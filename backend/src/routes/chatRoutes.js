import express from 'express';
import { uploadSkinPhoto } from '../middleware/upload.js';
import { requireAuth } from '../middleware/auth.js';
import {
  handleChatMessage,
  handleGenerateSummary,
  handleDownloadReport,
} from '../controllers/chatController.js';

const router = express.Router();

// Chat message route (supports optional single image with key 'image')
router.post('/message', requireAuth, uploadSkinPhoto.single('image'), handleChatMessage);

// Generate consultation summary
router.post('/summary', requireAuth, handleGenerateSummary);

// Download report as text file
router.post('/download', requireAuth, handleDownloadReport);

export default router;
