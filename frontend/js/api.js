/**
 * SKINSIGHT Backend API Client
 * Connects frontend with the Node.js/Express backend
 */

// Local development backend
const LOCAL_API_URL = 'http://localhost:5000';
// Deployed backend on Render — paste your Render service URL here after deploying
// (e.g. 'https://your-service-name.onrender.com', no trailing slash)
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

const SkinsightAPI = {
  /**
   * Health check to see if backend is running
   */
  async checkHealth() {
    try {
      const res = await fetch(`${BACKEND_BASE_URL}/api/health`);
      return res.ok;
    } catch (e) {
      return false;
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
    const formData = new FormData();
    if (message) formData.append('message', message);
    if (history && history.length > 0) formData.append('history', JSON.stringify(history));
    if (imageFile) formData.append('image', imageFile);

    const response = await fetch(`${BACKEND_BASE_URL}/api/chat/message`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: formData,
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Request failed with status ${response.status}`);
    }

    return response.json();
  },

  /**
   * Request a structured consultation summary
   * @param {Array} history - Full conversation history
   */
  async generateSummary(history) {
    const response = await fetch(`${BACKEND_BASE_URL}/api/chat/summary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
      body: JSON.stringify({ history }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Summary request failed (${response.status})`);
    }

    return response.json();
  },

  /**
   * Trigger direct .txt file download of the summary
   * @param {Object} params
   * @param {string} [params.summary] - Formatted summary text
   * @param {Array} [params.history] - Chat history if summary not yet compiled
   * @param {string} [params.patientName] - Optional patient name
   */
  async downloadReport({ summary, history, patientName }) {
    const response = await fetch(`${BACKEND_BASE_URL}/api/chat/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
      body: JSON.stringify({ summary, history, patientName }),
    });

    if (!response.ok) {
      throw new Error('Failed to generate downloadable report');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'skinsight-consultation-report.txt';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },
};

// Make accessible globally
window.SkinsightAPI = SkinsightAPI;
