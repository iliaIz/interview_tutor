/**
 * practice.ts
 * Lean HTTP Adapter for Coding Practice & Challenge Catalog.
 * Delegates all domain persistence and business logic to PracticeChallengeCatalog.
 * Cognitive Bounding SLA: <= 120 lines (Rule 8 compliant, down from 331 lines).
 */

import { Router } from 'express';
import { getAuthUserId, requireAuth } from '../middleware/auth';
import { AstAuditService } from '../services/astAuditService';
import { DynamicTaskGenerator } from '../services/dynamicTaskGenerator';
import { handleEvaluationStream } from './practiceSseAdapter';
import { PracticeChallengeCatalog } from '../services/practice/PracticeChallengeCatalog';

const router = Router();

// GET /api/practice/challenges - List challenges with optional category/track filter
router.get('/challenges', (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const { category, track } = req.query;
    const result = PracticeChallengeCatalog.listChallenges(
      { category: category as string, track: track as string },
      userId
    );
    res.json(result);
  } catch (err: any) {
    console.error('Error fetching practice challenges:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/practice/challenges/:id - Get challenge manifest and active user draft
router.get('/challenges/:id', (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const details = PracticeChallengeCatalog.getChallengeManifest(req.params.id, userId);
    if (!details) {
      return res.status(404).json({ error: 'Coding challenge not found' });
    }
    res.json(details);
  } catch (err: any) {
    console.error('Error fetching challenge by ID:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/practice/challenges/:id/evaluate & /api/practice/evaluate - SSE evaluation stream
router.post('/challenges/:id/evaluate', requireAuth, handleEvaluationStream);
router.post('/evaluate', requireAuth, handleEvaluationStream);

// POST /api/practice/draft & /api/practice/save-draft - Save workspace draft
const handleDraftSave = (req: any, res: any) => {
  try {
    const userId = getAuthUserId(req);
    const result = PracticeChallengeCatalog.saveDraft(userId, req.body);
    res.json(result);
  } catch (err: any) {
    const status = err.message.includes('required') || err.message.includes('exceed') ? 400 : 500;
    res.status(status).json({ error: err.message });
  }
};
router.post('/draft', requireAuth, handleDraftSave);
router.post('/save-draft', requireAuth, handleDraftSave);

// POST /api/practice/transaction-lab/draft - Save Transaction Lab draft
router.post('/transaction-lab/draft', requireAuth, (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const { scenarioId, userConfigs, threads = 1 } = req.body;
    const result = PracticeChallengeCatalog.saveTransactionLabDraft(userId, scenarioId, userConfigs, threads);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/practice/transaction-lab/draft/:scenarioId - Get Transaction Lab draft
router.get('/transaction-lab/draft/:scenarioId', requireAuth, (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const draft = PracticeChallengeCatalog.getTransactionLabDraft(userId, req.params.scenarioId);
    res.json({ draft });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/practice/reset/:challengeId - Reset workspace draft to initial state
router.post('/reset/:challengeId', requireAuth, (req, res) => {
  try {
    const userId = getAuthUserId(req);
    PracticeChallengeCatalog.resetWorkspace(userId, String(req.params.challengeId));
    res.json({ success: true, message: 'Challenge workspace reset to default.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/practice/audit - Run deterministic AST static audit
router.post('/audit', (req, res) => {
  try {
    const { code } = req.body;
    const result = AstAuditService.audit(code || '');
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/practice/generate-task - Generate dynamic Java kata
router.post('/generate-task', async (req, res) => {
  try {
    const task = await DynamicTaskGenerator.generateTask(req.body || {});
    res.json(task);
  } catch (err: any) {
    if (err.name === 'LlmGatewayUnavailableError') {
      return res.status(503).json({
        error: 'LLM_GATEWAY_TEMPORARILY_UNAVAILABLE',
        category: err.category || 'transient',
        reason: err.reason || 'proxy_unreachable',
        userMessage: err.userMessage || 'ИИ-модель перегружена или шлюз временно недоступен.',
        retryAfterSeconds: err.retryAfterSeconds || 5,
        healthEndpoint: err.healthEndpoint || '/api/health',
        availableBankCount: err.availableBankCount || 70,
        technicalDetails: err.message
      });
    }
    res.status(500).json({ error: err.message });
  }
});

// GET /api/practice/:challengeId/export-zip - Download Maven project ZIP
router.get('/:challengeId/export-zip', requireAuth, (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const { filename, buffer } = PracticeChallengeCatalog.exportMavenPackage(req.params.challengeId, userId);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err: any) {
    const status = err.message === 'Challenge not found' ? 404 : 500;
    res.status(status).json({ error: err.message });
  }
});

export default router;
