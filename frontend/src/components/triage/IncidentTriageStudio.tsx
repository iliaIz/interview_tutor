import React, { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { IncidentTriageEvaluation } from '../../types/nextgen';
import { 
  ArrowLeft, Terminal, AlertTriangle, CheckCircle2, Award,
  Send, Sparkles, Flame, Copy, Check, FileCode, Activity, Loader2,
  Search, X, Eye, Edit3, ShieldAlert, Cpu, Layers, Lock, ChevronDown, ChevronUp, Table
} from 'lucide-react';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { CodeViewer } from '../CodeViewer';
import { MarkdownRenderer } from '../MarkdownRenderer';

export const IncidentTriageStudio: React.FC = () => {
  const { 
    activeTriageIncident, 
    closeTriageIncident, 
    showToast,
    academyBreadcrumbContext,
    returnToAcademyStep
  } = useAppStore();
  const [activeTab, setActiveTab] = useState<'symptoms' | 'artifact' | 'rca'>('artifact');
  
  // Profiler UI vs Raw Terminal Mode
  const [artifactViewMode, setArtifactViewMode] = useState<'profiler' | 'raw'>('profiler');
  const [threadFilter, setThreadFilter] = useState<'all' | 'blocked' | 'runnable' | 'waiting'>('all');
  const [expandedThreadNames, setExpandedThreadNames] = useState<Set<string>>(new Set());

  // Log Search and Quick Filter State
  const [logSearchQuery, setLogSearchQuery] = useState('');
  
  // RCA Edit / Preview Modes
  const [rcaHypothesis, setRcaHypothesis] = useState('');
  const [rcaMode, setRcaMode] = useState<'edit' | 'preview'>('edit');

  const [preventionPlan, setPreventionPlan] = useState('');
  const [preventionMode, setPreventionMode] = useState<'edit' | 'preview'>('edit');
  
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState<IncidentTriageEvaluation | null>(null);

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

  const updateRcaHypothesis = (val: string) => setRcaHypothesis(val);
  const updatePreventionPlan = (val: string) => setPreventionPlan(val);

  // Structured Java Profiler Parser (Thread Dump & Heap Histogram)
  const parsedDump = useMemo(() => {
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

      const threadRegex = /"([^"]+)"\s+(?:#\d+\s+)?(?:daemon\s+)?prio=\d+\s+os_prio=\d+\s+tid=([0-9a-fx]+)\s+nid=([0-9a-fx]+)\s+([^\[\n]+)(?:\[([^\]]+)\])?\s+java\.lang\.Thread\.State:\s+([A-Z_]+)([\s\S]*?)(?=(?:\n"[^"]+"|\nJNI|\nFound|\n\n\n|$))/g;
      
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
        const [, name, tid, nid, , , state, body] = match;
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

      return { type: 'thread_dump' as const, threads, counts, deadlockSnippet };
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
      return { type: 'heap_histogram' as const, entries, maxBytes };
    }

    return { type: 'generic' as const };
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
            onClick={() => setActiveTab('rca')}
            className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'rca' ? 'bg-white text-amber-800 shadow-2xs border border-pastel-border' : 'text-pastel-muted hover:text-pastel-text'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Гипотеза RCA</span>
          </button>
        </div>

        {/* Action Button */}
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
            {/* Profiler Toolbar: View Switcher, Search & Fast Filters */}
            <div className="bg-white/95 border border-pastel-border/80 rounded-2xl p-3 shadow-2xs flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-pastel-bg p-0.5 rounded-xl border border-pastel-border">
                  <button
                    onClick={() => setArtifactViewMode('profiler')}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      artifactViewMode === 'profiler'
                        ? 'bg-white text-pastel-text shadow-2xs'
                        : 'text-pastel-muted hover:text-pastel-text'
                    }`}
                  >
                    <Activity className="w-3.5 h-3.5 text-amber-600" />
                    <span>VisualVM Profiler</span>
                  </button>
                  <button
                    onClick={() => setArtifactViewMode('raw')}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      artifactViewMode === 'raw'
                        ? 'bg-white text-pastel-text shadow-2xs'
                        : 'text-pastel-muted hover:text-pastel-text'
                    }`}
                  >
                    <Terminal className="w-3.5 h-3.5 text-slate-600" />
                    <span>Raw Terminal</span>
                  </button>
                </div>

                {parsedDump.type === 'thread_dump' && (
                  <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-pastel-bg text-pastel-text border border-pastel-border hidden sm:inline">
                    Всего потоков: {parsedDump.counts.total}
                  </span>
                )}
              </div>

              {/* Search input */}
              <div className="relative min-w-[220px] flex-1 max-w-md">
                <Search className="w-3.5 h-3.5 text-pastel-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={logSearchQuery}
                  onChange={(e) => setLogSearchQuery(e.target.value)}
                  placeholder="Поиск по стектрейсу, классам, мониторам..."
                  className="w-full pl-8 pr-7 py-1.5 text-xs font-mono bg-pastel-bg border border-pastel-border rounded-xl focus:outline-hidden focus:border-amber-400 placeholder:text-pastel-muted/60"
                />
                {logSearchQuery && (
                  <button
                    onClick={() => setLogSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-pastel-muted hover:text-pastel-text"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* PROFILER VIEW MODE */}
            {artifactViewMode === 'profiler' && (
              <>
                {/* 1. THREAD DUMP PROFILER */}
                {parsedDump.type === 'thread_dump' && (
                  <div className="space-y-4">
                    {/* Metrics Bar */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <button
                        onClick={() => setThreadFilter('all')}
                        className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                          threadFilter === 'all'
                            ? 'bg-white border-amber-300 shadow-xs ring-2 ring-amber-100'
                            : 'bg-white/80 border-pastel-border hover:bg-white'
                        }`}
                      >
                        <span className="text-[11px] font-medium text-pastel-muted block">Все потоки</span>
                        <strong className="text-lg font-mono font-black text-pastel-text">{parsedDump.counts.total}</strong>
                      </button>

                      <button
                        onClick={() => setThreadFilter('blocked')}
                        className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                          threadFilter === 'blocked'
                            ? 'bg-rose-50 border-rose-300 shadow-xs ring-2 ring-rose-100'
                            : 'bg-white/80 border-pastel-border hover:bg-white'
                        }`}
                      >
                        <span className="text-[11px] font-medium text-rose-600 flex items-center gap-1">
                          <Lock className="w-3 h-3" /> Заблокировано (BLOCKED)
                        </span>
                        <strong className="text-lg font-mono font-black text-rose-700">{parsedDump.counts.blocked}</strong>
                      </button>

                      <button
                        onClick={() => setThreadFilter('runnable')}
                        className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                          threadFilter === 'runnable'
                            ? 'bg-emerald-50 border-emerald-300 shadow-xs ring-2 ring-emerald-100'
                            : 'bg-white/80 border-pastel-border hover:bg-white'
                        }`}
                      >
                        <span className="text-[11px] font-medium text-emerald-700 flex items-center gap-1">
                          <Activity className="w-3 h-3" /> Выполняются (RUNNABLE)
                        </span>
                        <strong className="text-lg font-mono font-black text-emerald-700">{parsedDump.counts.runnable}</strong>
                      </button>

                      <button
                        onClick={() => setThreadFilter('waiting')}
                        className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                          threadFilter === 'waiting'
                            ? 'bg-amber-50 border-amber-300 shadow-xs ring-2 ring-amber-100'
                            : 'bg-white/80 border-pastel-border hover:bg-white'
                        }`}
                      >
                        <span className="text-[11px] font-medium text-amber-700 block">Ожидание (WAITING)</span>
                        <strong className="text-lg font-mono font-black text-amber-700">{parsedDump.counts.waiting}</strong>
                      </button>
                    </div>

                    {/* Deadlock Alert Banner */}
                    {parsedDump.counts.deadlock && (
                      <div className="p-4 rounded-2xl bg-rose-500/10 border-2 border-rose-500/50 shadow-sm space-y-2">
                        <div className="flex items-center gap-2 text-rose-700 font-bold text-sm">
                          <ShieldAlert className="w-5 h-5 text-rose-600 animate-pulse" />
                          <span>Критическая блокировка: Found one Java-level deadlock!</span>
                        </div>
                        {parsedDump.deadlockSnippet && (
                          <pre className="p-3 bg-slate-950 text-rose-300 rounded-xl text-xs font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed">
                            {parsedDump.deadlockSnippet}
                          </pre>
                        )}
                      </div>
                    )}

                    {/* Threads List */}
                    <div className="space-y-2">
                      {parsedDump.threads
                        .filter(t => {
                          if (threadFilter === 'blocked' && t.state !== 'BLOCKED') return false;
                          if (threadFilter === 'runnable' && t.state !== 'RUNNABLE') return false;
                          if (threadFilter === 'waiting' && !t.state.includes('WAITING')) return false;
                          if (logSearchQuery.trim()) {
                            const q = logSearchQuery.toLowerCase();
                            return t.name.toLowerCase().includes(q) ||
                              t.state.toLowerCase().includes(q) ||
                              (t.lockWaiting && t.lockWaiting.toLowerCase().includes(q)) ||
                              t.stack.some(line => line.toLowerCase().includes(q));
                          }
                          return true;
                        })
                        .map((thread) => {
                          const isBlocked = thread.state === 'BLOCKED';
                          const isRunnable = thread.state === 'RUNNABLE';
                          const isExpanded = expandedThreadNames.has(thread.name) || isBlocked;

                          return (
                            <div
                              key={thread.name + thread.tid}
                              className={`rounded-2xl border transition-all ${
                                isBlocked
                                  ? 'bg-rose-50/50 border-rose-200 shadow-2xs'
                                  : 'bg-white border-pastel-border/90 hover:border-pastel-border'
                              }`}
                            >
                              <div
                                onClick={() => {
                                  setExpandedThreadNames(prev => {
                                    const next = new Set(prev);
                                    if (next.has(thread.name)) next.delete(thread.name);
                                    else next.add(thread.name);
                                    return next;
                                  });
                                }}
                                className="p-3 sm:p-4 flex items-center justify-between gap-3 cursor-pointer select-none"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                                    isBlocked ? 'bg-rose-500 animate-ping' : isRunnable ? 'bg-emerald-500' : 'bg-amber-400'
                                  }`} />
                                  <Cpu className="w-4 h-4 text-pastel-muted shrink-0" />
                                  <span className="font-mono font-bold text-xs text-pastel-text truncate">
                                    "{thread.name}"
                                  </span>
                                  <span className="text-[10px] font-mono text-pastel-muted hidden md:inline">
                                    tid={thread.tid}
                                  </span>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                                    isBlocked
                                      ? 'bg-rose-100 text-rose-800 border-rose-200'
                                      : isRunnable
                                      ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                      : 'bg-amber-100 text-amber-800 border-amber-200'
                                  }`}>
                                    {thread.state}
                                  </span>
                                  {isExpanded ? (
                                    <ChevronUp className="w-4 h-4 text-pastel-muted" />
                                  ) : (
                                    <ChevronDown className="w-4 h-4 text-pastel-muted" />
                                  )}
                                </div>
                              </div>

                              {/* Expanded Lock & Stack Frames */}
                              {isExpanded && (
                                <div className="px-4 pb-4 pt-1 border-t border-pastel-border/60 font-mono text-xs space-y-2">
                                  {thread.lockWaiting && (
                                    <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 font-bold flex items-center gap-2">
                                      <Lock className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                                      <span>{thread.lockWaiting}</span>
                                    </div>
                                  )}
                                  {thread.lockHolding && (
                                    <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-2">
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                      <span>{thread.lockHolding}</span>
                                    </div>
                                  )}

                                  <div className="bg-slate-950 rounded-xl p-3 text-slate-300 text-[11px] leading-relaxed overflow-x-auto max-h-60">
                                    {thread.stack.map((line, idx) => {
                                      const isProjectCode = line.includes('com.') || line.includes('org.');
                                      return (
                                        <div
                                          key={idx}
                                          className={`py-0.5 ${
                                            line.includes('waiting to lock')
                                              ? 'text-rose-400 font-bold bg-rose-950/40 px-1 rounded'
                                              : isProjectCode
                                              ? 'text-emerald-300 font-medium'
                                              : 'text-slate-400'
                                          }`}
                                        >
                                          {line}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}

                {/* 2. HEAP HISTOGRAM PROFILER (Eclipse MAT / VisualVM Table) */}
                {parsedDump.type === 'heap_histogram' && (
                  <div className="bg-white rounded-2xl border border-pastel-border overflow-hidden shadow-2xs">
                    <div className="p-4 border-b border-pastel-border/80 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Table className="w-4 h-4 text-purple-600" />
                        <h3 className="text-xs font-bold text-pastel-text uppercase tracking-wider">
                          VisualVM Heap Objects Histogram (Топ аллокаций памяти)
                        </h3>
                      </div>
                      <span className="text-[11px] font-mono text-pastel-muted">
                        Показано: {parsedDump.entries.length} классов
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-xs font-mono text-left">
                        <thead className="bg-pastel-bg text-pastel-text text-[10px] uppercase font-bold border-b border-pastel-border">
                          <tr>
                            <th className="px-3.5 py-2.5"># Ранг</th>
                            <th className="px-3.5 py-2.5">Класс в куче (Class Name)</th>
                            <th className="px-3.5 py-2.5">Кол-во объектов</th>
                            <th className="px-3.5 py-2.5">Размер (Bytes)</th>
                            <th className="px-3.5 py-2.5 min-w-[120px]">% Памяти</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-pastel-border/60">
                          {parsedDump.entries
                            .filter(e => !logSearchQuery.trim() || e.className.toLowerCase().includes(logSearchQuery.toLowerCase()))
                            .map((entry) => {
                              const pct = Math.round((entry.bytes / (parsedDump.maxBytes || 1)) * 100);
                              return (
                                <tr key={entry.rank} className="hover:bg-pastel-bg/50 transition">
                                  <td className="px-3.5 py-2 font-bold text-pastel-muted">#{entry.rank}</td>
                                  <td className="px-3.5 py-2 font-bold text-pastel-text break-all">{entry.className}</td>
                                  <td className="px-3.5 py-2 text-slate-600">{entry.instances.toLocaleString()}</td>
                                  <td className="px-3.5 py-2 font-bold text-purple-700">
                                    {(entry.bytes / 1024 / 1024).toFixed(2)} MB ({entry.bytes.toLocaleString()} B)
                                  </td>
                                  <td className="px-3.5 py-2">
                                    <div className="flex items-center gap-2">
                                      <div className="w-16 bg-slate-100 h-2 rounded-full overflow-hidden">
                                        <div
                                          className="h-full bg-purple-500 rounded-full"
                                          style={{ width: `${pct}%` }}
                                        />
                                      </div>
                                      <span className="text-[10px] text-pastel-muted">{pct}%</span>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 3. GENERIC FALLBACK */}
                {parsedDump.type === 'generic' && (
                  <CodeViewer
                    code={activeTriageIncident.rawArtifactText}
                    language="log"
                    title="Observability SRE Terminal"
                    searchQuery={logSearchQuery}
                    showLineNumbers={true}
                    maxHeight="max-h-[600px]"
                  />
                )}
              </>
            )}

            {/* RAW TERMINAL VIEW MODE */}
            {artifactViewMode === 'raw' && (
              <CodeViewer
                code={activeTriageIncident.rawArtifactText}
                language="log"
                title="Raw JVM Output Terminal"
                searchQuery={logSearchQuery}
                showLineNumbers={true}
                maxHeight="max-h-[650px]"
              />
            )}
          </div>
        )}

        {activeTab === 'rca' && (
          <div className="max-w-4xl mx-auto space-y-6" onKeyDown={handleKeyDown}>
            {/* Block 1: RCA Hypothesis */}
            <div className="bg-white/95 border border-pastel-border/80 rounded-2xl p-5 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between border-b border-pastel-border/60 pb-2.5">
                <label className="text-xs font-bold text-pastel-text flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-amber-600" />
                  <span>1. Гипотеза корневой причины (Root Cause Analysis):</span>
                </label>

                <div className="flex items-center bg-pastel-bg p-0.5 rounded-lg border border-pastel-border">
                  <button
                    onClick={() => setRcaMode('edit')}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold transition cursor-pointer ${
                      rcaMode === 'edit' ? 'bg-white text-pastel-text shadow-2xs' : 'text-pastel-muted hover:text-pastel-text'
                    }`}
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>Редактор</span>
                  </button>
                  <button
                    onClick={() => setRcaMode('preview')}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold transition cursor-pointer ${
                      rcaMode === 'preview' ? 'bg-white text-pastel-accentRose shadow-2xs' : 'text-pastel-muted hover:text-pastel-text'
                    }`}
                  >
                    <Eye className="w-3 h-3" />
                    <span>Предпросмотр</span>
                  </button>
                </div>
              </div>

              {rcaMode === 'edit' ? (
                <textarea
                  value={rcaHypothesis}
                  onChange={(e) => updateRcaHypothesis(e.target.value)}
                  maxLength={20000}
                  placeholder="Опишите, что именно вызвало сбой на уровне JVM, блокировок, потоков или СУБД (поддерживается Markdown)..."
                  className="w-full h-36 bg-pastel-bg border border-pastel-border rounded-xl p-3 text-xs font-mono text-pastel-text placeholder-pastel-muted/50 focus:outline-hidden focus:border-amber-500 resize-none shadow-2xs"
                />
              ) : (
                <div className="min-h-[144px] p-3 rounded-xl bg-pastel-bg/60 border border-pastel-border">
                  {rcaHypothesis.trim() ? (
                    <MarkdownRenderer content={rcaHypothesis} />
                  ) : (
                    <span className="text-xs text-pastel-muted italic">Текст гипотезы пока пуст.</span>
                  )}
                </div>
              )}
            </div>

            {/* Block 2: Prevention Plan */}
            <div className="bg-white/95 border border-pastel-border/80 rounded-2xl p-5 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between border-b border-pastel-border/60 pb-2.5">
                <label className="text-xs font-bold text-pastel-text flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>2. Архитектурный план превентивных мер (Remediation Plan):</span>
                </label>

                <div className="flex items-center bg-pastel-bg p-0.5 rounded-lg border border-pastel-border">
                  <button
                    onClick={() => setPreventionMode('edit')}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold transition cursor-pointer ${
                      preventionMode === 'edit' ? 'bg-white text-pastel-text shadow-2xs' : 'text-pastel-muted hover:text-pastel-text'
                    }`}
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>Редактор</span>
                  </button>
                  <button
                    onClick={() => setPreventionMode('preview')}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold transition cursor-pointer ${
                      preventionMode === 'preview' ? 'bg-white text-pastel-accentRose shadow-2xs' : 'text-pastel-muted hover:text-pastel-text'
                    }`}
                  >
                    <Eye className="w-3 h-3" />
                    <span>Предпросмотр</span>
                  </button>
                </div>
              </div>

              {preventionMode === 'edit' ? (
                <textarea
                  value={preventionPlan}
                  onChange={(e) => updatePreventionPlan(e.target.value)}
                  maxLength={20000}
                  placeholder="Опишите, как перепроектировать код или конфигурацию (ReentrantLock, таймауты, индексы, ScopedValue), чтобы исключить рецидив..."
                  className="w-full h-36 bg-pastel-bg border border-pastel-border rounded-xl p-3 text-xs font-mono text-pastel-text placeholder-pastel-muted/50 focus:outline-hidden focus:border-amber-500 resize-none shadow-2xs"
                />
              ) : (
                <div className="min-h-[144px] p-3 rounded-xl bg-pastel-bg/60 border border-pastel-border">
                  {preventionPlan.trim() ? (
                    <MarkdownRenderer content={preventionPlan} />
                  ) : (
                    <span className="text-xs text-pastel-muted italic">План превентивных мер пока пуст.</span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Evaluation Result Modal */}
      {evaluationResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md overflow-y-auto">
          <div className="bg-white/95 border border-pastel-rose/80 rounded-3xl p-6 max-w-2xl w-full max-h-[90dvh] overflow-y-auto space-y-5 shadow-2xl relative overflow-hidden font-sans my-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Award className="w-6 h-6 text-amber-600" />
                <h2 className="text-lg font-bold text-pastel-text">Результат Триажа Аварии</h2>
              </div>
              <span className={`text-xs font-mono font-bold px-3 py-1 rounded-full border ${
                evaluationResult.verdict === 'RESOLVED'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
                {evaluationResult.verdict} ({evaluationResult.score}/100)
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-amber-50/60 p-3.5 rounded-xl border border-amber-200">
                <span className="font-bold text-amber-800 block mb-1">Разбор гипотезы RCA:</span>
                <p className="text-slate-700 leading-relaxed">{evaluationResult.rcaFeedback}</p>
              </div>

              <div className="bg-emerald-50/60 p-3.5 rounded-xl border border-emerald-200">
                <span className="font-bold text-emerald-800 block mb-1">Разбор превентивных мер:</span>
                <p className="text-slate-700 leading-relaxed">{evaluationResult.remediationFeedback}</p>
              </div>

              {evaluationResult.missingNuances?.length > 0 && (
                <div className="bg-rose-50/60 p-3.5 rounded-xl border border-rose-200">
                  <span className="font-bold text-rose-800 block mb-1.5">Упущенные инженерные нюансы:</span>
                  <ul className="list-disc pl-4 space-y-1 text-slate-700">
                    {evaluationResult.missingNuances.map((m, idx) => <li key={idx}>{m}</li>)}
                  </ul>
                </div>
              )}
            </div>

            <button
              onClick={() => setEvaluationResult(null)}
              className="w-full py-2.5 rounded-xl bg-pastel-card hover:bg-pastel-rose/40 text-pastel-text border border-pastel-border text-xs font-bold transition cursor-pointer"
            >
              Закрыть отчёт
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
