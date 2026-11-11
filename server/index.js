// Server entry point: load .env, connect MongoDB, mount routes, start listening.
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const { startScheduler } = require('./engine/scheduler');

const app = express();
app.use(express.json());

// Test mode is ON unless .env says exactly TEST_MODE=false (same rule as the mailer).
app.get('/api/health', (req, res) => res.json({ ok: true, testMode: process.env.TEST_MODE !== 'false' }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/recipient-lists', require('./routes/recipientLists'));
app.use('/api/templates', require('./routes/TemplateRoutes'));
app.use('/api/queries', require('./routes/queries'));
app.use('/api/jobs', require('./routes/jobs'));
app.use('/api/runs', require('./routes/runs'));

// Any error thrown in a route ends up here. Log it on the server, send a safe message to the browser.
app.use((err, req, res, next) => {
  if (!err.status) console.error(err);
  res.status(err.status || 500).json({ error: err.status ? err.message : 'Something went wrong' });
});

mongoose.connect(process.env.MONGO_URI).then(async () => {
  await startScheduler();
  const port = process.env.PORT || 5000;
  app.listen(port, () => console.log(`API on http://localhost:${port}`));
});
