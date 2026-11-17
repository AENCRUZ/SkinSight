import app from './src/app.js';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`
=====================================================
🚀 SKINSIGHT AI Backend Server is running!
📡 URL:     http://localhost:${PORT}
🩺 Health:  http://localhost:${PORT}/api/health
🤖 AI Chat: http://localhost:${PORT}/api/chat/message
=====================================================
  `);
});

