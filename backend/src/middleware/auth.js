import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const isConfigured = (val) =>
  typeof val === 'string' &&
  val.trim().length > 0 &&
  !val.includes('your_') &&
  !val.includes('your-project-id');

/**
 * Build the Supabase client used ONLY to verify user JWTs (auth.getUser).
 * The public anon key is enough for that, so production does not need the
 * service-role secret. The service-role key is still accepted as a fallback.
 */
export function createAuthClient(env = process.env) {
  const url = env.SUPABASE_URL;
  const key = isConfigured(env.SUPABASE_ANON_KEY)
    ? env.SUPABASE_ANON_KEY
    : env.SUPABASE_SERVICE_ROLE_KEY;

  if (!isConfigured(url) || !isConfigured(key)) return null;
  try {
    return createClient(url.trim(), key.trim(), {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  } catch (e) {
    console.warn('Failed to initialize Supabase client for auth verification:', e.message);
    return null;
  }
}

/**
 * Express middleware factory.
 *
 * Strict mode (REQUIRE_AUTH=true — use this in production):
 *   - no token / invalid token  -> 401
 *   - Supabase not configured   -> 503 (fail closed, never an open endpoint)
 * Development mode (REQUIRE_AUTH unset): requests continue as a "guest" so the
 * API can be tested locally without Supabase.
 *
 * `getClient` and `getStrict` are injectable so the behaviour can be unit tested.
 */
export function createRequireAuth({
  getClient = () => authClient,
  getStrict = () => process.env.REQUIRE_AUTH === 'true',
} = {}) {
  return async function requireAuth(req, res, next) {
    const strict = getStrict();
    const client = getClient();
    const guest = { id: 'guest', email: 'guest@skinsight.local', isGuest: true };

    if (!client) {
      if (strict) {
        console.error('[auth] REQUIRE_AUTH=true but Supabase (SUPABASE_URL + SUPABASE_ANON_KEY) is not configured.');
        return res.status(503).json({
          success: false,
          error: 'Authentication service is not configured. Please try again later.',
        });
      }
      req.user = guest;
      return next();
    }

    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

    if (!token) {
      if (strict) {
        return res.status(401).json({ success: false, error: 'Authentication required. Please log in.' });
      }
      req.user = guest;
      return next();
    }

    try {
      const { data, error } = await client.auth.getUser(token);
      if (error || !data || !data.user) {
        if (strict) {
          return res
            .status(401)
            .json({ success: false, error: 'Invalid or expired token. Please log in again.' });
        }
        req.user = guest;
        return next();
      }
      req.user = data.user;
      return next();
    } catch (err) {
      console.error('Auth middleware error:', err.message);
      if (strict) {
        return res.status(401).json({ success: false, error: 'Authentication failed.' });
      }
      req.user = guest;
      return next();
    }
  };
}

const authClient = createAuthClient();

export const requireAuth = createRequireAuth();
