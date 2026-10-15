import React, { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { IncidentTriageEvaluation } from '../../types/nextgen';
import { Activity, Flame, Search } from 'lucide-react';
import { parseThreadDumpFast } from '../../utils/threadDumpParser';
import { TriageCompassSheet } from './compass/TriageCompassSheet';
import { IncidentTriageTopBar } from './studio/IncidentTriageTopBar';
import { ThreadDumpVisualizer } from './studio/ThreadDumpVisualizer';
import { IncidentRcaTab } from './studio/IncidentRcaTab';
import { IncidentCommanderChatTab } from './studio/IncidentCommanderChatTab';
import { IncidentEvaluationModal } from './studio/IncidentEvaluationModal';

export const IncidentTriageStudio: React.FC = () => {
  const {
    activeTriageIncident,
    closeTriageIncident,
    showToast,
    academyBreadcrumbContext,
    returnToAcademyStep,
    toggleAcademyStepProgress
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<'symptoms' | 'artifact' | 'rca' | 'incident_commander'>('artifact');
  const [isCompassOpen, setIsCompassOpen] = useState(false);

  // MTTM / MTTR Dual Phase Tracker
  const [phase, setPhase] = useState<'mttm' | 'mttr'>('mttm');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [selectedMitigation, setSelectedMitigation] = useState<string>('');

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Profiler UI vs Raw Terminal Mode & Filters
  const [artifactViewMode, setArtifactViewMode] = useState<'profiler' | 'raw'>('profiler');
  const [logSearchQuery, setLogSearchQuery] = useState('');

  // RCA Edit / Preview Modes
  const [rcaHypothesis, setRcaHypothesis] = useState('');
  const [preventionPlan, setPreventionPlan] = useState('');

  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState<IncidentTriageEvaluation | null>(null);

  // Global Hotkey for Triage Compass (Ctrl + /)
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

  // Socratic Incident Commander State
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([
    {
      role: 'assistant',
      content: `Оперативный мост инцидента на связи. Мы расследуем «${activeTriageIncident?.title || 'аварию'}». С каких первичных симптомов (RED/USE) вы начинаете, и какую фальсифицируемую гипотезу хотите проверить в дампе?`
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);

  // Real-time Triage Epistemic Digest (Tarjan SCC & Thread Telemetry)
  const triageDigest = useMemo(() => {
    if (!activeTriageIncident) return null;
    let deadlockSummary = '';
    let threadCounts: any = undefined;

    if (activeTriageIncident.rawArtifactText) {
      const raw = activeTriageIncident.rawArtifactText;
      const isThreadDump =
        raw.includes('java.lang.Thread.State:') ||
        raw.includes('Java-level deadlock');
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

  const handleSendMessage = async () => {
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
  };

  // Autosave & Server Hydration for RCA Hypothesis & Prevention Plan
  useEffect(() => {
    if (!activeTriageIncident?.id) return;
    let isCancelled = false;

    // 1. Instant local fallback
    const savedDraft = localStorage.getItem(`triage_draft_${activeTriageIncident.id}`);
    if (savedDraft) {
      try {
        const { rca, plan } = JSON.parse(savedDraft);
        if (rca) setRcaHypothesis(rca);
        if (plan) setPreventionPlan(plan);
      } catch {}
    }

    // 2. Fetch ground-truth submission from backend SQLite
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

  // 3. Debounced autosave to localStorage (400ms)
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

  if (!activeTriageIncident) return null;

  const handleEvaluate = async () => {
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
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      void handleEvaluate();
    }
  };

  const handleMitigate = () => {
    setPhase('mttr');
    setActiveTab('rca');
    showToast({
      type: 'success',
      title: 'Трафик локализован (MTTM зафиксирован)',
      message: 'Переходим к Фазе 2: Поиск первопричины (RCA) и формулирование плана фикса'
    });
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-4rem)] overflow-hidden bg-pastel-bg text-pastel-text relative font-sans">
      {/* Top Bar */}
      <IncidentTriageTopBar
        title={activeTriageIncident.title}
        severity={activeTriageIncident.severity}
        academyBreadcrumbContext={academyBreadcrumbContext}
        returnToAcademyStep={returnToAcademyStep}
        closeTriageIncident={closeTriageIncident}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenCompass={() => setIsCompassOpen(true)}
        onEvaluate={handleEvaluate}
        isEvaluating={isEvaluating}
        phase={phase}
        onMitigate={handleMitigate}
        elapsedSeconds={elapsedSeconds}
      />

      {/* Main Content Body */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        {activeTab === 'symptoms' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-white/95 border border-pastel-border/80 rounded-2xl p-5 space-y-4 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200">
                  {activeTriageIncident.category}
                </span>
                <span className="text-xs font-mono font-bold text-rose-600 flex items-center gap-1">
                  <Flame className="w-4 h-4" />
                  <span>{activeTriageIncident.severity}</span>
                </span>
              </div>

              <h2 className="text-lg font-bold text-pastel-text">{activeTriageIncident.title}</h2>

              <div className="pt-2 border-t border-pastel-border/60">
                <span className="text-xs font-bold text-pastel-muted block mb-1">Симптомы сбоя и системное поведение:</span>
                <p className="text-xs text-pastel-text leading-relaxed whitespace-pre-line">
                  {activeTriageIncident.symptomsMarkdown}
                </p>
              </div>

              <div className="mt-4 p-3 rounded-xl bg-pastel-bg border border-pastel-border text-xs font-mono text-pastel-text flex items-center gap-2">
                <Activity className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Триггер алерта: {activeTriageIncident.keyMetricTrigger}</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'artifact' && (
          <div className="max-w-5xl 2xl:max-w-[2000px] mx-auto space-y-4">
            <ThreadDumpVisualizer
              rawArtifactText={activeTriageIncident.rawArtifactText || ''}
              artifactViewMode={artifactViewMode}
              setArtifactViewMode={setArtifactViewMode}
              logSearchQuery={logSearchQuery}
              setLogSearchQuery={setLogSearchQuery}
            />
          </div>
        )}

        {activeTab === 'rca' && (
          <IncidentRcaTab
            rcaHypothesis={rcaHypothesis}
            updateRcaHypothesis={setRcaHypothesis}
            preventionPlan={preventionPlan}
            updatePreventionPlan={setPreventionPlan}
            selectedMitigation={selectedMitigation}
            onSelectMitigation={setSelectedMitigation}
            onKeyDown={handleKeyDown}
          />
        )}

        {activeTab === 'incident_commander' && (
          <IncidentCommanderChatTab
            chatMessages={chatMessages}
            inputMessage={inputMessage}
            setInputMessage={setInputMessage}
            handleSendMessage={handleSendMessage}
            isSendingMessage={isSendingMessage}
            incidentTitle={activeTriageIncident.title}
          />
        )}
      </div>

      {/* Postmortem Evaluation Modal */}
      <IncidentEvaluationModal
        evaluationResult={evaluationResult}
        onClose={() => setEvaluationResult(null)}
      />

      {/* Triage Compass Modal Sheet (5 Golden SRE Rules) */}
      <TriageCompassSheet
        isOpen={isCompassOpen}
        onClose={() => setIsCompassOpen(false)}
        onAskTutorAboutRule={(ruleTitle, ruleSummary) => {
          setIsCompassOpen(false);
          setActiveTab('incident_commander');
          setInputMessage(
            `Объясните подробнее правило «${ruleTitle}» в контексте нашего инцидента «${activeTriageIncident.title}»:\n${ruleSummary}`
          );
        }}
      />
    </div>
  );
};
