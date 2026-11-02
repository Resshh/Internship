// Run all tests: npm test   (uses Node's built-in test runner, no extra library)
// Copy this file's pattern for your own module: test/<module>.test.js
const test = require('node:test');
const assert = require('node:assert');
const jwt = require('jsonwebtoken');
const { requireAdmin } = require('../middleware/auth');

process.env.JWT_SECRET = 'test-secret';

function call(role) {
  const token = role ? jwt.sign({ role }, 'test-secret') : 'bad';
  const req = { headers: { authorization: 'Bearer ' + token } };
  let status = 200;
  const res = { status(s) { status = s; return this; }, json() {} };
  requireAdmin(req, res, () => {});
  return status;
}

test('admin can open admin routes', () => assert.equal(call('admin'), 200));
test('normal user is blocked from admin routes (403)', () => assert.equal(call('user'), 403));
test('missing or bad token is rejected (401)', () => assert.equal(call(null), 401));
