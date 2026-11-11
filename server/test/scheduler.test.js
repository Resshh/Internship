const test = require('node:test');
const assert = require('node:assert');
const { toCron, describe: summary, reloadJob, scheduledCount } = require('../engine/scheduler');

test('every X minutes', () => {
  assert.strictEqual(toCron({ frequency: 'minutes', everyMinutes: 15 }), '*/15 * * * *');
  assert.strictEqual(summary({ frequency: 'minutes', everyMinutes: 15 }), 'every 15 minutes');
});

test('daily', () => {
  assert.strictEqual(toCron({ frequency: 'daily', time: '19:00' }), '0 19 * * *');
  assert.strictEqual(summary({ frequency: 'daily', time: '19:00' }), 'every day at 19:00 IST');
});

test('weekly', () => {
  assert.strictEqual(toCron({ frequency: 'weekly', time: '09:30', days: [4, 1] }), '30 9 * * 1,4');
  assert.strictEqual(summary({ frequency: 'weekly', time: '10:00', days: [4] }), 'every Thursday at 10:00 IST');
});

test('monthly', () => {
  assert.strictEqual(toCron({ frequency: 'monthly', time: '08:05', dayOfMonth: 1 }), '5 8 1 * *');
});

test('invalid input throws a clear 400 error', () => {
  for (const bad of [
    {}, { frequency: 'yearly' }, { frequency: 'minutes', everyMinutes: 0 }, { frequency: 'minutes', everyMinutes: 60 },
    { frequency: 'daily', time: '25:00' }, { frequency: 'daily' }, { frequency: 'weekly', time: '09:00', days: [] },
    { frequency: 'weekly', time: '09:00', days: [7] }, { frequency: 'monthly', time: '09:00', dayOfMonth: 32 },
  ]) {
    assert.throws(() => toCron(bad), (err) => err.status === 400, JSON.stringify(bad));
  }
  assert.strictEqual(summary({ frequency: 'daily' }), '');
});

test('reloadJob registers enabled jobs and removes disabled ones', () => {
  const job = { _id: 'abc', enabled: true, schedule: { frequency: 'minutes', everyMinutes: 5 } };
  reloadJob(job);
  assert.strictEqual(scheduledCount(), 1);
  reloadJob(job); // re-register replaces, never doubles
  assert.strictEqual(scheduledCount(), 1);
  reloadJob({ ...job, enabled: false });
  assert.strictEqual(scheduledCount(), 0);
});
