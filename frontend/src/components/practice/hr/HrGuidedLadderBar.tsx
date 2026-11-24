import React from 'react';
import { HrStepStatePayload, HrStepControlAction } from '@interview-prep/shared';
import { RefreshCw, ArrowRight, RotateCcw, Eye, EyeOff, CheckCircle2, Layers } from 'lucide-react';

interface HrGuidedLadderBarProps {
  stepState: HrStepStatePayload;
  beatIds?: string[];
  masteredBeatIds: string[];
  onStepControl: (action: HrStepControlAction, extra?: { beatIndex?: number; cueVisible?: boolean }) => void;
}

const RUNG_LABELS: Array<{ rung: 1 | 2 | 3 | 4; label: string; desc: string }> = [
  { rung: 1, label: '1. Эхо-повтор', desc: 'Повторите короткую фразу за тренером' },
  { rung: 2, label: '2. Перефраз', desc: 'Скажите своими связками с теми же фактами' },
  { rung: 3, label: '3. Без шпаргалки', desc: 'Ответьте на вопрос HR по памяти' },
  { rung: 4, label: '4. Сборка', desc: 'Соберите освоенные блоки воедино' }
];

export const HrGuidedLadderBar: React.FC<HrGuidedLadderBarProps> = ({
  stepState,
  beatIds = [],
  masteredBeatIds,
  onStepControl
}) => {
  return (
    <div className="w-full rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50/80 via-white to-purple-50/60 p-3.5 space-y-3 shadow-2xs">
      {/* Top Row: Beat title + Beat pills */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-600 text-white text-[11px] font-bold">
            <Layers className="w-3 h-3" />
            Блок {stepState.beatIndex + 1} / {stepState.totalBeats}
          </span>
          <span className="text-xs font-bold text-slate-800">{stepState.beatTitle}</span>
        </div>

        {/* Clickable Beat Switcher Pills */}
        <div className="flex items-center gap-1 flex-wrap">
          {Array.from({ length: stepState.totalBeats }).map((_, idx) => {
            const isCurrent = idx === stepState.beatIndex;
            const targetBeatId = beatIds[idx];
            const isBeatMastered = targetBeatId
              ? masteredBeatIds.includes(targetBeatId)
              : isCurrent && masteredBeatIds.includes(stepState.beatId);

            return (
              <button
                key={idx}
                onClick={() => onStepControl('select_beat', { beatIndex: idx })}
                className={`px-2 py-0.5 rounded-lg text-[11px] font-bold border transition cursor-pointer flex items-center gap-1 ${
                  isCurrent
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-2xs'
                    : isBeatMastered
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
                title={`Перейти к блоку ${idx + 1}`}
              >
                {isBeatMastered && <CheckCircle2 className="w-2.5 h-2.5" />}
                <span>{idx + 1}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Middle Row: 4-Rung Fading Scaffolding Indicator */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
        {RUNG_LABELS.map((item) => {
          const isActive = stepState.rung === item.rung;
          const isCompleted = stepState.rung > item.rung;
          return (
            <div
              key={item.rung}
              title={item.desc}
              className={`px-2 py-1.5 rounded-xl border text-[11px] transition ${
                isActive
                  ? 'bg-indigo-600 border-indigo-600 text-white font-bold shadow-xs'
                  : isCompleted
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800 font-semibold'
                  : 'bg-white/80 border-slate-200 text-slate-500'
              }`}
            >
              <div className="truncate">{item.label}</div>
            </div>
          );
        })}
      </div>

      {/* Bottom Row: Fallback Action Buttons (Synced with Voice!) */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => onStepControl('next_variant')}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-indigo-50 border border-indigo-200 text-indigo-700 text-[11px] font-semibold transition cursor-pointer"
            title="Попросить тренера сказать эту же мысль другими словами (Вариант 1..3)"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Другой вариант ({stepState.variantIndex + 1}/{stepState.variantCount})</span>
          </button>

          <button
            onClick={() => onStepControl('repeat_beat')}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-semibold transition cursor-pointer"
            title="Вернуться к Ступени 1 на этом же блоке"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Повторить блок</span>
          </button>

          <button
            onClick={() => onStepControl('toggle_cue', { cueVisible: !stepState.cueVisible })}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition cursor-pointer ${
              stepState.cueVisible
                ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                : 'bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100'
            }`}
            title="Бесшумно скрыть или показать карточку подсказок"
          >
            {stepState.cueVisible ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            <span>{stepState.cueVisible ? 'Скрыть подсказку' : 'Показать подсказку'}</span>
          </button>
        </div>

        <button
          onClick={() => onStepControl('next_rung')}
          className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
          title="Перейти к следующей ступени (также работает по голосовой команде «дальше»)"
        >
          <span>{stepState.rung >= 3 ? 'Следующий шаг' : 'Дальше →'}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
