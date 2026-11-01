import { Response } from 'express';
import { getAuthUserId } from '../middleware/auth';
import { ChallengeEvaluationPipeline } from '../services/sandbox/ChallengeEvaluationPipeline';
import { EvaluationPipelineEvent } from '../services/sandbox/evaluationPipelineTypes';

export async function handleEvaluationStream(req: any, res: any): Promise<void> {
  try {
    const userId = getAuthUserId(req);
    const challengeId = req.params.id || req.body.challengeId;
    const files = req.body.codeFiles || req.body.files;
    const activePhase = Number(req.body.activePhase) || 1;
    const timeSpentSeconds = Number(req.body.timeSpentSeconds) || 0;

    if (!challengeId || !Array.isArray(files) || files.length === 0) {
      res.status(400).json({ error: 'challengeId and non-empty files array are required' });
      return;
    }

    if (files.length > 15) {
      res.status(400).json({ error: 'Exceeded maximum allowable files limit (15 files max)' });
      return;
    }

    for (const f of files) {
      if (typeof f.content === 'string' && f.content.length > 200_000) {
        res.status(400).json({ error: `File ${f.path || 'unknown'} exceeds maximum allowable size (200KB max)` });
        return;
      }
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders();
    }

    const abortController = new AbortController();
    res.on('close', () => {
      if (!res.writableEnded) {
        abortController.abort();
      }
    });

    const sendSseEvent = (eventName: string, data: any) => {
      if (res.writableEnded || res.destroyed) return;
      res.write(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`);
      if (typeof res.flush === 'function') {
        res.flush();
      }
    };

    try {
      for await (const event of ChallengeEvaluationPipeline.evaluate({
        challengeId,
        userId,
        codeFiles: files,
        activePhase,
        timeSpentSeconds,
        abortSignal: abortController.signal
      })) {
        if (res.writableEnded || res.destroyed) break;

        if (event.gate === 'JVM_UNIT_TESTS') {
          if (event.status === 'RUNNING') {
            sendSseEvent('stage', {
              ...event,
              stage: 'sandbox',
              label: 'Компиляция Java 21 и прогон модульных тестов...'
            });
          } else if (event.status === 'FAILED') {
            sendSseEvent('stage', {
              ...event,
              stage: 'sandbox_done',
              label: event.payload?.error || 'Обнаружены ошибки компиляции Java 21',
              isCompilable: false,
              details: { isCompilable: false, passedCount: 0, failedCount: 1 }
            });
            // Complete event for fast-path uncompilable failure
            sendSseEvent('complete', {
              ...event,
              gate: 'PERSISTENCE',
              stage: 'complete',
              success: false,
              isPassed: false,
              status: 'FAILED',
              evaluation: {
                compilationStatus: { isCompilable: false, syntaxErrors: [] },
                scoreBreakdown: { overallScore: 0, summaryReview: event.payload?.error || 'Compilation failed' }
              }
            });
          } else {
            sendSseEvent('stage', {
              ...event,
              stage: 'sandbox_done',
              label: `Песочница JVM 21: ${event.payload?.testResults?.passed || 0}/${event.payload?.testResults?.total || 0} тестов пройдено`,
              isCompilable: true,
              details: {
                isCompilable: true,
                passedCount: event.payload?.testResults?.passed || 0,
                totalCount: event.payload?.testResults?.total || 0
              }
            });
          }
        } else if (event.gate === 'AST_INVARIANTS') {
          sendSseEvent('stage', {
            ...event,
            stage: 'ast_analysis',
            label: event.status === 'PASSED'
              ? 'Gate 2 AST-анализ: структурные запахи устранены, инварианты соблюдены'
              : (event.status === 'RUNNING'
                ? 'Gate 2 AST-анализ: проверка инвариантов...'
                : 'Gate 2 AST-анализ: обнаружены неисправленные запахи кода')
          });
        } else if (event.gate === 'MUTATION_TESTS') {
          sendSseEvent('stage', {
            ...event,
            stage: 'mutation',
            label: event.status === 'PASSED'
              ? `PITest: Мутационный скор ${event.payload?.mutationScore?.percentage || 100}%`
              : (event.status === 'RUNNING'
                ? 'PITest: Мутационное тестирование...'
                : (event.payload?.error || 'Мутационный тест завершен'))
          });
        } else if (event.gate === 'AI_EVALUATION') {
          if (event.status === 'RUNNING') {
            sendSseEvent('stage', {
              ...event,
              stage: 'ai_reasoning',
              label: 'Senior AI Архитектор: глубокий аудит (SOLID, потокобезопасность, идиоматика)...',
              details: { model: 'gemini-smart' }
            });
          } else if (event.status === 'FAILED') {
            sendSseEvent('error', {
              ...event,
              stage: 'failed',
              error: event.payload?.error || 'Ошибка вызова AI-шлюза при оценке',
              canRetryAiOnly: true
            });
          } else {
            sendSseEvent('stage', {
              ...event,
              stage: 'ai_done',
              label: `AI Рецензия сформирована (балл: ${event.payload?.aiFeedback?.score || 75}/100)`
            });
          }
        } else if (event.gate === 'PERSISTENCE') {
          if (event.status === 'PASSED') {
            const rawEval = event.payload?.evaluation;
            const normalizedEval = {
              ...rawEval,
              compilationStatus: rawEval?.compilationStatus || { isCompilable: true, syntaxErrors: [] },
              scoreBreakdown: rawEval?.scoreBreakdown || {
                overallScore: event.payload?.aiFeedback?.score ?? 75,
                summaryReview: event.payload?.aiFeedback?.critique || ''
              }
            };
            sendSseEvent('complete', {
              ...event,
              stage: 'complete',
              success: true,
              isPassed: true,
              status: 'PASSED',
              evaluation: normalizedEval
            });
          } else if (event.status === 'FAILED') {
            sendSseEvent('error', {
              ...event,
              stage: 'failed',
              error: event.payload?.error || 'Persistence error',
              canRetryAiOnly: false
            });
          }
        }
      }
    } catch (pipelineErr: any) {
      console.error('Error during practice evaluation pipeline stream:', pipelineErr);
      if (!res.writableEnded && !res.destroyed) {
        sendSseEvent('error', {
          gate: 'PERSISTENCE',
          status: 'FAILED',
          progressPercent: 100,
          stage: 'failed',
          error: pipelineErr?.message || 'Evaluation pipeline error',
          timestamp: Date.now()
        });
      }
    } finally {
      if (!res.writableEnded) {
        res.end();
      }
    }
  } catch (err: any) {
    console.error('Error initializing evaluation stream adapter:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || 'Evaluation failed' });
    } else if (!res.writableEnded) {
      res.end();
    }
  }
}
