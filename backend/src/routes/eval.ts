import { Router } from 'express';
import { evaluateAnswerWithGemini } from '../services/geminiText';

const router = Router();

// POST /api/eval - Evaluate user text answer using Gemini 3.5 Flash Lite
router.post('/', async (req, res) => {
  try {
    const { question, referenceAnswer, userAnswer } = req.body;

    if (!question || !referenceAnswer || !userAnswer) {
      return res.status(400).json({ error: 'Missing required parameters: question, referenceAnswer, userAnswer' });
    }

    const evaluation = await evaluateAnswerWithGemini(question, referenceAnswer, userAnswer);
    res.json(evaluation);
  } catch (error: any) {
    console.error('Error in /api/eval route:', error);
    res.status(500).json({ error: error.message || 'Failed to evaluate answer' });
  }
});

export default router;
