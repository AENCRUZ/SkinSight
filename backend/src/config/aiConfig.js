import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;

const isConfiguredKey =
  typeof apiKey === 'string' &&
  apiKey.trim().length > 0 &&
  !apiKey.includes('your_gemini_api_key_here') &&
  !apiKey.includes('your_');

if (!isConfiguredKey) {
  console.warn(
    '\n⚠️  [SKINSIGHT WARNING] GEMINI_API_KEY is not configured in backend/.env!\n' +
    '   Please add your real API key to enable AI responses.\n'
  );
}

const genAI = isConfiguredKey ? new GoogleGenerativeAI(apiKey.trim()) : null;

export const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
export const EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL || 'text-embedding-004';

export function getGenerativeModel(modelName = DEFAULT_MODEL, systemInstruction) {
  if (!genAI) {
    throw new Error('GEMINI_API_KEY in backend/.env is missing or still set to placeholder. Please paste your real Gemini API key.');
  }

  return genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
  });
}

export function getEmbeddingModel(modelName = EMBEDDING_MODEL) {
  if (!genAI) {
    return null;
  }
  return genAI.getGenerativeModel({ model: modelName });
}

export default genAI;

