import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getEmbeddingModel } from '../config/aiConfig.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const KNOWLEDGE_PATH = path.join(__dirname, '../data/knowledgeBase.json');

// Stop words to filter out during keyword scoring
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he',
  'in', 'is', 'it', 'its', 'of', 'on', 'or', 'that', 'the', 'to', 'was', 'were',
  'will', 'with', 'i', 'my', 'me', 'have', 'do', 'does', 'did', 'some', 'any'
]);

let cachedKnowledgeBase = null;
const embeddingCache = new Map(); // id -> float[]

// Embedding health. After repeated failures we stop calling the embedding API for a cooldown
// period and answer from keyword scoring only (instead of retrying every document on every turn).
const FAILURE_LIMIT = 3;
const COOLDOWN_MS = 5 * 60 * 1000;
let consecutiveFailures = 0;
let cooldownUntil = 0;
let warmPromise = null;
let lastMode = 'unknown'; // 'hybrid' | 'keyword' | 'unknown' (no search has run yet)

// Cosine similarity between unrelated short texts is usually well above 0 for modern embedding
// models, so raw cosine is rescaled: <= SEMANTIC_FLOOR counts as 0 and >= SEMANTIC_CEIL as 1.
// Calibrated 2026-11-22 against gemini-embedding-001: relevant docs scored ~0.69-0.71, unrelated ~0.55-0.63.
export const SEMANTIC_FLOOR = 0.60;
export const SEMANTIC_CEIL = 0.80;

function embeddingsAvailable() {
  return Date.now() >= cooldownUntil;
}

function recordEmbeddingResult(ok) {
  if (ok) {
    consecutiveFailures = 0;
    return;
  }
  consecutiveFailures += 1;
  if (consecutiveFailures >= FAILURE_LIMIT) {
    cooldownUntil = Date.now() + COOLDOWN_MS;
    consecutiveFailures = 0;
    console.warn(
      `[RAG Service] Embeddings failed ${FAILURE_LIMIT} times; using keyword-only retrieval for ${COOLDOWN_MS / 60000} min.`
    );
  }
}

function docEmbeddingText(doc) {
  return `${doc.title}\nKeywords: ${doc.keywords?.join(', ')}\n${doc.content}`;
}

export function normalizeSemantic(cosine) {
  if (!cosine || cosine <= SEMANTIC_FLOOR) return 0;
  return Math.min(1, (cosine - SEMANTIC_FLOOR) / (SEMANTIC_CEIL - SEMANTIC_FLOOR));
}

/**
 * Load knowledge chunks from JSON file
 */
export function getKnowledgeBase() {
  if (cachedKnowledgeBase) return cachedKnowledgeBase;

  try {
    const rawData = fs.readFileSync(KNOWLEDGE_PATH, 'utf-8');
    cachedKnowledgeBase = JSON.parse(rawData);
    return cachedKnowledgeBase;
  } catch (err) {
    console.error('[RAG Service] Failed to load knowledgeBase.json:', err.message);
    return [];
  }
}

/**
 * Tokenize string into meaningful lowercase keywords
 */
