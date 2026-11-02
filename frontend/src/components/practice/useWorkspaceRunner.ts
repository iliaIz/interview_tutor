import { useState, useRef, useEffect, useCallback } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { SandboxExecutionResponse } from './SandboxTestConsole';
import { MutationExecutionResponse } from '../../types/practice';
import { useWorkspaceAutosave } from './useWorkspaceAutosave';
import { removeLocalDraft } from '../../services/practiceDraftStorage';
import { useEvaluationPipeline } from './useEvaluationPipeline';
import { ReviewProgressEvent } from '../../types/practice';

export type EvaluationStageState = ReviewProgressEvent;

export function useWorkspaceRunner() {
  const {
    activePracticeChallenge,
    practiceWorkspaceFiles,
    activeWorkspaceFileIndex,
    activePracticePhase,
    practiceElapsedSeconds,
    isPracticeEvaluating,
    setIsPracticeEvaluating,
    setActivePracticeReport,
    showToast,
    academyBreadcrumbContext,
    toggleAcademyStepProgress,
    setLatestSandboxResult,
    setLatestMutationResult,
    updateWorkspaceFileContent,
    setPracticeWorkspaceFiles
  } = useAppStore();

  const autosave = useWorkspaceAutosave({
    challengeId: activePracticeChallenge?.id,
    files: practiceWorkspaceFiles,
    activePhase: activePracticePhase,
    activeWorkspaceFileIndex,
    timeSpentSeconds: practiceElapsedSeconds,
    enabled: Boolean(activePracticeChallenge)
  });

  const [isSandboxRunning, setIsSandboxRunning] = useState(false);
  const [sandboxResult, setSandboxResult] = useState<SandboxExecutionResponse | null>(null);
  const [mutationResult, setMutationResult] = useState<MutationExecutionResponse | null>(null);

  const evalPipeline = useEvaluationPipeline();

  const isWriteTheTestsMode = Boolean(
    activePracticeChallenge?.challengeMode === 'write_the_tests' ||
    activePracticeChallenge?.track === 'testing_mutation' ||
    (activePracticeChallenge?.mutants && activePracticeChallenge.mutants.length > 0)
  );

  const handleRunSandbox = useCallback(async () => {
    if (!activePracticeChallenge || isSandboxRunning) return;
    void autosave.flushNow();
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
    setLatestMutationResult,
    setLatestSandboxResult,
    showToast
  ]);

  const handleStartEvaluation = evalPipeline.handleStartEvaluation;

  const handleSaveDraft = useCallback(async () => {
    if (!activePracticeChallenge || autosave.isSaving) return;
    try {
      await autosave.flushNow();
      showToast({
        type: 'success',
        title: 'Черновик сохранен',
        message: 'Решение синхронизировано с базой данных'
      });
    } catch {
      showToast({
        type: 'error',
        title: 'Ошибка сохранения',
        message: 'Не удалось сохранить черновик'
      });
    }
  }, [activePracticeChallenge, autosave, showToast]);

  const handleResetWorkspace = useCallback(async () => {
    if (!activePracticeChallenge) return;
    if (!window.confirm('Сбросить весь воркспейс к начальному состоянию? Текущие изменения будут удалены.')) {
      return;
    }

    try {
      removeLocalDraft(activePracticeChallenge.id);
      await fetch(`/api/practice/reset/${activePracticeChallenge.id}`, { method: 'POST' });
      const initialFiles = (activePracticeChallenge.workspaceFiles || activePracticeChallenge.phases?.[0]?.addedFiles || []).map(f => ({ ...f }));
      setPracticeWorkspaceFiles(initialFiles);
      autosave.markClean();

      showToast({
        type: 'info',
        title: 'Воркспейс сброшен',
        message: 'Файлы возвращены к исходным шаблонам.'
      });
    } catch (e) {
      console.error('Error resetting workspace:', e);
    }
  }, [activePracticeChallenge, updateWorkspaceFileContent, autosave, showToast]);

  return {
    isSandboxRunning,
    sandboxResult,
    setSandboxResult,
    mutationResult,
    setMutationResult,
    isWriteTheTestsMode,
    isSavingDraft: autosave.isSaving,
    lastSavedTime: autosave.lastSavedTime,
    syncStatus: autosave.syncStatus,
    evaluationTimer: evalPipeline.evaluationTimer,
    evaluationStage: evalPipeline.currentStage,
    evalPipeline,
    handleRunSandbox,
    handleStartEvaluation,
    handleSaveDraft,
    handleResetWorkspace
  };
}
