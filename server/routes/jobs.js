// Jobs API (FR-03, FR-04, FR-05, FR-13, BR-03). Reads: any logged-in user. Writes: admins only.
const router = require('express').Router();
const mongoose = require('mongoose');
const { Job, JobRun } = require('../models');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { toCron, describe, reloadJob } = require('../engine/scheduler');
const { runJob } = require('../engine/runner');

const bad = (message, status = 400) => Object.assign(new Error(message), { status });
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function readInput(body = {}) {
  const input = {};
  for (const f of ['name', 'queryId', 'mode', 'rule', 'schedule', 'recipients', 'templateId']) {
    if (Object.hasOwn(body, f)) input[f] = body[f] === '' ? null : body[f];
  }
  if (typeof input.name === 'string') input.name = input.name.trim();
  if (Array.isArray(input.rule)) input.rule = input.rule.filter((c) => c && c.column);
  if (input.recipients) {
    const r = { ...input.recipients };
    if (!r.listId) r.listId = null;
    for (const f of ['cc', 'bcc']) {
      r[f] = (Array.isArray(r[f]) ? r[f] : []).map((e) => String(e).trim()).filter(Boolean);
      const badEmail = r[f].find((e) => !EMAIL.test(e));
      if (badEmail) throw bad(`Invalid ${f.toUpperCase()} email address: ${badEmail}`);
    }
    input.recipients = r;
  }
  return input;
}


// Why the job can't be enabled, or null when it's complete (BR-03).
function missingForEnable(job) {
  if (!job.queryId) return 'Choose a saved query';
  try { toCron(job.schedule); } catch (err) { return `Schedule: ${err.message}`; }
  const r = job.recipients || {};
  if (job.mode === 'report' && !r.listId) return 'Report jobs need a recipient list';
  if (r.from === 'list' ? !r.listId : !r.column) return 'Choose the recipients';
  if (!job.templateId) return 'Choose a template';
  return null;
}

async function findJob(id) {
  if (!mongoose.isValidObjectId(id)) throw bad('Invalid job ID');
  const job = await Job.findById(id);
  if (!job) throw bad('Job not found', 404);
  return job;
}

async function save(job) {
  if (job.enabled) {
    const why = missingForEnable(job);
    if (why) throw bad(`Cannot enable the job: ${why}`);
  }
  try {
    await job.save();
  } catch (err) {
    if (err.name === 'ValidationError' || err.name === 'CastError') throw bad(err.message);
    throw err;
  }
  reloadJob(job);
  return job;
}

router.get('/', requireAuth, async (req, res) => {
  const jobs = await Job.find().sort({ name: 1 }).populate('queryId', 'name connection').populate('templateId', 'name').lean();
  const lastRuns = await JobRun.aggregate([
    { $sort: { startTime: -1 } },
    { $group: { _id: '$jobId', startTime: { $first: '$startTime' }, status: { $first: '$status' } } },
  ]);
  const last = Object.fromEntries(lastRuns.map((r) => [String(r._id), r]));
  res.json({
    jobs: jobs.map((j) => ({
      ...j,
      queryName: j.queryId?.name,
      connection: j.queryId?.connection,
      queryId: j.queryId?._id,
      templateName: j.templateId?.name,
      templateId: j.templateId?._id,
      scheduleText: describe(j.schedule),
      lastRun: last[String(j._id)] || null,
    })),
  });
});

router.get('/:id', requireAdmin, async (req, res) => {
  res.json({ job: await findJob(req.params.id) });
});

router.post('/', requireAdmin, async (req, res) => {
  const input = readInput(req.body);
  if (!input.name) throw bad('Job name is required');
  if (!input.queryId) throw bad('Choose a saved query');
  const job = await save(new Job({ ...input, enabled: false }));
  res.status(201).json({ job });
});

router.put('/:id', requireAdmin, async (req, res) => {
  const job = await findJob(req.params.id);
  const input = readInput(req.body);
  if (Object.hasOwn(input, 'name') && !input.name) throw bad('Job name is required');
  job.set(input);
  res.json({ job: await save(job) });
});

router.patch('/:id/enabled', requireAdmin, async (req, res) => {
  const job = await findJob(req.params.id);
  job.enabled = req.body?.enabled === true;
  res.json({ job: await save(job) });
});

router.delete('/:id', requireAdmin, async (req, res) => {
  const job = await findJob(req.params.id);
  await job.deleteOne();
  reloadJob({ _id: job._id, enabled: false });
  res.json({ message: 'Job deleted' });
});

// Run now (FR-04): runs immediately, tagged manual in history.
router.post('/:id/run', requireAdmin, async (req, res) => {
  const job = await findJob(req.params.id);
  res.json({ run: await runJob(job._id, { manual: true }) });
});

// Test run (FR-13): 5 rows max, sends nothing, writes no history.
router.post('/:id/test-run', requireAdmin, async (req, res) => {
  const job = await findJob(req.params.id);
  try {
    res.json(await runJob(job._id, { testRun: true }));
  } catch (err) {
    throw err.status ? err : bad(err.message);
  }
});

module.exports = router;
module.exports.missingForEnable = missingForEnable;
