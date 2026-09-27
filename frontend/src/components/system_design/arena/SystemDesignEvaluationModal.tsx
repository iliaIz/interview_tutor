import React from 'react';
import { Award } from 'lucide-react';
import { SystemDesignEvaluation } from '../../../types/nextgen';

interface SystemDesignEvaluationModalProps {
  evaluationResult: SystemDesignEvaluation;
  onClose: () => void;
}

export const SystemDesignEvaluationModal: React.FC<SystemDesignEvaluationModalProps> = ({
  evaluationResult,
  onClose
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md overflow-y-auto">
      <div className="bg-white/95 border border-pastel-rose/80 rounded-3xl p-6 max-w-2xl w-full max-h-[90dvh] overflow-y-auto space-y-5 shadow-2xl relative overflow-hidden font-sans my-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-500 to-pastel-accentViolet text-white flex items-center justify-center shadow-sm">
              <Award className="w-5 h-5" />
            </div>
            <h2 className="text-base font-bold text-pastel-text">Вердикт Комитета по System Design</h2>
          </div>
          <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-purple-50 text-pastel-accentViolet border border-purple-200">
            {evaluationResult.verdict} ({evaluationResult.totalScore}/100)
          </span>
        </div>

        {/* Radar Metrics */}
        {evaluationResult.radarMetrics && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs font-mono">
            {Object.entries(evaluationResult.radarMetrics).map(([key, val]) => (
              <div key={key} className="bg-pastel-bg p-2.5 rounded-xl border border-pastel-border">
                <span className="text-pastel-muted block text-[10px] uppercase">{key}</span>
                <span className="font-bold text-pastel-text">{val}%</span>
              </div>
            ))}
          </div>
        )}

        {/* Strengths & Vulnerabilities */}
        <div className="space-y-3 text-xs">
          <div className="bg-emerald-50/60 p-3.5 rounded-xl border border-emerald-200">
            <span className="font-bold text-emerald-800 block mb-1.5">Сильные стороны решения:</span>
            <ul className="list-disc pl-4 space-y-1 text-slate-700">
              {evaluationResult.strengths?.map((s, idx) => (
                <li key={idx}>{s}</li>
              ))}
            </ul>
          </div>

          <div className="bg-amber-50/60 p-3.5 rounded-xl border border-amber-200">
            <span className="font-bold text-amber-800 block mb-1.5">Узкие места и риски:</span>
            <ul className="list-disc pl-4 space-y-1 text-slate-700">
              {evaluationResult.vulnerabilities?.map((v, idx) => (
                <li key={idx}>{v}</li>
              ))}
            </ul>
          </div>

          <div className="bg-pastel-bg p-3.5 rounded-xl border border-pastel-border">
            <span className="font-bold text-pastel-text block mb-1">Финальный фидбек Bar-Raiser:</span>
            <p className="text-pastel-muted leading-relaxed">{evaluationResult.barRaiserFeedback}</p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-pastel-card hover:bg-pastel-rose/40 text-pastel-text border border-pastel-border text-xs font-bold transition cursor-pointer"
        >
          Закрыть отчёт
        </button>
      </div>
    </div>
  );
};
