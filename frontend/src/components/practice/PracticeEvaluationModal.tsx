import React from 'react';
import { EvaluationResult } from '../../types/practice';
import {
  Trophy,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Sparkles,
  RotateCcw,
  Mic,
  X
} from 'lucide-react';
import { triggerSuccessConfetti } from '../../utils/confetti';
import { NativeModalDialog } from '../shared/NativeModalDialog';
import {
  resolveEvaluationPassStatus,
  formatEvaluationTestRatio
} from './evaluationReportBuilder';

interface PracticeEvaluationModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: EvaluationResult | null;
  onRetry: () => void;
  onStartVoiceDiscussion?: (finding?: any) => void;
}

export const PracticeEvaluationModal: React.FC<PracticeEvaluationModalProps> = ({
  isOpen,
  onClose,
  result,
  onRetry,
  onStartVoiceDiscussion
}) => {
  const isPassed = React.useMemo(() => resolveEvaluationPassStatus(result), [result]);
  const testRatio = React.useMemo(() => formatEvaluationTestRatio(result), [result]);

  const normalizedFindings = React.useMemo(() => {
    const raw = result?.concurrencyAnalysis?.findings;
    if (!Array.isArray(raw) || !result) return [];

    return raw
      .map((f: any) => {
        if (!f) return null;
        if (typeof f === 'string') {
          const text = f.trim();
          if (!text) return null;
          const isPraise =
            /used correctly|manage thread-safe|thread safe|properly synchronized|корректно|правильно|безопасно|без гонок/i.test(text) &&
            !/vulnerability|leak|hazard|race condition|deadlock|pinning|риск|гонк|утечк|ошибк/i.test(text);
          if (
            isPraise &&
            !result.concurrencyAnalysis.hasRaceConditions &&
            !result.concurrencyAnalysis.hasCarrierThreadPinning &&
            !result.concurrencyAnalysis.hasJmmVisibilityIssues
          ) {
            return null;
          }
          return {
            category: /pinning/i.test(text)
              ? 'CARRIER_THREAD_PINNING'
              : /deadlock/i.test(text)
              ? 'DEADLOCK_RISK'
              : /visibility|volatile/i.test(text)
              ? 'JMM_VISIBILITY'
              : /race/i.test(text)
              ? 'RACE_CONDITION'
              : 'NON_ATOMIC_COMPOUND',
            location: 'Shared State / Concurrency Logic',
            description: text,
            remediation: 'Обеспечьте синхронизацию или использование потокобезопасных структур данных.'
          };
        }
        return {
          category: typeof f.category === 'string' && f.category.trim().length > 0 ? f.category.trim() : null,
          location: typeof f.location === 'string' && f.location.trim().length > 0 ? f.location.trim() : null,
          description: typeof f.description === 'string' ? f.description.trim() : typeof f.finding === 'string' ? f.finding.trim() : '',
          remediation: typeof f.remediation === 'string' && f.remediation.trim().length > 0 ? f.remediation.trim() : null
        };
      })
      .filter(
        (f): f is { category: string | null; location: string | null; description: string; remediation: string | null } =>
          Boolean(f && f.description)
      );
  }, [result]);

  React.useEffect(() => {
    if (isOpen && result && isPassed) {
      triggerSuccessConfetti();
    }
  }, [isOpen, result, isPassed]);

  if (!isOpen || !result) return null;

  const score = Math.round(result.scoreBreakdown.overallScore);

  return (
    <NativeModalDialog
      isOpen={isOpen}
      onClose={onClose}
      ariaLabelledBy="practice-eval-modal-title"
      panelClassName="bg-white rounded-3xl border border-pastel-border shadow-2xl max-w-3xl w-full max-h-[90dvh] flex flex-col overflow-hidden"
    >
      {/* Header Banner */}
      <div
        className={`p-5 sm:p-6 border-b border-pastel-border flex items-center justify-between gap-3 ${
          isPassed ? 'bg-emerald-50/70' : 'bg-rose-50/70'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-white shadow-sm shrink-0 ${
              isPassed ? 'bg-emerald-700' : 'bg-[#B5433E]'
            }`}
          >
            <Trophy className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 id="practice-eval-modal-title" className="font-bold text-base sm:text-lg text-pastel-text">
                {isPassed ? 'Решение успешно защищено!' : 'Требуются доработки'}
              </h2>
              <span
                className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                  isPassed
                    ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                    : 'bg-rose-100 text-rose-900 border-rose-300'
                }`}
              >
                {score}/100
              </span>
            </div>
            <p className="text-xs text-pastel-muted mt-0.5">
              {isPassed
                ? 'Код соответствует стандартам архитектуры, чистоты и потокобезопасности.'
                : 'Обнаружены ошибки тестов, сборки или архитектурные несоответствия.'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть отчет оценки"
          className="touch-target-44 p-2 rounded-xl text-pastel-muted hover:text-pastel-text hover:bg-white transition cursor-pointer shrink-0 flex items-center justify-center"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content Body */}
      <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 text-xs custom-scrollbar">
        {/* 4 Multi-Dimensional Sub-Scores Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-2xl bg-pastel-bg border border-pastel-border/80 text-center space-y-1">
            <span className="text-[10px] text-pastel-muted font-semibold">Корректность (35%)</span>
            <div className="font-bold text-base text-pastel-text">
              {Math.round(result.scoreBreakdown.correctnessScore)}%
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-pastel-bg border border-pastel-border/80 text-center space-y-1">
            <span className="text-[10px] text-pastel-muted font-semibold">Concurrency &amp; Loom (25%)</span>
            <div
              className={`font-bold text-base ${
                result.concurrencyAnalysis.hasCarrierThreadPinning ? 'text-rose-700' : 'text-pastel-text'
              }`}
            >
              {Math.round(result.scoreBreakdown.concurrencyScore)}%
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-pastel-bg border border-pastel-border/80 text-center space-y-1">
            <span className="text-[10px] text-pastel-muted font-semibold">SOLID &amp; Architecture (25%)</span>
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
          <h3 className="font-bold text-xs text-pastel-text flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-pastel-accentRoseText" />
            <span>Senior AI Code Review &amp; Заключение:</span>
          </h3>
          <p className="text-xs text-pastel-text leading-relaxed">{result.scoreBreakdown.summaryReview}</p>
        </div>

        {/* Concurrency & Loom Findings */}
        {normalizedFindings.length > 0 && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-950 space-y-3">
            <h3 className="font-bold text-xs flex items-center gap-1.5 text-rose-900">
              <AlertTriangle className="w-4 h-4 text-rose-700" />
              <span>Замечания по Concurrency &amp; Project Loom:</span>
            </h3>
            <div className="space-y-2">
              {normalizedFindings.map((f, i) => (
                <div key={i} className="p-3 rounded-xl bg-white border border-rose-200/80 space-y-1 shadow-2xs">
                  {(f.category || f.location) && (
                    <div className="flex items-center justify-between gap-2">
                      {f.category && <span className="font-bold text-[11px] text-rose-800">[{f.category}]</span>}
                      {f.location && <span className="text-[10px] text-rose-700 font-mono">{f.location}</span>}
                    </div>
                  )}
                  {f.description && <p className="text-xs text-pastel-text">{f.description}</p>}
                  {f.remediation && (
                    <p className="text-[11px] text-emerald-900 bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                      <strong>Рекомендация:</strong> {f.remediation}
                    </p>
                  )}
                  {onStartVoiceDiscussion && (
                    <div className="pt-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() => onStartVoiceDiscussion(f)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-pastel-rose hover:bg-[#B5433E] text-pastel-accentRoseText hover:text-white border border-pastel-accentRose/30 font-semibold text-[11px] transition cursor-pointer"
                      >
                        <Mic className="w-3 h-3" />
                        <span>Разобрать замечание голосом</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Virtual Execution Test Cases */}
        <div className="space-y-2">
          <h3 className="font-bold text-xs text-pastel-text flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
            <span>
              Результаты тестирования ({testRatio.passed} / {testRatio.total} пройдено):
            </span>
          </h3>
          {result.virtualExecutionResult.testCases.length > 0 && (
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
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-rose-700 shrink-0" />
                      )}
                      <span>{tc.testName}</span>
                    </div>
                    <div className="text-[11px] text-pastel-muted mt-1 space-y-0.5">
                      <div>
                        Вход: <code className="bg-white/80 px-1 rounded">{tc.inputData}</code>
                      </div>
                      <div>
                        Ожидалось: <code className="bg-white/80 px-1 rounded">{tc.expectedOutput}</code>
                      </div>
                      {tc.failureReason && (
                        <div className="text-rose-800 font-semibold mt-1">Причина ошибки: {tc.failureReason}</div>
                      )}
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                      tc.status === 'PASSED'
                        ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                        : 'bg-rose-100 text-rose-900 border-rose-300'
                    }`}
                  >
                    {tc.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-pastel-border bg-white flex items-center justify-between gap-2 flex-wrap">
        <button
          type="button"
          onClick={onRetry}
          className="touch-target-44 flex items-center gap-1.5 px-4 py-2 rounded-2xl border border-pastel-border text-pastel-text font-bold text-xs hover:bg-pastel-bg transition cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Исправить решение</span>
        </button>

        <div className="flex items-center gap-2">
          {onStartVoiceDiscussion && (
            <button
              type="button"
              onClick={() => onStartVoiceDiscussion(null)}
              className="touch-target-44 flex items-center gap-1.5 px-4 py-2 bg-[#B5433E] hover:bg-[#9B3B36] text-white rounded-2xl font-bold text-xs transition shadow-2xs cursor-pointer"
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Обсудить отчет голосом</span>
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="touch-target-44 px-4 py-2 bg-pastel-bg hover:bg-pastel-border/60 text-pastel-text rounded-2xl font-bold text-xs transition border border-pastel-border cursor-pointer"
          >
            К коду (свернуть)
          </button>
        </div>
      </div>
    </NativeModalDialog>
  );
};
