import React from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  ArrowDownRight,
  RefreshCw,
  Layers
} from 'lucide-react';
import { VoiceEvaluationResult } from '../../types/voice';

interface RubricScorecardProps {
  evaluation: VoiceEvaluationResult;
}

export const RubricScorecard: React.FC<RubricScorecardProps> = ({ evaluation }) => {
  // Extract criteriaBreakdown, deductions, and upgradeSnippet
  const criteria = evaluation.criteriaBreakdown || evaluation.speechCoaching?.criteriaBreakdown || [];
  const deductions = evaluation.deductions || evaluation.speechCoaching?.deductions || [];
  const upgradeSnippet = evaluation.upgradeSnippet || evaluation.speechCoaching?.upgradeSnippet;

  const totalDeductions = deductions.reduce((acc, d) => acc + (d.penalty || 0), 0);
  const score = evaluation.score ?? 70;
  const missingPoints = evaluation.missingPoints || [];

  return (
    <div className="space-y-3 text-left">
      {/* 1. Criteria Ledger (Ведомость критериев темы) */}
      {criteria.length > 0 && (
        <div className="p-4 rounded-2xl bg-white/90 border border-pastel-border/80 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-xl bg-pastel-lavender/60 flex items-center justify-center text-pastel-accentViolet">
                <Layers className="w-3.5 h-3.5" />
              </div>
              <div>
                <h4 className="font-bold text-xs text-pastel-text">
                  Ведомость критериев ответа (Fixed Rubric)
                </h4>
                <p className="text-[10px] text-pastel-muted">
                  Бюджет темы: 100 баллов • Оценка по ключевым смысловым якорям
                </p>
              </div>
            </div>
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-pastel-card border border-pastel-border text-pastel-text">
              {score}/100 б.
            </span>
          </div>

          <div className="space-y-2.5 pt-1">
            {criteria.map((c, i) => {
              const pct = Math.min(100, Math.max(0, Math.round((c.earnedPoints / c.maxPoints) * 100)));
              const isFull = c.earnedPoints >= c.maxPoints;
              const isZero = c.earnedPoints === 0;

              return (
                <div
                  key={c.id || i}
                  className="p-2.5 rounded-xl bg-slate-50/60 border border-slate-200/50 space-y-1.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 font-bold text-slate-800">
                      {isFull ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      ) : isZero ? (
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                      ) : (
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      )}
                      <span>{c.title}</span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {c.probeAssisted && (
                        <span
                          className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-100/90 text-emerald-800 border border-emerald-200 flex items-center gap-1"
                          title="Баллы добраны благодаря ответу на наводящий вопрос интервьюера"
                        >
                          <RefreshCw className="w-2.5 h-2.5" />
                          <span>Добрано на уточнении</span>
                        </span>
                      )}
                      <span
                        className={`text-[10px] font-black px-2 py-0.5 rounded-lg border ${
                          isFull
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : isZero
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-amber-50 text-amber-800 border-amber-200'
                        }`}
                      >
                        {c.earnedPoints} / {c.maxPoints} б.
                      </span>
                    </div>
                  </div>

                  {/* Micro Progress Bar */}
                  <div className="w-full bg-slate-200/70 h-1.5 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${pct}%` }}
                      className={`h-full rounded-full transition-all duration-500 ${
                        isFull
                          ? 'bg-emerald-500'
                          : isZero
                          ? 'bg-rose-400'
                          : 'bg-amber-500'
                      }`}
                    />
                  </div>

                  {/* Evidence or Gap */}
                  {c.gap && (
                    <p className="text-[11px] text-rose-700/90 leading-tight flex items-start gap-1 pt-0.5">
                      <span className="font-semibold shrink-0">Дельта:</span>
                      <span>{c.gap}</span>
                    </p>
                  )}
                  {isFull && c.evidence && (
                    <p className="text-[10px] text-emerald-800/80 leading-tight">
                      ✓ {c.evidence}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. Deductions Card (Аудит списания штрафных баллов) */}
      {(deductions.length > 0 || (score < 100 && missingPoints.length > 0)) && (
        <div className="p-3.5 rounded-2xl bg-gradient-to-br from-rose-50/70 via-rose-50/40 to-amber-50/40 border border-rose-200/80 text-xs shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-rose-800 flex items-center gap-1.5">
              <ArrowDownRight className="w-4 h-4 text-rose-600" />
              <span>
                За что снижен балл {totalDeductions > 0 ? `(-${totalDeductions} б.)` : `(-${100 - score} б.)`}:
              </span>
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/80 border border-rose-200 text-rose-700">
              Штрафной аудит
            </span>
          </div>

          <ul className="space-y-1.5 text-rose-950">
            {deductions.length > 0
              ? deductions.map((d, i) => (
                  <li key={i} className="flex items-start gap-1.5 leading-relaxed bg-white/60 p-2 rounded-xl border border-rose-100">
                    <span className="font-black text-rose-700 shrink-0 text-[11px] bg-rose-100/90 px-1.5 py-0.5 rounded">
                      -{d.penalty} б.
                    </span>
                    <div>
                      <span className="font-bold text-slate-800">{d.criteria}: </span>
                      <span className="text-slate-700">{d.reason}</span>
                    </div>
                  </li>
                ))
              : missingPoints.map((pt, i) => (
                  <li key={i} className="flex items-start gap-1.5 leading-relaxed bg-white/60 p-2 rounded-xl border border-rose-100">
                    <span className="font-black text-rose-700 shrink-0 text-[11px] bg-rose-100/90 px-1.5 py-0.5 rounded">
                      Зона роста
                    </span>
                    <span className="text-slate-700">{pt}</span>
                  </li>
                ))}
          </ul>
        </div>
      )}

      {/* 3. Staff-level Upgrade Advice (Формула идеального ответа на 100 баллов) */}
      {upgradeSnippet && (
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-pastel-lavender/50 via-white to-pastel-rose/30 border border-pastel-accentViolet/30 text-xs shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-bold text-pastel-accentViolet flex items-center gap-1.5 text-[11px]">
              <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
              <span>Формула ответа на 100 баллов (Staff Level):</span>
            </span>
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-pastel-accentViolet/10 text-pastel-accentViolet">
              Golden Snippet
            </span>
          </div>
          <p className="text-[11px] text-pastel-text italic bg-white/80 p-2.5 rounded-xl border border-pastel-border/50 leading-relaxed">
            «{upgradeSnippet}»
          </p>
        </div>
      )}
    </div>
  );
};
