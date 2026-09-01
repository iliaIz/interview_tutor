import crypto from 'crypto';
import dotenv from 'dotenv';
import { db } from './db';
import { envConfig } from '../config/env';

dotenv.config();

export interface CandidateGap {
  id: string;
  questionId?: string;
  topic: string;
  subtopic?: string;
  errorConcept: string;
  deficitWeight: number;
  status: 'ACTIVE_DEFICIT' | 'VERIFYING' | 'MASTERED';
  soloStreak: number;
  similarity?: number;
}

export interface KnowledgeDecayParams {
  gapId?: string;
  questionId?: string;
  topic: string;
  errorConcept?: string;
  assistanceLevel: 'solo' | 'guided' | 'assisted' | 'relapse';
  score?: number;
  feedback?: string;
}

export interface UserProfileData {
  id: string;
  candidateName: string;
  targetSeniority: 'junior' | 'middle' | 'senior' | 'lead';
  primaryStack: string;
  preferredTone: 'rigorous' | 'supportive' | 'academic';
  focusAreas: string[];
}

// In-memory LRU embedding cache (max 500 entries)
const embeddingCache = new Map<string, Float32Array>();

/**
 * Converts Float32Array to SQLite Buffer BLOB
 */
function float32ArrayToBuffer(array: Float32Array): Buffer {
  return Buffer.from(array.buffer, array.byteOffset, array.byteLength);
}

/**
 * Converts SQLite Buffer BLOB back to Float32Array
 */
function bufferToFloat32Array(buffer: Buffer): Float32Array {
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

  if (embeddingCache.has(normalized)) {
    return embeddingCache.get(normalized)!;
  }

  const cleanProxyBase = envConfig.proxy.baseUrl;
  const proxyApiKey = envConfig.proxy.apiKey;
  const embeddingModel = envConfig.models.embedding;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000); // 4s timeout

    const res = await fetch(`${cleanProxyBase}/v1/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${proxyApiKey}`
      },
      body: JSON.stringify({
        model: embeddingModel,
        input: normalized
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      const rawVector = data?.data?.[0]?.embedding;
      if (Array.isArray(rawVector) && rawVector.length > 0) {
        const floatArray = new Float32Array(rawVector);
        if (embeddingCache.size > 500) {
          const firstKey = embeddingCache.keys().next().value;
          if (firstKey) embeddingCache.delete(firstKey);
        }
        embeddingCache.set(normalized, floatArray);
        return floatArray;
      }
    } else {
      console.warn(`Embedding API response not ok (${res.status}): ${await res.text()}`);
    }
  } catch (err: any) {
    console.warn(`Embedding API error via LiteLLM (${embeddingModel}):`, err.message);
  }

  // Graceful deterministic fallback pseudo-vector (so system never blocks)
  return createFallbackVector(normalized);
}

/**
 * Deterministic fallback vector in case gateway is warming up
 */
function createFallbackVector(text: string): Float32Array {
  const vec = new Float32Array(768);
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash |= 0;
  }
  for (let i = 0; i < 768; i++) {
    vec[i] = Math.sin(hash + i);
  }
  return vec;
}

/**
 * Retrieves pre-cached question embedding or generates and stores one
 */
export async function getOrCacheQuestionEmbedding(questionId: string, questionText: string, topic: string): Promise<Float32Array> {
  if (questionId) {
    try {
      const row = db.prepare('SELECT embedding FROM question_embeddings WHERE question_id = ?').get(questionId) as any;
      if (row && row.embedding) {
        return bufferToFloat32Array(row.embedding);
      }
    } catch (e) {
      console.warn('Error reading question embedding from db:', e);
    }
  }

  // Generate embedding
  const fullText = `${topic}: ${questionText}`;
  const embedding = await embedText(fullText);

  if (questionId) {
    try {
      const blob = float32ArrayToBuffer(embedding);
      db.prepare(`
        INSERT OR REPLACE INTO question_embeddings (question_id, topic, embedding, updated_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      `).run(questionId, topic, blob);
    } catch (e) {
      console.warn('Error saving question embedding to db:', e);
    }
  }

  return embedding;
}

