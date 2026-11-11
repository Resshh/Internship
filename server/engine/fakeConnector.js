const path = require('path');

// queryId -> mock file. These IDs are the ones seed.js puts in the queries collection.
const FILES = {
  '000000000000000000000001': 'overdue-invoices.json',
  '000000000000000000000002': 'late-purchase-orders.json',
  '000000000000000000000003': 'low-stock.json',
  '000000000000000000000004': 'daily-sales.json',
  '000000000000000000000005': 'receivables.json',
};

async function runQuery(queryId, params = {}) {
  const file = FILES[String(queryId)];
  if (!file) throw new Error(`Unknown queryId ${queryId}`);
  const data = require(path.join(__dirname, '../../mock-data', file));
  const rows = params.limit ? data.rows.slice(0, params.limit) : data.rows; // Test run uses a small limit
  return { columns: data.columns, rows, meta: { source: 'Fake', rowCount: rows.length } };
}

module.exports = { runQuery };
