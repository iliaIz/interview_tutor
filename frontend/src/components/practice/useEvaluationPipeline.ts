import { useState, useRef, useEffect, useCallback } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { ReviewProgressEvent, ReviewStageId } from '../../types/practice';

export interface ReviewLogEntry {
  id: string;
  time: string;
  text: string;
  type: 'info' | 'success' | 'warn' | 'error';
}

export interface StepperState {
  sandbox: { status: 'pending' | 'running' | 'success' | 'error'; label: string };
  ast: { status: 'pending' | 'running' | 'success' | 'error'; label: string };
  ai: { status: 'pending' | 'running' | 'success' | 'error'; label: string; model?: string };
  report: { status: 'pending' | 'running' | 'success' | 'error'; label: string };
}

export function useEvaluationPipeline() {
  const {
    activePracticeChallenge,
    practiceWorkspaceFiles,
    activePracticePhase,
    isPracticeEvaluating,
    setIsPracticeEvaluating,
    setActivePracticeReport,
    showToast,
    academyBreadcrumbContext,
    toggleAcademyStepProgress
  } = useAppStore();

  const [isConsoleOpen, setIsConsoleOpen] = useState(false);
  const [evaluationTimer, setEvaluationTimer] = useState(0);
  const [currentStage, setCurrentStage] = useState<ReviewProgressEvent>({
    stage: 'idle',
    label: '',
    timestamp: 0
  });

  const [reviewLogs, setReviewLogs] = useState<ReviewLogEntry[]>([]);
  const [stepperState, setStepperState] = useState<StepperState>({
    sandbox: { status: 'pending', label: 'Ожидание запуска' },
    ast: { status: 'pending', label: 'Ожидание' },
    ai: { status: 'pending', label: 'Ожидание' },
    report: { status: 'pending', label: 'Ожидание' }
  });

  const [activeError, setActiveError] = useState<{ message: string; canRetryAiOnly: boolean } | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const addLog = useCallback((text: string, type: 'info' | 'success' | 'warn' | 'error' = 'info') => {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setReviewLogs((prev) => [
      ...prev,
      {
        id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        time: timeStr,
        text,
        type
      }
    ]);
  }, []);

  // Timer while evaluation is active
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPracticeEvaluating) {
      interval = setInterval(() => {
        setEvaluationTimer((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPracticeEvaluating]);

  const handleAbortEvaluation = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsPracticeEvaluating(false);
    addLog('Оценка прервана пользователем.', 'warn');
    setCurrentStage({ stage: 'failed', label: 'Оценка прервана', timestamp: Date.now() });
    showToast({
      type: 'warning',
      title: 'Оценка остановлена',
      message: 'Запрос на Senior AI Review отменен пользователем.'
    });
  }, [addLog, setIsPracticeEvaluating, showToast]);

  const handleStartEvaluation = useCallback(async () => {
    if (!activePracticeChallenge || isPracticeEvaluating) return;

    setIsPracticeEvaluating(true);
    setIsConsoleOpen(true);
    setEvaluationTimer(0);
    setActiveError(null);
    setReviewLogs([]);

    const initialEvent: ReviewProgressEvent = {
      stage: 'sandbox',
      label: 'Компиляция Java 21 и прогон модульных тестов в In-Memory Sandbox...',
      timestamp: Date.now()
    };
    setCurrentStage(initialEvent);

    setStepperState({
      sandbox: { status: 'running', label: 'Компиляция и тесты...' },
      ast: { status: 'pending', label: 'Ожидание' },
      ai: { status: 'pending', label: 'Ожидание' },
      report: { status: 'pending', label: 'Ожидание' }
    });

    addLog('Запуск Senior AI Review Pipeline (SOTA Late 2026)...', 'info');
    addLog('Шаг 1: Инициализация JVM 21 Sandbox...', 'info');

    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Safety timeout: 120s (exceeds backend's 85s ceiling)
    const clientTimeoutId = setTimeout(() => {
      controller.abort();
    }, 120000);

    try {
      const response = await fetch('/api/practice/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        signal: controller.signal,
        body: JSON.stringify({
          challengeId: activePracticeChallenge.id,
          files: practiceWorkspaceFiles,
          activePhase: activePracticePhase
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: Ошибка отправки на проверку`);
      }

      if (!response.body) throw new Error('ReadableStream not supported');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let currentEvent = 'message';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          if (trimmed.startsWith('event:')) {
            currentEvent = trimmed.slice(6).trim();
            continue;
          }

          if (trimmed.startsWith('data:')) {
            const jsonStr = trimmed.slice(5).trim();
            if (!jsonStr) continue;

            let parsed: any;
            try {
              parsed = JSON.parse(jsonStr);
            } catch {
              continue;
            }

            // Universal SOTA SSE event dispatcher
            const eventType = parsed.event || currentEvent;
            const eventData = parsed.data || parsed;

            if (eventType === 'stage') {
              const stageId: ReviewStageId = eventData.stage;
              setCurrentStage({
                stage: stageId,
                label: eventData.label || 'Обработка...',
                timestamp: eventData.timestamp || Date.now(),
                details: eventData.details
              });

              if (stageId === 'sandbox') {
                setStepperState((prev) => ({
                  ...prev,
                  sandbox: { status: 'running', label: 'Компиляция и тесты...' }
                }));
              } else if (stageId === 'sandbox_done') {
                const details = eventData.details || {};
                const isOk = details.isCompilable && (details.failedCount === 0 || details.passedCount > 0);
                const statLabel = details.isCompilable
                  ? `${details.passedCount || 0}/${details.totalCount || details.passedCount || 0} тестов (${details.durationMs || 0}мс)`
                  : 'Ошибка компиляции';

                setStepperState((prev) => ({
                  ...prev,
                  sandbox: { status: isOk ? 'success' : 'error', label: statLabel },
                  ast: { status: isOk ? 'running' : 'pending', label: 'Анализ JMM & Loom...' }
                }));
                addLog(`JVM Sandbox: ${statLabel}`, isOk ? 'success' : 'error');
              } else if (stageId === 'ast_analysis') {
                setStepperState((prev) => ({
                  ...prev,
                  ast: { status: 'success', label: 'Loom & JMM проверены' },
                  ai: { status: 'running', label: 'Аудит SOLID & Concurrency...' }
                }));
                addLog('AST Scanner: Loom Carrier-Pinning и JMM инварианты проверены.', 'info');
              } else if (stageId === 'ai_reasoning') {
                setStepperState((prev) => ({
                  ...prev,
                  ai: { status: 'running', label: 'Senior AI Архитектор размышляет...', model: eventData.details?.model }
                }));
                addLog(`AI Gateway: Запрос отправлен модели [${eventData.details?.model || 'gemini-smart'}]. Аудит архитектуры...`, 'info');
              }
            } else if (eventType === 'heartbeat') {
              if (eventData.elapsedSeconds) {
                addLog(`AI Gateway: Генерация архитектурного фидбека (прошло ${eventData.elapsedSeconds}с)...`, 'info');
              }
            } else if (eventType === 'complete') {
              const evalResult = eventData.evaluation;
              if (evalResult) {
                setStepperState({
                  sandbox: { status: 'success', label: 'Тесты пройдены' },
                  ast: { status: 'success', label: 'AST чистый' },
                  ai: { status: 'success', label: 'Аудит завершен' },
                  report: { status: 'success', label: `Оценка: ${Math.round(evalResult.scoreBreakdown?.overallScore || 0)}/100` }
                });

                addLog(`Рецензия готова! Финальный балл: ${Math.round(evalResult.scoreBreakdown?.overallScore || 0)}/100`, 'success');
                setActivePracticeReport(evalResult);

                if (eventData.isPassed && academyBreadcrumbContext) {
                  toggleAcademyStepProgress(
                    academyBreadcrumbContext.courseId,
                    academyBreadcrumbContext.stepNumber,
                    true
                  );
                }
              }
              currentEvent = 'message';
            } else if (eventType === 'error') {
              const errMsg = eventData.error || 'Ошибка проверки';
              setActiveError({
                message: errMsg,
                canRetryAiOnly: Boolean(eventData.canRetryAiOnly)
              });
              setStepperState((prev) => ({
                ...prev,
                ai: { status: 'error', label: 'Сбой вызова модели' }
              }));
              addLog(`Сбой: ${errMsg}`, 'error');
              throw new Error(errMsg);
            }

            currentEvent = 'message';
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        addLog('Запрос отменен пользователем или истекло максимальное время ожидания (120с).', 'warn');
        return;
      }
      showToast({
        type: 'error',
        title: 'Ошибка проверки',
        message: err.message || 'Не удалось завершить оценку решения.'
      });
    } finally {
      clearTimeout(clientTimeoutId);
      setIsPracticeEvaluating(false);
      abortControllerRef.current = null;
    }
  }, [
    activePracticeChallenge,
    isPracticeEvaluating,
    practiceWorkspaceFiles,
    activePracticePhase,
    academyBreadcrumbContext,
    setIsPracticeEvaluating,
    setActivePracticeReport,
    toggleAcademyStepProgress,
    showToast,
    addLog
  ]);

  return {
    isEvaluating: isPracticeEvaluating,
    currentStage,
    evaluationTimer,
    reviewLogs,
    stepperState,
    activeError,
    isConsoleOpen,
    setIsConsoleOpen,
    handleStartEvaluation,
    handleAbortEvaluation
  };
}