/**
 * Fast KNN search for candidate gaps relevant to the current question
 */
export async function findRelevantCandidateGaps(
  questionText: string,
  topic: string,
  questionId?: string,
  threshold = 0.70
): Promise<CandidateGap[]> {
  try {
    const questionVec = questionId
      ? await getOrCacheQuestionEmbedding(questionId, questionText, topic)
      : await embedText(`${topic}: ${questionText}`);

    // Query active and verifying candidate gaps
    const rows = db.prepare(`
      SELECT id, question_id, topic, subtopic, error_concept, embedding, deficit_weight, status, solo_streak
      FROM candidate_error_vectors
      WHERE status IN ('ACTIVE_DEFICIT', 'VERIFYING')
      ORDER BY updated_at DESC
      LIMIT 100
    `).all() as any[];

    if (!rows || rows.length === 0) {
      return [];
    }

    const matches: CandidateGap[] = [];

    for (const row of rows) {
      if (!row.embedding) continue;
      const gapVec = bufferToFloat32Array(row.embedding);
      const sim = cosineSimilarity(questionVec, gapVec);

      if (sim >= threshold) {
        matches.push({
          id: row.id,
          questionId: row.question_id,
          topic: row.topic,
          subtopic: row.subtopic,
          errorConcept: row.error_concept,
          deficitWeight: row.deficit_weight,
          status: row.status,
          soloStreak: row.solo_streak,
          similarity: sim
        });
      }
    }

    // Sort by cosine similarity descending
    matches.sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0));

    // Return TOP 2 most relevant gaps
    return matches.slice(0, 2);
  } catch (err) {
    console.error('Error finding relevant candidate gaps:', err);
    return [];
  }
}

/**
 * Applies Scaffolded Knowledge Decay math upon question completion
 */
export async function applyKnowledgeDecay(params: KnowledgeDecayEventParams): Promise<{
  updatedGaps: { id: string; oldWeight: number; newWeight: number; newStatus: string; delta: number }[];
  masteredCount: number;
}> {
  const { questionId, topic, assistanceLevel, resolvedGapIds = [] } = params;
  const results: { id: string; oldWeight: number; newWeight: number; newStatus: string; delta: number }[] = [];
  let masteredCount = 0;

  let delta = 0;
  if (assistanceLevel === 'solo') delta = -1.0;
  else if (assistanceLevel === 'guided') delta = -0.5;
  else if (assistanceLevel === 'assisted') delta = -0.25;
  else if (assistanceLevel === 'relapse') delta = +0.8;

  // 1. If specific gap IDs were resolved / tested
  const targetIds = [...resolvedGapIds];

  // If none specified, find gaps matching question_id or topic
  if (targetIds.length === 0 && questionId) {
    const matchingRows = db.prepare(`
      SELECT id FROM candidate_error_vectors
      WHERE question_id = ? AND status IN ('ACTIVE_DEFICIT', 'VERIFYING')
    `).all(questionId) as any[];
    matchingRows.forEach((r) => targetIds.push(r.id));
  }

  for (const gapId of targetIds) {
    const row = db.prepare('SELECT * FROM candidate_error_vectors WHERE id = ?').get(gapId) as any;
    if (!row) continue;

    const oldWeight = row.deficit_weight;
    let newWeight = oldWeight + delta;
    newWeight = Math.max(0.0, Math.min(1.0, parseFloat(newWeight.toFixed(2))));

    let newStatus = row.status;
    let newSoloStreak = row.solo_streak;
    let newAssistedCount = row.assisted_count;

    if (assistanceLevel === 'solo') {
      newSoloStreak += 1;
      if (newWeight <= 0.1 || newSoloStreak >= 1) {
        newWeight = 0.0;
        newStatus = 'MASTERED';
        masteredCount++;
      } else {
        newStatus = 'VERIFYING';
      }
    } else if (assistanceLevel === 'guided') {
      if (newWeight <= 0.1) {
        newWeight = 0.0;
        newStatus = 'MASTERED';
        masteredCount++;
      } else {
        newStatus = 'VERIFYING';
      }
    } else if (assistanceLevel === 'assisted') {
      newAssistedCount += 1;
      newStatus = newWeight <= 0.4 ? 'VERIFYING' : 'ACTIVE_DEFICIT';
    } else if (assistanceLevel === 'relapse') {
      newSoloStreak = 0;
      newStatus = 'ACTIVE_DEFICIT';
    }

    db.prepare(`
      UPDATE candidate_error_vectors
      SET deficit_weight = @newWeight,
          status = @newStatus,
          solo_streak = @newSoloStreak,
          assisted_count = @newAssistedCount,
          last_tested_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = @id
    `).run({
      newWeight,
      newStatus,
      newSoloStreak,
      newAssistedCount,
      id: gapId
    });

    results.push({
      id: gapId,
      oldWeight,
      newWeight,
      newStatus,
      delta
    });
  }

  return { updatedGaps: results, masteredCount };
}

