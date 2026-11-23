import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import chatRoutes from './routes/chatRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import { initPush } from './services/pushService.js';
import rateLimit from 'express-rate-limit';

dotenv.config();
initPush();

const app = express();

// Render (and most PaaS hosts) sit behind a reverse proxy. Trust the first hop so
// req.ip is the real client IP and the rate limiter counts each user separately.
app.set('trust proxy', 1);

// CORS configuration: allow local development and the exact origins listed in CLIENT_ORIGIN
// (e.g. CLIENT_ORIGIN=https://aencruz.github.io in production)
const allowedOrigins = process.env.CLIENT_ORIGIN
  ? process.env.CLIENT_ORIGIN.split(',')
      .map((origin) => origin.trim().replace(/\/+$/, ''))
      .filter(Boolean)
  : ['http://localhost:8000', 'http://127.0.0.1:8000', 'http://localhost:5500', 'http://127.0.0.1:5500'];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, file://)
      if (!origin) return callback(null, true);

      // Localhost origins are only trusted outside production (set NODE_ENV=production on Render).
      const isLocal =
        process.env.NODE_ENV !== 'production' &&
        (origin.startsWith('http://localhost:') ||
        origin.startsWith('https://localhost:') ||
        origin.startsWith('http://127.0.0.1:') ||
        origin.startsWith('https://127.0.0.1:'));

      if (isLocal || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // Reject other origins without throwing an unhandled exception
      return callback(null, false);
    },
    credentials: true,
  })
);

// Request logger. Only the path is logged (never the query string, which can contain user text).
app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.path}`);
  next();
});

// Chat text and history are small; photos arrive as multipart (5 MB cap in middleware/upload.js).
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Rate limiting — protect AI endpoints from abuse
const chatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1-minute window
  max: 20, // max 20 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests. Please wait a moment and try again.' },
});

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'SkinSight AI Assistant API',
    timestamp: new Date().toISOString(),
  });
});

// Chat & AI Routes (rate-limited)
app.use('/api/chat', chatLimiter, chatRoutes);

// Medication push reminders (Web Push / VAPID)
app.use('/api/notifications', notificationRoutes);

// Global 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found.',
  });
});

// Global Error Handler — never leaks internal error text for 5xx responses.
app.use((err, req, res, next) => {
  let status = err.status || err.statusCode || 500;
  let message;
  if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Invalid JSON in request body.';
  } else if (err.type === 'entity.too.large') {
    status = 413;
    message = 'Request is too large.';
  } else if (status < 500 && err.expose) {
    message = err.message;
  } else if (status < 500) {
    message = 'Invalid request.';
  } else {
    console.error('Unhandled Server Error:', err);
    message = 'Internal server error.';
  }
  res.status(status).json({ success: false, error: message });
});

export default app;
