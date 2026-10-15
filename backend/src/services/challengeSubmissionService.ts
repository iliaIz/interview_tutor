import { Response } from 'express';
import { db } from './db';
import { CodingChallenge } from './challengeSeedData';
import { evaluateChallengeSubmission } from './codeEvaluator';
import { JvmExecutionService } from './sandbox/JvmExecutionService';

export interface EvaluateChallengeParams {
  userId: string;
  challengeId: string;
  files: Array<{ path: string; content: string }>;
  activePhase: number;
  timeSpentSeconds: number;
  isSse: boolean;
  res: Response;
}

export async function handleChallengeEvaluation({
  userId,
  challengeId,
  files,
  activePhase,
  timeSpentSeconds,
  isSse,
  res
}: EvaluateChallengeParams): Promise<void> {
  const row = db.prepare('SELECT manifest_json FROM coding_challenges WHERE id = ?').get(challengeId) as any;
  if (!row) {
    res.status(404).json({ error: 'Challenge not found' });
    return;
  }

  const challenge: CodingChallenge = JSON.parse(row.manifest_json);
  const abortController = new AbortController();

  res.on('close', () => {
    if (!res.writableEnded) {
      abortController.abort();
    }
  });

  if (isSse) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    });
    if (typeof (res as any).flushHeaders === 'function') {
      (res as any).flushHeaders();
    }
  }

  const sendSse = (event: string, data: any) => {
    if (isSse && !res.writableEnded && !res.destroyed) {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      if (typeof (res as any).flush === 'function') {
        (res as any).flush();
      }
    }
  };

  sendSse('stage', {
    stage: 'sandbox',
    label: 'Компиляция Java 21 и прогон модульных тестов...',
    timestamp: Date.now()
  });

  const sandboxResult = await JvmExecutionService.execute({
    challengeId,
    files,
    activePhase
  });

  if (res.writableEnded || abortController.signal.aborted) {
    return;
  }

  sendSse('stage', {
    stage: 'sandbox_done',
    label: sandboxResult.isCompilable
      ? `Песочница JVM 21: ${sandboxResult.passedCount}/${sandboxResult.testResults.length} тестов пройдено (${sandboxResult.executionTimeMs}мс)`
      : 'Обнаружены синтаксические ошибки компиляции Java 21',
    timestamp: Date.now(),
    details: {
      isCompilable: sandboxResult.isCompilable,
      passedCount: sandboxResult.passedCount,
      failedCount: sandboxResult.failedCount,
      totalCount: sandboxResult.testResults.length,
      durationMs: sandboxResult.executionTimeMs
    }
  });

  if (sandboxResult.isCompilable) {
    sendSse('stage', {
      stage: 'ast_analysis',
      label: 'AST-анализ: проверка Loom (Carrier Thread Pinning) и Java Memory Model...',
      timestamp: Date.now()
    });

    sendSse('stage', {
      stage: 'ai_reasoning',
      label: 'Senior AI Архитектор: глубокий аудит (SOLID, потокобезопасность, идиоматика)...',
      timestamp: Date.now(),
      details: {
        model: 'gemini-smart'
      }
    });
  }

  let elapsedSeconds = 0;
  const heartbeatInterval = setInterval(() => {
    elapsedSeconds += 3;
    if (isSse && !res.writableEnded && !res.destroyed) {
      sendSse('heartbeat', {
        elapsedSeconds,
        timestamp: Date.now()
      });
    }
  }, 3000);

  let evaluation;
  try {
    evaluation = await evaluateChallengeSubmission({
      challenge,
      files,
      activePhase,
      timeSpentSeconds,
      sandboxResult,
      abortSignal: abortController.signal
    });
  } catch (err: any) {
    clearInterval(heartbeatInterval);
    console.error('❌ Senior AI Review pipeline failed:', err.message);
    if (isSse && !res.writableEnded && !res.destroyed) {
      sendSse('error', {
        stage: 'failed',
        error: err.message || 'Ошибка вызова AI-шлюза при оценке',
        canRetryAiOnly: Boolean(sandboxResult?.isCompilable),
        timestamp: Date.now()
      });
      res.end();
    } else if (!res.headersSent) {
      res.status(502).json({
        error: err.message || 'Ошибка вызова AI-шлюза при оценке',
        canRetryAiOnly: Boolean(sandboxResult?.isCompilable)
      });
    }
    return;
  } finally {
    clearInterval(heartbeatInterval);
  }

  const isPassed = evaluation.scoreBreakdown.overallScore >= 70 && !evaluation.concurrencyAnalysis.hasCarrierThreadPinning;
  const status = isPassed ? 'PASSED' : 'FAILED';

  const submissionId = `sub_${challengeId}_${userId}`;
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

  if (res.writableEnded || abortController.signal.aborted) {
    return;
  }

  if (isSse) {
    sendSse('complete', {
      stage: 'complete',
      success: true,
      isPassed,
      status,
      evaluation,
      timestamp: Date.now()
    });
    res.end();
  } else {
    res.json({
      success: true,
      isPassed,
      status,
      evaluation
    });
  }
}
