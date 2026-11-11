// Run history (FR-17, FR-18). Any logged-in user can read.
const router = require('express').Router();
const mongoose = require('mongoose');
const { JobRun, DeliveryLog } = require('../models');
const { requireAuth } = require('../middleware/auth');

// GET /api/runs?job=<id>&status=success|failed|running&from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/', requireAuth, async (req, res) => {
  const { job, status, from, to } = req.query;
  const filter = {};
  if (job) {
    if (!mongoose.isValidObjectId(job)) return res.status(400).json({ error: 'Invalid job ID' });
    filter.jobId = job;
  }
  if (status) filter.status = String(status);
  const start = from && new Date(`${from}T00:00:00`);
  const end = to && new Date(`${to}T23:59:59.999`);
  if ((start && isNaN(start)) || (end && isNaN(end))) return res.status(400).json({ error: 'Dates must be YYYY-MM-DD' });
  if (start || end) filter.startTime = { ...(start && { $gte: start }), ...(end && { $lte: end }) };

  // ponytail: capped at 200 newest runs, add paging when history outgrows it
  const runs = await JobRun.find(filter).sort({ startTime: -1 }).limit(200).populate('jobId', 'name').lean();
  res.json({ runs: runs.map((r) => ({ ...r, jobName: r.jobId?.name || '(deleted job)', jobId: r.jobId?._id || r.jobId })) });
});

router.get('/:id/logs', requireAuth, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid run ID' });
  res.json({ logs: await DeliveryLog.find({ runId: req.params.id }).sort({ createdAt: 1 }).lean() });
});

module.exports = router;
