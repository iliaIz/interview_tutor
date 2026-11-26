import { Router } from 'express';
import { getAuthUserId } from '../middleware/auth';
import { LlmGatewayUnavailableError } from '../services/LlmGatewayClient';
import { questionEvaluationService } from '../services/evaluation/QuestionEvaluationService';

const router = Router();

export interface SaveEvaluationPayload {
  questionId: string;
  topic: string;
  mode: 'voice' | 'text';
  score: number;
  isPassed: boolean;
  positivePoints: string[];
  missingPoints: string[];
  feedback: string;
  userAnswer?: string;
  transcript?: string;
  audioMetrics?: any;
  turnTelemetry?: any;
}

// POST /api/eval - Evaluate user text answer using Gemini and persist to SQLite
router.post('/', async (req, res) => {
  const abortController = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) abortController.abort();
  });

  try {
    const userId = getAuthUserId(req);
    const { questionId, topic, question, referenceAnswer, userAnswer, userGender } = req.body;

    if (!question || !referenceAnswer || !userAnswer) {
      return res.status(400).json({ error: 'Missing required parameters: question, referenceAnswer, userAnswer' });
    }

    const evaluation = await questionEvaluationService.evaluateTextAnswer({
      question,
      referenceAnswer,
      userAnswer,
      userGender: userGender || 'female',
      abortSignal: abortController.signal
    });

    let decayResult = null;
    let progressSummary = null;
    if (questionId && topic) {
      const outcome = await questionEvaluationService.recordOutcome({
        userId,
        questionId,
        topic,
        mode: 'text',
        score: evaluation.score,
        isPassed: evaluation.isPassed,
        positivePoints: evaluation.positivePoints,
        missingPoints: evaluation.missingPoints,
        feedback: evaluation.feedback,
        userAnswer: userAnswer || ''
      });
      decayResult = outcome.knowledgeUpdate;
      progressSummary = outcome.progress;
    }

    res.json({
      ...evaluation,
      knowledgeUpdate: decayResult,
      progress: progressSummary
    });
  } catch (error: any) {
    if ((req as any).signal?.aborted || error?.name === 'AbortError') {
      return res.status(499).end();
    }
    if (error instanceof LlmGatewayUnavailableError) {
      const status = error.reason === 'rate_limit_exceeded' ? 429 : 503;
      res.setHeader('Retry-After', String(error.retryAfterSeconds));
      return res.status(status).json({
        error: error.userMessage || error.message,
        reason: error.reason,
        category: error.category,
        retryAfterSeconds: error.retryAfterSeconds,
        healthEndpoint: error.healthEndpoint
      });
    }
    console.error('Error in /api/eval route:', error);
    res.status(500).json({ error: error.message || 'Failed to evaluate answer' });
  }
});

// POST /api/eval/save - Persist evaluation from Gemini Live Function Calling or client
router.post('/save', async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const {
      questionId,
      topic,
      mode = 'voice',
      score,
      isPassed,
      positivePoints = [],
      missingPoints = [],
      feedback = '',
      userAnswer = '',
      transcript = '',
      audioMetrics = null,
      turnTelemetry = null,
      audioPath = null
    } = req.body;

    if (!questionId || !topic || score === undefined) {
      return res.status(400).json({ error: 'Missing required parameters: questionId, topic, score' });
    }

    const numScore = Math.round(Number(score));
    const passedBool = isPassed !== undefined ? !!isPassed : numScore >= 70;

    const outcome = await questionEvaluationService.recordOutcome({
      userId,
      questionId,
      topic,
      mode,
      score: numScore,
      isPassed: passedBool,
      positivePoints,
      missingPoints,
      feedback,
      userAnswer,
      transcript,
      audioMetrics,
      turnTelemetry,
      audioPath
    });

    res.json({
      success: true,
      id: outcome.evalId,
      score: numScore,
      isPassed: passedBool,
      progress: outcome.progress,
      knowledgeUpdate: outcome.knowledgeUpdate,
      message: 'Evaluation saved and progress synchronized successfully'
    });
  } catch (error: any) {
    console.error('Error in /api/eval/save:', error);
    res.status(500).json({ error: error.message || 'Failed to save evaluation' });
  }
});

// GET /api/eval/latest/:questionId - Get the latest detailed report for a question
router.get('/latest/:questionId', (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const report = questionEvaluationService.getLatestEvaluation(req.params.questionId, userId);

    if (!report) {
      return res.status(404).json({ error: 'No evaluation found for this question' });
    }

    res.json(report);
  } catch (error: any) {
    console.error('Error in /api/eval/latest/:questionId:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch evaluation report' });
  }
});

// GET /api/eval/topic/:topicId - Get evaluation summary for all questions in a topic
router.get('/topic/:topicId', (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const summaries = questionEvaluationService.getTopicSummaries(req.params.topicId, userId);
    res.json(summaries);
  } catch (error: any) {
    console.error('Error in /api/eval/topic/:topicId:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch topic evaluations' });
  }
});

export default router;
