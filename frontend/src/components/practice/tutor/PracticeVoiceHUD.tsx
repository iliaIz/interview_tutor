import React, { useEffect, useRef } from 'react';
import { usePracticeVoice } from './PracticeVoiceContext';
import { useAppStore } from '../../../store/useAppStore';
import { useInterviewConfig } from '../../../hooks/useInterviewConfig';
import { VOICE_DEFAULTS } from '../../../config/voiceDefaults';
import { Mic, MicOff, Volume2, PhoneOff, Radio, Sparkles, Send, Loader2, RefreshCw } from 'lucide-react';

interface PracticeVoiceHUDProps {
  onAiTranscriptUpdate?: (transcript: string) => void;
}

export const PracticeVoiceHUD: React.FC<PracticeVoiceHUDProps> = ({ onAiTranscriptUpdate }) => {
  const { config: interviewConfig } = useInterviewConfig();
  const hasAutoStartedRef = useRef(false);

  const {
    isConnected,
    isAiSpeaking,
    isRecording,
    isMuted,
    isUserSpeaking,
    isPauseHolding,
    isError,
    lastError,
    statusMessage,
    disconnect,
    subscribeAudioLevel,
    startPracticeSession,
    handleInteraction
  } = usePracticeVoice();

  const rmsBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return subscribeAudioLevel((db) => {
      if (rmsBarRef.current) {
        const pct = Math.min(100, Math.max(10, ((db + 60) / 45) * 100));
        rmsBarRef.current.style.width = `${pct}%`;
      }
    });
  }, [subscribeAudioLevel]);

  // Auto-start live session ONCE on mount (never loop infinitely on fatal error or manual close)
  useEffect(() => {
    if (!isConnected && !isError && !hasAutoStartedRef.current) {
      hasAutoStartedRef.current = true;
      void startPracticeSession();
    }
  }, [isConnected, isError, startPracticeSession]);

  const isManualMode = interviewConfig.turnMode === 'manual';

  return (
    <div className="flex flex-col items-center justify-between p-4 rounded-2xl bg-gradient-to-b from-[#FFF0F5]/80 via-white to-pastel-lavender/20 border border-pastel-accentRose/30 shadow-sm relative overflow-hidden">
      {/* Background Pulse Aura */}
      <div
        className={`absolute -top-12 -right-12 w-40 h-40 rounded-full blur-3xl transition-opacity duration-700 pointer-events-none ${
          isAiSpeaking
            ? 'bg-pastel-accentRose/30 opacity-100 animate-pulse'
            : isPauseHolding
            ? 'bg-amber-400/30 opacity-100 animate-pulse'
            : isUserSpeaking
            ? 'bg-emerald-500/40 opacity-100 animate-pulse'
            : isRecording
            ? 'bg-emerald-400/20 opacity-80'
            : 'bg-slate-300/20 opacity-40'
        }`}
      />

      {/* Header Info with Active Config Pill */}
      <div className="w-full flex items-center justify-between z-10 mb-3 gap-1">
        <div className="flex items-center gap-1.5 overflow-hidden">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white border border-pastel-accentRose/20 text-[10px] font-bold text-pastel-accentRoseText shadow-2xs truncate">
            <Radio className="w-3 h-3 text-pastel-accentRose animate-pulse shrink-0" />
            <span className="truncate">
              {interviewConfig.voice || VOICE_DEFAULTS.voice} • {interviewConfig.userGender === 'male' ? 'Мужской' : interviewConfig.userGender === 'neutral' ? 'На «Вы»' : 'Женский'} • {isManualMode ? 'По кнопке' : 'Авто-VAD'}
            </span>
          </div>
        </div>

        <button
          onClick={disconnect}
          className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-rose-600 px-2 py-1 rounded-lg hover:bg-rose-50 transition cursor-pointer shrink-0"
          title="Завершить голосовую сессию"
        >
          <PhoneOff className="w-3.5 h-3.5" />
          <span>Отключить</span>
        </button>
      </div>

      {/* Central Tactile Circle Button (Tactile Barge-In / Auto-VAD / Commit) */}
      <div className="relative my-4 flex flex-col items-center">
        <button
          onClick={handleInteraction}
          className={`w-24 h-24 rounded-full flex flex-col items-center justify-center transition-all duration-300 shadow-lg cursor-pointer transform active:scale-95 ${
            isAiSpeaking
              ? 'bg-gradient-to-tr from-pink-500 to-rose-400 text-white ring-8 ring-rose-100 animate-pulse'
              : isPauseHolding
              ? 'bg-gradient-to-tr from-amber-500 to-orange-400 text-white ring-8 ring-amber-100 animate-pulse'
              : isUserSpeaking
              ? 'bg-gradient-to-tr from-emerald-600 to-teal-500 text-white ring-8 ring-emerald-200 scale-105'
              : isRecording
              ? 'bg-gradient-to-tr from-emerald-500 to-teal-400 text-white ring-8 ring-emerald-100'
              : 'bg-white text-slate-400 border-2 border-slate-200 hover:border-pastel-accentRose'
          }`}
          title={
            isAiSpeaking
              ? 'Нажмите, чтобы перебить ИИ (Barge-In)'
              : isManualMode && isRecording
              ? 'Нажмите, чтобы отправить ответ ИИ'
              : 'Нажмите, чтобы включить/отключить микрофон'
          }
        >
          {isAiSpeaking ? (
            <>
              <Volume2 className="w-8 h-8 animate-bounce" />
              <span className="text-[9px] font-bold mt-1 tracking-wider uppercase">Перебить</span>
            </>
          ) : isPauseHolding ? (
            <>
              <Loader2 className="w-8 h-8 animate-spin" />
              <span className="text-[9px] font-bold mt-1 tracking-wider uppercase">Пауза VAD</span>
            </>
          ) : isUserSpeaking ? (
            <>
              <Mic className="w-8 h-8 animate-pulse text-white" />
              <span className="text-[9px] font-bold mt-1 tracking-wider uppercase">Говорите</span>
            </>
          ) : isRecording ? (
            isManualMode ? (
              <>
                <Send className="w-8 h-8 text-white" />
                <span className="text-[9px] font-bold mt-1 tracking-wider uppercase">Отправить</span>
              </>
            ) : (
              <>
                <Mic className="w-8 h-8 animate-pulse" />
                <span className="text-[9px] font-bold mt-1 tracking-wider uppercase">Слушаю</span>
              </>
            )
          ) : (
            <>
              <MicOff className="w-8 h-8" />
              <span className="text-[9px] font-bold mt-1 tracking-wider uppercase">Пауза</span>
            </>
          )}
        </button>

        {/* Dynamic RMS Wave Bar when user is speaking */}
        {isRecording && !isAiSpeaking && (
          <div className="w-28 h-1.5 bg-slate-100 rounded-full overflow-hidden mt-2.5 border border-slate-200">
            <div
              ref={rmsBarRef}
              className={`h-full transition-all duration-75 rounded-full ${
                isUserSpeaking ? 'bg-emerald-500' : 'bg-slate-300'
              }`}
              style={{ width: '10%' }}
            />
          </div>
        )}

        <span className="text-xs font-semibold text-slate-600 mt-2 text-center max-w-[280px]">
          {isError
            ? (lastError || statusMessage || 'Соединение прервано')
            : isAiSpeaking
            ? 'ИИ говорит вслух (нажмите, чтобы перебить)'
            : isPauseHolding
            ? (statusMessage || 'Пауза: ИИ осмысливает ваш ответ...')
            : isUserSpeaking
            ? 'Вы говорите (голос передается напарнику)...'
            : isRecording
            ? isManualMode
              ? 'Говорите, затем нажмите кнопку для отправки'
              : `Говорите свободно, пауза ${((interviewConfig.vadPauseMs ?? VOICE_DEFAULTS.vadPauseMs) / 1000).toFixed(1)}с запустит ответ`
            : isConnected
            ? statusMessage
            : (statusMessage || 'Подключение к аудио-шлюзу...')}
        </span>

        {!isConnected && (
          <button
            onClick={() => void startPracticeSession()}
            className="mt-2.5 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-pastel-accentRose text-white text-[11px] font-bold shadow-xs hover:opacity-90 transition cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Переподключить</span>
          </button>
        )}
      </div>

    </div>
  );
};
