/**
 * VoiceTutorMediaCluster.tsx
 * Media buttons and VAD state indicators for Voice Tutor.
 * Cognitive Bounding Limit: <= 220 lines.
 */

import React from 'react';
import { Play, Pause, Square, Volume2, Mic, MicOff, Loader2, Clock, Zap } from 'lucide-react';
import { InterviewConfig } from '../../types/interviewConfig';
import { VOICE_DEFAULTS } from '../../config/voiceDefaults';

export interface VoiceTutorMediaClusterProps {
  isSessionPaused?: boolean;
  onToggleSessionPause?: () => void;
  isAiSpeaking: boolean;
  isThinking: boolean;
  thinkingStage: 'critical' | 'delayed' | 'idle' | 'processing';
  isRecording: boolean;
  isUserSpeaking: boolean;
  isPauseHolding: boolean;
  rmsDb: number;
  onInterruption: () => void;
  toggleMic: () => void;
  triggerEndTurn: () => void;
  interviewConfig: InterviewConfig;
}

export const VoiceTutorMediaCluster: React.FC<VoiceTutorMediaClusterProps> = ({
  isSessionPaused,
  onToggleSessionPause,
  isAiSpeaking,
  isThinking,
  thinkingStage,
  isRecording,
  isUserSpeaking,
  isPauseHolding,
  rmsDb,
  onInterruption,
  toggleMic,
  triggerEndTurn,
  interviewConfig
}) => {
  return (
    <div className="my-2 flex flex-col items-center justify-center shrink-0">
      <div className="flex items-center justify-center gap-3 sm:gap-5">
        {onToggleSessionPause && (
          <button
            type="button"
            onClick={onToggleSessionPause}
            title={isSessionPaused ? "Продолжить диалог (Пробел)" : "Пауза в диалоге (Пробел)"}
            className={`flex flex-col items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-2xl border transition-all duration-200 cursor-pointer shadow-2xs active:scale-95 touch-manipulation ${
              isSessionPaused
                ? 'bg-amber-500 text-white border-amber-600 ring-4 ring-amber-200 shadow-md animate-pulse'
                : 'bg-white hover:bg-amber-50/60 text-slate-700 border-pastel-border hover:border-amber-300'
            }`}
          >
            {isSessionPaused ? (
              <Play className="w-5 h-5 fill-white text-white ml-0.5" />
            ) : (
              <Pause className="w-5 h-5 text-slate-600" />
            )}
            <span className={`text-[9px] font-bold mt-0.5 ${isSessionPaused ? 'text-white' : 'text-slate-600'}`}>
              {isSessionPaused ? 'Пуск' : 'Пауза'}
            </span>
          </button>
        )}

        <div className="relative flex items-center justify-center">
          {isRecording && isUserSpeaking && (
            <div
              className="absolute rounded-full bg-emerald-400/30 animate-ping pointer-events-none"
              style={{
                width: `${84 + Math.min(36, Math.max(0, (rmsDb + 50) * 1.5))}px`,
                height: `${84 + Math.min(36, Math.max(0, (rmsDb + 50) * 1.5))}px`
              }}
            />
          )}
          <div
            className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 ${
              isAiSpeaking
                ? 'bg-gradient-to-tr from-pastel-accentRose via-pink-400 to-pastel-accentViolet shadow-xl ring-4 ring-pink-200'
                : isThinking
                ? 'bg-gradient-to-tr from-amber-300 via-orange-400 to-amber-500 shadow-xl ring-4 ring-amber-200'
                : isRecording
                ? isUserSpeaking
                  ? 'bg-gradient-to-tr from-emerald-400 to-teal-500 shadow-xl ring-4 ring-emerald-300 scale-105'
                  : 'bg-gradient-to-tr from-emerald-400 to-teal-500 shadow-xl ring-4 ring-emerald-200'
                : 'bg-slate-100 border border-slate-300'
            }`}
          >
            <button
              type="button"
              onClick={() => {
                if (isAiSpeaking || isThinking) {
                  onInterruption();
                } else {
                  toggleMic();
                }
              }}
              className="w-16 h-16 rounded-full bg-white flex flex-col items-center justify-center text-pastel-text shadow-inner transition hover:scale-105 active:scale-95 cursor-pointer touch-manipulation"
              title={isAiSpeaking || isThinking ? 'Barge-in' : isRecording ? 'Отключить микрофон' : 'Включить микрофон'}
            >
              {isAiSpeaking ? (
                <Volume2 className="w-6 h-6 text-pastel-accentRose animate-bounce" />
              ) : isThinking ? (
                <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
              ) : isRecording ? (
                <Mic className={`w-6 h-6 ${isUserSpeaking ? 'text-emerald-500 scale-110' : 'text-emerald-600 animate-pulse'} transition-transform`} />
              ) : (
                <MicOff className="w-6 h-6 text-slate-400" />
              )}
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={onInterruption}
          disabled={!isAiSpeaking && !isThinking}
          title={isAiSpeaking ? "Прервать ответ ИИ (Esc)" : isThinking ? "Остановить генерацию (Esc)" : "ИИ не говорит"}
          className={`flex flex-col items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-2xl border transition-all duration-200 shadow-2xs touch-manipulation ${
            isAiSpeaking || isThinking
              ? 'bg-rose-50 hover:bg-rose-100 text-rose-600 border-rose-300 ring-2 ring-rose-200 cursor-pointer active:scale-95'
              : 'bg-slate-50 text-slate-300 border-slate-200 opacity-40 cursor-not-allowed'
          }`}
        >
          <Square className={`w-4 h-4 sm:w-5 sm:h-5 ${isAiSpeaking || isThinking ? 'fill-rose-500 text-rose-500 animate-pulse' : ''}`} />
          <span className="text-[9px] font-bold mt-0.5">Стоп</span>
        </button>
      </div>

      <div className="mt-1.5 text-center flex flex-col items-center gap-1">
        {isAiSpeaking ? (
          <span className="px-2.5 py-0.5 rounded-full bg-pastel-rose text-pastel-accentRose text-[10px] font-bold border border-pastel-accentRose/30 animate-pulse flex items-center gap-1">
            <Volume2 className="w-3 h-3 animate-bounce" />
            <span>ИИ отвечает вслух...</span>
          </span>
        ) : isThinking ? (
          <div className="flex flex-col items-center gap-1">
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 animate-pulse ${
              thinkingStage === 'critical' ? 'bg-rose-50 text-rose-700 border-rose-300' : thinkingStage === 'delayed' ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-amber-50 text-amber-700 border-amber-300'
            }`}>
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>
                {thinkingStage === 'critical' ? 'Задержка ответа шлюза...' : thinkingStage === 'delayed' ? 'Связь со шлюзом: генерация схемы...' : 'ИИ осмысливает ответ и готовит пояснение...'}
              </span>
            </span>
            {(thinkingStage === 'critical' || thinkingStage === 'delayed') && (
              <button
                type="button"
                onClick={toggleMic}
                className="px-2 py-0.5 rounded-full bg-white hover:bg-slate-100 border border-slate-300 text-[9px] font-bold text-slate-700 shadow-2xs cursor-pointer flex items-center gap-1"
              >
                <Mic className="w-2.5 h-2.5 text-emerald-600" />
                <span>Продолжить говорить</span>
              </button>
            )}
          </div>
        ) : isRecording && isUserSpeaking ? (
          <span className="px-2.5 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-bold border border-emerald-600 shadow-xs flex items-center gap-1 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
            <span>Слышу вас: говорите...</span>
          </span>
        ) : isRecording && isPauseHolding ? (
          <div className="flex items-center gap-1.5">
            <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 text-[10px] font-bold border border-amber-300 flex items-center gap-1 animate-pulse">
              <Clock className="w-3 h-3 text-amber-600" />
              <span>Слушаю паузу ({((interviewConfig.vadPauseMs ?? VOICE_DEFAULTS.vadPauseMs) / 1000).toFixed(1)}с)...</span>
            </span>
            <button
              type="button"
              onClick={triggerEndTurn}
              className="px-2 py-0.5 rounded-full bg-amber-100 hover:bg-amber-200 text-amber-800 text-[9px] font-bold transition border border-amber-300 flex items-center gap-0.5 cursor-pointer shadow-2xs"
            >
              <Zap className="w-2.5 h-2.5 text-amber-700 fill-current" />
              <span>Отправить сейчас</span>
            </button>
          </div>
        ) : isRecording ? (
          <div className="flex items-center gap-1.5">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-300 flex items-center gap-1">
              <Mic className="w-3 h-3 text-emerald-600 animate-pulse" />
              <span>Говорите (Авто-VAD)...</span>
            </span>
            <button
              type="button"
              onClick={triggerEndTurn}
              className="px-2 py-0.5 rounded-full bg-pastel-card hover:bg-emerald-50 text-pastel-sub hover:text-emerald-700 text-[9px] font-medium transition border border-pastel-border flex items-center gap-0.5 cursor-pointer"
            >
              <Zap className="w-2.5 h-2.5 text-emerald-600 fill-current" />
              <span>Готово</span>
            </button>
          </div>
        ) : (
          <span className="px-2.5 py-0.5 rounded-full bg-pastel-card text-pastel-muted text-[10px] border border-pastel-border flex items-center gap-1">
            <MicOff className="w-3 h-3 text-slate-400" />
            <span>Микрофон отключен (нажмите на кружок)</span>
          </span>
        )}
      </div>
    </div>
  );
};
