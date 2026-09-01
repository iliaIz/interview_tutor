import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { IncidentTriageEvaluation } from '../../types/nextgen';
import { 
  ArrowLeft, Terminal, AlertTriangle, CheckCircle2, Award,
  Send, Sparkles, Flame, Copy, Check, FileCode, Activity, Loader2,
  Search, X, Eye, Edit3, ShieldAlert
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
  
  // Log Search and Quick Filter State
  const [logSearchQuery, setLogSearchQuery] = useState('');
  
  // RCA Edit / Preview Modes
  const [rcaHypothesis, setRcaHypothesis] = useState('');
  const [rcaMode, setRcaMode] = useState<'edit' | 'preview'>('edit');

  const [preventionPlan, setPreventionPlan] = useState('');
  const [preventionMode, setPreventionMode] = useState<'edit' | 'preview'>('edit');
  
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState<IncidentTriageEvaluation | null>(null);

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
          <div className="max-w-5xl mx-auto space-y-3">
            {/* SRE Observability Toolbar: Search & Fast Filter Chips */}
            <div className="bg-white/95 border border-pastel-border/80 rounded-2xl p-3 shadow-2xs flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 flex-1 min-w-[240px]">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-pastel-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={logSearchQuery}
                    onChange={(e) => setLogSearchQuery(e.target.value)}
                    placeholder="Поиск по стектрейсу (Deadlock, thread, pool, exception)..."
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

              {/* Fast Focus Chips */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={() => setLogSearchQuery('deadlock')}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition cursor-pointer"
                >
                  🔴 Deadlock
                </button>
                <button
                  onClick={() => setLogSearchQuery('BLOCKED')}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200 transition cursor-pointer"
                >
                  ⚠️ Blocked
                </button>
                <button
                  onClick={() => setLogSearchQuery('OutOfMemoryError')}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 transition cursor-pointer"
                >
                  💥 OOM / GC
                </button>
                <button
                  onClick={() => setLogSearchQuery('HikariPool')}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition cursor-pointer"
                >
                  ⚡ HikariCP
                </button>
              </div>
            </div>

            {/* SRE Observability Terminal (CodeViewer with JVM Log Tokenization) */}
            <CodeViewer
              code={activeTriageIncident.rawArtifactText}
              language="log"
              title="Observability SRE Terminal (Thread Dump & Diagnostics)"
              searchQuery={logSearchQuery}
              showLineNumbers={true}
              maxHeight="max-h-[600px]"
            />
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
                  onChange={(e) => setRcaHypothesis(e.target.value)}
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
                  onChange={(e) => setPreventionPlan(e.target.value)}
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
