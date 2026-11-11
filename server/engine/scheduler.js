// Runs enabled jobs on their schedule (FR-07, FR-08, BR-02, NFR-10).
// The job form stores friendly fields; toCron() turns them into a 5-field cron expression.
const cron = require('node-cron');

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function invalid(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

function parseTime(time) {
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(String(time || ''));
  if (!m) throw invalid('Schedule time must be HH:mm, e.g. 19:00');
  return { hour: Number(m[1]), minute: Number(m[2]) };
}

function toCron(schedule = {}) {
  const { frequency, everyMinutes, time, days, dayOfMonth } = schedule || {};
  if (frequency === 'minutes') {
    const n = Number(everyMinutes);
    if (!Number.isInteger(n) || n < 1 || n > 59) throw invalid('Every X minutes must be a whole number from 1 to 59');
    return `*/${n} * * * *`;
  }
  if (!['daily', 'weekly', 'monthly'].includes(frequency)) throw invalid('Choose a schedule frequency');
  const { hour, minute } = parseTime(time);
  if (frequency === 'daily') return `${minute} ${hour} * * *`;
  if (frequency === 'weekly') {
    const list = [...new Set((days || []).map(Number))].sort();
    if (!list.length || list.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) throw invalid('Pick at least one weekday');
    return `${minute} ${hour} * * ${list.join(',')}`;
  }
  const d = Number(dayOfMonth);
  if (!Number.isInteger(d) || d < 1 || d > 31) throw invalid('Day of month must be from 1 to 31');
  return `${minute} ${hour} ${d} * *`;
}

// Human summary, e.g. "every Thursday at 10:00 IST". Returns '' for an incomplete schedule.
function describe(schedule = {}) {
  try {
    toCron(schedule);
  } catch {
    return '';
  }
  const { frequency, everyMinutes, time, days, dayOfMonth, timezone = 'Asia/Kolkata' } = schedule;
  if (frequency === 'minutes') return Number(everyMinutes) === 1 ? 'every minute' : `every ${everyMinutes} minutes`;
  const at = `at ${time} ${timezone === 'Asia/Kolkata' ? 'IST' : timezone}`;
  if (frequency === 'daily') return `every day ${at}`;
  if (frequency === 'weekly') return `every ${[...new Set(days.map(Number))].sort().map((d) => DAY_NAMES[d]).join(', ')} ${at}`;
  return `on day ${dayOfMonth} of every month ${at}`;
}

// ---- Live scheduling ----
const tasks = new Map(); // jobId -> node-cron task

// Call after every create / edit / enable / disable / delete. A disabled or deleted job is just unregistered.
function reloadJob(job) {
  const id = String(job._id);
  tasks.get(id)?.destroy();
  tasks.delete(id);
  if (!job.enabled) return;
  try {
    const task = cron.schedule(toCron(job.schedule), () => {
      // Required here, not at the top, to avoid a load-order loop with runner.js.
      require('./runner').runJob(id).catch((err) => console.error(`Scheduled run of job ${id} failed:`, err.message));
    }, { timezone: job.schedule?.timezone || 'Asia/Kolkata', noOverlap: true, name: `job-${id}` });
    tasks.set(id, task);
  } catch (err) {
    console.error(`Job ${id} not scheduled: ${err.message}`);
  }
}

async function startScheduler() {
  const { Job } = require('../models');
  const jobs = await Job.find({ enabled: true });
  jobs.forEach(reloadJob);
  console.log(`Scheduler: ${tasks.size} enabled job(s) registered`);
}

module.exports = { toCron, describe, reloadJob, startScheduler, scheduledCount: () => tasks.size };