export interface KnowledgeDecayEventParams {
  questionId?: string;
  topic: string;
  assistanceLevel: 'solo' | 'guided' | 'assisted' | 'relapse';
  resolvedGapIds?: string[];
}

/**
 * Records a new error gap discovered during an evaluation
 */
export async function recordNewErrorGap(params: {
  questionId?: string;
  topic: string;
  subtopic?: string;
  errorConcept: string;
  initialDeficit?: number;
  userId?: string;
}): Promise<string> {
  const { questionId, topic, subtopic, errorConcept, initialDeficit = 1.0, userId = 'default_user' } = params;
  const id = `gap_${crypto.randomBytes(12).toString('hex')}`;

  // Check if identical or very similar error already exists for this user
  const existing = db.prepare(`
    SELECT id, deficit_weight, solo_streak
    FROM candidate_error_vectors
    WHERE user_id = ? AND topic = ? AND error_concept = ?
  `).get(userId, topic, errorConcept) as any;

  if (existing) {
    db.prepare(`
      UPDATE candidate_error_vectors
      SET deficit_weight = 1.0,
          status = 'ACTIVE_DEFICIT',
          solo_streak = 0,
          last_tested_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(existing.id);
    return existing.id;
  }

  const embedding = await embedText(`${topic} ${subtopic || ''}: ${errorConcept}`);
  const blob = float32ArrayToBuffer(embedding);

  db.prepare(`
    INSERT INTO candidate_error_vectors (
      id, user_id, question_id, topic, subtopic, error_concept,
      embedding, deficit_weight, status, solo_streak, assisted_count,
      last_tested_at, created_at, updated_at
    ) VALUES (
      @id, @userId, @questionId, @topic, @subtopic, @errorConcept,
      @embedding, @deficitWeight, 'ACTIVE_DEFICIT', 0, 0,
      CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
  `).run({
    id,
    userId,
    questionId: questionId || null,
    topic,
    subtopic: subtopic || null,
    errorConcept,
    embedding: blob,
    deficitWeight: initialDeficit
  });

  return id;
}

/**
 * Fetches analytics and gap list for Knowledge Radar UI
 */
export function getKnowledgeRadarData(): {
  activeDeficits: CandidateGap[];
  verifyingGaps: CandidateGap[];
  masteredGaps: CandidateGap[];
  stats: { activeCount: number; verifyingCount: number; masteredCount: number; totalGaps: number };
} {
  const rows = db.prepare(`
    SELECT id, question_id, topic, subtopic, error_concept, deficit_weight, status, solo_streak, last_tested_at
    FROM candidate_error_vectors
    ORDER BY updated_at DESC
  `).all() as any[];

  const activeDeficits: CandidateGap[] = [];
  const verifyingGaps: CandidateGap[] = [];
  const masteredGaps: CandidateGap[] = [];

  for (const r of rows) {
    const item: CandidateGap = {
      id: r.id,
      questionId: r.question_id,
      topic: r.topic,
      subtopic: r.subtopic,
      errorConcept: r.error_concept,
      deficitWeight: r.deficit_weight,
      status: r.status,
      soloStreak: r.solo_streak
    };

    if (r.status === 'MASTERED') {
      masteredGaps.push(item);
    } else if (r.status === 'VERIFYING') {
      verifyingGaps.push(item);
    } else {
      activeDeficits.push(item);
    }
  }

  return {
    activeDeficits,
    verifyingGaps,
    masteredGaps,
    stats: {
      activeCount: activeDeficits.length,
      verifyingCount: verifyingGaps.length,
      masteredCount: masteredGaps.length,
      totalGaps: rows.length
    }
  };
}

/**
 * Resets a gap status back to ACTIVE_DEFICIT for intentional re-practice
 */
export function resetGapForPractice(gapId: string): boolean {
  const info = db.prepare(`
    UPDATE candidate_error_vectors
    SET deficit_weight = 1.0,
        status = 'ACTIVE_DEFICIT',
        solo_streak = 0,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(gapId);
  return info.changes > 0;
}

/**
 * Fetches user profile settings
 */
export function getUserProfile(): UserProfileData {
  const row = db.prepare('SELECT * FROM user_profile_settings WHERE id = ?').get('default_user') as any;
  if (!row) {
    return {
      id: 'default_user',
      candidateName: 'Кандидат',
      targetSeniority: 'senior',
      primaryStack: 'Java 21, Spring Boot 3.3, PostgreSQL, Kafka',
      preferredTone: 'rigorous',
      focusAreas: ['Spring Transactional', 'JMM & Concurrency', 'Kafka Partitions']
    };
  }

  let focusAreas: string[] = [];
  try {
    if (row.focus_areas_json) focusAreas = JSON.parse(row.focus_areas_json);
  } catch {}

  return {
    id: row.id,
    candidateName: row.candidate_name || 'Кандидат',
    targetSeniority: row.target_seniority || 'senior',
    primaryStack: row.primary_stack || 'Java 21, Spring Boot 3.3, PostgreSQL, Kafka',
    preferredTone: row.preferred_tone || 'rigorous',
    focusAreas
  };
}

/**
 * Updates user profile settings
 */
export function updateUserProfile(profile: Partial<UserProfileData>): UserProfileData {
  const current = getUserProfile();
  const updated: UserProfileData = {
    ...current,
    ...profile,
    focusAreas: profile.focusAreas || current.focusAreas
  };

  db.prepare(`
    INSERT INTO user_profile_settings (
      id, candidate_name, target_seniority, primary_stack, preferred_tone, focus_areas_json, updated_at
    ) VALUES (
      @id, @candidateName, @targetSeniority, @primaryStack, @preferredTone, @focusAreasJson, CURRENT_TIMESTAMP
    )
    ON CONFLICT(id) DO UPDATE SET
      candidate_name = excluded.candidate_name,
      target_seniority = excluded.target_seniority,
      primary_stack = excluded.primary_stack,
      preferred_tone = excluded.preferred_tone,
      focus_areas_json = excluded.focus_areas_json,
      updated_at = CURRENT_TIMESTAMP
  `).run({
    id: updated.id,
    candidateName: updated.candidateName,
    targetSeniority: updated.targetSeniority,
    primaryStack: updated.primaryStack,
    preferredTone: updated.preferredTone,
    focusAreasJson: JSON.stringify(updated.focusAreas)
  });

  return updated;
}
