// Fills an empty database with login users and the 5 saved queries.
// Run: npm run seed   (safe to run again - it updates instead of duplicating)
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { User, Query } = require('./models');

const users = [
  { name: 'Admin User', email: 'admin@test.com', role: 'admin' },
  { name: 'Normal User', email: 'user@test.com', role: 'user' },
];
// _ids match FILES in engine/fakeConnector.js
const queries = [
  ['000000000000000000000001', 'Overdue invoices', 'Sales SQL Server'],
  ['000000000000000000000002', 'Late purchase orders', 'SAP HANA'],
  ['000000000000000000000003', 'Low stock items', 'SAP Service Layer'],
  ['000000000000000000000004', 'Daily sales', 'Sales SQL Server'],
  ['000000000000000000000005', 'Receivables ageing', 'SAP HANA'],
];

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const passwordHash = await bcrypt.hash(process.env.SEED_PASSWORD || 'Test@123', 10);
  for (const u of users) await User.updateOne({ email: u.email }, { ...u, passwordHash }, { upsert: true });
  for (const [_id, name, connection] of queries) await Query.updateOne({ _id }, { name, connection }, { upsert: true });
  console.log('Seeded: admin@test.com / user@test.com, 5 queries');
  await mongoose.disconnect();
})();
