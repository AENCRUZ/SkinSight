/**
 * SKINSIGHT Backend API Client
 * Connects frontend with the Node.js/Express backend.
 *
 * Reliability features:
 *  - every request has a timeout (the hosted backend can take up to a minute to wake up from idle)
 *  - one automatic retry for transient failures (network error, 502/503/504), never for validation errors
 *  - errors are ApiError objects with a machine-readable `code`, so pages can show the right message:
 *      "auth" (401), "too-large" (413), "bad-request" (400/422), "rate-limit" (429),
 *      "unavailable" (5xx), "timeout", "network"
 */

// Local development backend
const LOCAL_API_URL = 'http://localhost:5000';
// Deployed backend on Render (no trailing slash)
const PRODUCTION_API_URL = 'https://skinsight-f5p8.onrender.com';

const isLocalHost = ['localhost', '127.0.0.1', ''].includes(window.location.hostname);

// Local pages use localhost; deployed pages use PRODUCTION_API_URL only (never localhost).
const BACKEND_BASE_URL = (
  window.SKINSIGHT_API_URL ||
  (isLocalHost ? LOCAL_API_URL : PRODUCTION_API_URL)
).replace(/\/+$/, '');

if (!BACKEND_BASE_URL) {
  console.error(
    '[SKINSIGHT] Backend URL is not configured. Set PRODUCTION_API_URL in frontend/js/api.js ' +
    'to your Render service URL (e.g. https://your-service-name.onrender.com).'
  );
}

const REQUEST_TIMEOUT_MS = 60000; // a sleeping Render instance can need ~30-50 s to start
const HEALTH_TIMEOUT_MS = 75000;
const RETRY_DELAY_MS = 1500;

class ApiError extends Error {
  constructor(code, message, status) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status || 0;
  }
}

function codeForStatus(status) {
  if (status === 401 || status === 403) return 'auth';
  if (status === 413) return 'too-large';
  if (status === 429) return 'rate-limit';
  if (status === 400 || status === 422) return 'bad-request';
  if (status >= 500) return 'unavailable';
  return 'bad-request';
}

const DEFAULT_MESSAGES = {
  auth: 'Please log in again to continue.',
  'too-large': 'That request is too large. Try a smaller photo.',
  'rate-limit': 'Too many requests. Please wait a moment and try again.',
  'bad-request': 'That request could not be processed.',
  unavailable: 'The assistant is temporarily unavailable. Please try again in a moment.',
  timeout: 'The assistant took too long to respond. It may be waking up, so please try again.',
  network: 'We couldn’t reach the server. Check your connection and try again.',
};

/**
 * Retrieve Supabase auth token for authenticated API requests
 */
async function getAuthHeaders() {
  const headers = {};
  try {
    if (window.supabaseClient) {
      const { data } = await window.supabaseClient.auth.getSession();
      if (data && data.session && data.session.access_token) {
        headers['Authorization'] = 'Bearer ' + data.session.access_token;
      }
    }
  } catch (e) {
    // Auth not available — requests will proceed without token
  }
  return headers;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** fetch + timeout. Throws ApiError('timeout' | 'network'). */
async function fetchOnce(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (e) {
    if (e && e.name === 'AbortError') throw new ApiError('timeout', DEFAULT_MESSAGES.timeout);
    throw new ApiError('network', DEFAULT_MESSAGES.network);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Perform a request against the backend and return parsed JSON.
 * `build` is called for every attempt so a fresh body/headers (e.g. a refreshed token) is used on retry.
 */
async function request(path, build, { timeoutMs = REQUEST_TIMEOUT_MS, retries = 1 } = {}) {
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const options = await build();
      const response = await fetchOnce(`${BACKEND_BASE_URL}${path}`, options, timeoutMs);
      if (response.ok) return await response.json();

      const errData = await response.json().catch(() => ({}));
      const code = codeForStatus(response.status);
      const err = new ApiError(code, errData.error || DEFAULT_MESSAGES[code], response.status);
      // Only transient server-side problems are worth retrying.
      if (![502, 503, 504].includes(response.status)) throw err;
      lastError = err;
    } catch (e) {
      if (!(e instanceof ApiError)) throw e;
      if (e.code !== 'network' && e.code !== 'timeout' && e.code !== 'unavailable') throw e;
      lastError = e;
    }
    if (attempt < retries) await sleep(RETRY_DELAY_MS);
  }
  throw lastError;
}

const SkinsightAPI = {
  /**
   * Health check to see if backend is running
   */
  async checkHealth() {
    try {
      const res = await fetchOnce(`${BACKEND_BASE_URL}/api/health`, {}, HEALTH_TIMEOUT_MS);
      return res.ok;
    } catch (e) {
      return false;
    }
  },

  /**
   * Wake the backend (hosted instances sleep when idle). Resolves to true/false when the check finishes.
   * `onSlow` is called once if the server has not answered after `slowAfterMs`, so the UI can explain the wait.
   */
  async wakeUp(onSlow, slowAfterMs = 2500) {
    let finished = false;
    const timer = setTimeout(() => { if (!finished && typeof onSlow === 'function') onSlow(); }, slowAfterMs);
    try {
      return await this.checkHealth();
    } finally {
      finished = true;
      clearTimeout(timer);
    }
  },

  /**
   * Send a chat message with optional image to the AI Assistant
   * @param {Object} params
   * @param {string} params.message - User message text
   * @param {Array} params.history - Previous chat history
   * @param {File} [params.imageFile] - Uploaded skin photo
   */
  async sendMessage({ message, history = [], imageFile = null }) {
    return request('/api/chat/message', async () => {
      const formData = new FormData();
      if (message) formData.append('message', message);
      if (history && history.length > 0) formData.append('history', JSON.stringify(history));
      if (imageFile) formData.append('image', imageFile);
      return { method: 'POST', headers: await getAuthHeaders(), body: formData };
    });
  },

  /**
   * Request a structured consultation summary
   * @param {Array} history - Full conversation history
   */
  async generateSummary(history) {
    return request('/api/chat/summary', async () => ({
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
      body: JSON.stringify({ history }),
    }));
  },
};

// Make accessible globally
window.SkinsightAPI = SkinsightAPI;
window.SkinsightApiError = ApiError;
