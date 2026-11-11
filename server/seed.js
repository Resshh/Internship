// Fills the database with login users, the 5 saved queries and the 5 demo workflows (FR-20, FR-21).
// Run: npm run seed   (safe to run again - it updates by name instead of duplicating)
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { User, Query, Template, RecipientList, Job } = require('./models');

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

const lists = [
  { name: 'Finance Team', emails: ['finance@test.com'], cc: ['accounts.head@test.com'], bcc: [] },
  { name: 'Sales Management', emails: ['sales.head@test.com', 'sales.manager@test.com'], cc: [], bcc: [] },
  { name: 'Purchase Team', emails: ['purchase@test.com'], cc: [], bcc: [] },
  { name: 'Store Managers', emails: ['kochi.store@test.com', 'tvm.store@test.com'], cc: [], bcc: [] },
];

const templates = [
  {
    name: 'Payment Reminder',
    subject: 'Payment reminder: invoice {{InvoiceNo}} is {{DaysOverdue}} days overdue',
    body: 'Dear {{CustomerName}},\n\nOur records show that invoice {{InvoiceNo}} for Rs {{Amount}} is {{DaysOverdue}} days overdue.\nPlease arrange payment at the earliest.\n\nRegards,\nFinance Team',
  },
  {
    name: 'PO Follow-up',
    subject: 'Follow-up: purchase order {{PONo}} is {{DaysLate}} days late',
    body: 'Dear {{SupplierName}},\n\nPurchase order {{PONo}} ({{Item}}) was due on {{DeliveryDate}} and is now {{DaysLate}} days late.\nPlease confirm the new delivery date.\n\nRegards,\nPurchase Team',
  },
  {
    name: 'Low Stock Alert',
    subject: 'Low stock: {{ItemName}} at {{Warehouse}}',
    body: 'Hello,\n\n{{ItemName}} ({{ItemCode}}) at {{Warehouse}} has {{Quantity}} units left, below the reorder level of {{ReorderLevel}}.\nShortfall: {{Shortfall}} units. Please raise a purchase request.\n\nNotification Engine',
  },
  {
    name: 'Daily Sales Report',
    subject: 'Daily sales report - {{Date}}',
    body: 'Hello,\n\nPlease find attached the daily sales report for {{Date}} ({{RowCount}} rows).\n\nNotification Engine',
  },
  {
    name: 'Weekly Receivables Report',
    subject: 'Weekly receivables ageing - {{Date}}',
    body: 'Hello,\n\nPlease find attached the receivables ageing report ({{RowCount}} customers) as of {{Date}}.\n\nNotification Engine',
  },
];

const daily = (time) => ({ frequency: 'daily', time, timezone: 'Asia/Kolkata' });
const jobs = [
  { name: 'Payment Reminder', query: 1, template: 'Payment Reminder', mode: 'message',
    rule: [{ column: 'DaysOverdue', op: '>', value: 7 }], schedule: daily('10:00'),
    recipients: { from: 'column', column: 'Email', cc: [], bcc: [] } },
  { name: 'PO Follow-up', query: 2, template: 'PO Follow-up', mode: 'message',
    rule: [{ column: 'DaysLate', op: '>', value: 0 }], schedule: daily('10:30'),
    recipients: { from: 'column', column: 'Email', cc: ['purchase@test.com'], bcc: [] } },
  { name: 'Low Stock Alert', query: 3, template: 'Low Stock Alert', mode: 'message',
    rule: [{ column: 'Shortfall', op: '>', value: 0 }], schedule: daily('08:00'),
    recipients: { from: 'column', column: 'StoreEmail', cc: [], bcc: [] } },
  { name: 'Daily Sales Report', query: 4, template: 'Daily Sales Report', mode: 'report',
    rule: [], schedule: daily('19:00'), recipients: { from: 'list', list: 'Sales Management', cc: [], bcc: [] } },
  { name: 'Weekly Receivables Report', query: 5, template: 'Weekly Receivables Report', mode: 'report',
    rule: [], schedule: { frequency: 'weekly', time: '09:00', days: [1], timezone: 'Asia/Kolkata' },
    recipients: { from: 'list', list: 'Finance Team', cc: [], bcc: [] } },
];

const upsert = (Model, filter, doc) => Model.findOneAndUpdate(filter, doc, { upsert: true, returnDocument: 'after', runValidators: true });

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const passwordHash = await bcrypt.hash(process.env.SEED_PASSWORD || 'Test@123', 10);
  for (const u of users) await User.updateOne({ email: u.email }, { ...u, passwordHash }, { upsert: true });
  for (const [_id, name, connection] of queries) await Query.updateOne({ _id }, { name, connection }, { upsert: true });

  const listIds = {};
  for (const l of lists) listIds[l.name] = (await upsert(RecipientList, { name: l.name }, l))._id;
  const templateIds = {};
  for (const t of templates) templateIds[t.name] = (await upsert(Template, { name: t.name }, t))._id;

  for (const { query, template, recipients: { list, ...recipients }, ...job } of jobs) {
    await upsert(Job, { name: job.name }, {
      ...job,
      queryId: queries[query - 1][0],
      templateId: templateIds[template],
      recipients: { ...recipients, listId: list ? listIds[list] : undefined },
      enabled: true,
    });
  }
  console.log('Seeded: admin@test.com / user@test.com, 5 queries, 4 recipient lists, 5 templates, 5 jobs');
  await mongoose.disconnect();
})();
