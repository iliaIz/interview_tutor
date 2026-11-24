import React from 'react';
import { HrStepStatePayload } from '@interview-prep/shared';
import { MessageSquareQuote, ShieldCheck, Eye, Sparkles } from 'lucide-react';

interface HrLiveSubtitleCardProps {
  lastAiText?: string;
  stepState?: HrStepStatePayload | null;
  onPeekCue?: () => void;
}

export const HrLiveSubtitleCard: React.FC<HrLiveSubtitleCardProps> = ({
  lastAiText,
  stepState,
  onPeekCue
}) => {
  if (!lastAiText && !stepState) return null;

  return (
    <div className="w-full space-y-2.5">
      {/* Live AI Speech Subtitle */}
      {lastAiText && (
        <div className="w-full p-3 rounded-xl bg-white/90 border border-purple-200/80 shadow-2xs text-left">
          <div className="text-[10px] font-bold uppercase tracking-wider text-purple-600 mb-1 flex items-center gap-1">
            <MessageSquareQuote className="w-3 h-3" />
            <span>Реплика тренера (текстом)</span>
          </div>
          <p className="text-xs text-slate-800 leading-relaxed">{lastAiText}</p>
        </div>
      )}

      {/* Guided Scaffolding Toggleable Cue Card */}
      {stepState && (
        stepState.cueVisible ? (
          <div className="w-full p-3 rounded-xl bg-amber-50/70 border border-amber-200/90 text-left space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-700" />
                <span>Неизменяемые факты + живой ориентир (связки меняйте свободно)</span>
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {stepState.immutableFacts.map((fact, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded-md bg-white border border-amber-300 text-amber-950 text-[11px] font-bold"
                >
                  {fact}
                </span>
              ))}
            </div>

            <div className="text-xs text-slate-700 italic bg-white/80 px-2.5 py-2 rounded-lg border border-amber-100">
              «{stepState.activeVariantText}»
            </div>
          </div>
        ) : (
          <div className="w-full p-3 rounded-xl bg-slate-50 border border-dashed border-slate-300 flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-slate-600 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <span>
                {stepState.rung === 3
                  ? `Вопрос HR по памяти: «${stepState.hrTriggerPrompt}»`
                  : stepState.rung === 4
                  ? 'Ступень сборки: объедините освоенные блоки без подсказки!'
                  : 'Подсказка скрыта — сформулируйте ответ своими словами.'}
              </span>
            </div>
            {onPeekCue && (
              <button
                onClick={onPeekCue}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-[11px] font-semibold text-slate-700 transition cursor-pointer shrink-0"
              >
                <Eye className="w-3 h-3" />
                <span>Подсмотреть</span>
              </button>
            )}
          </div>
        )
      )}
    </div>
  );
};
