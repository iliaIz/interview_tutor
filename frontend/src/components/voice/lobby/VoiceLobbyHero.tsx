import React from 'react';
import { Mic, GraduationCap, ShieldCheck } from 'lucide-react';
import { InterviewConfig } from '../../../types/interviewConfig';
import { FAANG_PERSONAS, TARGET_GRADES } from '../../../types/personas';

export interface VoiceLobbyHeroProps {
  interviewConfig: InterviewConfig;
  isBatchMode: boolean;
  totalQuestions: number;
}

export const VoiceLobbyHero: React.FC<VoiceLobbyHeroProps> = ({
  interviewConfig,
  isBatchMode,
  totalQuestions
}) => {
  const turnMode = interviewConfig.turnMode || 'manual';
  const persona = interviewConfig.persona || 'mentor';

  return (
    <>
      <div className="relative">
        <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-pastel-accentRose via-pink-400 to-pastel-accentViolet p-1 shadow-xl flex items-center justify-center animate-pulse">
          <div className="w-full h-full rounded-full bg-white flex items-center justify-center text-3xl">
            {persona === 'amazon_bar_raiser'
              ? '📦'
              : persona === 'google_staff'
              ? '🔍'
              : persona === 'yandex_core'
              ? '🔴'
              : (interviewConfig.strategy === 'socratic_tutoring' ? '🌸' : '👩‍💻')}
          </div>
        </div>
        <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white p-1.5 rounded-full border-2 border-white shadow-xs">
          <Mic className="w-4 h-4" />
        </div>
      </div>

      <div className="max-w-md space-y-1.5 px-2">
        <h4 className="font-bold text-pastel-text text-base">
          {isBatchMode
            ? `Готовы пройти серию из ${totalQuestions} вопросов?`
            : `${FAANG_PERSONAS[persona]?.name || 'ИИ-интервьюер'} готов к диалогу`}
        </h4>
        <p className="text-xs text-pastel-muted leading-relaxed">
          {isBatchMode
            ? 'Режим "Без рук" (Hands-Free): ИИ последовательно задаст каждый вопрос темы, оценит ваши ответы и сам переведет к следующему.'
            : (persona && persona !== 'mentor')
            ? `Официальная симуляция найма BigTech (${FAANG_PERSONAS[persona].company}). Оценивает грейд ${TARGET_GRADES[interviewConfig.targetGrade || 'L5_SENIOR']?.badge}.`
            : 'Интервьюер поздоровается голосом и зачитает вопрос. Вы можете отвечать своими словами и уточнять детали.'}
        </p>

        <div className="pt-1 flex flex-wrap items-center justify-center gap-2">
          {/* Turn Mode Pill */}
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] font-bold shadow-2xs ${
            turnMode === 'auto'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
              : 'bg-amber-50 text-amber-800 border-amber-300'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${
              turnMode === 'auto' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
            }`} />
            <span>{turnMode === 'auto' ? '⚡ Авто-VAD' : '✋ По очереди'}</span>
          </span>

          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-pastel-card border border-pastel-border text-[11px] font-semibold text-pastel-text shadow-2xs">
            {interviewConfig.strategy === 'socratic_tutoring' ? (
              <GraduationCap className="w-3.5 h-3.5 text-pastel-accentRose" />
            ) : (
              <ShieldCheck className="w-3.5 h-3.5 text-pastel-accentViolet" />
            )}
            <span>
              {FAANG_PERSONAS[persona]?.badge || 'Ментор'} • {interviewConfig.voice}
            </span>
          </span>
        </div>
      </div>
    </>
  );
};
