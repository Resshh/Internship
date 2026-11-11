const test = require('node:test');
const assert = require('node:assert');
const { render } = require('../engine/template');

test('fills placeholders from the row', () => {
  assert.deepStrictEqual(render('Invoice {{InvoiceNo}}: Rs {{Amount}}', { InvoiceNo: 'INV-101', Amount: 25000 }),
    { text: 'Invoice INV-101: Rs 25000', missing: [] });
});

test('missing value is left empty and listed', () => {
  assert.deepStrictEqual(render('Hi {{CustomerName}}, due {{DueDate}}', { CustomerName: 'ABC' }),
    { text: 'Hi ABC, due ', missing: ['DueDate'] });
});

test('empty and null templates', () => {
  assert.deepStrictEqual(render('', {}), { text: '', missing: [] });
  assert.deepStrictEqual(render(null, {}), { text: '', missing: [] });
});

test('broken syntax never throws', () => {
  assert.strictEqual(render('Hello {{#if', {}).text, 'Hello {{#if');
});

test('values are not HTML-escaped', () => {
  assert.strictEqual(render('{{Name}}', { Name: 'A & B' }).text, 'A & B');
});
