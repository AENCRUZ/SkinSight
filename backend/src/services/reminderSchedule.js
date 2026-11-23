/**
 * Pure scheduling logic for medication push reminders (no I/O, easy to unit test).
 *
 * Mirrors the schedule model in frontend/js/medication-store.js:
 *   schedule:  once_daily | twice_daily | every_other_day
 *   frequency: daily | weekly | as_needed   (as_needed is never scheduled, so never reminded)
 *   twice_daily adds a second dose 12 hours after `time`.
 *   every_other_day / weekly count days from the date the medication was created.
 */

export const SCHEDULES = ['once_daily', 'twice_daily', 'every_other_day'];
export const FREQUENCIES = ['daily', 'weekly', 'as_needed'];
export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const SLOT_RE = /^[A-Za-z0-9_-]{1,40}\|\d{4}-\d{2}-\d{2}\|([01]\d|2[0-3]):[0-5]\d$/;
export const LIMITS = { meds: 30, name: 80, notes: 300, completed: 300 };

/** Default catch-up window: a reminder is still sent if the check runs up to this many minutes late. */
export const CATCH_UP_MINUTES = 15;

function pad(n) {
  return n < 10 ? '0' + n : '' + n;
}

export function isValidTimeZone(tz) {
  if (typeof tz !== 'string' || !tz || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Calendar date ("YYYY-MM-DD") and minutes since midnight for `date` in time zone `tz`. */
export function localParts(date, tz) {
  const parts = {};
  new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
    .formatToParts(date)
    .forEach((p) => {
      parts[p.type] = p.value;
    });
  return {
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

function dayNumber(key) {
  const [y, m, d] = key.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
}

export function addDays(key, delta) {
  const n = dayNumber(key) + delta;
  const dt = new Date(n * 86400000);
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/** Dose times ("HH:MM") a medication has on calendar day `key`. */
export function timesFor(med, key) {
  if (!med || med.frequency === 'as_needed') return [];
  const diff = dayNumber(key) - dayNumber(med.created);
  if (diff < 0) return [];
  if (med.frequency === 'weekly' && diff % 7 !== 0) return [];
  if (med.schedule === 'every_other_day' && diff % 2 !== 0) return [];
  const out = [med.time];
  if (med.schedule === 'twice_daily') {
    const [h, m] = med.time.split(':');
    out.push(`${pad((Number(h) + 12) % 24)}:${m}`);
  }
  return out;
}

function toMinutes(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Reminders that are due now and have not been sent or marked completed.
 * Looks at today and yesterday so a dose at 23:55 is still caught by a check at 00:05.
 *
 * @returns {Array<{ slotId: string, med: object, date: string, time: string }>}
 */
export function dueReminders({ medications, completed = [], lastSent = {}, timezone, now = new Date(), windowMinutes = CATCH_UP_MINUTES }) {
  const tz = isValidTimeZone(timezone) ? timezone : 'UTC';
  const { dateKey: today, minutes: nowMin } = localParts(now, tz);
  const done = new Set(completed);
  const out = [];

  for (const [key, offset] of [[today, 0], [addDays(today, -1), 1440]]) {
    for (const med of medications || []) {
      for (const time of timesFor(med, key)) {
        const late = nowMin + offset - toMinutes(time);
        if (late < 0 || late > windowMinutes) continue;
        const slotId = `${med.id}|${key}|${time}`;
        if (done.has(slotId) || lastSent[slotId]) continue;
        out.push({ slotId, med, date: key, time });
      }
    }
  }
  return out;
}

/** Drop "already sent" markers older than two days so the record does not grow forever. */
export function pruneLastSent(lastSent, timezone, now = new Date()) {
  const tz = isValidTimeZone(timezone) ? timezone : 'UTC';
  const oldest = addDays(localParts(now, tz).dateKey, -2);
  const out = {};
  for (const [slotId, ts] of Object.entries(lastSent || {})) {
    const date = slotId.split('|')[1];
    if (date && date >= oldest) out[slotId] = ts;
  }
  return out;
}

export function fmtTime(t) {
  if (!TIME_RE.test(t || '')) return '';
  const [hs, m] = t.split(':');
  const h = Number(hs);
  return `${h % 12 || 12}:${m} ${h >= 12 ? 'PM' : 'AM'}`;
}

/** Never trust client JSON: keep only well-formed medications, with the same limits as the frontend store. */
export function cleanMedications(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const m of list.slice(0, LIMITS.meds)) {
    if (!m || typeof m !== 'object') continue;
    if (typeof m.id !== 'string' || !/^[A-Za-z0-9_-]{1,40}$/.test(m.id)) continue;
    if (typeof m.name !== 'string' || !m.name.trim()) continue;
    out.push({
      id: m.id,
      name: m.name.trim().slice(0, LIMITS.name),
      schedule: SCHEDULES.includes(m.schedule) ? m.schedule : 'once_daily',
      frequency: FREQUENCIES.includes(m.frequency) ? m.frequency : 'daily',
      time: TIME_RE.test(m.time || '') ? m.time : '09:00',
      notes: typeof m.notes === 'string' ? m.notes.slice(0, LIMITS.notes) : '',
      created: DATE_RE.test(m.created || '') ? m.created : new Date().toISOString().slice(0, 10),
    });
  }
  return out;
}

export function cleanCompleted(list) {
  if (!Array.isArray(list)) return [];
  return list.filter((s) => typeof s === 'string' && SLOT_RE.test(s)).slice(0, LIMITS.completed);
}

export function cleanSubscription(sub) {
  if (!sub || typeof sub !== 'object') return null;
  const { endpoint, keys } = sub;
  if (typeof endpoint !== 'string' || endpoint.length > 1000) return null;
  try {
    if (new URL(endpoint).protocol !== 'https:') return null;
  } catch {
    return null;
  }
  if (!keys || typeof keys.p256dh !== 'string' || typeof keys.auth !== 'string') return null;
  if (keys.p256dh.length > 200 || keys.auth.length > 100) return null;
  return { endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } };
}
