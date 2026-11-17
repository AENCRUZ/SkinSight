import { getGenerativeModel } from '../config/aiConfig.js';
import { INTAKE_SYSTEM_PROMPT, SUMMARY_SYSTEM_PROMPT } from '../prompts/systemPrompt.js';

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

  if (message && message.trim().length > 0) {
    currentParts.push(message.trim());
  } else if (currentParts.length > 0) {
    currentParts.push('Please observe this skin photo objectively according to the intake guidelines.');
  } else {
    throw new Error('A message or an image is required.');
  }

  const result = await chat.sendMessage(currentParts);
  const response = await result.response;
  const replyText = response.text();

  return {
    reply: replyText,
    history: [
      ...formattedHistory,
      {
        role: 'user',
        parts: [{ text: message || '[Image Attached]' }],
      },
      {
        role: 'model',
        parts: [{ text: replyText }],
      },
    ],
  };
}

/**
 * Generate a complete consultation summary report from conversation history
 */
export async function generateConsultationSummary(history = []) {
  const model = getGenerativeModel(undefined, SUMMARY_SYSTEM_PROMPT);

  const conversationTranscript = history
    .map((msg) => {
      const roleLabel = msg.role === 'model' || msg.role === 'assistant' ? 'AI Assistant' : 'Patient';
      const content = msg.parts ? msg.parts.map((p) => p.text).join(' ') : (msg.text || msg.content || '');
      return `${roleLabel}: ${content}`;
    })
    .join('\n\n');

  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const prompt = `Here is the intake conversation transcript to summarize:\n\n${conversationTranscript}\n\nPlease generate the final structured Consultation Intake Report JSON for the patient. Current date is ${currentDate}.`;

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.2,
    },
  });

  const response = await result.response;
  const rawText = response.text();

  try {
    const parsed = JSON.parse(rawText);
    return parsed;
  } catch (err) {
    return {
      mainConcern: 'Patient reported skin concern',
      symptoms: 'Reported in consultation chat',
      duration: 'See report details',
      affectedArea: 'Reported skin area',
      triggers: 'None confirmed',
      observations: 'Objective observations documented',
      questions: [
        'What could be the cause of these symptoms?',
        'What preventive measures or monitoring do you suggest?'
      ],
      fullText: rawText,
    };
  }
}

