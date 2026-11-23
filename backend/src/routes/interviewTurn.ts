/**
 * interviewTurn.ts
 * Express Route Adapter for Cascaded Turn-based Audio & Text Evaluation (SPEC-27).
 * Thin transport layer delegating to GreetingSynthesisService and CascadedTurnEngine.
 * Cognitive Bounding SLA: <= 100 lines (Rule 8 compliant).
 */

import { Router, Request, Response } from 'express';
import { getAuthUserId } from '../middleware/auth';
import {
  GreetingSynthesisService,
  sanitizeVoice
} from '../services/interview/GreetingSynthesisService';
import {
  CascadedTurnEngine,
  getSafeSpokenText,
  DeductionItem,
  TurnReasoningResult
} from '../services/interview/CascadedTurnEngine';

export { sanitizeVoice, getSafeSpokenText, DeductionItem, TurnReasoningResult };

const router = Router();

// POST /api/interview/greeting - Synthesizes initial greeting and reads question
router.post('/greeting', async (req: Request, res: Response) => {
  try {
    if (!req.body.questionText) {
      return res.status(400).json({ error: 'questionText is required' });
    }

    const result = await GreetingSynthesisService.synthesizeGreeting({
      ...req.body,
      abortSignal: (req as any).signal
    });

    return res.json(result);
  } catch (err: any) {
    if ((req as any).signal?.aborted || err?.message === 'Request aborted by client') {
      return res.status(499).end();
    }
    console.error('Error in /api/interview/greeting:', err);
    return res.status(err?.category === 'transient' ? 503 : 500).json({
      error: err.userMessage || err.message || 'Greeting synthesis failed'
    });
  }
});

// POST /api/interview/turn - Cascaded Turn Engine (STT -> Gemini Fast Reasoning -> TTS v3)
router.post('/turn', async (req: Request, res: Response) => {
  try {
    if (!req.body.questionText) {
      return res.status(400).json({ error: 'questionText is required' });
    }

    const userId = getAuthUserId(req);
    const result = await CascadedTurnEngine.executeTurn({
      ...req.body,
      userId,
      abortSignal: (req as any).signal
    });

    return res.json(result);
  } catch (err: any) {
    if ((req as any).signal?.aborted || err?.message === 'Request aborted by client') {
      return res.status(499).end();
    }
    console.error('Error in /api/interview/turn:', err);
    return res.status(err?.category === 'transient' ? 503 : 500).json({
      error: err.userMessage || err.message || 'Interview turn processing failed'
    });
  }
});

export default router;
