import { Router } from 'express';
import { db } from '../services/db';
import { evaluateChallengeSubmission } from '../services/codeEvaluator';
import { CodingChallenge } from '../services/challengeSeedData';
import { getAuthUserId } from '../middleware/auth';
import { JvmExecutionService } from '../services/sandbox/JvmExecutionService';

const router = Router();

// GET /api/practice/challenges - List all challenges with category filter & submission status for current user
router.get('/challenges', (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const { category, track } = req.query;
    let query = 'SELECT id, slug, title, category, track, badge, difficulty, target_stack, time_limit_minutes, short_description, updated_at FROM coding_challenges';
    const params: any[] = [];
    const whereClauses: string[] = [];

    if (category && category !== 'all') {
      whereClauses.push('category = ?');
      params.push(category);
    }
    if (track && track !== 'all') {
      whereClauses.push('track = ?');
      params.push(track);
    }

    if (whereClauses.length > 0) {
      query += ' WHERE ' + whereClauses.join(' AND ');
    }
    query += ' ORDER BY created_at ASC';

    const rows = db.prepare(query).all(...params) as any[];

    // Fetch submission status for the authenticated user
    const subStmt = db.prepare('SELECT challenge_id, status, score, updated_at FROM coding_submissions WHERE user_id = ?');
    const submissions = subStmt.all(userId) as any[];
    const subMap = new Map(submissions.map(s => [s.challenge_id, s]));

    const result = rows.map(r => {
      const sub = subMap.get(r.id);
      return {
        ...r,
        track: r.track || 'lld_bigtech',
        timeLimitMinutes: r.time_limit_minutes,
        targetStack: r.target_stack,
        shortDescription: r.short_description,
        isCompleted: sub?.status === 'PASSED' || (sub?.score !== undefined && sub.score >= 70),
        lastScore: sub?.score,
        lastStatus: sub?.status || 'NOT_STARTED'
      };
    });

    res.json(result);
  } catch (err: any) {
    console.error('Error fetching practice challenges:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/practice/challenges/:id - Get full challenge manifest for current user
router.get('/challenges/:id', (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const challengeId = req.params.id;
    const row = db.prepare('SELECT manifest_json FROM coding_challenges WHERE id = ? OR slug = ?').get(challengeId, challengeId) as any;

    if (!row) {
      return res.status(404).json({ error: 'Coding challenge not found' });
    }

    const manifest: CodingChallenge = JSON.parse(row.manifest_json);

    // Check if user has an active draft
    const draftRow = db.prepare('SELECT files_json, active_phase, status, score, evaluation_json, time_spent_seconds FROM coding_submissions WHERE challenge_id = ? AND user_id = ?')
      .get(manifest.id, userId) as any;

    let draftFiles = null;
    let activePhase = 1;
    let lastEvaluation = null;
    let timeSpentSeconds = 0;

    if (draftRow) {
      try {
        draftFiles = JSON.parse(draftRow.files_json);
        activePhase = draftRow.active_phase || 1;
        timeSpentSeconds = draftRow.time_spent_seconds || 0;
        if (draftRow.evaluation_json) {
          lastEvaluation = JSON.parse(draftRow.evaluation_json);
        }
      } catch {}
    }

    res.json({
      challenge: manifest,
      savedDraft: draftFiles,
      activePhase,
      lastEvaluation,
      timeSpentSeconds
    });
  } catch (err: any) {
    console.error('Error fetching challenge by ID:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/practice/evaluate - Submit workspace files for dual-pass evaluation
router.post('/evaluate', async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const { challengeId, files, activePhase = 1, timeSpentSeconds = 0 } = req.body;

    if (!challengeId || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: 'challengeId and non-empty files array are required' });
    }

    if (files.length > 15) {
      return res.status(400).json({ error: 'Exceeded maximum allowable files limit (15 files max)' });
    }

    for (const f of files) {
      if (typeof f.content === 'string' && f.content.length > 200_000) {
        return res.status(400).json({ error: `File ${f.path || 'unknown'} exceeds maximum allowable size (200KB max)` });
      }
    }

    const row = db.prepare('SELECT manifest_json FROM coding_challenges WHERE id = ?').get(challengeId) as any;
    if (!row) {
      return res.status(404).json({ error: 'Challenge not found' });
    }

    const challenge: CodingChallenge = JSON.parse(row.manifest_json);

    // 1. Authoritative Real JVM 21 In-Memory Sandbox Execution (< 80ms)
    const sandboxResult = await JvmExecutionService.execute({
      challengeId,
      files,
      activePhase
    });

    // 2. Enriched Architectural & Concurrency Evaluation
    const evaluation = await evaluateChallengeSubmission({
      challenge,
      files,
      activePhase,
      timeSpentSeconds,
      sandboxResult
    });

    const isPassed = evaluation.scoreBreakdown.overallScore >= 70 && !evaluation.concurrencyAnalysis.hasCarrierThreadPinning;
    const status = isPassed ? 'PASSED' : 'FAILED';

    // Upsert into coding_submissions with isolated userId
    const upsertStmt = db.prepare(`
      INSERT INTO coding_submissions (
        id, challenge_id, user_id, files_json, active_phase, status, score,
        evaluation_json, time_spent_seconds, updated_at
      ) VALUES (
        @id, @challenge_id, @user_id, @files_json, @active_phase, @status, @score,
        @evaluation_json, @time_spent_seconds, CURRENT_TIMESTAMP
      )
      ON CONFLICT(id) DO UPDATE SET
        files_json = excluded.files_json,
        active_phase = excluded.active_phase,
        status = excluded.status,
        score = excluded.score,
        evaluation_json = excluded.evaluation_json,
        time_spent_seconds = excluded.time_spent_seconds,
        updated_at = CURRENT_TIMESTAMP
    `);

    const submissionId = `sub_${challengeId}_${userId}`;
    upsertStmt.run({
      id: submissionId,
      challenge_id: challengeId,
      user_id: userId,
      files_json: JSON.stringify(files),
      active_phase: activePhase,
      status,
      score: Math.round(evaluation.scoreBreakdown.overallScore),
      evaluation_json: JSON.stringify(evaluation),
      time_spent_seconds: timeSpentSeconds
    });

    res.json({
      success: true,
      isPassed,
      status,
      evaluation
    });
  } catch (err: any) {
    console.error('Error during practice evaluation:', err);
    res.status(500).json({ error: err.message || 'Evaluation failed' });
  }
});

// POST /api/practice/draft - Auto-save workspace draft for active user
router.post('/draft', (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const { challengeId, files, activePhase = 1, timeSpentSeconds = 0 } = req.body;
    if (!challengeId || !Array.isArray(files)) {
      return res.status(400).json({ error: 'challengeId and files array are required' });
    }

    const submissionId = `sub_${challengeId}_${userId}`;
    const stmt = db.prepare(`
      INSERT INTO coding_submissions (
        id, challenge_id, user_id, files_json, active_phase, time_spent_seconds, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP
      )
      ON CONFLICT(id) DO UPDATE SET
        files_json = excluded.files_json,
        active_phase = excluded.active_phase,
        time_spent_seconds = excluded.time_spent_seconds,
        updated_at = CURRENT_TIMESTAMP
    `);

    stmt.run(submissionId, challengeId, userId, JSON.stringify(files), activePhase, timeSpentSeconds);
    res.json({ success: true, savedAt: new Date().toISOString() });
  } catch (err: any) {
    console.error('Error saving practice draft:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/practice/reset/:challengeId - Reset workspace draft to initial state for active user
router.post('/reset/:challengeId', (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const challengeId = req.params.challengeId;
    const submissionId = `sub_${challengeId}_${userId}`;
    db.prepare('DELETE FROM coding_submissions WHERE id = ?').run(submissionId);
    res.json({ success: true, message: 'Challenge workspace reset to default.' });
  } catch (err: any) {
    console.error('Error resetting challenge:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/practice/audit - Run deterministic AST static audit on Java code
router.post('/audit', (req, res) => {
  try {
    const { code } = req.body;
    const { AstAuditService } = require('../services/astAuditService');
    const result = AstAuditService.audit(code || '');
    res.json(result);
  } catch (err: any) {
    console.error('Error in AST audit endpoint:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/practice/generate-task - Generate a dynamic SOTA Java kata on the fly
router.post('/generate-task', async (req, res) => {
  try {
    const { DynamicTaskGenerator } = require('../services/dynamicTaskGenerator');
    const task = await DynamicTaskGenerator.generateTask(req.body || {});
    res.json(task);
  } catch (err: any) {
    console.error('Error generating dynamic task:', err);
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

export default router;
