import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { IncidentTriageEvaluation } from '../../../types/nextgen';
import { parseThreadDumpFast } from '../../../utils/threadDumpParser';

export type TriageTab = 'symptoms' | 'artifact' | 'rca' | 'incident_commander';

export interface UseIncidentInvestigationReturn {
  activeTab: TriageTab;
  setActiveTab: (tab: TriageTab) => void;
  isCompassOpen: boolean;
  setIsCompassOpen: React.Dispatch<React.SetStateAction<boolean>>;
  phase: 'mttm' | 'mttr';
  elapsedSeconds: number;
  handleMitigate: () => void;
  selectedMitigation: string;
  setSelectedMitigation: (val: string) => void;
  artifactViewMode: 'profiler' | 'raw';
  setArtifactViewMode: (mode: 'profiler' | 'raw') => void;
  logSearchQuery: string;
  setLogSearchQuery: (query: string) => void;
  rcaHypothesis: string;
  setRcaHypothesis: (val: string) => void;
  preventionPlan: string;
  setPreventionPlan: (val: string) => void;
  isEvaluating: boolean;
  evaluationResult: IncidentTriageEvaluation | null;
  setEvaluationResult: React.Dispatch<React.SetStateAction<IncidentTriageEvaluation | null>>;
  handleEvaluate: () => Promise<void>;
  chatMessages: Array<{ role: 'user' | 'assistant'; content: string }>;
  inputMessage: string;
  setInputMessage: (val: string) => void;
  isSendingMessage: boolean;
  handleSendMessage: () => Promise<void>;
  handleAskTutorAboutRule: (ruleTitle: string, ruleSummary: string) => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;
}

