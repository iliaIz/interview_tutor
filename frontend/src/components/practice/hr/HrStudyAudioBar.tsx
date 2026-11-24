import React from 'react';
import { HrQuestionRubricItem, HrMicroBeat } from '@interview-prep/shared';
import {
  Volume2,
  Square,
  SkipForward,
  RefreshCw,
  Timer,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Headphones
} from 'lucide-react';
import { useStudyAudioPlayer } from './useStudyAudioPlayer';

interface HrStudyAudioBarProps {
  question: HrQuestionRubricItem;
  masteredBeatIds?: string[];
}

export const HrStudyAudioBar: React.FC<HrStudyAudioBarProps> = ({
  question,
  masteredBeatIds = []
}) => {
  const beats: HrMicroBeat[] = question.microBeats || [];
  const {
    activeVoice,
    variantMap,
    playingKey,
    loadingKey,
    playbackRate,
    setPlaybackRate,
    shadowPauseMode,
    setShadowPauseMode,
    isPlaylistActive,
    pauseCountdownSec,
    errorMsg,
    handlePlayBeatClick,
    handlePlayAll,
    handleNextVariant
  } = useStudyAudioPlayer(question.id, beats);

  if (beats.length === 0) return null;

  return (
    <div className="rounded-2xl border border-indigo-200/80 bg-gradient-to-br from-indigo-50/60 via-white to-pastel-lavender/30 p-4 space-y-3">
      {/* Header & Global Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-xl bg-indigo-100 text-indigo-700">
            <Headphones className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <span>Пассивный аудио-разбор по микро-блокам</span>
              <span className="px-2 py-0.5 rounded-full bg-white border border-indigo-200 text-[10px] font-semibold text-indigo-700">
                Голос: {activeVoice}
              </span>
            </div>
            <div className="text-[11px] text-slate-500">
              Слушайте короткие фразы в разных формулировках и повторяйте вслух до старта арены
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {/* Speed Selector */}
          <div className="flex p-0.5 rounded-lg bg-white border border-slate-200 text-[11px]">
            {([0.9, 1.0, 1.15] as const).map((rate) => (
              <button
                key={rate}
                onClick={() => setPlaybackRate(rate)}
                className={`px-2 py-0.5 rounded-md font-semibold transition cursor-pointer ${
                  playbackRate === rate
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {rate}x
              </button>
            ))}
          </div>

          {/* Shadow Pause Toggle */}
          <button
            onClick={() => setShadowPauseMode((v) => !v)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition cursor-pointer ${
              shadowPauseMode
                ? 'bg-amber-50 border-amber-300 text-amber-800'
                : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900'
            }`}
            title="Делать паузу 3.5 сек после каждой фразы, чтобы вы могли повторить вслух"
          >
            <Timer className="w-3 h-3" />
            <span>Пауза для повтора</span>
          </button>

          {/* Play All Button */}
          <button
            onClick={handlePlayAll}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold shadow-xs transition cursor-pointer ${
              isPlaylistActive
                ? 'bg-rose-500 hover:bg-rose-600 text-white'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
            }`}
          >
            {isPlaylistActive ? (
              <>
                <Square className="w-3 h-3 fill-white" />
                <span>Стоп</span>
              </>
            ) : (
              <>
                <SkipForward className="w-3.5 h-3.5" />
                <span>Слушать всё ({beats.length})</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Shadow Pause Banner */}
      {pauseCountdownSec > 0 && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-800 animate-pulse">
          <Timer className="w-3.5 h-3.5" />
          <span>Пауза — повторите фразу вслух своими словами... ({pauseCountdownSec}с)</span>
        </div>
      )}

      {/* Error Notice */}
      {errorMsg && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Micro-Beats Stack */}
      <div className="space-y-2">
        {beats.map((beat, idx) => {
          const vIdx = variantMap[beat.id] || 0;
          const variantText = beat.spokenVariants[vIdx] || beat.spokenVariants[0];
          const key = `${beat.id}:${vIdx}`;
          const isPlaying = playingKey === key;
          const isLoading = loadingKey === key;
          const isMastered = masteredBeatIds.includes(beat.id);

          return (
            <div
              key={beat.id}
              className={`rounded-xl border p-3 transition ${
                isPlaying
                  ? 'bg-indigo-50/90 border-indigo-400 shadow-xs'
                  : 'bg-white/95 border-slate-200/90 hover:border-indigo-200'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                    Блок {idx + 1}
                  </span>
                  <span className="text-xs font-bold text-slate-800">{beat.title}</span>
                  {isMastered && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3 h-3" /> Освоен
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleNextVariant(beat)}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-[11px] font-semibold text-slate-700 transition cursor-pointer"
                    title="Показать и озвучить другую естественную формулировку с теми же фактами"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Вариант {vIdx + 1}/{beat.spokenVariants.length}</span>
                  </button>

                  <button
                    onClick={() => handlePlayBeatClick(beat)}
                    disabled={isLoading}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                      isPlaying
                        ? 'bg-rose-500 text-white'
                        : 'bg-pastel-accentRose/10 hover:bg-pastel-accentRose hover:text-white text-pastel-accentRose'
                    }`}
                  >
                    {isLoading ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : isPlaying ? (
                      <Square className="w-3 h-3 fill-current" />
                    ) : (
                      <Volume2 className="w-3.5 h-3.5" />
                    )}
                    <span>{isLoading ? 'Синтез...' : isPlaying ? 'Стоп' : 'Слушать'}</span>
                  </button>
                </div>
              </div>

              <p className="text-xs text-slate-700 leading-relaxed mb-2">«{variantText}»</p>

              <div className="flex flex-wrap gap-1.5">
                {beat.immutableFacts.map((fact, fIdx) => (
                  <span
                    key={fIdx}
                    className="px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200/80 text-amber-900 text-[10px] font-semibold"
                    title="Неизменяемый факт (закон, документ или цифра)"
                  >
                    {fact}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
