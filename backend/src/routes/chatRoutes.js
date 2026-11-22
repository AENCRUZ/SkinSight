import express from 'express';
import { uploadSkinPhoto } from '../middleware/upload.js';
import { requireAuth } from '../middleware/auth.js';
import {
  handleChatMessage,
  handleGenerateSummary,
  handleDownloadReport,
  handleSearchKnowledge,
  handleGetKnowledgeStats,
} from '../controllers/chatController.js';

const router = express.Router();

// Chat message route (supports optional single image with key 'image')
router.post('/message', requireAuth, uploadSkinPhoto, handleChatMessage);

// Generate consultation summary
router.post('/summary', requireAuth, handleGenerateSummary);

// Download report as text file
router.post('/download', requireAuth, handleDownloadReport);

// RAG clinical knowledge base inspection & verification
// (login required in strict mode — these are diagnostics, not public endpoints)
router.get('/knowledge/search', requireAuth, handleSearchKnowledge);
router.get('/knowledge/stats', requireAuth, handleGetKnowledgeStats);

export default router;
