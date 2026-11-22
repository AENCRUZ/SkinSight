import { sendChatMessage, generateConsultationSummary } from '../services/aiService.js';
import { buildDownloadableReportText } from '../services/reportService.js';
import { searchKnowledgeBase, getKnowledgeBaseStats } from '../services/ragService.js';
import { validateSummary } from '../services/summaryValidator.js';
import {
  HttpError,
  parseHistoryField,
  validateMessageText,
  cleanPatientName,
} from '../middleware/validateChat.js';

/**
 * Convert any thrown error into a safe { status, error } pair for the client.
 * Validation errors (HttpError) keep their own message; upstream AI/API problems get friendly,
 * generic text so internal details (keys, URLs, stack traces) never reach the browser.
 */
export function toClientError(error) {
  if (error instanceof HttpError) return { status: error.status, error: error.message };

  const msg = String(error?.message || '');
  const upstream = Number(error?.status) || 0;

  if (/API[_ ]?KEY|GEMINI_API_KEY/i.test(msg) && /missing|placeholder|not configured|invalid/i.test(msg)) {
    return { status: 503, error: 'The AI service is not configured. Please contact the site owner.' };
  }
  if (upstream === 429) {
    return { status: 429, error: 'The assistant is busy right now. Please wait a moment and try again.' };
  }
  if (upstream === 400 && /API key/i.test(msg)) {
    return { status: 503, error: 'The AI service is not configured. Please contact the site owner.' };
  }
  if (upstream >= 500 || upstream === 503) {
    return { status: 503, error: 'The assistant is temporarily unavailable. Please try again shortly.' };
  }
  if (/blocked|SAFETY|candidate/i.test(msg)) {
    return { status: 422, error: 'The assistant could not respond to that. Please rephrase and try again.' };
  }
  return { status: 500, error: 'Something went wrong on our side. Please try again.' };
}

function sendError(res, label, error) {
  const mapped = toClientError(error);
  if (mapped.status >= 500) console.error(`${label}:`, error?.message || error);
  return res.status(mapped.status).json({ success: false, error: mapped.error });
}

/**
 * Handle incoming chat message with optional image upload
 */
export async function handleChatMessage(req, res) {
  try {
    const message = validateMessageText(req.body?.message);
    const history = parseHistoryField(req.body?.history);
    const imageFile = req.file || null;

    if (!message && !imageFile) {
      throw new HttpError(400, 'Please provide either a message or a skin image.');
    }

    const result = await sendChatMessage({ message, history, imageFile });

    return res.status(200).json({
      success: true,
      reply: result.reply,
      history: result.history,
      sources: result.sources || [],
    });
  } catch (error) {
    return sendError(res, 'Error in handleChatMessage', error);
  }
}

/**
 * Generate consultation summary from conversation
 */
export async function handleGenerateSummary(req, res) {
  try {
    const history = parseHistoryField(req.body?.history);
    if (history.length === 0) {
      throw new HttpError(400, 'Conversation history is required to generate a summary.');
    }

    const summary = await generateConsultationSummary(history);
    return res.status(200).json({ success: true, summary });
  } catch (error) {
    return sendError(res, 'Error in handleGenerateSummary', error);
  }
}

/**
 * Download summary as a formatted .txt file.
 * Accepts an already generated summary object (re-validated here) or a history to summarize.
 */
export async function handleDownloadReport(req, res) {
  try {
    let summary = null;
    const patientName = cleanPatientName(req.body?.patientName);

    if (req.body?.summary && typeof req.body.summary === 'object') {
      const checked = validateSummary(req.body.summary, { userText: '' });
      if (!checked.value) throw new HttpError(400, 'Summary content is invalid.');
      summary = checked.value;
    } else if (req.body?.history !== undefined) {
      const history = parseHistoryField(req.body.history);
      if (history.length === 0) throw new HttpError(400, 'Summary content or conversation history is required.');
      summary = await generateConsultationSummary(history);
    }

    if (!summary) {
      throw new HttpError(400, 'Summary content or conversation history is required.');
    }

    const reportText = buildDownloadableReportText(summary, patientName);

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="skinsight-summary.txt"');
    return res.send(reportText);
  } catch (error) {
    return sendError(res, 'Error in handleDownloadReport', error);
  }
}

/**
 * Search the clinical knowledge base (RAG debug / verification endpoint)
 */
export async function handleSearchKnowledge(req, res) {
  try {
    const query = typeof req.query.q === 'string' ? req.query.q : '';
    const limit = Math.min(Math.max(Number(req.query.limit) || 3, 1), 8);

    if (!query.trim()) {
      throw new HttpError(400, 'Query parameter q is required (e.g. /api/chat/knowledge/search?q=itchy+rash)');
    }
    if (query.length > 300) throw new HttpError(400, 'Query is too long (max 300 characters).');

    const results = await searchKnowledgeBase(query, { limit });

    return res.status(200).json({
      success: true,
      query,
      count: results.length,
      results,
    });
  } catch (error) {
    return sendError(res, 'Error in handleSearchKnowledge', error);
  }
}

/**
 * Get knowledge base overview & stats
 */
export async function handleGetKnowledgeStats(req, res) {
  try {
    return res.status(200).json({ success: true, stats: getKnowledgeBaseStats() });
  } catch (error) {
    return sendError(res, 'Error in handleGetKnowledgeStats', error);
  }
}
