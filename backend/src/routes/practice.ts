import { Router } from 'express';
import { db } from '../services/db';
import { CodingChallenge } from '../services/challengeSeedData';
import { getAuthUserId } from '../middleware/auth';
import { AstAuditService } from '../services/astAuditService';
import { DynamicTaskGenerator } from '../services/dynamicTaskGenerator';
import { handleChallengeEvaluation } from '../services/challengeSubmissionService';
import { buildChallengeZipPackage } from '../services/mavenScaffoldGenerator';

const router = Router();

// GET /api/practice/challenges - List all challenges with category filter & submission status for current user
router.get('/challenges', (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const { category, track } = req.query;
    let query = 'SELECT id, slug, title, category, track, badge, difficulty, target_stack, time_limit_minutes, short_description, task_code, updated_at FROM coding_challenges';
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
    query += ' ORDER BY task_code ASC, created_at ASC';

    const rows = db.prepare(query).all(...params) as any[];

    // Fetch submission status for the authenticated user
    const subStmt = db.prepare('SELECT challenge_id, status, score, files_json, time_spent_seconds, updated_at FROM coding_submissions WHERE user_id = ?');
    const submissions = subStmt.all(userId) as any[];
    const subMap = new Map(submissions.map(s => [s.challenge_id, s]));

    const result = rows.map(r => {
      const sub = subMap.get(r.id);
      const isCompleted = sub?.status === 'PASSED' || (sub?.score !== undefined && sub.score >= 70);
      let status: 'COMPLETED' | 'IN_PROGRESS' | 'FAILED' | 'NOT_STARTED' = 'NOT_STARTED';

      if (isCompleted) {
        status = 'COMPLETED';
      } else if (sub?.status === 'FAILED' || (sub?.score !== undefined && sub.score < 70)) {
        status = 'FAILED';
      } else if (sub && (sub.files_json || (sub.time_spent_seconds && sub.time_spent_seconds > 0))) {
        status = 'IN_PROGRESS';
      }

      const rawDiff = r.difficulty || 'Middle';
      const difficulty = rawDiff.charAt(0).toUpperCase() + rawDiff.slice(1).toLowerCase();

      return {
        ...r,
        difficulty,
        taskCode: r.task_code || r.id,
        track: r.track || 'lld_bigtech',
        timeLimitMinutes: r.time_limit_minutes,
        targetStack: r.target_stack,
        shortDescription: r.short_description,
        isCompleted,
        status,
        lastScore: sub?.score,
        lastStatus: status,
        timeSpentSeconds: sub?.time_spent_seconds || 0,
        completedAt: isCompleted ? sub?.updated_at : undefined
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

// POST /api/practice/evaluate - Submit workspace files for dual-pass evaluation (SSE streaming & JSON compatible)
router.post('/evaluate', async (req, res) => {
  const isSse = req.headers.accept?.includes('text/event-stream') || req.query.stream === 'true';

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

    await handleChallengeEvaluation({
      userId,
      challengeId,
      files,
      activePhase,
      timeSpentSeconds,
      isSse,
      res
    });
  } catch (err: any) {
    if (res.writableEnded) {
      return;
    }
    if (err.name === 'AbortError' || err.name === 'TimeoutError') {
      console.warn(`⏳ Practice evaluation timed out or aborted: ${err.message}`);
      if (res.headersSent) {
        res.write(`event: error\ndata: ${JSON.stringify({
          error: 'Время ожидания ответа AI-рецензента истекло (Gateway Timeout). Пожалуйста, повторите попытку.'
        })}\n\n`);
        res.end();
      } else {
        res.status(504).json({
          error: 'Время ожидания ответа AI-рецензента истекло (Gateway Timeout). Пожалуйста, повторите попытку.'
        });
      }
      return;
    }
    console.error('Error during practice evaluation:', err);
    if (res.headersSent) {
      res.write(`event: error\ndata: ${JSON.stringify({
        error: err.message || 'Evaluation failed'
      })}\n\n`);
      res.end();
    } else {
      res.status(500).json({ error: err.message || 'Evaluation failed' });
    }
  }
});

// POST /api/practice/draft & /api/practice/save-draft - Auto-save workspace draft for active user
const handleDraftSave = (req: any, res: any) => {
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
};

router.post('/draft', handleDraftSave);
router.post('/save-draft', handleDraftSave);

// POST /api/practice/transaction-lab/draft - Save Transaction Lab scenario draft
router.post('/transaction-lab/draft', (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const { scenarioId, userConfigs, threads = 1 } = req.body;
    if (!scenarioId || !userConfigs) {
      return res.status(400).json({ error: 'scenarioId and userConfigs are required' });
    }
    const submissionId = `tx_sub_${scenarioId}_${userId}`;
    const stmt = db.prepare(`
      INSERT INTO coding_submissions (
        id, challenge_id, user_id, files_json, active_phase, time_spent_seconds, updated_at
      ) VALUES (
        ?, ?, ?, ?, 1, 0, CURRENT_TIMESTAMP
      )
      ON CONFLICT(id) DO UPDATE SET
        files_json = excluded.files_json,
        updated_at = CURRENT_TIMESTAMP
    `);
    const payload = JSON.stringify({ userConfigs, threads });
    stmt.run(submissionId, scenarioId, userId, payload);
    res.json({ success: true, savedAt: new Date().toISOString() });
  } catch (err: any) {
    console.error('Error saving transaction lab draft:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/practice/transaction-lab/draft/:scenarioId - Get Transaction Lab scenario draft
router.get('/transaction-lab/draft/:scenarioId', (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const scenarioId = req.params.scenarioId;
    const submissionId = `tx_sub_${scenarioId}_${userId}`;
    const row = db.prepare('SELECT files_json, updated_at FROM coding_submissions WHERE id = ?').get(submissionId) as any;
    if (!row) {
      return res.json({ draft: null });
    }
    const data = JSON.parse(row.files_json);
    res.json({
      draft: {
        scenarioId,
        userConfigs: data.userConfigs || {},
        threads: data.threads || 1,
        updatedAt: row.updated_at
      }
    });
  } catch (err: any) {
    console.error('Error getting transaction lab draft:', err);
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

// GET /api/practice/:challengeId/export-zip - Download Maven project ZIP for IntelliJ IDEA
router.get('/:challengeId/export-zip', (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const { challengeId } = req.params;

    const row = db.prepare('SELECT id, slug, title, category, target_stack, files_json FROM coding_challenges WHERE id = ? OR slug = ?').get(challengeId, challengeId) as any;
    if (!row) {
      return res.status(404).json({ error: 'Challenge not found' });
    }

    const defaultFiles = JSON.parse(row.files_json || '[]');

    // Check for user draft
    const sub = db.prepare('SELECT files_json FROM coding_submissions WHERE user_id = ? AND challenge_id = ?').get(userId, row.id) as any;
    const files = (sub && sub.files_json) ? JSON.parse(sub.files_json) : defaultFiles;

    const challenge: CodingChallenge = {
      id: row.id,
      slug: row.slug || row.id,
      title: row.title,
      category: row.category,
      targetStack: row.target_stack,
      badge: '',
      difficulty: 'Middle',
      timeLimitMinutes: 60,
      shortDescription: '',
      instructionsMarkdown: '',
      workspaceFiles: defaultFiles
    };

    const zipBuffer = buildChallengeZipPackage(challenge, files);
    const filename = `challenge-${row.slug || row.id}.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(zipBuffer);
  } catch (err: any) {
    console.error('Error generating project ZIP:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
