// All database collections in one place. This file IS the shared database contract
// (Common Guide section 7). Change a field here = tell the team in stand-up.
const { Schema, model } = require('mongoose');
const { ObjectId } = Schema.Types;

// ---- Owned by Batch 1 (us) ----

const User = model('User', new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['admin', 'user'], default: 'user' },
}, { timestamps: true }), 'users');

const Job = model('Job', new Schema({
  name: { type: String, required: true },
  queryId: { type: ObjectId, ref: 'Query', required: true }, // only the ID, never the SQL (FR-05)
  mode: { type: String, enum: ['message', 'report'], default: 'message' },
  // AND of all conditions, e.g. [{ column: 'DaysOverdue', op: '>', value: 7 }] (FR-06)
  rule: [{ column: String, op: { type: String, enum: ['>', '>=', '<', '<=', '=', '!='] }, value: Schema.Types.Mixed }],
  schedule: { // turned into a cron expression by the scheduler (FR-07)
    frequency: { type: String, enum: ['minutes', 'daily', 'weekly', 'monthly'] },
    everyMinutes: Number, // frequency = minutes
    time: String,         // 'HH:mm' for daily / weekly / monthly
    days: [Number],       // weekly: 0 = Sun ... 6 = Sat
    dayOfMonth: Number,   // monthly: 1-31
    timezone: { type: String, default: 'Asia/Kolkata' },
  },
  recipients: { // FR-09
    from: { type: String, enum: ['column', 'list'], default: 'column' },
    column: String,                          // from = column, e.g. 'Email'
    listId: { type: ObjectId, ref: 'RecipientList' }, // from = list
    cc: [String],
    bcc: [String],
  },
  templateId: { type: ObjectId, ref: 'Template' },
  attachmentPath: String, // report mode: file from Batch 2's buildReport (FR-19)
  enabled: { type: Boolean, default: false },
}, { timestamps: true }), 'jobs');

const Template = model('Template', new Schema({
  name: { type: String, required: true, unique: true },
  subject: { type: String, required: true }, // may contain {{placeholders}}
  body: { type: String, required: true },
}, { timestamps: true }), 'templates');

const RecipientList = model('RecipientList', new Schema({
  name: { type: String, required: true, unique: true }, // e.g. 'Finance Team'
  emails: [String], // To
  cc: [String],
  bcc: [String],
}, { timestamps: true }), 'recipient_lists');

const JobRun = model('JobRun', new Schema({
  jobId: { type: ObjectId, ref: 'Job', required: true },
  manual: { type: Boolean, default: false }, // true = "Run now", shown as a tag in history
  startTime: { type: Date, default: Date.now },
  endTime: Date,
  rowsFetched: { type: Number, default: 0 },
  rowsMatched: { type: Number, default: 0 },
  emailsSent: { type: Number, default: 0 },
  skippedDuplicates: { type: Number, default: 0 }, // not failures (BR-06)
  failed: { type: Number, default: 0 },
  status: { type: String, enum: ['running', 'success', 'failed'], default: 'running' },
  error: String, // safe message only, no passwords or customer data (BR-10)
}), 'job_runs');

const DeliveryLog = model('DeliveryLog', new Schema({
  runId: { type: ObjectId, ref: 'JobRun', required: true },
  recipient: String,
  subject: String,
  status: { type: String, enum: ['sent', 'failed', 'skipped'] },
  retryCount: { type: Number, default: 0 },
  errorMessage: String,
}, { timestamps: true }), 'delivery_logs');

const SentHistory = model('SentHistory', new Schema({
  jobId: { type: ObjectId, ref: 'Job', required: true },
  // job:record:date, e.g. 'payment-reminder:INV-101:2026-10-28'.
  // unique = the database itself refuses a duplicate send (FR-15).
  dedupeKey: { type: String, required: true, unique: true },
  recipient: String,
  sentAt: { type: Date, default: Date.now },
}), 'sent_history');

// ---- Owned by Batch 2 (we only READ these to fill the job form dropdowns) ----
// Minimal shape so our dropdowns work with seed data. Batch 2's real model replaces it.
const Query = model('Query', new Schema({
  name: String,       // e.g. 'Overdue invoices'
  connection: String, // e.g. 'Sales SQL Server'
}), 'queries');

module.exports = { User, Job, Template, RecipientList, JobRun, DeliveryLog, SentHistory, Query };
