import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const isConfigured = (val) =>
  typeof val === 'string' &&
  val.trim().length > 0 &&
  !val.includes('your_') &&
  !val.includes('your-project-id');

let supabase = null;
if (isConfigured(supabaseUrl) && isConfigured(supabaseServiceKey)) {
  try {
    supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  } catch (e) {
    console.warn('Failed to initialize Supabase client for auth verification:', e.message);
    supabase = null;
  }
}

/**
 * Express middleware: validates the Supabase JWT from the Authorization header.
 * If Supabase credentials are not configured (local dev), requests pass through.
 */
export async function requireAuth(req, res, next) {
  if (!supabase) {
    // Supabase not configured on backend — allow requests in development
    return next();
  }

  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({ success: false, error: 'Authentication required.' });
  }

  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      return res.status(401).json({ success: false, error: 'Invalid or expired token.' });
    }
    req.user = data.user;
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    return res.status(401).json({ success: false, error: 'Authentication failed.' });
  }
}
