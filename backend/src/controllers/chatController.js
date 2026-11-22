import { sendChatMessage, generateConsultationSummary } from '../services/aiService.js';
import { buildDownloadableReportText } from '../services/reportService.js';
import { searchKnowledgeBase, getKnowledgeBaseStats } from '../services/ragService.js';

/**
 * Handle incoming chat message with optional image upload
 */
export async function handleChatMessage(req, res) {
  try {
    const { message } = req.body;
    let history = [];

    // Parse history if received from FormData as a JSON string
    if (typeof req.body.history === 'string') {
      try {
        history = JSON.parse(req.body.history);
      } catch (err) {
        history = [];
      }
    } else if (Array.isArray(req.body.history)) {
      history = req.body.history;
    }

    const imageFile = req.file || null;

    if (!message && !imageFile) {
      return res.status(400).json({
        success: false,
        error: 'Please provide either a message or a skin image.',
      });
    }

    const result = await sendChatMessage({
      message,
      history,
      imageFile,
    });

    return res.status(200).json({
      success: true,
      reply: result.reply,
      history: result.history,
      sources: result.sources || [],
    });
  } catch (error) {
    console.error('Error in handleChatMessage:', error);
    const isApiKeyError = error.message && (
      error.message.includes('API_KEY') ||
      error.message.includes('API key') ||
      error.message.includes('GEMINI')
    );
    return res.status(500).json({
      success: false,
      error: isApiKeyError ? error.message : 'Failed to process chat message.',
    });
  }
}

/**
 * Generate consultation summary text from conversation
 */
export async function handleGenerateSummary(req, res) {
  try {
    const { history } = req.body;

    if (!history || !Array.isArray(history) || history.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Conversation history is required to generate a summary.',
      });
    }

    const summary = await generateConsultationSummary(history);

    return res.status(200).json({
      success: true,
      summary,
    });
  } catch (error) {
    console.error('Error in handleGenerateSummary:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to generate consultation summary.',
    });
  }
}

/**
 * Download summary as a formatted .txt file
 */
export async function handleDownloadReport(req, res) {
  try {
    let { summary, history, patientName } = req.body;

    // If summary not provided, generate from history
    if (!summary && history && Array.isArray(history)) {
      summary = await generateConsultationSummary(history);
    }

    if (!summary) {
      return res.status(400).json({
        success: false,
        error: 'Summary content or conversation history is required.',
      });
    }

    const reportText = buildDownloadableReportText(summary, patientName || 'Patient');

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="skinsight-summary.txt"');
    return res.send(reportText);
  } catch (error) {
    console.error('Error in handleDownloadReport:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to download report file.',
    });
  }
}

/**
 * Search the clinical knowledge base (RAG debug / verification endpoint)
 */
export async function handleSearchKnowledge(req, res) {
  try {
    const query = req.query.q || req.body?.query || '';
    const limit = Number(req.query.limit || req.body?.limit) || 3;

    if (!query.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Query parameter q is required (e.g. /api/chat/knowledge/search?q=itchy+rash)',
      });
    }

    const results = await searchKnowledgeBase(query, { limit });

    return res.status(200).json({
      success: true,
      query,
      count: results.length,
      results,
    });
  } catch (error) {
    console.error('Error in handleSearchKnowledge:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to search knowledge base.',
    });
  }
}

/**
 * Get knowledge base overview & stats
 */
export async function handleGetKnowledgeStats(req, res) {
  try {
    const stats = getKnowledgeBaseStats();
    return res.status(200).json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error('Error in handleGetKnowledgeStats:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve knowledge base stats.',
    });
  }
}
