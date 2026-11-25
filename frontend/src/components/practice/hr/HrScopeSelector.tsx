import React from 'react';
import { HrQuestionRubricItem, HrSessionMode, HrBeatScope } from '@interview-prep/shared';
import { BookOpen, CheckCircle2, Layers, Target } from 'lucide-react';

interface HrScopeSelectorProps {
  mode: HrSessionMode;
  activeQuestion: HrQuestionRubricItem | null;
  selectedChunkId: string | null;
  selectedStartBeatId: string | null;
  guidedBeatScope: HrBeatScope;
  masteredBeatIds: string[];
  onSelectChunkId: (chunkId: string | null) => void;
  onSelectStartBeatId: (beatId: string | null) => void;
  onSelectGuidedBeatScope: (scope: HrBeatScope) => void;
}

export const HrScopeSelector: React.FC<HrScopeSelectorProps> = ({
  mode,
  activeQuestion,
  selectedChunkId,
  selectedStartBeatId,
  guidedBeatScope,
  masteredBeatIds,
  onSelectChunkId,
  onSelectStartBeatId,
  onSelectGuidedBeatScope
}) => {
  if (!activeQuestion) return null;

  if (mode === 'guided_zero_start') {
    const beats = activeQuestion.microBeats || [];
    if (beats.length === 0) return null;
    const activeBeatId = selectedStartBeatId && beats.some((b) => b.id === selectedStartBeatId)
      ? selectedStartBeatId
      : beats[0].id;

    return (
      <div className="w-full bg-indigo-50/50 p-3.5 rounded-xl border border-indigo-200/80 mb-3 text-left space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-800 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-indigo-600" />
            <span>Карта микро-блоков ({beats.length}) — выберите, с какого начать</span>
          </div>

          <div className="flex p-0.5 bg-white border border-indigo-200 rounded-lg text-[11px]">
            <button
              type="button"
              onClick={() => onSelectGuidedBeatScope('all_from_beat')}
              className={`px-2 py-0.5 rounded-md font-semibold transition cursor-pointer ${
                guidedBeatScope === 'all_from_beat'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Начать с выбранного блока и пройти маршрут до конца"
            >
              Весь маршрут ({beats.length})
            </button>
            <button
              type="button"
              onClick={() => onSelectGuidedBeatScope('single_beat')}
              className={`px-2 py-0.5 rounded-md font-semibold transition cursor-pointer flex items-center gap-1 ${
                guidedBeatScope === 'single_beat'
                  ? 'bg-amber-600 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Отрабатывать только выбранный 1 блок разными формулировками"
            >
              <Target className="w-3 h-3" />
              <span>Только этот блок (1)</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {beats.map((beat, idx) => {
            const isSelected = beat.id === activeBeatId;
            const isMastered = masteredBeatIds.includes(beat.id);

            return (
              <button
                key={beat.id}
                type="button"
                onClick={() => onSelectStartBeatId(beat.id)}
                className={`text-left p-2 rounded-xl border transition cursor-pointer flex items-start justify-between gap-2 ${
                  isSelected
                    ? 'bg-white border-indigo-500 ring-1 ring-indigo-300 shadow-2xs'
                    : 'bg-white/80 border-slate-200/80 hover:border-indigo-300'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <span className="text-xs font-bold text-slate-800 truncate">{beat.title}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {beat.immutableFacts.slice(0, 2).map((fact, fIdx) => (
                      <span
                        key={fIdx}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200/70 truncate max-w-[160px]"
                      >
                        {fact}
                      </span>
                    ))}
                  </div>
                </div>
                {isMastered && (
                  <span title="Блок освоен" className="shrink-0 mt-0.5 text-emerald-600">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (!activeQuestion.chunks || activeQuestion.chunks.length === 0) return null;

  return (
    <div className="w-full bg-slate-50 p-3 rounded-xl border border-slate-200/80 mb-3 text-left">
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
        <BookOpen className="w-3 h-3 text-pastel-accentRose" />
        Масштаб отработки (Чанкование)
      </div>
      <div className="flex flex-wrap gap-1.5 text-xs">
        <button
          type="button"
          onClick={() => onSelectChunkId(null)}
          className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer ${
            selectedChunkId === null
              ? 'bg-pastel-accentRose text-white shadow-2xs'
              : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900'
          }`}
        >
          Весь ответ целиком
        </button>
        {activeQuestion.chunks.map((ch) => (
          <button
            key={ch.id}
            type="button"
            onClick={() => onSelectChunkId(ch.id)}
            className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer ${
              selectedChunkId === ch.id
                ? 'bg-pastel-accentRose text-white shadow-2xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900'
            }`}
          >
            {ch.title}
          </button>
        ))}
      </div>
    </div>
  );
};
