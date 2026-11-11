// Saved queries (Batch 2 owns them; we only read them to fill the job form).
const router = require('express').Router();
const mongoose = require('mongoose');
const { Query } = require('../models');
const { requireAuth } = require('../middleware/auth');
const { runQuery } = require('../engine/fakeConnector');
const { toObjects } = require('../engine/rules');

router.get('/', requireAuth, async (req, res) => {
  res.json({ queries: await Query.find().sort({ name: 1 }).lean() });
});

// Columns + up to 5 sample rows: feeds the rule column dropdown and the template placeholder list / preview.
router.get('/:id/sample', requireAuth, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid query ID' });
  try {
    const data = await runQuery(req.params.id, { limit: 5 });
    res.json({ columns: data.columns, rows: toObjects(data) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
