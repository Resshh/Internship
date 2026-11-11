// Runs one job end to end (docs/PLAN.md section 1):
// runQuery -> rule filter -> recipients -> fill template -> dedupe -> send with retry -> log.
const path = require('path');
const { Job, Template, RecipientList, JobRun, DeliveryLog, SentHistory } = require('../models');
// The ONLY data source (NFR-07). At Batch 2 integration, change this one line.
const { runQuery } = require('./fakeConnector');
const { toObjects, matches } = require('./rules');
const { render } = require('./template');
const { sendMail } = require('./mailer');

const MAX_RETRIES = 3;
const TEST_RUN_ROWS = 5;

// 'Payment Reminder' -> 'payment-reminder'
const slug = (s) => String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// YYYY-MM-DD in the job's timezone, so "today" means today in Kochi, not in UTC.
const today = (timeZone = 'Asia/Kolkata') => new Date().toLocaleDateString('en-CA', { timeZone });

// jobName:recordId:date, e.g. 'payment-reminder:INV-101:2026-11-02' (FR-15)
const dedupeKey = (jobName, recordId, date) => `${slug(jobName)}:${recordId}:${date}`;

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const toHtml = (text) => escapeHtml(text).replace(/\r?\n/g, '<br>');

// Short, safe error text for logs: no stack, no credentials (BR-10).
const safeError = (err) => String(err?.message || err).replace(/\s+/g, ' ').slice(0, 200);

function toCsv(columns, objects) {
  const cell = (v) => (/[",\r\n]/.test(String(v ?? '')) ? `"${String(v).replace(/"/g, '""')}"` : String(v ?? ''));
  return [columns.map(cell).join(','), ...objects.map((o) => columns.map((c) => cell(o[c])).join(','))].join('\r\n') + '\r\n';
}

// Try once, then up to `retries` more times. Never throws (BR-09).
async function sendWithRetry(send, { retries = MAX_RETRIES, delayMs = 1000 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      await send();
      return { ok: true, retryCount: attempt };
    } catch (err) {
      lastError = err;
      if (attempt < retries && delayMs) await new Promise((r) => setTimeout(r, delayMs * (attempt + 1)));
    }
  }
  return { ok: false, retryCount: retries, error: safeError(lastError) };
}

function splitEmails(value) {
  return String(value ?? '').split(/[,;]/).map((s) => s.trim()).filter(Boolean);
}

// Everything a run needs, minus the sending. Used by both real runs and test runs.
async function prepare(job, { limit } = {}) {
  const template = job.templateId && await Template.findById(job.templateId);
  if (!template) throw new Error('Template not found');
  const list = job.recipients?.from === 'list' || job.mode === 'report'
    ? job.recipients?.listId && await RecipientList.findById(job.recipients.listId)
    : null;
  if ((job.recipients?.from === 'list' || job.mode === 'report') && !list) throw new Error('Recipient list not found');

  const data = await runQuery(job.queryId, limit ? { limit } : {});
  const rows = toObjects(data);
  const matched = rows.filter((row) => matches(row, job.rule || []));
  const cc = [...(job.recipients?.cc || []), ...(list?.cc || [])];
  const bcc = [...(job.recipients?.bcc || []), ...(list?.bcc || [])];
  const date = today(job.schedule?.timezone);

  const fill = (row) => {
    const subject = render(template.subject, row);
    const body = render(template.body, row);
    return { subject: subject.text, body: body.text, missing: [...new Set([...subject.missing, ...body.missing])] };
  };

  let emails;
  if (job.mode === 'report') {
    // One email to the list with the data attached (FR-19). Uses Batch 2's file if the job has one.
    const row = { JobName: job.name, Date: date, RowCount: matched.length };
    const attachment = job.attachmentPath
      ? { filename: path.basename(job.attachmentPath), path: path.resolve(__dirname, '../..', job.attachmentPath) }
      : { filename: `${slug(job.name)}-${date}.csv`, content: toCsv(data.columns, matched) };
    emails = matched.length
      ? [{ to: list.emails, cc, bcc, recordId: 'report', ...fill(row), attachments: [attachment] }]
      : [];
  } else {
    const idColumn = data.columns[0]; // first column is the record's ID: InvoiceNo, PONo, ItemCode
    emails = matched.map((row) => ({
      to: job.recipients?.from === 'list' ? list.emails : splitEmails(row[job.recipients?.column]),
      cc,
      bcc,
      recordId: row[idColumn],
      ...fill(row),
    }));
  }
  return { rowsFetched: rows.length, rowsMatched: matched.length, emails, date };
}

// Test run (FR-13): max 5 rows, sends nothing, writes nothing.
async function testRun(job) {
  const { rowsFetched, rowsMatched, emails } = await prepare(job, { limit: TEST_RUN_ROWS });
  const first = emails[0];
  return {
    rowsFetched,
    rowsMatched,
    emailsToSend: emails.filter((e) => e.to.length).length,
    noEmailAddress: emails.filter((e) => !e.to.length).length,
    preview: first && {
      to: first.to, cc: first.cc, bcc: first.bcc, subject: first.subject, body: first.body,
      missing: first.missing, attachment: first.attachments?.[0]?.filename,
    },
  };
}

async function deliver(job, run, email, date, retryOptions) {
  const recipient = email.to.join(', ');
  const log = (status, extra = {}) => DeliveryLog.create({ runId: run._id, recipient, subject: email.subject, status, ...extra });

  if (!email.to.length) {
    run.failed++;
    return log('failed', { errorMessage: 'No email address' });
  }

  // Claim the key first: the unique index makes the DATABASE refuse a second send, even for overlapping runs.
  const key = dedupeKey(job.name, email.recordId, date);
  try {
    await SentHistory.create({ jobId: job._id, dedupeKey: key, recipient });
  } catch (err) {
    if (err.code !== 11000) throw err;
    run.skippedDuplicates++;
    return log('skipped', { errorMessage: 'Already sent today' });
  }

  const result = await sendWithRetry(() => sendMail({
    to: email.to, cc: email.cc, bcc: email.bcc, subject: email.subject, html: toHtml(email.body), attachments: email.attachments,
  }), retryOptions);

  if (result.ok) {
    run.emailsSent++;
    return log('sent', { retryCount: result.retryCount });
  }
  // Free the key so the next run can try this email again.
  await SentHistory.deleteOne({ dedupeKey: key });
  run.failed++;
  return log('failed', { retryCount: result.retryCount, errorMessage: result.error });
}

async function runJob(jobId, { manual = false, testRun: isTestRun = false, retryOptions } = {}) {
  const job = await Job.findById(jobId);
  if (!job) throw Object.assign(new Error('Job not found'), { status: 404 });
  if (isTestRun) return testRun(job);

  const run = await JobRun.create({ jobId: job._id, manual });
  try {
    const { rowsFetched, rowsMatched, emails, date } = await prepare(job);
    Object.assign(run, { rowsFetched, rowsMatched });
    // One at a time: one bad email never stops the rest.
    for (const email of emails) await deliver(job, run, email, date, retryOptions);
    run.status = run.failed ? 'failed' : 'success';
  } catch (err) {
    run.status = 'failed';
    run.error = safeError(err);
  }
  run.endTime = new Date();
  await run.save();
  return run;
}

module.exports = { runJob, sendWithRetry, dedupeKey, slug, toCsv, splitEmails };
