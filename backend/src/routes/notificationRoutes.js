import express from 'express';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import {
  getPublicKey,
  isPushReady,
  removeSubscription,
  runDueReminders,
  saveSubscription,
  sendTest,
} from '../services/pushService.js';

const router = express.Router();

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests. Please wait a moment and try again.' },
});

const testLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many test notifications. Please wait a minute.' },
});

function requirePush(req, res, next) {
  if (!isPushReady()) {
    return res.status(503).json({ success: false, error: 'Push reminders are not configured on the server.' });
  }
  next();
}

function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

// Public VAPID key the browser needs to subscribe.
router.get('/vapid-public-key', requirePush, (req, res) => {
  res.json({ success: true, publicKey: getPublicKey() });
});

// Create/replace this browser's subscription and the schedule to remind about.
// Body: { subscription, medications, completed, timezone }
router.post('/subscribe', limiter, requirePush, async (req, res, next) => {
  try {
    const ok = await saveSubscription(req.body || {});
    if (!ok) return res.status(400).json({ success: false, error: 'Invalid push subscription.' });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// Body: { endpoint }
router.post('/unsubscribe', limiter, async (req, res, next) => {
  try {
    await removeSubscription((req.body || {}).endpoint);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// Body: { endpoint, delaySeconds (0-60) }
router.post('/test', testLimiter, requirePush, async (req, res, next) => {
  try {
    const { endpoint, delaySeconds } = req.body || {};
    const result = await sendTest(endpoint, delaySeconds);
    if (result.reason === 'not_found') {
      return res.status(404).json({ success: false, error: 'Reminders are not turned on for this browser.' });
    }
    if (!result.ok) return res.status(502).json({ success: false, error: 'The notification could not be delivered.' });
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

// External trigger (e.g. cron-job.org every minute). Also wakes a sleeping Render instance.
// Header: x-cron-secret: <CRON_SECRET>
router.all('/run-due', requirePush, async (req, res, next) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || !safeEqual(req.get('x-cron-secret') || req.query.key || '', secret)) {
    return res.status(401).json({ success: false, error: 'Unauthorized.' });
  }
  try {
    res.json({ success: true, ...(await runDueReminders()) });
  } catch (err) {
    next(err);
  }
});

export default router;
