import React from 'react';
import {
  Activity,
  GraduationCap,
  CheckCircle2,
  AlertCircle,
  RotateCcw
} from 'lucide-react';
import { VoiceEvaluationResult } from '../../types/voice';
import { InterviewConfig } from '../../types/interviewConfig';
import { HiringCommitteeCard } from '../HiringCommitteeCard';
import { MarkdownRenderer } from '../MarkdownRenderer';
import { AcousticTelemetryService } from '../../services/AcousticTelemetryService';
import { RubricScorecard } from './RubricScorecard';

export interface VoiceVerdictViewProps {
  evaluation: VoiceEvaluationResult;
  interviewConfig: InterviewConfig;
  retryCurrentQuestionCleanly: () => void;
  onClose: () => void;
  onNextQuestion?: () => void;
  nextQuestionIndex?: number;
  totalQuestions?: number;
  onFinishBatch?: () => void;
}

export const VoiceVerdictView: React.FC<VoiceVerdictViewProps> = ({
  evaluation,
  interviewConfig,
  retryCurrentQuestionCleanly,
  onClose,
  onNextQuestion,
  nextQuestionIndex,
  totalQuestions,
  onFinishBatch
}) => {
  return (
    <div className="my-2 space-y-4 overflow-y-auto max-h-[65vh] pr-1">
      <div
        className={`p-4 rounded-2xl border flex items-center justify-between ${
          evaluation.isPassed
            ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
            : 'bg-rose-50/80 border-rose-200 text-rose-900'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-black text-lg ${
              evaluation.isPassed ? 'bg-emerald-500' : 'bg-rose-500'
            }`}
          >
            {evaluation.score ?? 70}%
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-sm">
                {evaluation.isPassed ? '🎉 Собеседование успешно пройдено!' : 'Требуется дополнительное повторение'}
              </h4>
              {(evaluation.score ?? 70) < 100 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 border border-rose-300 text-rose-700 shadow-2xs">
                  -{100 - (evaluation.score ?? 70)} б.
                </span>
              )}
            </div>
            <p className="text-xs opacity-80">
              Стратегия: {interviewConfig.strategy === 'socratic_tutoring' ? 'Сократический менторинг' : 'Адаптивное зондирование'}
            </p>
          </div>
        </div>
      </div>

      {/* FAANG Hiring Committee Packet */}
      {evaluation.faangScorecard && (
        <HiringCommitteeCard
          scorecard={evaluation.faangScorecard}
          personaId={interviewConfig.persona || 'mentor'}
        />
      )}

      {/* Vocal Coaching & Acoustic Profile */}
      {evaluation.audioMetrics && (() => {
        const humanProfile = AcousticTelemetryService.getHumanizedProfile(
          evaluation.audioMetrics,
          evaluation.clarityMetrics
        );
        return (
          <div className="p-4 rounded-3xl bg-gradient-to-br from-pastel-rose/40 via-white to-pastel-lavender/40 border border-pastel-border/80 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-2xl bg-gradient-to-tr from-pastel-accentRose to-pastel-accentViolet flex items-center justify-center text-white shadow-2xs">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-pastel-text">Голосовой коучинг и манера речи</h4>
                  <p className="text-[10px] text-pastel-muted">Анализ интонаций, темпа, чистоты и структуры ответа</p>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-white/90 border border-pastel-border text-pastel-accentViolet shadow-2xs">
                ✨ AI Voice Studio
              </span>
            </div>

            {evaluation.audioMetrics.energyVector30 && evaluation.audioMetrics.energyVector30.length > 0 && (
              <div className="p-2.5 bg-white/85 rounded-2xl border border-pastel-border/60 flex items-end justify-between h-11 gap-1 shadow-2xs">
                {evaluation.audioMetrics.energyVector30.map((val, idx) => (
                  <div
                    key={idx}
                    style={{ height: `${Math.max(12, val * 100)}%` }}
                    className={`w-full rounded-full transition-all duration-300 ${
                      val > 0.65
                        ? 'bg-gradient-to-t from-pastel-accentRose to-pink-400'
                        : val > 0.35
                        ? 'bg-gradient-to-t from-pastel-accentViolet to-indigo-300'
                        : 'bg-pastel-border/80'
                    }`}
                    title={`Энергия голоса: ${(val * 100).toFixed(0)}%`}
                  />
                ))}
              </div>
            )}

            <div className={`grid grid-cols-1 sm:grid-cols-2 ${humanProfile.clarity ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-2 text-left`}>
              {/* Volume Card */}
              <div className="p-3 bg-white/90 rounded-2xl border border-pastel-border/60 flex flex-col justify-between shadow-2xs">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs">{humanProfile.volume.iconEmoji}</span>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${humanProfile.volume.badgeStyle}`}>
                      {humanProfile.volume.badge}
                    </span>
                  </div>
                  <span className="font-bold text-xs text-pastel-text block">{humanProfile.volume.title}</span>
                  <p className="text-[10px] text-pastel-muted leading-tight mt-0.5">{humanProfile.volume.description}</p>
                </div>
                <span className="text-[9px] font-medium text-pastel-sub/70 mt-2 block border-t border-pastel-border/30 pt-1">
                  Уровень: {humanProfile.volume.techValue}
                </span>
              </div>

              {/* Pace Card */}
              <div className="p-3 bg-white/90 rounded-2xl border border-pastel-border/60 flex flex-col justify-between shadow-2xs">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs">{humanProfile.pace.iconEmoji}</span>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${humanProfile.pace.badgeStyle}`}>
                      {humanProfile.pace.badge}
                    </span>
                  </div>
                  <span className="font-bold text-xs text-pastel-text block">{humanProfile.pace.title}</span>
                  <p className="text-[10px] text-pastel-muted leading-tight mt-0.5">{humanProfile.pace.description}</p>
                </div>
                <span className="text-[9px] font-medium text-pastel-sub/70 mt-2 block border-t border-pastel-border/30 pt-1">
                  Скорость: {humanProfile.pace.techValue}
                </span>
              </div>

              {/* Structure Card */}
              <div className="p-3 bg-white/90 rounded-2xl border border-pastel-border/60 flex flex-col justify-between shadow-2xs">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs">{humanProfile.structure.iconEmoji}</span>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${humanProfile.structure.badgeStyle}`}>
                      {humanProfile.structure.badge}
                    </span>
                  </div>
                  <span className="font-bold text-xs text-pastel-text block">{humanProfile.structure.title}</span>
                  <p className="text-[10px] text-pastel-muted leading-tight mt-0.5">{humanProfile.structure.description}</p>
                </div>
                <span className="text-[9px] font-medium text-pastel-sub/70 mt-2 block border-t border-pastel-border/30 pt-1">
                  Паузы: {humanProfile.structure.techValue}
                </span>
              </div>

              {/* Clarity & Filler Words Card */}
              {humanProfile.clarity && (
                <div className="p-3 bg-white/90 rounded-2xl border border-pastel-border/60 flex flex-col justify-between shadow-2xs">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs">{humanProfile.clarity.iconEmoji}</span>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${humanProfile.clarity.badgeStyle}`}>
                        {humanProfile.clarity.badge}
                      </span>
                    </div>
                    <span className="font-bold text-xs text-pastel-text block">{humanProfile.clarity.title}</span>
                    <p className="text-[10px] text-pastel-muted leading-tight mt-0.5">{humanProfile.clarity.description}</p>
                  </div>
                  <span className="text-[9px] font-medium text-pastel-sub/70 mt-2 block border-t border-pastel-border/30 pt-1">
                    Чистота: {humanProfile.clarity.techValue}
                  </span>
                </div>
              )}
            </div>

            {/* Mentor Praise Badge */}
            <div className="p-2.5 rounded-2xl bg-white/95 border border-pastel-rose/80 text-[11px] text-pastel-text leading-relaxed flex items-center gap-2 shadow-2xs">
              <span className="text-sm shrink-0">🌸</span>
              <p className="font-medium text-pastel-text/90">{humanProfile.mentorPraise}</p>
            </div>

            {/* Pedagogical STAR / PREP Rephrased Example */}
            {evaluation.speechCoaching?.rephrasedExample && (
              <div className="p-3.5 bg-gradient-to-r from-pastel-accentViolet/10 via-white to-pastel-accentRose/10 rounded-2xl border border-pastel-accentViolet/35 shadow-2xs space-y-2 text-left animate-fadeIn">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-pastel-accentViolet">
                    <GraduationCap className="w-4 h-4 text-pastel-accentRose" />
                    <span>Совет тренера: Эталонный ответ по {evaluation.speechCoaching.structureType || 'структуре'}</span>
                  </div>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-pastel-accentViolet/15 text-pastel-accentViolet">
                    Staff Engineer Style
                  </span>
                </div>
                <p className="text-[11px] text-pastel-text leading-relaxed italic bg-white/70 p-2.5 rounded-xl border border-pastel-border/50">
                  «{evaluation.speechCoaching.rephrasedExample}»
                </p>
              </div>
            )}
          </div>
        );
      })()}

      {evaluation.positivePoints && evaluation.positivePoints.length > 0 && (
        <div className="p-3.5 rounded-2xl bg-emerald-50/50 border border-emerald-200/60 text-xs">
          <span className="font-bold text-emerald-700 flex items-center gap-1.5 mb-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Что раскрыто глубоко и точно:
          </span>
          <ul className="space-y-1 text-emerald-900 list-disc list-inside">
            {evaluation.positivePoints.map((pt, i) => (
              <li key={i}>{pt}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Transparent Fixed Rubric & Deductions Audit */}
      <RubricScorecard evaluation={evaluation} />

      {(evaluation.spokenFeedback || evaluation.feedback) && (
        <div className="p-3.5 rounded-2xl bg-pastel-card border border-pastel-border text-xs leading-relaxed text-pastel-text">
          <span className="font-bold text-pastel-accentViolet block mb-1">Резюме интервьюера:</span>
          <MarkdownRenderer content={evaluation.spokenFeedback || evaluation.feedback || ''} compact />
        </div>
      )}

      <div className="pt-3 border-t border-pastel-border/60 flex flex-wrap items-center gap-2 sm:gap-3">
        {onNextQuestion && (
          <button
            type="button"
            onClick={onNextQuestion}
            className="flex-1 py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold text-xs hover:opacity-95 transition shadow-sm flex items-center justify-center gap-2 cursor-pointer min-w-[160px]"
          >
            <span>Следующий вопрос ({nextQuestionIndex !== undefined ? nextQuestionIndex + 1 : ''} / {totalQuestions || ''})</span>
          </button>
        )}

        {onFinishBatch && (
          <button
            type="button"
            onClick={onFinishBatch}
            className="flex-1 py-3 px-4 rounded-2xl bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet text-white font-bold text-xs hover:opacity-95 transition shadow-sm flex items-center justify-center gap-2 cursor-pointer min-w-[160px]"
          >
            <span>Итоговые результаты</span>
          </button>
        )}

        <button
          type="button"
          onClick={retryCurrentQuestionCleanly}
          className="py-3 px-4 rounded-2xl bg-white hover:bg-slate-50 border border-pastel-border text-slate-700 font-semibold text-xs transition shadow-2xs flex items-center justify-center gap-2 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Ответить заново</span>
        </button>

        <button
          type="button"
          onClick={onClose}
          className="py-3 px-5 rounded-2xl border border-pastel-border text-pastel-text text-xs font-semibold hover:bg-pastel-rose transition cursor-pointer"
        >
          Закрыть
        </button>
      </div>
    </div>
  );
};
