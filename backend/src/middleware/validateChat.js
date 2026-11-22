/**
 * Request validation for chat endpoints (limits are exported so tests and docs stay in sync).
 * Client-supplied history is untrusted: roles are normalised, length is capped and turns are cleaned.
 */
export const LIMITS = {
  MESSAGE_CHARS: 2000,
  HISTORY_TURNS: 40,
  TURN_CHARS: 4000,
  PATIENT_NAME_CHARS: 80,
};

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.expose = true;
  }
}

function turnText(msg) {
  if (!msg || typeof msg !== 'object') return '';
  if (Array.isArray(msg.parts)) {
    return msg.parts.map((p) => (typeof p === 'string' ? p : (p && p.text) || '')).join(' ');
  }
  if (typeof msg.text === 'string') return msg.text;
  if (typeof msg.content === 'string') return msg.content;
  return '';
}

// The retrieved knowledge-base text that sendChatMessage wraps around the user's message starts with this banner
// (see formatRagContext in ragService.js). Earlier versions leaked those wrapped turns into the saved history.
const REFERENCE_BANNER = /^=+\s*VERIFIED CLINICAL INTAKE KNOWLEDGE BASE/i;

export function isReferenceArtifact(text) {
  return REFERENCE_BANNER.test(String(text || '').trim());
}

/**
 * Remove turns that were never written by the user: the wrapped "reference text" user turn that older versions
 * stored, and the model reply that immediately followed it (the clean user message and its reply come right after).
 * Works on [{ role, text }] items.
 */
export function dropReferenceArtifacts(items) {
  const out = [];
  for (let i = 0; i < items.length; i++) {
    if (items[i].role === 'user' && isReferenceArtifact(items[i].text)) {
      if (items[i + 1] && items[i + 1].role === 'model') i++; // also skip its duplicate reply
      continue;
    }
    out.push(items[i]);
  }
  return out;
}

/**
 * Normalise history to [{ role: 'user'|'model', parts:[{text}] }].
 * Throws HttpError(400) when limits are exceeded. Unknown roles become 'user' (never 'model'). Note: the roles
 * 'user' and 'model' are still accepted from the client, so forged model turns are NOT prevented here.
 * Reference-text artifacts from older versions are removed BEFORE the limits are applied.
 */
export function normalizeHistory(raw) {
  if (raw === undefined || raw === null || raw === '') return [];
  if (!Array.isArray(raw)) throw new HttpError(400, 'history must be an array.');
  const tooLong = () =>
    new HttpError(400, `Conversation is too long (max ${LIMITS.HISTORY_TURNS} messages). Please start a new consultation.`);
  // generous pre-check (older saved histories have up to 2x the turns); the real limit applies after cleaning
  if (raw.length > LIMITS.HISTORY_TURNS * 3) throw tooLong();

  const items = [];
  for (const msg of raw) {
    const text = turnText(msg).trim();
    if (!text) continue;
    const role = msg.role === 'model' || msg.role === 'assistant' || msg.role === 'ai' ? 'model' : 'user';
    items.push({ role, text });
  }

  const cleaned = dropReferenceArtifacts(items);
  if (cleaned.length > LIMITS.HISTORY_TURNS) throw tooLong();

  return cleaned.map(({ role, text }) => {
    if (text.length > LIMITS.TURN_CHARS) {
      throw new HttpError(400, `A message in the history is too long (max ${LIMITS.TURN_CHARS} characters).`);
    }
    return { role, parts: [{ text }] };
  });
}

export function validateMessageText(message) {
  if (message === undefined || message === null) return '';
  if (typeof message !== 'string') throw new HttpError(400, 'message must be text.');
  const trimmed = message.trim();
  if (trimmed.length > LIMITS.MESSAGE_CHARS) {
    throw new HttpError(400, `Message is too long (max ${LIMITS.MESSAGE_CHARS} characters).`);
  }
  return trimmed;
}

/** Parse history from either a JSON body (array) or multipart form field (JSON string). */
export function parseHistoryField(value) {
  if (typeof value === 'string') {
    if (!value.trim()) return [];
    try {
      return normalizeHistory(JSON.parse(value));
    } catch (err) {
      if (err instanceof HttpError) throw err;
      throw new HttpError(400, 'history is not valid JSON.');
    }
  }
  return normalizeHistory(value);
}

export function cleanPatientName(name) {
  if (typeof name !== 'string') return 'Patient';
  // strip control characters so the value cannot break the report layout
  const cleaned = name.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, LIMITS.PATIENT_NAME_CHARS);
  return cleaned || 'Patient';
}
