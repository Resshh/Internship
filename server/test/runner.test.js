// Pure parts of the runner. The full run (DB + SMTP) is checked with Run now, see README.
const test = require('node:test');
const assert = require('node:assert');
const { sendWithRetry, dedupeKey, toCsv, splitEmails } = require('../engine/runner');
const { applyTestMode } = require('../engine/mailer');

test('dedupe key is jobName:recordId:date', () => {
  assert.strictEqual(dedupeKey('Payment Reminder', 'INV-101', '2026-11-02'), 'payment-reminder:INV-101:2026-11-02');
});

test('retry: succeeds on a later attempt', async () => {
  let calls = 0;
  const result = await sendWithRetry(async () => { if (++calls < 3) throw new Error('busy'); }, { delayMs: 0 });
  assert.deepStrictEqual(result, { ok: true, retryCount: 2 });
});

test('retry: gives up after 3 retries, never throws', async () => {
  let calls = 0;
  const result = await sendWithRetry(async () => { calls++; throw new Error('connect ECONNREFUSED'); }, { delayMs: 0 });
  assert.strictEqual(calls, 4); // first try + 3 retries
  assert.deepStrictEqual(result, { ok: false, retryCount: 3, error: 'connect ECONNREFUSED' });
});

test('test mode sends everything to TEST_EMAIL only', () => {
  process.env.TEST_MODE = 'true';
  process.env.TEST_EMAIL = 'team-inbox@test.com';
  assert.deepStrictEqual(applyTestMode({ to: ['abc@test.com'], cc: ['x@test.com'], bcc: ['y@test.com'] }),
    { to: 'team-inbox@test.com', cc: undefined, bcc: undefined });
});

test('test mode is on unless explicitly false', () => {
  delete process.env.TEST_MODE;
  assert.strictEqual(applyTestMode({ to: ['abc@test.com'] }).to, process.env.TEST_EMAIL);
  process.env.TEST_MODE = 'false';
  assert.deepStrictEqual(applyTestMode({ to: ['abc@test.com'] }).to, ['abc@test.com']);
  process.env.TEST_MODE = 'true';
});

test('CSV report quotes commas and quotes', () => {
  assert.strictEqual(toCsv(['A', 'B'], [{ A: 'x,y', B: 'say "hi"' }]), 'A,B\r\n"x,y","say ""hi"""\r\n');
});

test('email column may hold several addresses; empty means none', () => {
  assert.deepStrictEqual(splitEmails('a@test.com; b@test.com'), ['a@test.com', 'b@test.com']);
  assert.deepStrictEqual(splitEmails(''), []);
  assert.deepStrictEqual(splitEmails(undefined), []);
});
