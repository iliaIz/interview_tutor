import React, { useState } from 'react';
import { Award, ChevronDown, ChevronUp, RotateCcw, Check } from 'lucide-react';
import { VoiceEvaluationResult } from '../../types/voice';

export interface VoiceGrandFinaleViewProps {
  totalEvaluated: number;
  totalQuestions: number;
  activeTopic: string;
  avgScore: number;
  passedCount: number;
  questionsBatch?: Array<{ id: string; num: number; question: string }>;
  allResults: Record<string, VoiceEvaluationResult | undefined>;
  handleRetry: () => void;
  onClose: () => void;
}

export const VoiceGrandFinaleView: React.FC<VoiceGrandFinaleViewProps> = ({
  totalEvaluated,
  totalQuestions,
  activeTopic,
  avgScore,
  passedCount,
  questionsBatch,
  allResults,
  handleRetry,
  onClose
}) => {
  const [expandedSummaryIds, setExpandedSummaryIds] = useState<Set<string>>(new Set());

  const toggleSummaryExpand = (qId: string) => {
    setExpandedSummaryIds((prev) => {
      const next = new Set(prev);
      if (next.has(qId)) {
        next.delete(qId);
      } else {
        next.add(qId);
      }
      return next;
    });
  };

  return (
    <div className="my-2 space-y-4 overflow-y-auto max-h-[65vh] pr-1">
      {/* Grand Finale Hero Banner */}
      <div className="p-5 rounded-3xl bg-gradient-to-br from-pastel-accentRose/20 via-white to-pastel-accentViolet/20 border border-pastel-border shadow-md text-center space-y-3">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-pastel-accentRose to-pastel-accentViolet flex items-center justify-center text-white text-3xl shadow-md mx-auto">
          <Award className="w-8 h-8" />
        </div>
        <div>
          <h4 className="font-black text-lg text-pastel-text">
            🎉 Собеседование успешно завершено!
          </h4>
          <p className="text-xs text-pastel-muted mt-0.5">
            Пройдено вопросов: {totalEvaluated} из {totalQuestions} • Тема: {activeTopic}
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
          <div className="p-3 rounded-2xl bg-white/90 border border-pastel-border shadow-2xs">
            <span className="text-[10px] text-pastel-muted font-bold block">Средний балл</span>
            <span className="text-xl font-black text-pastel-accentViolet">{avgScore}%</span>
          </div>
          <div className="p-3 rounded-2xl bg-white/90 border border-pastel-border shadow-2xs">
            <span className="text-[10px] text-pastel-muted font-bold block">Зачтено тем</span>
            <span className="text-xl font-black text-emerald-600">{passedCount}/{totalEvaluated}</span>
          </div>
          <div className="col-span-2 sm:col-span-1 p-3 rounded-2xl bg-white/90 border border-pastel-border shadow-2xs">
            <span className="text-[10px] text-pastel-muted font-bold block">Готовность к офферу</span>
            <span className="text-xl font-black text-pastel-accentRose">
              {avgScore >= 80 ? '🔥 Высокая' : avgScore >= 65 ? '👍 Средняя' : '📖 Требует базы'}
            </span>
          </div>
        </div>
      </div>

      {/* List of Evaluated Questions with Accordions */}
      <div className="space-y-2">
        <h5 className="text-xs font-bold text-pastel-text px-1">Детализация по вопросам темы:</h5>
        {questionsBatch?.map((q, idx) => {
          const res = allResults[q.id];
          const isExpanded = expandedSummaryIds.has(q.id);
          return (
            <div
              key={q.id || idx}
              className="rounded-2xl border border-pastel-border bg-white shadow-2xs overflow-hidden"
            >
              <button
                type="button"
                onClick={() => toggleSummaryExpand(q.id)}
                className="w-full flex items-center justify-between p-3.5 text-left hover:bg-pastel-card/60 transition cursor-pointer"
              >
                <div className="flex items-center gap-2.5 flex-1 pr-2">
                  <div
                    className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${
                      res?.isPassed
                        ? 'bg-emerald-100 text-emerald-800'
                        : res
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {res?.score !== undefined ? `${res.score}%` : `#${q.num}`}
                  </div>
                  <div className="min-w-0">
                    <h6 className="font-bold text-xs text-pastel-text truncate">
                      Вопрос #{q.num}: {q.question}
                    </h6>
                    <p className="text-[10px] text-pastel-muted truncate">
                      {res ? (res.spokenFeedback || res.feedback) : 'Не оценивался'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {res?.isPassed ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Зачтено
                    </span>
                  ) : res ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                      Повторить
                    </span>
                  ) : null}
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-pastel-muted" /> : <ChevronDown className="w-4 h-4 text-pastel-muted" />}
                </div>
              </button>

              {isExpanded && res && (
                <div className="p-3.5 pt-0 border-t border-pastel-border/50 bg-pastel-card/30 space-y-2 text-xs">
                  {res.positivePoints && res.positivePoints.length > 0 && (
                    <div className="text-emerald-900 text-[11px]">
                      <span className="font-bold text-emerald-700 block mb-1">Раскрыто:</span>
                      <ul className="list-disc list-inside space-y-0.5">
                        {res.positivePoints.map((p, i) => (
                          <li key={i}>{p}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {res.missingPoints && res.missingPoints.length > 0 && (
                    <div className="text-rose-900 text-[11px]">
                      <span className="font-bold text-rose-700 block mb-1">Зоны роста:</span>
                      <ul className="list-disc list-inside space-y-0.5">
                        {res.missingPoints.map((p, i) => (
                          <li key={i}>{p}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom Final Actions */}
      <div className="pt-3 border-t border-pastel-border/60 flex items-center gap-3">
        <button
          type="button"
          onClick={handleRetry}
          className="py-3 px-5 rounded-2xl bg-white border border-pastel-border text-pastel-text text-xs font-semibold hover:bg-pastel-card transition flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Пройти заново</span>
        </button>

        <button
          type="button"
          onClick={onClose}
          className="flex-1 py-3 px-6 rounded-2xl bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet text-white text-xs font-bold hover:opacity-95 transition shadow-sm flex items-center justify-center gap-2 cursor-pointer"
        >
          <Check className="w-4 h-4" />
          <span>Завершить и сохранить прогресс</span>
        </button>
      </div>
    </div>
  );
};
