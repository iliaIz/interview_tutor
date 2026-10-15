import React from 'react';
import { EvaluationResult } from '../../types/practice';
import {
  Trophy,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Zap,
  Layers,
  Cpu,
  Sparkles,
  Shield,
  ArrowRight,
  RotateCcw,
  BookOpen
} from 'lucide-react';
import { triggerSuccessConfetti } from '../../utils/confetti';

interface PracticeEvaluationModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: EvaluationResult | null;
  onRetry: () => void;
}

export const PracticeEvaluationModal: React.FC<PracticeEvaluationModalProps> = ({
  isOpen,
  onClose,
  result,
  onRetry
}) => {
  if (!isOpen || !result) return null;

  const score = Math.round(result.scoreBreakdown.overallScore);
  const isPassed = score >= 70 && !result.concurrencyAnalysis.hasCarrierThreadPinning;

  const normalizedFindings = React.useMemo(() => {
    const raw = result.concurrencyAnalysis?.findings;
    if (!Array.isArray(raw)) return [];

    return raw
      .map((f: any) => {
        if (!f) return null;
        if (typeof f === 'string') {
          const text = f.trim();
          if (!text) return null;
          // Filter out positive praises mistakenly stored in findings when no race condition is flagged
          const isPraise = /used correctly|manage thread-safe|thread safe|properly synchronized|корректно|правильно|безопасно|без гонок/i.test(text)
            && !/vulnerability|leak|hazard|race condition|deadlock|pinning|риск|гонк|утечк|ошибк/i.test(text);
          if (isPraise && !result.concurrencyAnalysis.hasRaceConditions && !result.concurrencyAnalysis.hasCarrierThreadPinning && !result.concurrencyAnalysis.hasJmmVisibilityIssues) {
            return null;
          }
          return {
            category: /pinning/i.test(text) ? 'CARRIER_THREAD_PINNING' : /deadlock/i.test(text) ? 'DEADLOCK_RISK' : /visibility|volatile/i.test(text) ? 'JMM_VISIBILITY' : /race/i.test(text) ? 'RACE_CONDITION' : 'NON_ATOMIC_COMPOUND',
            location: 'Shared State / Concurrency Logic',
            description: text,
            remediation: 'Обеспечьте синхронизацию или использование потокобезопасных структур данных.'
          };
        }
        return {
          category: typeof f.category === 'string' && f.category.trim().length > 0 ? f.category.trim() : null,
          location: typeof f.location === 'string' && f.location.trim().length > 0 ? f.location.trim() : null,
          description: typeof f.description === 'string' ? f.description.trim() : (typeof f.finding === 'string' ? f.finding.trim() : ''),
          remediation: typeof f.remediation === 'string' && f.remediation.trim().length > 0 ? f.remediation.trim() : null
        };
      })
      .filter((f): f is { category: string | null; location: string | null; description: string; remediation: string | null } => Boolean(f && f.description));
  }, [result.concurrencyAnalysis]);

  React.useEffect(() => {
    if (isPassed) {
      triggerSuccessConfetti();
    }
  }, [isPassed]);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl border border-pastel-border shadow-2xl max-w-3xl w-full max-h-[90dvh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header Banner */}
        <div className={`p-6 border-b border-pastel-border flex items-center justify-between ${
          isPassed
            ? 'bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-transparent'
            : 'bg-gradient-to-r from-rose-500/15 via-amber-500/10 to-transparent'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-white shadow-md ${
              isPassed
                ? 'bg-gradient-to-tr from-emerald-500 to-teal-600'
                : 'bg-gradient-to-tr from-rose-500 to-amber-500'
            }`}>
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg text-pastel-text">
                  {isPassed ? 'Решение успешно защищено!' : 'Требуются доработки'}
                </h3>
                <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                  isPassed
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    : 'bg-rose-100 text-rose-800 border-rose-300'
                }`}>
                  {score}/100
                </span>
              </div>
              <p className="text-xs text-pastel-muted">
                {isPassed
                  ? 'Код соответствует высоким стандартам архитектуры, чистоты и потокобезопасности.'
                  : 'Обнаружены архитектурные несоответствия или риски блокировки потоков.'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-pastel-muted hover:text-pastel-text hover:bg-pastel-card transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs custom-scrollbar">
          {/* 4 Multi-Dimensional Sub-Scores Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-pastel-bg border border-pastel-border/80 text-center space-y-1">
              <span className="text-[10px] text-pastel-muted font-semibold">Корректность (35%)</span>
              <div className="font-bold text-base text-pastel-text">
                {Math.round(result.scoreBreakdown.correctnessScore)}%
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-pastel-bg border border-pastel-border/80 text-center space-y-1">
              <span className="text-[10px] text-pastel-muted font-semibold">Concurrency & Loom (25%)</span>
              <div className={`font-bold text-base ${
                result.concurrencyAnalysis.hasCarrierThreadPinning ? 'text-rose-600' : 'text-pastel-text'
              }`}>
                {Math.round(result.scoreBreakdown.concurrencyScore)}%
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-pastel-bg border border-pastel-border/80 text-center space-y-1">
              <span className="text-[10px] text-pastel-muted font-semibold">SOLID & Architecture (25%)</span>
              <div className="font-bold text-base text-pastel-text">
                {Math.round(result.scoreBreakdown.architectureScore)}%
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-pastel-bg border border-pastel-border/80 text-center space-y-1">
              <span className="text-[10px] text-pastel-muted font-semibold">Java 21 Idioms (15%)</span>
              <div className="font-bold text-base text-pastel-text">
                {Math.round(result.scoreBreakdown.modernIdiomsScore)}%
              </div>
            </div>
          </div>

          {/* Senior Review Summary */}
          <div className="p-4 rounded-2xl bg-pastel-bg/60 border border-pastel-border/80 space-y-1.5">
            <h4 className="font-bold text-xs text-pastel-text flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-pastel-accentRose" />
              <span>Senior AI Code Review & Заключение:</span>
            </h4>
            <p className="text-xs text-pastel-text leading-relaxed">
              {result.scoreBreakdown.summaryReview}
            </p>
          </div>

          {/* Concurrency & Loom Findings (if any) */}
          {normalizedFindings.length > 0 && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-950 space-y-3">
              <h4 className="font-bold text-xs flex items-center gap-1.5 text-rose-800">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>Замечания по Concurrency & Project Loom:</span>
              </h4>
              <div className="space-y-2">
                {normalizedFindings.map((f, i) => (
                  <div key={i} className="p-3 rounded-xl bg-white border border-rose-200/80 space-y-1 shadow-2xs">
                    {(f.category || f.location) && (
                      <div className="flex items-center justify-between">
                        {f.category && <span className="font-bold text-[11px] text-rose-700">[{f.category}]</span>}
                        {f.location && <span className="text-[10px] text-rose-500 font-mono">{f.location}</span>}
                      </div>
                    )}
                    {f.description && <p className="text-xs text-pastel-text">{f.description}</p>}
                    {f.remediation && (
                      <p className="text-[11px] text-emerald-800 bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                        💡 <strong>Рекомендация:</strong> {f.remediation}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Virtual Execution Test Cases */}
          <div className="space-y-2">
            <h4 className="font-bold text-xs text-pastel-text flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Результаты виртуального тестирования ({result.virtualExecutionResult.passCount} / {result.virtualExecutionResult.testCases.length} пройдено):</span>
            </h4>
            <div className="space-y-1.5">
              {result.virtualExecutionResult.testCases.map((tc, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-xl border flex items-start justify-between gap-3 text-xs ${
                    tc.status === 'PASSED'
                      ? 'bg-emerald-50/50 border-emerald-200 text-emerald-950'
                      : 'bg-rose-50/50 border-rose-200 text-rose-950'
                  }`}
                >
                  <div>
                    <div className="font-bold flex items-center gap-1.5">
                      {tc.status === 'PASSED' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                      )}
                      <span>{tc.testName}</span>
                    </div>
                    <div className="text-[11px] text-pastel-muted mt-1 space-y-0.5">
                      <div>Вход: <code className="bg-white/80 px-1 rounded">{tc.inputData}</code></div>
                      <div>Ожидалось: <code className="bg-white/80 px-1 rounded">{tc.expectedOutput}</code></div>
                      {tc.failureReason && (
                        <div className="text-rose-700 font-semibold mt-1">Причина ошибки: {tc.failureReason}</div>
                      )}
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                    tc.status === 'PASSED'
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : 'bg-rose-100 text-rose-800 border-rose-300'
                  }`}>
                    {tc.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-pastel-border bg-white flex items-center justify-between">
          <button
            onClick={onRetry}
            className="flex items-center gap-1.5 px-4 py-2 rounded-2xl border border-pastel-border text-pastel-text font-bold text-xs hover:bg-pastel-bg transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Исправить решение</span>
          </button>

          <button
            onClick={onClose}
            className="px-5 py-2 bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet text-white rounded-2xl font-bold text-xs hover:opacity-95 transition shadow-2xs cursor-pointer"
          >
            Закрыть отчет
          </button>
        </div>
      </div>
    </div>
  );
};
