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
 * Generate embedding for text using Google Gemini text-embedding-004
 */
async function generateEmbedding(text) {
  const model = getEmbeddingModel();
  if (!model) return null;

  try {
    const result = await model.embedContent(text);
    return result.embedding?.values || null;
  } catch (err) {
    console.warn('[RAG Service] Gemini embedding API call skipped/failed:', err.message);
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
  let maxPossiblePoints = queryTokens.length * 3; // weight: 3 for keywords, 2 for title, 1 for content

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
 * Index/warm knowledge base embeddings in memory
 */
export async function initializeKnowledgeEmbeddings() {
  const docs = getKnowledgeBase();
  const model = getEmbeddingModel();
  if (!model) return;

  for (const doc of docs) {
    if (!embeddingCache.has(doc.id)) {
      const textToEmbed = `${doc.title}\nKeywords: ${doc.keywords?.join(', ')}\n${doc.content}`;
      const emb = await generateEmbedding(textToEmbed);
      if (emb) {
        embeddingCache.set(doc.id, emb);
      }
    }
  }
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

  // Try generating query vector embedding
  let queryEmbedding = null;
  const model = getEmbeddingModel();
  if (model) {
    queryEmbedding = await generateEmbedding(query);
  }

  const scoredDocs = [];

  for (const doc of docs) {
    // 1. Keyword score
    const kwScore = computeKeywordScore(queryTokens, doc);

    // 2. Semantic vector score
    let semanticScore = 0;
    if (queryEmbedding) {
      let docEmbedding = embeddingCache.get(doc.id);
      if (!docEmbedding) {
        const textToEmbed = `${doc.title}\nKeywords: ${doc.keywords?.join(', ')}\n${doc.content}`;
        docEmbedding = await generateEmbedding(textToEmbed);
        if (docEmbedding) embeddingCache.set(doc.id, docEmbedding);
      }

      if (docEmbedding) {
        semanticScore = cosineSimilarity(queryEmbedding, docEmbedding);
      }
    }

    // 3. Combined Hybrid Score
    // If semantic embedding is available, weigh 60% semantic + 40% keyword; else 100% keyword
    const finalScore = queryEmbedding && semanticScore > 0
      ? 0.6 * semanticScore + 0.4 * kwScore
      : kwScore;

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
    `Use the factual guidance below to inform your intake questions, objective visual observations, danger sign detection, and comfort care recommendations.\n` +
    `CRITICAL: You are an intake scribe, NOT a doctor. Do NOT use this knowledge to diagnose diseases, prescribe medication, or give definitive medical opinions.\n` +
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
    categories: [...new Set(docs.map((d) => d.category))],
    documents: docs.map((d) => ({
      id: d.id,
      title: d.title,
      category: d.category,
      keywordCount: d.keywords?.length || 0,
    })),
  };
}
