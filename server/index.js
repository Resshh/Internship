// Server entry point: load .env, connect MongoDB, mount routes, start listening.
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');

const app = express();
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true, testMode: process.env.TEST_MODE === 'true' }));
app.use('/api/auth', require('./routes/auth'));
// Add one line per route file as features land, e.g.:
// app.use('/api/jobs', require('./routes/jobs'));

// Any error thrown in a route ends up here. Log it on the server, send a safe message to the browser.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.status ? err.message : 'Something went wrong' });
});

mongoose.connect(process.env.MONGO_URI).then(() => {
  const port = process.env.PORT || 5000;
  app.listen(port, () => console.log(`API on http://localhost:${port}`));
});
