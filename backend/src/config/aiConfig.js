import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.warn(
    '\n⚠️  [SKINSIGHT WARNING] GEMINI_API_KEY is not set in backend/.env!\n' +
    '   Please add your API key from https://aistudio.google.com/app/apikey to enable AI responses.\n'
  );
}

const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

export const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';

export function getGenerativeModel(modelName = DEFAULT_MODEL, systemInstruction) {
  if (!genAI) {
    throw new Error('GEMINI_API_KEY is missing. Please set it in backend/.env');
  }

  return genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
  });
}

export default genAI;

