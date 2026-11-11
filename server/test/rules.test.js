// Rule engine tests: npm test
const test = require('node:test');
const assert = require('node:assert');
const { toObjects, matches } = require('../engine/rules');
const invoices = require('../../mock-data/overdue-invoices.json');
const purchaseOrders = require('../../mock-data/late-purchase-orders.json');
const stock = require('../../mock-data/low-stock.json');

const pick = (data, rule, key) => toObjects(data).filter((r) => matches(r, rule)).map((r) => r[key]);

test('toObjects turns rows into objects', () => {
  assert.deepStrictEqual(toObjects(invoices)[0], {
    InvoiceNo: 'INV-101', CustomerName: 'ABC Traders', Email: 'abc@test.com', DaysOverdue: 10, Amount: 25000,
  });
});

test('payment reminder: DaysOverdue > 7', () => {
  assert.deepStrictEqual(pick(invoices, [{ column: 'DaysOverdue', op: '>', value: 7 }], 'InvoiceNo'),
    ['INV-101', 'INV-103', 'INV-105']);
});

test('empty rule matches every row', () => {
  assert.strictEqual(pick(invoices, [], 'InvoiceNo').length, 5);
});

test('conditions are joined with AND', () => {
  const rule = [{ column: 'DaysOverdue', op: '>', value: 7 }, { column: 'Amount', op: '>=', value: 10000 }];
  assert.deepStrictEqual(pick(invoices, rule, 'InvoiceNo'), ['INV-101', 'INV-103']);
});

test('value typed in a form as text still compares as a number', () => {
  assert.deepStrictEqual(pick(invoices, [{ column: 'DaysOverdue', op: '>', value: '7' }], 'InvoiceNo'),
    ['INV-101', 'INV-103', 'INV-105']);
});

test('all six operators', () => {
  const row = { n: 7 };
  const ok = (op, value) => matches(row, [{ column: 'n', op, value }]);
  assert.ok(ok('>', 6) && !ok('>', 7));
  assert.ok(ok('>=', 7) && !ok('>=', 8));
  assert.ok(ok('<', 8) && !ok('<', 7));
  assert.ok(ok('<=', 7) && !ok('<=', 6));
  assert.ok(ok('=', 7) && !ok('=', 8));
  assert.ok(ok('!=', 8) && !ok('!=', 7));
});

test('supplier follow-up: delivery date has passed (date text compare)', () => {
  assert.deepStrictEqual(pick(purchaseOrders, [{ column: 'DeliveryDate', op: '<', value: '2026-11-05' }], 'PONo'),
    ['PO-501', 'PO-503']);
});

test('low stock alert: Shortfall > 0', () => {
  assert.deepStrictEqual(pick(stock, [{ column: 'Shortfall', op: '>', value: 0 }], 'ItemCode'), ['ITM-01', 'ITM-03']);
});

test('text equality', () => {
  assert.deepStrictEqual(pick(stock, [{ column: 'Warehouse', op: '=', value: 'Kochi' }], 'ItemCode'), ['ITM-01', 'ITM-02']);
});

test('a column missing from the data never matches', () => {
  assert.strictEqual(pick(invoices, [{ column: 'NoSuchColumn', op: '>', value: 0 }], 'InvoiceNo').length, 0);
});

test('unknown operator throws a clear error', () => {
  assert.throws(() => matches({ n: 1 }, [{ column: 'n', op: '~', value: 1 }]), /Unknown rule operator/);
});
