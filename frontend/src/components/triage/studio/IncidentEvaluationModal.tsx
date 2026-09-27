import React from 'react';
import { Award, CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { IncidentTriageEvaluation } from '../../../types/nextgen';
import { useBodyScrollLock } from '../../../hooks/useBodyScrollLock';

interface IncidentEvaluationModalProps {
  evaluationResult: IncidentTriageEvaluation | null;
  onClose: () => void;
}

export const IncidentEvaluationModal: React.FC<IncidentEvaluationModalProps> = ({
  evaluationResult,
  onClose
}) => {
  useBodyScrollLock(Boolean(evaluationResult));

  if (!evaluationResult) return null;

  const isResolved = evaluationResult.verdict === 'RESOLVED';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md overflow-y-auto">
      <div className="bg-white/95 border border-pastel-rose/80 rounded-3xl p-6 max-w-2xl w-full max-h-[90dvh] overflow-y-auto space-y-5 shadow-2xl relative font-sans my-auto animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="w-6 h-6 text-amber-600" />
            <h2 className="text-lg font-bold text-pastel-text">Результат Триажа Аварии</h2>
          </div>
          <span
            className={`text-xs font-mono font-bold px-3 py-1 rounded-full border ${
              isResolved
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}
          >
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

          {evaluationResult.missingNuances && evaluationResult.missingNuances.length > 0 && (
            <div className="bg-rose-50/60 p-3.5 rounded-xl border border-rose-200">
              <span className="font-bold text-rose-800 block mb-1.5">Упущенные инженерные нюансы:</span>
              <ul className="list-disc pl-4 space-y-1 text-slate-700">
                {evaluationResult.missingNuances.map((m, idx) => (
                  <li key={idx}>{m}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-pastel-card hover:bg-pastel-rose/40 text-pastel-text border border-pastel-border text-xs font-bold transition cursor-pointer active:scale-98"
        >
          Закрыть отчёт
        </button>
      </div>
    </div>
  );
};
