import React, { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { IncidentTriageEvaluation } from '../../types/nextgen';
import { 
  ArrowLeft, Terminal, AlertTriangle, CheckCircle2, Award,
  Flame, Activity, Loader2, Compass, MessageSquare
} from 'lucide-react';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { TriageCompassSheet } from './compass/TriageCompassSheet';
import { TriageProfilerArtifactView, ParsedDump } from './TriageProfilerArtifactView';
import { TriageHypothesisBoard } from './TriageHypothesisBoard';
import { TriageIncidentCommanderChat } from './TriageIncidentCommanderChat';
import { TriageEvaluationModal } from './TriageEvaluationModal';

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
  
  // Profiler UI vs Raw Terminal Mode
  const [artifactViewMode, setArtifactViewMode] = useState<'profiler' | 'raw'>('profiler');
  const [threadFilter, setThreadFilter] = useState<'all' | 'blocked' | 'runnable' | 'waiting'>('all');
  const [expandedThreadNames, setExpandedThreadNames] = useState<Set<string>>(new Set());

  // Log Search and Quick Filter State
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
        setIsCompassOpen(prev => !prev);
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
          conversationHistory: updatedChat.slice(-6)
        })
      });

      if (res.ok) {
        const data = await res.json();
        setChatMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
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
      .then(res => res.ok ? res.json() : null)
      .then(data => {
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

  // Structured Java Profiler Parser (Thread Dump & Heap Histogram)
  const parsedDump = useMemo<ParsedDump>(() => {
    const raw = activeTriageIncident?.rawArtifactText || '';
    const isThreadDump = raw.includes('java.lang.Thread.State:') || raw.includes('JNI global references:') || raw.includes('Java-level deadlock');
    const isHeapHistogram = raw.includes('num') && raw.includes('#instances') && raw.includes('#bytes');

    if (isThreadDump) {
      const hasDeadlock = raw.includes('Java-level deadlock') || raw.toLowerCase().includes('deadlock');
      let deadlockSnippet = '';
      if (hasDeadlock) {
        const match = raw.match(/Found one Java-level deadlock:[\s\S]*?(?=\n\n\n|\n[A-Z]|$)/);
        deadlockSnippet = match ? match[0] : '';
      }

      const threadRegex = /"([^"]+)"[^\n]*?\n\s+java\.lang\.Thread\.State:\s+([A-Z_]+)([\s\S]*?)(?=(?:\n"[^"]+"|\n#\d+|\nJNI|\nFound|\n\n\n|$))/g;
      
      const threads: Array<{
        name: string;
        tid: string;
        nid: string;
        state: string;
        lockWaiting?: string;
        lockHolding?: string;
        stack: string[];
      }> = [];

      let match;
      while ((match = threadRegex.exec(raw)) !== null) {
        const [, name, state, body] = match;
        const tidMatch = match[0].match(/tid=([0-9a-fx]+)/i);
        const nidMatch = match[0].match(/nid=([0-9a-fx]+)/i);
        const tid = tidMatch ? tidMatch[1] : '';
        const nid = nidMatch ? nidMatch[1] : '';
        const lines = body.trim().split('\n').map(l => l.trim()).filter(Boolean);
        const lockWaiting = lines.find(l => l.includes('- waiting to lock') || l.includes('- waiting on'));
        const lockHolding = lines.find(l => l.includes('- locked'));

        threads.push({
          name,
          tid,
          nid,
          state,
          lockWaiting,
          lockHolding,
          stack: lines
        });
      }

      const counts = {
        total: threads.length,
        runnable: threads.filter(t => t.state === 'RUNNABLE').length,
        blocked: threads.filter(t => t.state === 'BLOCKED').length,
        waiting: threads.filter(t => t.state.includes('WAITING')).length,
        deadlock: hasDeadlock
      };

      return { type: 'thread_dump', threads, counts, deadlockSnippet };
    }

    if (isHeapHistogram) {
      const lines = raw.split('\n').filter(l => /^\s*\d+:\s+\d+\s+\d+\s+/.test(l));
      const entries = lines.slice(0, 50).map(line => {
        const parts = line.trim().split(/\s+/);
        return {
          rank: parts[0].replace(':', ''),
          instances: parseInt(parts[1], 10),
          bytes: parseInt(parts[2], 10),
          className: parts[3]
        };
      });
      const maxBytes = entries.length > 0 ? entries[0].bytes : 1;
      return { type: 'heap_histogram', entries, maxBytes };
    }

    return { type: 'generic' };
  }, [activeTriageIncident?.rawArtifactText]);

  useBodyScrollLock(Boolean(evaluationResult));

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
          preventionPlan
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

  return (
    <div className="flex flex-col h-[calc(100dvh-4rem)] overflow-hidden bg-pastel-bg text-pastel-text relative font-sans">
      {/* Top Bar */}
      <div className="h-14 border-b border-pastel-border/80 bg-white/95 backdrop-blur-md px-3 sm:px-4 flex items-center justify-between shrink-0 z-10 shadow-2xs gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {academyBreadcrumbContext ? (
            <button
              onClick={returnToAcademyStep}
              className="flex items-center gap-1 text-xs font-bold text-pastel-accentRose bg-pastel-rose hover:bg-pastel-accentRose hover:text-white px-2.5 py-1.5 rounded-xl border border-pastel-accentRose/30 transition cursor-pointer shrink-0"
              title="Вернуться к шагу курса в Академии"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">← Назад в Академию: Шаг #{academyBreadcrumbContext.stepNumber}</span>
              <span className="sm:hidden">← Шаг #{academyBreadcrumbContext.stepNumber}</span>
            </button>
          ) : (
            <button
              onClick={closeTriageIncident}
              className="flex items-center gap-1 text-xs font-bold text-pastel-muted hover:text-pastel-text px-2.5 py-1.5 rounded-xl hover:bg-pastel-rose/40 transition cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Каталог аварий</span>
            </button>
          )}

          <div className="h-4 w-px bg-pastel-border shrink-0" />

          {activeTriageIncident.level && (
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border shrink-0 ${
              activeTriageIncident.level === 'L0'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : activeTriageIncident.level === 'L1'
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : 'bg-purple-50 text-purple-700 border-purple-200'
            }`}>
              {activeTriageIncident.level}
            </span>
          )}

          <span className="font-bold text-xs text-pastel-text truncate max-w-[140px] sm:max-w-md">
            {activeTriageIncident.title}
          </span>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-pastel-bg p-0.5 rounded-xl border border-pastel-border shrink-0">
          <button
            onClick={() => setActiveTab('symptoms')}
            className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'symptoms' ? 'bg-white text-amber-800 shadow-2xs border border-pastel-border' : 'text-pastel-muted hover:text-pastel-text'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            <span>Симптомы</span>
          </button>

          <button
            onClick={() => setActiveTab('artifact')}
            className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'artifact' ? 'bg-white text-amber-800 shadow-2xs border border-pastel-border' : 'text-pastel-muted hover:text-pastel-text'
            }`}
          >
            <Terminal className="w-3.5 h-3.5 text-slate-600" />
            <span>Дамп / Лог</span>
          </button>

          <button
            onClick={() => setActiveTab('incident_commander')}
            className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'incident_commander' ? 'bg-white text-amber-800 shadow-2xs border border-pastel-border' : 'text-pastel-muted hover:text-pastel-text'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-amber-600" />
            <span>Incident Commander</span>
          </button>

          <button
            onClick={() => setActiveTab('rca')}
            className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'rca' ? 'bg-white text-amber-800 shadow-2xs border border-pastel-border' : 'text-pastel-muted hover:text-pastel-text'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Гипотеза RCA</span>
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setIsCompassOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/80 transition cursor-pointer shadow-2xs"
            title="Шпаргалка Triage Compass (Ctrl + /)"
          >
            <Compass className="w-3.5 h-3.5 text-amber-600 animate-spin-slow" />
            <span className="hidden sm:inline">Компас (Ctrl+/)</span>
          </button>

          <button
            onClick={handleEvaluate}
            disabled={isEvaluating}
            className="flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white transition shadow-sm cursor-pointer disabled:opacity-50 shrink-0 active:scale-95 touch-manipulation"
          >
            {isEvaluating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Award className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isEvaluating ? 'Оценка...' : 'Сдать RCA (Ctrl+↵)'}</span>
            <span className="sm:hidden">{isEvaluating ? '...' : 'Сдать'}</span>
          </button>
        </div>
      </div>

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
          <TriageProfilerArtifactView
            rawArtifactText={activeTriageIncident.rawArtifactText}
            parsedDump={parsedDump}
            artifactViewMode={artifactViewMode}
            setArtifactViewMode={setArtifactViewMode}
            threadFilter={threadFilter}
            setThreadFilter={setThreadFilter}
            logSearchQuery={logSearchQuery}
            setLogSearchQuery={setLogSearchQuery}
            expandedThreadNames={expandedThreadNames}
            setExpandedThreadNames={setExpandedThreadNames}
          />
        )}

        {activeTab === 'rca' && (
          <TriageHypothesisBoard
            rcaHypothesis={rcaHypothesis}
            updateRcaHypothesis={setRcaHypothesis}
            preventionPlan={preventionPlan}
            updatePreventionPlan={setPreventionPlan}
            onKeyDown={handleKeyDown}
          />
        )}

        {activeTab === 'incident_commander' && (
          <TriageIncidentCommanderChat
            chatMessages={chatMessages}
            inputMessage={inputMessage}
            setInputMessage={setInputMessage}
            isSendingMessage={isSendingMessage}
            handleSendMessage={handleSendMessage}
          />
        )}
      </div>

      {/* Evaluation Result Modal */}
      <TriageEvaluationModal
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
          setInputMessage(`Объясните подробнее правило «${ruleTitle}» в контексте нашего инцидента «${activeTriageIncident.title}»:\n${ruleSummary}`);
        }}
      />
    </div>
  );
};
