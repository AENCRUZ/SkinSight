import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanCompleted,
  cleanMedications,
  cleanSubscription,
  dueReminders,
  localParts,
  pruneLastSent,
  timesFor,
} from '../src/services/reminderSchedule.js';

const TZ = 'Asia/Manila'; // UTC+8, no DST
const at = (iso) => new Date(iso); // ISO with +08:00 offset
const med = (over = {}) => ({ id: 'm1', name: 'Cream', schedule: 'once_daily', frequency: 'daily', time: '09:00', notes: '', created: '2026-11-20', ...over });

test('localParts converts to the user time zone', () => {
  assert.deepEqual(localParts(at('2026-11-23T09:05:00+08:00'), TZ), { dateKey: '2026-11-23', minutes: 545 });
});

test('timesFor follows the frontend schedule rules', () => {
  assert.deepEqual(timesFor(med(), '2026-11-23'), ['09:00']);
  assert.deepEqual(timesFor(med({ schedule: 'twice_daily' }), '2026-11-23'), ['09:00', '21:00']);
  assert.deepEqual(timesFor(med({ schedule: 'every_other_day' }), '2026-11-21'), []);
  assert.deepEqual(timesFor(med({ schedule: 'every_other_day' }), '2026-11-22'), ['09:00']);
  assert.deepEqual(timesFor(med({ frequency: 'weekly' }), '2026-11-26'), []);
  assert.deepEqual(timesFor(med({ frequency: 'weekly' }), '2026-11-27'), ['09:00']);
  assert.deepEqual(timesFor(med({ frequency: 'as_needed' }), '2026-11-23'), []);
  assert.deepEqual(timesFor(med(), '2026-11-19'), [], 'nothing before the medication was created');
});

test('a dose is due at its time and within the catch-up window, not before or long after', () => {
  const run = (iso, extra = {}) => dueReminders({ medications: [med()], timezone: TZ, now: at(iso), ...extra });
  assert.equal(run('2026-11-23T08:59:00+08:00').length, 0);
  assert.equal(run('2026-11-23T09:00:00+08:00')[0].slotId, 'm1|2026-11-23|09:00');
  assert.equal(run('2026-11-23T09:15:00+08:00').length, 1);
  assert.equal(run('2026-11-23T09:16:00+08:00').length, 0);
});

test('already sent or completed doses are skipped', () => {
  const now = at('2026-11-23T09:01:00+08:00');
  const slot = 'm1|2026-11-23|09:00';
  assert.equal(dueReminders({ medications: [med()], timezone: TZ, now, lastSent: { [slot]: 1 } }).length, 0);
  assert.equal(dueReminders({ medications: [med()], timezone: TZ, now, completed: [slot] }).length, 0);
});

test('a late-night dose is still caught just after midnight', () => {
  const due = dueReminders({ medications: [med({ time: '23:55' })], timezone: TZ, now: at('2026-11-24T00:05:00+08:00') });
  assert.equal(due.length, 1);
  assert.equal(due[0].slotId, 'm1|2026-11-23|23:55');
});

test('pruneLastSent keeps only the last few days', () => {
  const kept = pruneLastSent({ 'm1|2026-11-23|09:00': 1, 'm1|2026-11-10|09:00': 1 }, TZ, at('2026-11-23T10:00:00+08:00'));
  assert.deepEqual(Object.keys(kept), ['m1|2026-11-23|09:00']);
});

test('input cleaning rejects malformed data', () => {
  assert.equal(cleanSubscription({ endpoint: 'http://x.test/a', keys: { p256dh: 'a', auth: 'b' } }), null);
  assert.equal(cleanSubscription({ endpoint: 'https://x.test/a' }), null);
  assert.ok(cleanSubscription({ endpoint: 'https://x.test/a', keys: { p256dh: 'a', auth: 'b' } }));
  assert.deepEqual(cleanMedications([{ id: 'bad id!', name: 'x' }, { id: 'ok', name: '  ' }]), []);
  assert.equal(cleanMedications([med({ time: '25:00' })])[0].time, '09:00');
  assert.deepEqual(cleanCompleted(['m1|2026-11-23|09:00', 'junk', 5]), ['m1|2026-11-23|09:00']);
});
