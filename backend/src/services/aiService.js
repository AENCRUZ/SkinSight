import { getGenerativeModel } from '../config/aiConfig.js';
import { INTAKE_SYSTEM_PROMPT, SUMMARY_SYSTEM_PROMPT } from '../prompts/systemPrompt.js';
import { retrieveRagContext } from './ragService.js';
import { screenText, SAFE_FALLBACK_REPLY, CORRECTION_INSTRUCTION } from './safetyFilter.js';
import { validateSummary } from './summaryValidator.js';
import { HttpError } from '../middleware/validateChat.js';

/**
 * Convert Multer file buffer into Gemini inlineData part
 */
export function bufferToGenerativePart(buffer, mimeType) {
  return {
    inlineData: {
      data: buffer.toString('base64'),
      mimeType,
    },
  };
}

/**
 * Format conversation history into Gemini chat format:
 * [ { role: 'user' | 'model', parts: [{ text: '...' }] } ]
 * (Controllers already validate/limit history; this keeps the service safe when called directly.)
 */
function sanitizeHistory(rawHistory = []) {
  if (!Array.isArray(rawHistory)) return [];

  const items = [];
  for (const msg of rawHistory) {
    if (!msg) continue;
    let text = '';
    if (Array.isArray(msg.parts)) {
      text = msg.parts.map((p) => (typeof p === 'string' ? p : p.text || '')).join(' ');
    } else if (typeof msg.text === 'string') {
      text = msg.text;
    } else if (typeof msg.content === 'string') {
      text = msg.content;
    }

    if (!text.trim()) continue;

    const role =
      msg.role === 'model' || msg.role === 'assistant' || msg.role === 'ai' ? 'model' : 'user';

    items.push({
      role,
      parts: [{ text: text.trim() }],
    });
  }

  // Gemini API requires the first turn in history to have role 'user'
  while (items.length > 0 && items[0].role !== 'user') {
    items.shift();
  }

  return items;
}

const turnText = (turn) => turn.parts.map((p) => p.text).join(' ');

/** Everything the USER wrote (used so the safety filter allows echoing terms the user chose themselves). */
function collectUserText(history, message) {
  return [...history.filter((t) => t.role === 'user').map(turnText), message || ''].join('\n');
}

/**
 * Process an intake chat message (with optional image)
 */
export async function sendChatMessage({ message, history = [], imageFile = null }) {
  const model = getGenerativeModel(undefined, INTAKE_SYSTEM_PROMPT);

  const formattedHistory = sanitizeHistory(history);

  // Start chat session with previous history
  const chat = model.startChat({
    history: formattedHistory,
    generationConfig: {
      temperature: 0.3,
    },
  });

  // Prepare current user turn parts
  const currentParts = [];

  if (imageFile && imageFile.buffer) {
    const imagePart = bufferToGenerativePart(imageFile.buffer, imageFile.mimetype);
    currentParts.push(imagePart);
  }

  // Retrieve relevant clinical knowledge via RAG
  const queryForRag = (message && message.trim()) || 'skin photo intake observation';
  const ragResult = await retrieveRagContext(queryForRag);

  let userTurnText = message && message.trim().length > 0
    ? message.trim()
    : 'Please describe only what is objectively visible in this skin photo, following the intake guidelines, and ask me clarifying questions.';

  if (ragResult.formattedContext) {
    userTurnText = `${ragResult.formattedContext}\n\n[USER INPUT]:\n${userTurnText}`;
  }

  currentParts.push(userTurnText);

  const userText = collectUserText(formattedHistory, message);

  let replyText = (await chat.sendMessage(currentParts)).response.text();
  let screen = screenText(replyText, { userText });

  if (!screen.ok) {
    console.warn('[safety] first reply rejected:', screen.violations.join('; '));
    try {
      replyText = (await chat.sendMessage(CORRECTION_INSTRUCTION)).response.text();
      screen = screenText(replyText, { userText });
    } catch (err) {
      screen = { ok: false, violations: ['regeneration failed'] };
    }
    if (!screen.ok) {
      console.warn('[safety] regenerated reply rejected, using safe fallback:', screen.violations.join('; '));
      replyText = SAFE_FALLBACK_REPLY;
    }
  }

  return {
    reply: replyText,
    history: [
      ...formattedHistory,
      {
        role: 'user',
        parts: [{ text: (message && message.trim()) || '[Image Attached]' }],
      },
      {
        role: 'model',
        parts: [{ text: replyText }],
      },
    ],
    sources: ragResult.docs.map((doc) => ({
      id: doc.id,
      title: doc.title,
      category: doc.category,
      score: doc.score,
    })),
  };
}

const SUMMARY_RETRY_NOTE =
  '\n\nIMPORTANT: your previous attempt was rejected. Return valid JSON only. Use "Not reported" for anything the patient did not say, ' +
  'name NO skin conditions and recommend NO medications.';

/**
 * Generate a consultation summary from conversation history.
 * Returns validated fields only. Never returns invented placeholder content: if a reliable summary
 * cannot be produced after one retry, an HttpError(502) is thrown and the UI shows a retry state.
 */
export async function generateConsultationSummary(history = []) {
  const turns = sanitizeHistory(history);
  const userText = turns.filter((t) => t.role === 'user').map(turnText).join('\n');
  if (!userText.trim()) {
    throw new HttpError(400, 'There is nothing to summarize yet. Describe your skin concern in the chat first.');
  }

  const model = getGenerativeModel(undefined, SUMMARY_SYSTEM_PROMPT);

  const transcript = turns
    .map((t) => `${t.role === 'model' ? 'AI Assistant' : 'Patient'}: ${turnText(t)}`)
    .join('\n\n');

  const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const basePrompt =
    `Here is the intake conversation transcript to summarize:\n\n${transcript}\n\n` +
    `Return the JSON record described in your instructions. Today's date is ${currentDate}.`;

  let lastProblems = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    const prompt = attempt === 0 ? basePrompt : basePrompt + SUMMARY_RETRY_NOTE;
    let parsed = null;
    try {
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
      });
      parsed = JSON.parse(result.response.text());
    } catch (err) {
      if (err instanceof SyntaxError) {
        lastProblems = ['model returned invalid JSON'];
        continue;
      }
      throw err; // API/network error: let the controller map it
    }

    const checked = validateSummary(parsed, { userText });
    if (checked.ok) return checked.value;
    lastProblems = checked.problems;
  }

  console.warn('[summary] rejected after retry:', lastProblems.join('; '));
  throw new HttpError(502, 'We could not generate a reliable summary this time. Please try again.');
}
