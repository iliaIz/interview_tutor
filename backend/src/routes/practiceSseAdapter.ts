import { getAuthUserId } from '../middleware/auth';
import { ChallengeEvaluationSession } from '../services/sandbox/ChallengeEvaluationSession';
import {
  ChallengeSubmissionRepository,
  validateWorkspaceFiles,
  WorkspaceValidationError
} from '../services/sandbox/ChallengeSubmissionRepository';

/**
 * practiceSseAdapter.ts
 * Stream bridge for Practice Challenge Evaluation (SPEC-23 / Spec 43).
 * Decoupled from evaluation business logic: strictly translates pipeline events
 * to SSE events (or JSON response when requested).
 */
export async function handleEvaluationStream(req: any, res: any): Promise<void> {
  try {
    const userId = getAuthUserId(req);
    const challengeId = req.params.id || req.body.challengeId;
    const rawFiles = req.body.codeFiles || req.body.files;
    const activePhase = Number(req.body.activePhase) || 1;
    const timeSpentSeconds = Number(req.body.timeSpentSeconds) || 0;

    if (!challengeId) {
      res.status(400).json({ error: 'challengeId and non-empty files array are required' });
      return;
    }

    let files;
    try {
      files = validateWorkspaceFiles(rawFiles);
    } catch (err: any) {
      if (err instanceof WorkspaceValidationError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      throw err;
    }

    const isJsonMode = req.headers.accept === 'application/json' && req.query.stream !== 'true';

    const abortController = new AbortController();
    res.on('close', () => {
      if (!res.writableEnded) {
        abortController.abort();
      }
    });

    if (!isJsonMode) {
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      if (typeof res.flushHeaders === 'function') {
        res.flushHeaders();
      }
    }

    const sendSseEvent = (eventName: string, data: any) => {
      if (isJsonMode || res.writableEnded || res.destroyed) return;
      res.write(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`);
      if (typeof res.flush === 'function') {
        res.flush();
      }
    };

    let jsonResult: { success: boolean; isPassed: boolean; status: string; evaluation: any } | null = null;
    let terminalError: { statusCode: number; error: string; canRetryAiOnly: boolean } | null = null;
    const session = new ChallengeEvaluationSession({ submissionRepo: ChallengeSubmissionRepository });

    try {
      for await (const event of session.runGates({
        challengeId,
        userId,
        codeFiles: files,
        activePhase,
        timeSpentSeconds,
        abortSignal: abortController.signal
      })) {
        if (res.writableEnded || res.destroyed) break;

        // Terminal early bailout capture for JSON mode
        if (event.payload?.evaluation && (event.status === 'FAILED' || event.status === 'PASSED')) {
          jsonResult = {
            success: true,
            isPassed: event.status === 'PASSED',
            status: event.status,
            evaluation: event.payload.evaluation
          };
        }

        if (event.gate === 'JVM_UNIT_TESTS') {
          if (event.status === 'RUNNING') {
            sendSseEvent('stage', { ...event, stage: 'sandbox', label: 'Компиляция Java 21 и прогон модульных тестов...' });
          } else if (event.status === 'FAILED') {
            if (isJsonMode) break;
            sendSseEvent('stage', {
              ...event,
              stage: 'sandbox_done',
              label: event.payload?.error || 'Обнаружены ошибки компиляции Java 21',
              isCompilable: false,
              details: { isCompilable: false, passedCount: 0, failedCount: 1 }
            });
            sendSseEvent('complete', {
              ...event,
              gate: 'PERSISTENCE',
              stage: 'complete',
              success: false,
              isPassed: false,
              status: 'FAILED',
              evaluation: event.payload?.evaluation
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
          if (event.status === 'FAILED') {
            if (isJsonMode) break;
            sendSseEvent('stage', {
              ...event,
              stage: 'ast_analysis',
              label: event.payload?.error || 'Gate 2 AST-анализ: обнаружены неисправленные запахи кода'
            });
            sendSseEvent('complete', {
              ...event,
              gate: 'PERSISTENCE',
              stage: 'complete',
              success: false,
              isPassed: false,
              status: 'FAILED',
              evaluation: event.payload?.evaluation
            });
          } else {
            sendSseEvent('stage', {
              ...event,
              stage: 'ast_analysis',
              label: event.status === 'PASSED'
                ? 'Gate 2 AST-анализ: структурные запахи устранены, инварианты соблюдены'
                : 'Gate 2 AST-анализ: проверка инвариантов...'
            });
          }
        } else if (event.gate === 'MUTATION_TESTS') {
          if (event.status === 'FAILED') {
            if (isJsonMode) break;
            sendSseEvent('stage', {
              ...event,
              stage: 'mutation',
              label: event.payload?.error || 'Мутационный скор ниже порога'
            });
            sendSseEvent('complete', {
              ...event,
              gate: 'PERSISTENCE',
              stage: 'complete',
              success: false,
              isPassed: false,
              status: 'FAILED',
              evaluation: event.payload?.evaluation
            });
          } else {
            sendSseEvent('stage', {
              ...event,
              stage: 'mutation',
              label: event.status === 'PASSED'
                ? `PITest: Мутационный скор ${event.payload?.mutationScore?.percentage || 100}%`
                : (event.status === 'RUNNING'
                  ? 'PITest: Мутационное тестирование...'
                  : (event.payload?.error || 'Мутационный тест завершен'))
            });
          }
        } else if (event.gate === 'AI_EVALUATION') {
          if (event.status === 'RUNNING') {
            sendSseEvent('stage', {
              ...event,
              stage: 'ai_reasoning',
              label: 'Senior AI Архитектор: глубокий аудит (SOLID, потокобезопасность, идиоматика)...',
              details: { model: 'gemini-smart' }
            });
          } else if (event.status === 'FAILED') {
            const errMsg = event.payload?.error || 'Ошибка вызова AI-шлюза при оценке';
            terminalError = { statusCode: 503, error: errMsg, canRetryAiOnly: true };
            if (isJsonMode) break;
            sendSseEvent('error', {
              ...event,
              stage: 'failed',
              error: errMsg,
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
            if (isJsonMode) break;
            sendSseEvent('complete', {
              ...event,
              stage: 'complete',
              success: true,
              isPassed: true,
              status: 'PASSED',
              evaluation: event.payload?.evaluation
            });
          } else if (event.status === 'FAILED') {
            if (isJsonMode) {
              return res.status(500).json({ error: event.payload?.error || 'Persistence error' });
            }
            sendSseEvent('error', {
              ...event,
              stage: 'failed',
              error: event.payload?.error || 'Persistence error',
              canRetryAiOnly: false
            });
          }
        }
      }

      if (isJsonMode) {
        if (jsonResult) {
          return res.status(200).json(jsonResult);
        }
        const fallbackVerdict = session.getTerminalVerdict();
        if (fallbackVerdict) {
          return res.status(200).json({
            success: true,
            isPassed: fallbackVerdict.status === 'PASSED',
            status: fallbackVerdict.status,
            evaluation: fallbackVerdict.evaluation
          });
        }
        if (terminalError) {
          return res.status(terminalError.statusCode).json({
            success: false,
            error: terminalError.error,
            canRetryAiOnly: terminalError.canRetryAiOnly
          });
        }
        return res.status(500).json({ error: 'Evaluation did not produce a final verdict' });
      }
    } catch (pipelineErr: any) {
      console.error('Error during practice evaluation pipeline stream:', pipelineErr);
      if (isJsonMode) {
        if (!res.headersSent) {
          return res.status(500).json({ error: pipelineErr?.message || 'Evaluation pipeline error' });
        }
        return;
      }
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
      if (!isJsonMode && !res.writableEnded) {
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
