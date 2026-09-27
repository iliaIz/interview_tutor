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
    }
  };

  sendSse('stage', {
    stage: 'sandbox',
    label: 'Компиляция Java 21 и прогон модульных тестов...'
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
    isCompilable: sandboxResult.isCompilable,
    passedCount: sandboxResult.passedCount,
    failedCount: sandboxResult.failedCount
  });

  if (sandboxResult.isCompilable) {
    sendSse('stage', {
      stage: 'ast_analysis',
      label: 'AST-анализ: проверка Loom (Carrier Thread Pinning) и Java Memory Model...'
    });

    sendSse('stage', {
      stage: 'ai_reasoning',
      label: 'Senior AI Архитектор: глубокий аудит (SOLID, потокобезопасность, идиоматика)...'
    });
  }

  const heartbeatInterval = setInterval(() => {
    if (isSse && !res.writableEnded && !res.destroyed) {
      res.write(': keep-alive\n\n');
    }
  }, 5000);

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
      success: true,
      isPassed,
      status,
      evaluation
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
