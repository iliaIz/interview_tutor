import { useState, useRef, useEffect, useCallback } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { SandboxExecutionResponse } from './SandboxTestConsole';
import { MutationExecutionResponse } from '../../types/practice';
import { usePracticeVoice } from './tutor/PracticeVoiceContext';

export interface EvaluationStageState {
  stage: 'idle' | 'sandbox' | 'sandbox_done' | 'ast_analysis' | 'ai_reasoning' | 'complete';
  label: string;
}

export function useWorkspaceRunner() {
  const {
    activePracticeChallenge,
    practiceWorkspaceFiles,
    activePracticePhase,
    isPracticeEvaluating,
    setIsPracticeEvaluating,
    setActivePracticeReport,
    showToast,
    academyBreadcrumbContext,
    toggleAcademyStepProgress,
    setLatestSandboxResult,
    setLatestMutationResult,
    updateWorkspaceFileContent
  } = useAppStore();

  const { isConnected: isVoiceConnected, sendTextMessage } = usePracticeVoice();

  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isSandboxRunning, setIsSandboxRunning] = useState(false);
  const [sandboxResult, setSandboxResult] = useState<SandboxExecutionResponse | null>(null);
  const [mutationResult, setMutationResult] = useState<MutationExecutionResponse | null>(null);
  const [evaluationTimer, setEvaluationTimer] = useState(0);
  const [evaluationStage, setEvaluationStage] = useState<EvaluationStageState>({
    stage: 'idle',
    label: ''
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  // Auto-increment timer while evaluation is in progress
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPracticeEvaluating) {
      setEvaluationTimer(0);
      interval = setInterval(() => {
        setEvaluationTimer((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPracticeEvaluating]);

  const isWriteTheTestsMode = Boolean(
    activePracticeChallenge?.challengeMode === 'write_the_tests' ||
    activePracticeChallenge?.track === 'testing_mutation' ||
    (activePracticeChallenge?.mutants && activePracticeChallenge.mutants.length > 0)
  );

  const handleRunSandbox = useCallback(async () => {
    if (!activePracticeChallenge || isSandboxRunning) return;
    setIsSandboxRunning(true);
    setSandboxResult(null);
    setMutationResult(null);

    try {
      if (isWriteTheTestsMode) {
        const res = await fetch('/api/sandbox/execute-mutation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            challengeId: activePracticeChallenge.id,
            files: practiceWorkspaceFiles,
            mutants: activePracticeChallenge.mutants || [],
            requiredScore: activePracticeChallenge.requiredMutationScore || 85
          })
        });

        const data: MutationExecutionResponse = await res.json();
        setMutationResult(data);
        setLatestMutationResult(data);

        if (isVoiceConnected) {
          if (data.baselinePassed && data.passedThreshold) {
            sendTextMessage(`[СИСТЕМНОЕ СОБЫТИЕ IDE]: Кандидат запустил мутационные тесты. Все мутанты уничтожены (${data.killedCount}/${data.totalMutants}), мутационный скор ${data.mutationScore.toFixed(0)}%.`);
          } else {
            sendTextMessage(`[СИСТЕМНОЕ СОБЫТИЕ IDE]: Кандидат запустил мутационные тесты. Мутационный скор ${data.mutationScore.toFixed(0)}%. Выжило мутантов: ${data.survivedCount} из ${data.totalMutants}.`);
          }
        }
      } else {
        const res = await fetch('/api/sandbox/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            challengeId: activePracticeChallenge.id,
            files: practiceWorkspaceFiles,
            activePhase: activePracticePhase
          })
        });

        const data: SandboxExecutionResponse = await res.json();
        setSandboxResult(data);
        setLatestSandboxResult(data);

        if (isVoiceConnected) {
          if (data.isCompilable && data.failedCount === 0) {
            sendTextMessage(`[СИСТЕМНОЕ СОБЫТИЕ IDE]: Кандидат запустил локальные тесты в песочнице. Все тесты успешно пройдены (${data.passedCount}/${data.passedCount + data.failedCount}) за ${data.executionTimeMs}мс.`);
          } else if (!data.isCompilable) {
            sendTextMessage(`[СИСТЕМНОЕ СОБЫТИЕ IDE]: Ошибка компиляции кода в песочнице: ${data.error || 'Синтаксические ошибки'}.`);
          } else {
            sendTextMessage(`[СИСТЕМНОЕ СОБЫТИЕ IDE]: Тесты в песочнице не прошли: упало ${data.failedCount} тестов из ${data.passedCount + data.failedCount}.`);
          }
        }
      }
    } catch (e: any) {
      console.error('Failed to run sandbox:', e);
      showToast({
        type: 'error',
        title: 'Ошибка запуска песочницы',
        message: e.message || 'Не удалось связаться с сервером исполнения.'
      });
    } finally {
      setIsSandboxRunning(false);
    }
  }, [
    activePracticeChallenge,
    isSandboxRunning,
    isWriteTheTestsMode,
    practiceWorkspaceFiles,
    activePracticePhase,
    isVoiceConnected,
    sendTextMessage,
    setLatestMutationResult,
    setLatestSandboxResult,
    showToast
  ]);

  const handleStartEvaluation = useCallback(async () => {
    if (!activePracticeChallenge || isPracticeEvaluating) return;

    setIsPracticeEvaluating(true);
    setEvaluationStage({ stage: 'sandbox', label: 'Компиляция и виртуальное исполнение в In-Memory Sandbox...' });

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const clientTimeoutId = setTimeout(() => {
      controller.abort();
    }, 90000);

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

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;

          const jsonStr = trimmed.slice(5).trim();
          if (!jsonStr) continue;

          const event = JSON.parse(jsonStr);
          const { event: eventType, data: eventData } = event;

          if (eventType === 'stage') {
            setEvaluationStage({
              stage: eventData.stage,
              label: eventData.label || 'Обработка решения...'
            });
          } else if (eventType === 'complete' && eventData?.evaluation) {
            setActivePracticeReport(eventData.evaluation);
            if (eventData.isPassed && academyBreadcrumbContext) {
              toggleAcademyStepProgress(
                academyBreadcrumbContext.courseId,
                academyBreadcrumbContext.stepNumber,
                true
              );
            }
          } else if (eventType === 'error' && eventData?.error) {
            throw new Error(eventData.error);
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        showToast({
          type: 'warning',
          title: 'Оценка остановлена',
          message: 'Запрос отменен пользователем или истекло максимальное время ожидания.'
        });
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
      setEvaluationStage({ stage: 'idle', label: '' });
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
    showToast
  ]);

  const handleSaveDraft = useCallback(async () => {
    if (!activePracticeChallenge || isSavingDraft) return;
    setIsSavingDraft(true);
    try {
      await fetch('/api/practice/save-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          challengeId: activePracticeChallenge.id,
          files: practiceWorkspaceFiles,
          activePhase: activePracticePhase
        })
      });
      setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      showToast({
        type: 'success',
        title: 'Черновик сохранен',
        message: 'Решение синхронизировано с базой данных'
      });
    } catch {
      showToast({
        type: 'error',
        title: 'Ошибка автосохранения',
        message: 'Не удалось сохранить черновик'
      });
    } finally {
      setIsSavingDraft(false);
    }
  }, [activePracticeChallenge, isSavingDraft, practiceWorkspaceFiles, activePracticePhase, showToast]);

  const handleResetWorkspace = useCallback(async () => {
    if (!activePracticeChallenge) return;
    if (!window.confirm('Сбросить весь воркспейс к начальному состоянию? Текущие изменения будут удалены.')) {
      return;
    }

    try {
      await fetch(`/api/practice/reset/${activePracticeChallenge.id}`, { method: 'POST' });
      const initialFiles = activePracticeChallenge.workspaceFiles || activePracticeChallenge.phases?.[0]?.addedFiles || [];
      initialFiles.forEach((file, idx) => {
        updateWorkspaceFileContent(idx, file.content);
      });

      showToast({
        type: 'info',
        title: 'Воркспейс сброшен',
        message: 'Файлы возвращены к исходным шаблонам.'
      });
    } catch (e) {
      console.error('Error resetting workspace:', e);
    }
  }, [activePracticeChallenge, updateWorkspaceFileContent, showToast]);

  return {
    isSandboxRunning,
    sandboxResult,
    setSandboxResult,
    mutationResult,
    setMutationResult,
    isWriteTheTestsMode,
    isSavingDraft,
    lastSavedTime,
    evaluationTimer,
    evaluationStage,
    handleRunSandbox,
    handleStartEvaluation,
    handleSaveDraft,
    handleResetWorkspace
  };
}
