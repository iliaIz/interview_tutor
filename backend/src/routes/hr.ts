import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { getAllHrQuestions, getHrQuestion, getCandidateDossier, getJobContext } from '../services/live/hrContextResolver';
import { resolveQuestionMicroBeats } from '../services/live/hrGuidedStepper';
import { synthesizeTTSWithRetry } from '../services/podcast';
import { DEFAULT_VOICE_NAME, sanitizeVoiceName } from '../config/liveDefaults';

export const hrRouter = Router();

const MAX_STUDY_TTS_CACHE = 120;
const studyTtsCache = new Map<string, Buffer>();

function getCachedStudyAudio(key: string): Buffer | undefined {
  const existing = studyTtsCache.get(key);
  if (!existing) return undefined;
  studyTtsCache.delete(key);
  studyTtsCache.set(key, existing);
  return existing;
}

function setCachedStudyAudio(key: string, buf: Buffer): void {
  if (studyTtsCache.size >= MAX_STUDY_TTS_CACHE) {
    const oldestKey = studyTtsCache.keys().next().value;
    if (oldestKey) studyTtsCache.delete(oldestKey);
  }
  studyTtsCache.set(key, buf);
}

/**
 * GET /api/hr/questions
 * Returns all canonical questions and rubrics from canonicalQuestionMatrix.json
 */
hrRouter.get('/questions', (_req: Request, res: Response) => {
  try {
    const questions = getAllHrQuestions();
    res.json({ questions, count: questions.length });
  } catch (err: any) {
    console.error('[HR_ROUTER_ERROR] Failed to fetch questions:', err);
    res.status(500).json({ error: 'Failed to fetch HR questions' });
  }
});

/**
 * GET /api/hr/questions/:id
 * Returns a specific question by id
 */
hrRouter.get('/questions/:id', (req: Request, res: Response) => {
  try {
    const questionId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const question = getHrQuestion(questionId);
    if (!question || (questionId !== question.id && questionId !== 'default')) {
      return res.status(404).json({ error: `Question not found: ${questionId}` });
    }
    res.json({ question });
  } catch (err: any) {
    console.error(`[HR_ROUTER_ERROR] Failed to fetch question:`, err);
    res.status(500).json({ error: 'Failed to fetch question' });
  }
});

/**
 * GET /api/hr/dossier
 * Returns the canonical candidate dossier
 */
hrRouter.get('/dossier', (_req: Request, res: Response) => {
  try {
    const dossier = getCandidateDossier();
    res.json({ dossier });
  } catch (err: any) {
    console.error('[HR_ROUTER_ERROR] Failed to fetch dossier:', err);
    res.status(500).json({ error: 'Failed to fetch candidate dossier' });
  }
});

/**
 * GET /api/hr/job-context
 * Returns the default job context
 */
hrRouter.get('/job-context', (_req: Request, res: Response) => {
  try {
    const jobContext = getJobContext();
    res.json({ jobContext });
  } catch (err: any) {
    console.error('[HR_ROUTER_ERROR] Failed to fetch job context:', err);
    res.status(500).json({ error: 'Failed to fetch job context' });
  }
});

/**
 * GET /api/hr/study-tts
 * Synthesizes WAV audio for a specific micro-beat phrasing variant using the global chosen Gemini TTS voice.
 * Query: questionId, beatId, variantIdx (default 0), voice (sanitized)
 */
hrRouter.get('/study-tts', async (req: Request, res: Response) => {
  try {
    const questionId = String(req.query.questionId || '').trim();
    const beatId = String(req.query.beatId || '').trim();
    const rawIdx = req.query.variantIdx !== undefined ? Number(req.query.variantIdx) : 0;

    if (!questionId || !beatId || !Number.isInteger(rawIdx) || rawIdx < 0) {
      return res.status(400).json({ error: 'Invalid or missing questionId, beatId, or variantIdx' });
    }

    const question = getHrQuestion(questionId);
    if (!question || question.id !== questionId) {
      return res.status(404).json({ error: `Question not found: ${questionId}` });
    }

    const beats = resolveQuestionMicroBeats(question);
    const beat = beats.find((b) => b.id === beatId);
    if (!beat) {
      return res.status(404).json({ error: `Micro-beat not found: ${beatId}` });
    }

    if (rawIdx >= beat.spokenVariants.length) {
      return res.status(400).json({ error: `variantIdx out of bounds (0..${beat.spokenVariants.length - 1})` });
    }

    const text = beat.spokenVariants[rawIdx].trim();
    const voice = sanitizeVoiceName(req.query.voice, DEFAULT_VOICE_NAME);
    const textHash = crypto.createHash('sha1').update(`${voice}:${text}`).digest('hex');

    const cached = getCachedStudyAudio(textHash);
    if (cached) {
      res.setHeader('Content-Type', 'audio/wav');
      res.setHeader('Cache-Control', 'private, max-age=86400');
      res.setHeader('X-Study-TTS-Cache', 'HIT');
      return res.send(cached);
    }

    const { buffer } = await synthesizeTTSWithRetry(text, voice, 3);
    setCachedStudyAudio(textHash, buffer);

    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.setHeader('X-Study-TTS-Cache', 'MISS');
    return res.send(buffer);
  } catch (err: any) {
    console.error('[HR_STUDY_TTS_ERROR] Synthesis failed:', err);
    return res.status(503).json({
      error: 'Синтез речи временно недоступен. Вы можете продолжить чтение карточки или голосовой тренажёр.',
      details: err?.message || 'TTS gateway error'
    });
  }
});