export function useIncidentInvestigation(): UseIncidentInvestigationReturn {
  const {
    activeTriageIncident,
    showToast,
    academyBreadcrumbContext,
    toggleAcademyStepProgress
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<TriageTab>('artifact');
  const [isCompassOpen, setIsCompassOpen] = useState(false);
  const [phase, setPhase] = useState<'mttm' | 'mttr'>('mttm');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [selectedMitigation, setSelectedMitigation] = useState<string>('');

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const [artifactViewMode, setArtifactViewMode] = useState<'profiler' | 'raw'>('profiler');
  const [logSearchQuery, setLogSearchQuery] = useState('');
  const [rcaHypothesis, setRcaHypothesis] = useState('');
  const [preventionPlan, setPreventionPlan] = useState('');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState<IncidentTriageEvaluation | null>(null);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        setIsCompassOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([
    {
      role: 'assistant',
      content: `Оперативный мост инцидента на связи. Мы расследуем «${activeTriageIncident?.title || 'аварию'}». С каких первичных симптомов (RED/USE) вы начинаете, и какую фальсифицируемую гипотезу хотите проверить в дампе?`
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);

  const triageDigest = useMemo(() => {
    if (!activeTriageIncident) return null;
    let deadlockSummary = '';
    let threadCounts: any = undefined;

    if (activeTriageIncident.rawArtifactText) {
      const raw = activeTriageIncident.rawArtifactText;
      const isThreadDump = raw.includes('java.lang.Thread.State:') || raw.includes('Java-level deadlock');
      if (isThreadDump) {
        try {
          const parsed = parseThreadDumpFast(raw);
          threadCounts = parsed.counts;
          if (parsed.hasDeadlock && parsed.deadlockCycles.length > 0) {
            deadlockSummary = parsed.deadlockCycles
              .map((c) => `Цикл ${c.cycleId}: [${c.threadNames.join(' -> ')}] на локах [${c.lockIds.join(', ')}]`)
              .join('; ');
          }
        } catch {}
      }
    }

    return {
      phase,
      elapsedSeconds,
      deadlockSummary: deadlockSummary || undefined,
      threadCounts,
      candidateRcaDraft: rcaHypothesis.trim() || undefined
    };
  }, [activeTriageIncident, phase, elapsedSeconds, rcaHypothesis]);

  const handleSendMessage = useCallback(async () => {
    if (!inputMessage.trim() || isSendingMessage || !activeTriageIncident) return;
    const userMsg = inputMessage.trim();
    setInputMessage('');

    const updatedChat = [...chatMessages, { role: 'user' as const, content: userMsg }];
    setChatMessages(updatedChat);
    setIsSendingMessage(true);

    try {
      const res = await fetch('/api/triage/probe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          incidentId: activeTriageIncident.id,
          userMessage: userMsg,
          conversationHistory: updatedChat.slice(-6),
          triageDigest
        })
      });

      if (res.ok) {
        const data = await res.json();
        setChatMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
      } else {
        showToast({ type: 'error', title: 'Ошибка AI', message: 'Не удалось получить ответ от Incident Commander' });
      }
    } catch {
      showToast({ type: 'error', title: 'Сетевая ошибка', message: 'Ошибка связи с сервером' });
    } finally {
      setIsSendingMessage(false);
    }
  }, [inputMessage, isSendingMessage, activeTriageIncident, chatMessages, triageDigest, showToast]);

  useEffect(() => {
    if (!activeTriageIncident?.id) return;
    let isCancelled = false;

    const savedDraft = localStorage.getItem(`triage_draft_${activeTriageIncident.id}`);
    if (savedDraft) {
      try {
        const { rca, plan } = JSON.parse(savedDraft);
        if (rca) setRcaHypothesis(rca);
        if (plan) setPreventionPlan(plan);
      } catch {}
    }

    fetch(`/api/triage/submissions/${activeTriageIncident.id}`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isCancelled || !data?.submission) return;
        const sub = data.submission;
        if (sub.rca_hypothesis) setRcaHypothesis(sub.rca_hypothesis);
        if (sub.prevention_plan) setPreventionPlan(sub.prevention_plan);
        if (sub.evaluation_json) {
          try {
            setEvaluationResult(JSON.parse(sub.evaluation_json));
          } catch {}
        }
      })
      .catch(() => {});

    return () => {
      isCancelled = true;
    };
  }, [activeTriageIncident?.id]);

  useEffect(() => {
    if (!activeTriageIncident?.id) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(
          `triage_draft_${activeTriageIncident.id}`,
          JSON.stringify({ rca: rcaHypothesis, plan: preventionPlan })
        );
      } catch {}
    }, 400);
    return () => clearTimeout(timer);
  }, [activeTriageIncident?.id, rcaHypothesis, preventionPlan]);

  const handleEvaluate = useCallback(async () => {
    if (!activeTriageIncident) return;
    if (!rcaHypothesis.trim() || !preventionPlan.trim()) {
      showToast({
        type: 'warning',
        title: 'Заполните поля',
        message: 'Пожалуйста, укажите гипотезу RCA и превентивный план фикса'
      });
      return;
    }

    setIsEvaluating(true);
    try {
      const res = await fetch('/api/triage/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          incidentId: activeTriageIncident.id,
          rcaHypothesis,
          preventionPlan,
          conversationHistory: chatMessages,
          investigationDigest: triageDigest
        })
      });

      if (res.ok) {
        const result: IncidentTriageEvaluation = await res.json();
        setEvaluationResult(result);
        if (result.verdict !== 'INCORRECT' && academyBreadcrumbContext) {
          void toggleAcademyStepProgress(
            academyBreadcrumbContext.courseId,
            academyBreadcrumbContext.stepNumber,
            true
          );
        }
      } else {
        showToast({ type: 'error', title: 'Ошибка оценки', message: 'Не удалось получить оценку RCA' });
      }
    } catch {
      showToast({ type: 'error', title: 'Сетевая ошибка', message: 'Ошибка связи с сервером' });
    } finally {
      setIsEvaluating(false);
    }
  }, [
    activeTriageIncident,
    rcaHypothesis,
    preventionPlan,
    chatMessages,
    triageDigest,
    academyBreadcrumbContext,
    toggleAcademyStepProgress,
    showToast
  ]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        void handleEvaluate();
      }
    },
    [handleEvaluate]
  );

  const handleMitigate = useCallback(() => {
    setPhase('mttr');
    setActiveTab('rca');
    showToast({
      type: 'success',
      title: 'Трафик локализован (MTTM зафиксирован)',
      message: 'Переходим к Фазе 2: Поиск первопричины (RCA) и формулирование плана фикса'
    });
  }, [showToast]);

  const handleAskTutorAboutRule = useCallback(
    (ruleTitle: string, ruleSummary: string) => {
      setIsCompassOpen(false);
      setActiveTab('incident_commander');
      setInputMessage(
        `Объясните подробнее правило «${ruleTitle}» в контексте нашего инцидента «${activeTriageIncident?.title || ''}»:\n${ruleSummary}`
      );
    },
    [activeTriageIncident?.title]
  );

  return {
    activeTab,
    setActiveTab,
    isCompassOpen,
    setIsCompassOpen,
    phase,
    elapsedSeconds,
    handleMitigate,
    selectedMitigation,
    setSelectedMitigation,
    artifactViewMode,
    setArtifactViewMode,
    logSearchQuery,
    setLogSearchQuery,
    rcaHypothesis,
    setRcaHypothesis,
    preventionPlan,
    setPreventionPlan,
    isEvaluating,
    evaluationResult,
    setEvaluationResult,
    handleEvaluate,
    chatMessages,
    inputMessage,
    setInputMessage,
    isSendingMessage,
    handleSendMessage,
    handleAskTutorAboutRule,
    handleKeyDown
  };
}
