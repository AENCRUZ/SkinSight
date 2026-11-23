/**
 * Medication push reminders: Web Push (VAPID) delivery + the "who is due now?" check.
 *
 * runDueReminders() is called every minute by the in-process scheduler AND can be triggered from outside
 * (POST /api/notifications/run-due with the CRON_SECRET). The external trigger matters on Render's free plan,
 * which puts the server to sleep after ~15 minutes without traffic; a sleeping server can't send anything.
 */
import * as webpush from 'web-push';
import cron from 'node-cron';
import { createPushStore } from './pushStore.js';
import {
  cleanCompleted,
  cleanMedications,
  cleanSubscription,
  dueReminders,
  fmtTime,
  isValidTimeZone,
  pruneLastSent,
} from './reminderSchedule.js';

// Created in initPush(), after dotenv has loaded (ES imports run before app.js calls dotenv.config()).
let store = null;
let vapidReady = false;
let running = false;
let scheduler = null;

export function initPush(env = process.env) {
  store = createPushStore(env);
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = env;
  const subject = env.VAPID_SUBJECT || 'mailto:support@skinsight.app';
  if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    try {
      webpush.setVapidDetails(subject, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
      vapidReady = true;
      console.log(`🔔 Push reminders enabled (storage: ${store.kind}).`);
    } catch (e) {
      console.error('❌ [push] Invalid VAPID configuration:', e.message);
    }
  } else {
    console.warn('⚠️  [push] VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY not set: medication push reminders are disabled.');
  }
  return vapidReady;
}

export function isPushReady() {
  return vapidReady;
}

export function getPublicKey() {
  return vapidReady ? process.env.VAPID_PUBLIC_KEY : null;
}

/** Creates or replaces the reminder record for one browser. Returns false if the input is invalid. */
export async function saveSubscription({ subscription, medications, completed, timezone }) {
  const sub = cleanSubscription(subscription);
  if (!sub) return false;
  const existing = await store.get(sub.endpoint);
  const tz = isValidTimeZone(timezone) ? timezone : 'UTC';
  await store.upsert({
    endpoint: sub.endpoint,
    subscription: sub,
    medications: cleanMedications(medications),
    completed: cleanCompleted(completed),
    timezone: tz,
    last_sent: pruneLastSent(existing ? existing.last_sent : {}, tz),
  });
  return true;
}

export async function removeSubscription(endpoint) {
  if (typeof endpoint !== 'string' || !endpoint) return false;
  await store.remove(endpoint);
  return true;
}

async function deliver(record, payload) {
  try {
    await webpush.sendNotification(record.subscription, JSON.stringify(payload), { TTL: 60 * 60, urgency: 'high' });
    return true;
  } catch (err) {
    if (err.statusCode === 404 || err.statusCode === 410) {
      // The browser revoked permission or the subscription expired: forget it.
      await store.remove(record.endpoint).catch(() => {});
    } else {
      console.error(`[push] Delivery failed (${err.statusCode || 'network'}): ${err.body || err.message}`);
    }
    return false;
  }
}

export async function sendTest(endpoint, delaySeconds = 0) {
  const record = typeof endpoint === 'string' ? await store.get(endpoint) : null;
  if (!record) return { ok: false, reason: 'not_found' };
  const payload = {
    title: 'SKINSIGHT reminders are working',
    body: 'This is a test. Medication reminders will appear like this, even when Chrome is closed.',
    tag: 'skinsight-test',
    url: 'medication-tracker.html',
  };
  const delay = Math.max(0, Math.min(60, Number(delaySeconds) || 0));
  if (delay) {
    setTimeout(() => deliver(record, payload), delay * 1000);
    return { ok: true, scheduled: true, delaySeconds: delay };
  }
  return { ok: await deliver(record, payload) };
}

function reminderPayload(due) {
  const { med, time, slotId } = due;
  return {
    title: `Time for ${med.name}`,
    body: `Scheduled dose at ${fmtTime(time)}.${med.notes ? ' ' + med.notes : ''}`,
    tag: `dose-${slotId}`,
    url: 'medication-tracker.html',
    slotId,
  };
}

/** Sends every reminder that is due. Safe to call often: each dose is sent at most once. */
export async function runDueReminders(now = new Date()) {
  if (!vapidReady || running) return { sent: 0, skipped: running };
  running = true;
  let sent = 0;
  try {
    const records = await store.all();
    for (const record of records) {
      const due = dueReminders({
        medications: record.medications,
        completed: record.completed,
        lastSent: record.last_sent || {},
        timezone: record.timezone,
        now,
      });
      if (!due.length) continue;

      const lastSent = { ...(record.last_sent || {}) };
      let gone = false;
      for (const item of due) {
        const ok = await deliver(record, reminderPayload(item));
        if (ok) {
          lastSent[item.slotId] = Date.now();
          sent++;
        } else if (!(await store.get(record.endpoint))) {
          gone = true; // subscription was removed after a 404/410
          break;
        }
      }
      if (!gone) await store.update(record.endpoint, { last_sent: pruneLastSent(lastSent, record.timezone, now) });
    }
  } catch (e) {
    console.error('[push] Reminder check failed:', e.message);
  } finally {
    running = false;
  }
  return { sent };
}

export function startReminderScheduler() {
  if (scheduler || !vapidReady || process.env.PUSH_INTERNAL_CRON === 'false') return;
  scheduler = cron.schedule('* * * * *', () => {
    runDueReminders();
  });
  console.log('⏰ Medication reminder check runs every minute.');
}