function tokenize(text = '') {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

/**
 * Calculate cosine similarity between two float vectors
 */
export function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Generate an embedding with the configured Gemini embedding model (see aiConfig.js).
 * Returns null on any failure; callers fall back to keyword scoring.
 */
async function generateEmbedding(text, isQuery = false) {
  const model = getEmbeddingModel();
  if (!model || !embeddingsAvailable()) return null;

  try {
    const result = await model.embedContent({
      content: { role: 'user', parts: [{ text }] },
      taskType: isQuery ? 'RETRIEVAL_QUERY' : 'RETRIEVAL_DOCUMENT',
    });
    const values = result.embedding?.values || null;
    recordEmbeddingResult(!!values);
    return values;
  } catch (err) {
    console.warn('[RAG Service] Gemini embedding API call failed:', err.message);
    recordEmbeddingResult(false);
    return null;
  }
}

/**
 * Compute lexical / keyword similarity score [0 to 1]
 */
function computeKeywordScore(queryTokens, doc) {
  if (!queryTokens || queryTokens.length === 0) return 0;

  const docKeywords = new Set(doc.keywords?.map((k) => k.toLowerCase()) || []);
  const titleTokens = new Set(tokenize(doc.title));
  const contentTokens = new Set(tokenize(doc.content));

  let matchedPoints = 0;
  const maxPossiblePoints = queryTokens.length * 3; // weight: 3 for keywords, 2 for title, 1 for content

  for (const token of queryTokens) {
    let tokenScore = 0;

    // Check exact or partial match in doc.keywords
    for (const kw of docKeywords) {
      if (kw.includes(token) || token.includes(kw)) {
        tokenScore = Math.max(tokenScore, 3);
        break;
      }
    }

    if (tokenScore < 2 && titleTokens.has(token)) {
      tokenScore = 2;
    }

    if (tokenScore < 1 && contentTokens.has(token)) {
      tokenScore = 1;
    }

    matchedPoints += tokenScore;
  }

  return maxPossiblePoints > 0 ? Math.min(1, matchedPoints / maxPossiblePoints) : 0;
}

/**
 * Index/warm knowledge base embeddings in memory with ONE batch call. Safe to call many times:
 * concurrent callers share the same promise and nothing is re-embedded once cached.
 */
export function initializeKnowledgeEmbeddings() {
  if (warmPromise) return warmPromise;
  warmPromise = (async () => {
    const docs = getKnowledgeBase();
    const model = getEmbeddingModel();
    const missing = docs.filter((d) => !embeddingCache.has(d.id));
    if (!model || missing.length === 0 || !embeddingsAvailable()) return;
    try {
      const res = await model.batchEmbedContents({
        requests: missing.map((doc) => ({
          content: { role: 'user', parts: [{ text: docEmbeddingText(doc) }] },
          taskType: 'RETRIEVAL_DOCUMENT',
        })),
      });
      (res.embeddings || []).forEach((e, i) => {
        if (e?.values) embeddingCache.set(missing[i].id, e.values);
      });
      recordEmbeddingResult(embeddingCache.size > 0);
    } catch (err) {
      console.warn('[RAG Service] Batch embedding of knowledge base failed:', err.message);
      recordEmbeddingResult(false);
    }
  })().finally(() => {
    // allow a later retry (e.g. after the cooldown) if the cache is still incomplete
    if (embeddingCache.size < getKnowledgeBase().length) warmPromise = null;
  });
  return warmPromise;
}

/**
 * Search the knowledge base using hybrid semantic + keyword matching
 * @param {string} query
 * @param {Object} options
 * @param {number} options.limit - Max documents to return (default: 3)
 * @param {number} options.minScore - Minimum combined score threshold (default: 0.15)
 */
export async function searchKnowledgeBase(query = '', { limit = 3, minScore = 0.15 } = {}) {
  const docs = getKnowledgeBase();
  if (!docs || docs.length === 0 || !query || !query.trim()) {
    return [];
  }

  const queryTokens = tokenize(query);

  // Vector retrieval is optional: any failure falls back to keyword-only scoring.
  let queryEmbedding = null;
  if (getEmbeddingModel() && embeddingsAvailable()) {
    await initializeKnowledgeEmbeddings();
    if (embeddingCache.size > 0) queryEmbedding = await generateEmbedding(query, true);
  }
  lastMode = queryEmbedding ? 'hybrid' : 'keyword';

  const scoredDocs = [];

  for (const doc of docs) {
    const kwScore = computeKeywordScore(queryTokens, doc);

    let semanticScore = 0;
    const docEmbedding = embeddingCache.get(doc.id);
    if (queryEmbedding && docEmbedding) {
      semanticScore = normalizeSemantic(cosineSimilarity(queryEmbedding, docEmbedding));
    }

    // 60% semantic + 40% keyword when vectors exist for this doc, otherwise keyword only
    const finalScore = queryEmbedding && docEmbedding ? 0.6 * semanticScore + 0.4 * kwScore : kwScore;

    if (finalScore >= minScore) {
      scoredDocs.push({
        ...doc,
        score: Number(finalScore.toFixed(3)),
        semanticScore: Number(semanticScore.toFixed(3)),
        keywordScore: Number(kwScore.toFixed(3)),
      });
    }
  }

  // Sort descending by finalScore and take top `limit`
  scoredDocs.sort((a, b) => b.score - a.score);
  return scoredDocs.slice(0, limit);
}

/**
 * Format retrieved documents into an LLM context block
 */
export function formatRagContext(retrievedDocs = []) {
  if (!retrievedDocs || retrievedDocs.length === 0) {
    return '';
  }

  const chunks = retrievedDocs.map((doc, idx) => {
    return `[Reference Document ${idx + 1}: ${doc.title} (Category: ${doc.category})]\n${doc.content}`;
  }).join('\n\n');

  return (
    `======================================================================\n` +
    `VERIFIED CLINICAL INTAKE KNOWLEDGE BASE (RETRIEVED VIA RAG):\n` +
    `Use the guidance below ONLY to shape intake questions and to recognise emergency danger signs.\n` +
    `CRITICAL: You are an intake scribe, NOT a doctor. NEVER name or suggest any skin condition, diagnosis or possible cause from this material, NEVER recommend or mention medications for the user to take, and NEVER give definitive medical opinions.\n` +
    `======================================================================\n` +
    `${chunks}\n` +
    `======================================================================`
  );
}

/**
 * High-level helper: Retrieve relevant clinical knowledge for a chat turn
 */
export async function retrieveRagContext(query = '', options = {}) {
  const docs = await searchKnowledgeBase(query, options);
  const formattedContext = formatRagContext(docs);
  return {
    docs,
    formattedContext,
    hasKnowledge: docs.length > 0,
  };
}

/**
 * Retrieve metadata and summary stats about the knowledge base
 */
export function getKnowledgeBaseStats() {
  const docs = getKnowledgeBase();
  return {
    totalDocuments: docs.length,
    cachedEmbeddingsCount: embeddingCache.size,
    retrievalMode: lastMode,
    embeddingsCoolingDown: !embeddingsAvailable(),
    categories: [...new Set(docs.map((d) => d.category))],
    documents: docs.map((d) => ({
      id: d.id,
      title: d.title,
      category: d.category,
      keywordCount: d.keywords?.length || 0,
    })),
  };
}

/** Test helper: reset module state. */
export function _resetRagStateForTests() {
  embeddingCache.clear();
  consecutiveFailures = 0;
  cooldownUntil = 0;
  warmPromise = null;
  lastMode = 'unknown';
}
