import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { IncidentTriageEvaluation } from '../../types/nextgen';
import { 
  ArrowLeft, Terminal, AlertTriangle, CheckCircle2, Award,
  Send, Sparkles, Flame, Copy, Check, FileCode, Activity
} from 'lucide-react';

export const IncidentTriageStudio: React.FC = () => {
  const { activeTriageIncident, closeTriageIncident, showToast } = useAppStore();
  const [activeTab, setActiveTab] = useState<'symptoms' | 'artifact' | 'rca'>('artifact');
  
  const [rcaHypothesis, setRcaHypothesis] = useState('');
  const [preventionPlan, setPreventionPlan] = useState('');
  
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState<IncidentTriageEvaluation | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  if (!activeTriageIncident) return null;

  const handleCopyArtifact = () => {
    navigator.clipboard.writeText(activeTriageIncident.rawArtifactText);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

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

  return (
    <div className="flex flex-col h-[calc(100dvh-4rem)] overflow-hidden bg-slate-950 text-slate-100 relative font-sans">
      {/* Top Bar */}
      <div className="h-12 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md px-3 sm:px-4 flex items-center justify-between shrink-0 z-10 shadow-sm gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={closeTriageIncident}
            className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-slate-200 px-2 py-1.5 rounded-xl hover:bg-slate-800 transition cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Каталог аварий</span>
          </button>

          <div className="h-4 w-px bg-slate-800 shrink-0" />

          <span className="font-bold text-xs text-slate-200 truncate max-w-[140px] sm:max-w-md">
            {activeTriageIncident.title}
          </span>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-slate-950 p-0.5 rounded-xl border border-slate-800 shrink-0">
          <button
            onClick={() => setActiveTab('symptoms')}
            className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'symptoms' ? 'bg-slate-800 text-amber-400 shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Симптомы</span>
          </button>

          <button
            onClick={() => setActiveTab('artifact')}
            className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'artifact' ? 'bg-slate-800 text-amber-400 shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Дамп / Лог</span>
          </button>

          <button
            onClick={() => setActiveTab('rca')}
            className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'rca' ? 'bg-slate-800 text-amber-400 shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Гипотеза RCA</span>
          </button>
        </div>

        {/* Action Button */}
        <button
          onClick={handleEvaluate}
          disabled={isEvaluating}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white transition shadow-sm cursor-pointer disabled:opacity-50 shrink-0"
        >
          <Award className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{isEvaluating ? 'Оценка...' : 'Сдать RCA'}</span>
        </button>
      </div>

      {/* Main Content Body */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        {activeTab === 'symptoms' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-slate-800 text-amber-400 border border-slate-700">
                  {activeTriageIncident.category}
                </span>
                <span className="text-xs font-mono font-bold text-rose-400 flex items-center gap-1">
                  <Flame className="w-4 h-4" />
                  <span>{activeTriageIncident.severity}</span>
                </span>
              </div>

              <h2 className="text-lg font-bold text-slate-100">{activeTriageIncident.title}</h2>
              
              <div className="pt-2 border-t border-slate-800">
                <span className="text-xs font-bold text-slate-400 block mb-1">Симптомы сбоя и системное поведение:</span>
                <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
                  {activeTriageIncident.symptomsMarkdown}
                </p>
              </div>

              <div className="mt-4 p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-400 flex items-center gap-2">
                <Activity className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Триггер алерта: {activeTriageIncident.keyMetricTrigger}</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'artifact' && (
          <div className="max-w-5xl mx-auto space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-slate-400 flex items-center gap-1.5">
                <Terminal className="w-4 h-4 text-amber-400" />
                <span>Сырой диагностический артефакт (Thread Dump / GC Log / Trace):</span>
              </span>

              <button
                onClick={handleCopyArtifact}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-mono border border-slate-800 transition cursor-pointer"
              >
                {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{isCopied ? 'Скопировано' : 'Копировать дамп'}</span>
              </button>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 overflow-x-auto">
              <pre className="text-xs font-mono text-amber-300/90 whitespace-pre-wrap leading-relaxed">
                {activeTriageIncident.rawArtifactText}
              </pre>
            </div>
          </div>
        )}

        {activeTab === 'rca' && (
          <div className="max-w-4xl mx-auto space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">
                  1. Гипотеза корневой причины (Root Cause Analysis):
                </label>
                <textarea
                  value={rcaHypothesis}
                  onChange={(e) => setRcaHypothesis(e.target.value)}
                  placeholder="Опишите, что именно вызвало сбой на уровне JVM, блокировок, потоков или СУБД..."
                  className="w-full h-36 bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">
                  2. Архитектурный план превентивных мер (Remediation Plan):
                </label>
                <textarea
                  value={preventionPlan}
                  onChange={(e) => setPreventionPlan(e.target.value)}
                  placeholder="Опишите, как перепроектировать код или конфигурацию (ReentrantLock, таймауты, индексы, ScopedValue), чтобы исключить рецидив..."
                  className="w-full h-36 bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 resize-none"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Evaluation Result Modal */}
      {evaluationResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Award className="w-6 h-6 text-amber-400" />
                <h2 className="text-lg font-bold text-slate-100">Результат Триажа Аварии</h2>
              </div>
              <span className={`text-xs font-mono font-bold px-3 py-1 rounded-full border ${
                evaluationResult.verdict === 'RESOLVED'
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
              }`}>
                {evaluationResult.verdict} ({evaluationResult.score}/100)
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                <span className="font-bold text-amber-400 block mb-1">Разбор гипотезы RCA:</span>
                <p className="text-slate-300 leading-relaxed">{evaluationResult.rcaFeedback}</p>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                <span className="font-bold text-emerald-400 block mb-1">Разбор превентивных мер:</span>
                <p className="text-slate-300 leading-relaxed">{evaluationResult.remediationFeedback}</p>
              </div>

              {evaluationResult.missingNuances?.length > 0 && (
                <div className="bg-slate-950 p-3.5 rounded-xl border border-rose-500/20">
                  <span className="font-bold text-rose-400 block mb-1.5">Упущенные инженерные нюансы:</span>
                  <ul className="list-disc pl-4 space-y-1 text-slate-300">
                    {evaluationResult.missingNuances.map((m, idx) => <li key={idx}>{m}</li>)}
                  </ul>
                </div>
              )}
            </div>

            <button
              onClick={() => setEvaluationResult(null)}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition cursor-pointer"
            >
              Закрыть отчёт
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
