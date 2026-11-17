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
 * - If a token is provided, validates it with Supabase.
 * - If no token is provided: allows guest access in dev mode (unless REQUIRE_AUTH=true in .env).
 */
export async function requireAuth(req, res, next) {
  const strictAuth = process.env.REQUIRE_AUTH === 'true';

  if (!supabase) {
    // Supabase not configured on backend — allow requests in development
    return next();
  }

  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  if (!token) {
    if (strictAuth) {
      return res.status(401).json({ success: false, error: 'Authentication required. Please log in.' });
    }
    // Permissive in development mode for guest testing
    req.user = { id: 'guest', email: 'guest@skinsight.local' };
    return next();
  }

  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      if (strictAuth) {
        return res.status(401).json({ success: false, error: 'Invalid or expired token. Please log in again.' });
      }
      // If token verification failed in dev, still permit testing
      console.warn('Auth token verification failed, continuing as guest:', error?.message);
      req.user = { id: 'guest', email: 'guest@skinsight.local' };
      return next();
    }
    req.user = data.user;
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    if (strictAuth) {
      return res.status(401).json({ success: false, error: 'Authentication failed.' });
    }
    req.user = { id: 'guest', email: 'guest@skinsight.local' };
    next();
  }
}
