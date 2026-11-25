import { useState, useRef, useEffect, useCallback } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { ReviewProgressEvent } from '../../types/practice';
import {
  EvaluationGateType,
  EvaluationGateStatus,
  GateState,
  INITIAL_GATES,
  buildEvaluationReport
} from './evaluationReportBuilder';

export type { EvaluationGateType, EvaluationGateStatus, GateState };

export interface ReviewLogEntry {
  id: string;
  time: string;
  text: string;
  type: 'info' | 'success' | 'warn' | 'error';
}

export interface StepperState {
  sandbox: { status: 'pending' | 'running' | 'success' | 'error'; label: string };
  ast: { status: 'pending' | 'running' | 'success' | 'error'; label: string };
  mutation?: { status: 'pending' | 'running' | 'success' | 'error' | 'skipped'; label: string };
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
  const [gateStates, setGateStates] = useState<Record<EvaluationGateType, GateState>>(INITIAL_GATES);
  const gateStatesRef = useRef<Record<EvaluationGateType, GateState>>(INITIAL_GATES);

  const [stepperState, setStepperState] = useState<StepperState>({
    sandbox: { status: 'pending', label: 'Ожидание запуска' },
    ast: { status: 'pending', label: 'Ожидание' },
    mutation: { status: 'pending', label: 'Ожидание' },
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

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPracticeEvaluating) {
      interval = setInterval(() => setEvaluationTimer((prev) => prev + 1), 1000);
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

  const dispatchGateEvent = useCallback((event: any) => {
    const gate: EvaluationGateType = event.gate;
    const status: EvaluationGateStatus = event.status;
    const progressPercent: number = event.progressPercent ?? 0;
    const payload = event.payload || {};

    const updatedGate: GateState = { gate, status, progressPercent, payload };
    gateStatesRef.current = { ...gateStatesRef.current, [gate]: updatedGate };
    setGateStates((prev) => ({ ...prev, [gate]: updatedGate }));

    if (gate === 'JVM_UNIT_TESTS') {
      if (status === 'RUNNING') {
        setCurrentStage({ stage: 'sandbox', label: 'Компиляция Java 21 и прогон тестов...', timestamp: Date.now() });
        setStepperState((prev) => ({ ...prev, sandbox: { status: 'running', label: 'Компиляция и тесты...' } }));
      } else if (status === 'PASSED') {
        const passed = payload.testResults?.passed ?? 0;
        const total = payload.testResults?.total ?? passed;
        const statLabel = `${passed}/${total} тестов пройдено`;
        setStepperState((prev) => ({
          ...prev,
          sandbox: { status: 'success', label: statLabel },
          ast: { status: 'running', label: 'Анализ AST-инвариантов...' }
        }));
        addLog(`JVM Sandbox: ${statLabel} успешно.`, 'success');
      } else if (status === 'FAILED') {
        const errMsg = payload.error || 'Тесты в песочнице не пройдены';
        setStepperState((prev) => ({ ...prev, sandbox: { status: 'error', label: errMsg } }));
        addLog(`JVM Sandbox сбой: ${errMsg}`, 'error');
        setActiveError({ message: errMsg, canRetryAiOnly: false });
      }
    } else if (gate === 'AST_INVARIANTS') {
      if (status === 'RUNNING') {
        setCurrentStage({ stage: 'ast_analysis', label: 'Проверка AST-инвариантов...', timestamp: Date.now() });
        setStepperState((prev) => ({ ...prev, ast: { status: 'running', label: 'Анализ AST-инвариантов...' } }));
      } else if (status === 'PASSED') {
        setStepperState((prev) => ({
          ...prev,
          ast: { status: 'success', label: 'Loom & JMM проверены' }
        }));
        addLog('AST Scanner: Инварианты архитектуры и Loom safety соблюдены.', 'success');
      } else if (status === 'FAILED') {
        const violations = payload.astViolations || [];
        const errMsg = payload.error || `Нарушены AST-инварианты (${violations.length})`;
        setStepperState((prev) => ({ ...prev, ast: { status: 'error', label: errMsg } }));
        addLog(`AST Scanner сбой: ${errMsg}`, 'error');
        setActiveError({ message: errMsg, canRetryAiOnly: false });
      }
    } else if (gate === 'MUTATION_TESTS') {
      if (status === 'RUNNING') {
        setCurrentStage({ stage: 'ast_analysis', label: 'Мутационное тестирование (PITest)...', timestamp: Date.now() });
        setStepperState((prev) => ({ ...prev, mutation: { status: 'running', label: 'PITest...' } }));
        addLog('Шаг 3 [MUTATION_TESTS]: Мутационное тестирование (PITest)...', 'info');
      } else if (status === 'PASSED') {
        const score = payload.mutationScore?.percentage ?? 100;
        const killed = payload.mutationScore?.killedMutants ?? 0;
        const total = payload.mutationScore?.totalMutants ?? 0;
        setStepperState((prev) => ({ ...prev, mutation: { status: 'success', label: `${score}% (${killed}/${total})` } }));
        addLog(`PITest: Мутационный скор ${score}% (${killed}/${total} мутантов уничтожено).`, 'success');
      } else if (status === 'SKIPPED') {
        setStepperState((prev) => ({ ...prev, mutation: { status: 'skipped', label: 'Пропущено' } }));
        addLog('PITest: Мутационные тесты пропущены (мутанты не заданы).', 'info');
      } else if (status === 'FAILED') {
        const errMsg = payload.error || 'Мутационный скор ниже порога';
        setCurrentStage({ stage: 'failed', label: errMsg, timestamp: Date.now() });
        setStepperState((prev) => ({ ...prev, mutation: { status: 'error', label: errMsg } }));
        addLog(`PITest сбой: ${errMsg}`, 'error');
        setActiveError({ message: errMsg, canRetryAiOnly: false });
      }
    } else if (gate === 'AI_EVALUATION') {
      if (status === 'RUNNING') {
        setCurrentStage({ stage: 'ai_reasoning', label: 'Senior AI Архитектор размышляет...', timestamp: Date.now() });
        setStepperState((prev) => ({
          ...prev,
          ai: { status: 'running', label: 'Senior AI Архитектор размышляет...', model: 'gemini-smart' }
        }));
        addLog('Шаг 4 [AI_EVALUATION]: Senior AI Архитектор проводит глубокий аудит...', 'info');
      } else if (status === 'PASSED') {
        const score = payload.aiFeedback?.score ?? 75;
        setStepperState((prev) => ({
          ...prev,
          ai: { status: 'success', label: `Аудит завершен (${score}/100)` },
          report: { status: 'running', label: 'Формирование отчета...' }
        }));
        addLog(`AI Gateway: Рецензия сформирована (балл: ${score}/100).`, 'success');
      } else if (status === 'FAILED') {
        const errMsg = payload.error || 'Сбой вызова модели';
        setStepperState((prev) => ({ ...prev, ai: { status: 'error', label: errMsg } }));
        addLog(`AI Gateway сбой: ${errMsg}`, 'error');
        setActiveError({ message: errMsg, canRetryAiOnly: true });
      }
    } else if (gate === 'PERSISTENCE') {
      if (status === 'RUNNING') {
        setCurrentStage({ stage: 'complete', label: 'Сохранение результатов...', timestamp: Date.now() });
        setStepperState((prev) => ({ ...prev, report: { status: 'running', label: 'Сохранение в базу...' } }));
        addLog('Шаг 5 [PERSISTENCE]: Атомарное сохранение в ledger...', 'info');
      } else if (status === 'PASSED') {
        const report = buildEvaluationReport(payload, gateStatesRef.current);
        const finalScore = Math.round(report.scoreBreakdown?.overallScore ?? 75);
        setStepperState((prev) => ({
          ...prev,
          report: { status: 'success', label: `Оценка: ${finalScore}/100` }
        }));
        addLog(`Рецензия готова! Финальный балл: ${finalScore}/100`, 'success');
        setActivePracticeReport(report);

        const isPassed = finalScore >= 70 && !report.concurrencyAnalysis?.hasCarrierThreadPinning;
        if (isPassed && academyBreadcrumbContext) {
          toggleAcademyStepProgress(academyBreadcrumbContext.courseId, academyBreadcrumbContext.stepNumber, true);
        }
      } else if (status === 'FAILED') {
        const errMsg = payload.error || 'Ошибка сохранения';
        setStepperState((prev) => ({ ...prev, report: { status: 'error', label: errMsg } }));
        addLog(`Persistence сбой: ${errMsg}`, 'error');
      }
    }
  }, [addLog, academyBreadcrumbContext, setActivePracticeReport, toggleAcademyStepProgress]);

  const handleStartEvaluation = useCallback(async () => {
    if (!activePracticeChallenge || isPracticeEvaluating) return;

    setIsPracticeEvaluating(true);
    setIsConsoleOpen(true);
    setEvaluationTimer(0);
    setActiveError(null);
    setReviewLogs([]);
    setGateStates(INITIAL_GATES);
    gateStatesRef.current = INITIAL_GATES;

    setCurrentStage({ stage: 'sandbox', label: 'Инициализация 5-Gate Review Pipeline...', timestamp: Date.now() });
    setStepperState({
      sandbox: { status: 'running', label: 'Компиляция и тесты...' },
      ast: { status: 'pending', label: 'Ожидание' },
      mutation: { status: 'pending', label: 'Ожидание' },
      ai: { status: 'pending', label: 'Ожидание' },
      report: { status: 'pending', label: 'Ожидание' }
    });

    addLog('Запуск Decoupled 5-Gate Evaluation Pipeline (SPEC-004)...', 'info');

    const controller = new AbortController();
    abortControllerRef.current = controller;
    const clientTimeoutId = setTimeout(() => controller.abort(), 120000);

    try {
      const evaluateUrl = `/api/practice/challenges/${encodeURIComponent(activePracticeChallenge.id)}/evaluate`;
      const response = await fetch(evaluateUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        credentials: 'include',
        signal: controller.signal,
        body: JSON.stringify({
          challengeId: activePracticeChallenge.id,
          files: practiceWorkspaceFiles,
          activePhase: activePracticePhase,
          timeSpentSeconds: useAppStore.getState().practiceElapsedSeconds || 0
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: Ошибка отправки на проверку`);
      }

      if (response.headers.get('content-type')?.includes('application/json')) {
        const jsonData = await response.json();
        if (jsonData.evaluation) {
          const score = Math.round(jsonData.evaluation.scoreBreakdown?.overallScore ?? (jsonData.isPassed ? 75 : 0));
          setActivePracticeReport(jsonData.evaluation);
          setStepperState((prev) => ({
            ...prev,
            report: { status: jsonData.isPassed ? 'success' : 'error', label: `Оценка: ${score}/100` }
          }));
          setCurrentStage({ stage: 'complete', label: `Оценка завершена: ${score}/100`, timestamp: Date.now() });
          addLog(`Рецензия получена (${score}/100).`, jsonData.isPassed ? 'success' : 'warn');
        } else if (jsonData.error) {
          setActiveError({ message: jsonData.error, canRetryAiOnly: Boolean(jsonData.canRetryAiOnly) });
          addLog(`Сбой оценки: ${jsonData.error}`, 'error');
        }
        return;
      }

      if (!response.body) throw new Error('ReadableStream not supported');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;

          const jsonStr = trimmed.slice(5).trim();
          if (!jsonStr) continue;

          try {
            const parsed = JSON.parse(jsonStr);
            if (parsed.gate) {
              dispatchGateEvent(parsed);
            } else if (parsed.error) {
              setActiveError({ message: parsed.error, canRetryAiOnly: Boolean(parsed.canRetryAiOnly) });
              addLog(parsed.error, 'error');
            }
          } catch {
            // ignore malformed SSE frames
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        addLog('Запрос отменен пользователем или истек таймаут (120с).', 'warn');
        return;
      }
      showToast({ type: 'error', title: 'Ошибка проверки', message: err.message || 'Сбой оценки решения.' });
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
    dispatchGateEvent,
    setActivePracticeReport,
    setIsPracticeEvaluating,
    showToast,
    addLog
  ]);

  return {
    isEvaluating: isPracticeEvaluating,
    currentStage,
    evaluationTimer,
    reviewLogs,
    stepperState,
    gateStates,
    activeError,
    isConsoleOpen,
    setIsConsoleOpen,
    handleStartEvaluation,
    handleAbortEvaluation
  };
}
