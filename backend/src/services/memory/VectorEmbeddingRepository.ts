/**
 * VectorEmbeddingRepository.ts
 * Manages text embedding generation, caching, and vector similarity calculations.
 * Encapsulates SQLite BLOB conversions and cached question vectors.
 * Cognitive Bounding Limit: <= 350 lines (Rule 8 compliant).
 */

import { db } from '../db';
import { envConfig } from '../../config/env';
import { llmGateway } from '../LlmGatewayClient';

export interface CachedQuestionEmbedding {
  questionId: string;
  topic: string;
  vec: Float32Array;
}

// In-memory LRU embedding cache (max 500 entries)
const textEmbeddingCache = new Map<string, Float32Array>();

// In-memory cache for question embeddings
let cachedQuestionEmbeddings: CachedQuestionEmbedding[] | null = null;
let lastCacheRefreshMs = 0;
const EMBEDDING_CACHE_TTL_MS = 60_000;

/**
 * Converts Float32Array to SQLite Buffer BLOB
 */
export function float32ArrayToBuffer(array: Float32Array): Buffer {
  return Buffer.from(array.buffer, array.byteOffset, array.byteLength);
}

/**
 * Converts SQLite Buffer BLOB back to Float32Array
 */
export function bufferToFloat32Array(buffer: Buffer): Float32Array {
  return new Float32Array(
    buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
  );
}

/**
 * High-performance cosine similarity between two Float32Array vectors
 */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;
  return dotProduct / denominator;
}

/**
 * Generates vector embedding via LiteLLM Proxy using GEMINI_EMBEDDING_MODEL
 */
export async function embedText(text: string): Promise<Float32Array> {
  const normalized = text.trim();
  if (!normalized) {
    return new Float32Array(768);
  }

  if (textEmbeddingCache.has(normalized)) {
    return textEmbeddingCache.get(normalized)!;
  }

  try {
    const floatArray = await llmGateway.embed({
      input: normalized,
      model: envConfig.models.embedding,
      maxRetries: 0,
      timeoutMs: 4_000
    });
    while (textEmbeddingCache.size >= 500) {
      const firstKey = textEmbeddingCache.keys().next().value;
      if (firstKey) textEmbeddingCache.delete(firstKey);
      else break;
    }
    textEmbeddingCache.set(normalized, floatArray);
    return floatArray;
  } catch (err: any) {
    console.warn(`Vector embedding generation failed for "${normalized.slice(0, 30)}...":`, err.message);
  }

  // Graceful fallback: deterministically hashed pseudo-vector
  const fallback = new Float32Array(768);
  for (let i = 0; i < normalized.length; i++) {
    const idx = (normalized.charCodeAt(i) * 31 + i) % 768;
    fallback[idx] += 0.05;
  }
  return fallback;
}

/**
 * Returns in-memory cached question embeddings to eliminate Event Loop blocking
 */
export function getCachedQuestionEmbeddings(): CachedQuestionEmbedding[] {
  const now = Date.now();
  if (cachedQuestionEmbeddings && now - lastCacheRefreshMs < EMBEDDING_CACHE_TTL_MS) {
    return cachedQuestionEmbeddings;
  }
  const rows = db.prepare('SELECT question_id, topic, embedding FROM question_embeddings').all() as any[];
  const list: CachedQuestionEmbedding[] = [];
  for (const r of rows) {
    if (!r.embedding) continue;
    const b = r.embedding as Buffer;
    const vec = new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
    list.push({
      questionId: r.question_id,
      topic: r.topic || '',
      vec
    });
  }
  cachedQuestionEmbeddings = list;
  lastCacheRefreshMs = now;
  return list;
}

/**
 * Invalidates question embedding in-memory cache
 */
export function invalidateQuestionEmbeddingCache(): void {
  cachedQuestionEmbeddings = null;
  lastCacheRefreshMs = 0;
}

/**
 * Fetches cached question embedding from SQLite or generates and caches it
 */
export async function getOrCacheQuestionEmbedding(
  questionId: string,
  questionText: string,
  topic: string
): Promise<Float32Array> {
  const cached = db.prepare('SELECT embedding FROM question_embeddings WHERE question_id = ?').get(questionId) as any;
  if (cached && cached.embedding) {
    return bufferToFloat32Array(cached.embedding);
  }

  const vec = await embedText(`${topic}: ${questionText}`);
  const blob = float32ArrayToBuffer(vec);

  try {
    db.prepare(`
      INSERT INTO question_embeddings (question_id, topic, embedding, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(question_id) DO UPDATE SET
        topic = excluded.topic,
        embedding = excluded.embedding,
        updated_at = CURRENT_TIMESTAMP
    `).run(questionId, topic, blob);
    invalidateQuestionEmbeddingCache();
  } catch (err: any) {
    console.warn(`Failed to cache question embedding for ${questionId}:`, err.message);
  }

  return vec;
}
