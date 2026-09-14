import React from 'react';
import { Mic, MicOff, Radio, Volume2, Sparkles, AlertCircle } from 'lucide-react';

export interface TactileVoiceCircleProps {
  isConnected: boolean;
  isAiSpeaking: boolean;
  isRecording: boolean;
  isMuted: boolean;
  rmsDb?: number;
  onBargeIn: () => void;
  onToggleMic: () => void;
  statusText?: string;
}

export const TactileVoiceCircle: React.FC<TactileVoiceCircleProps> = ({
  isConnected,
  isAiSpeaking,
  isRecording,
  isMuted,
  rmsDb = -60,
  onBargeIn,
  onToggleMic,
  statusText
}) => {
  const handleClick = () => {
    if (isAiSpeaking) {
      onBargeIn();
    } else {
      onToggleMic();
    }
  };

  // Dynamic scale based on RMS decibels when recording
  const normalizedRms = Math.min(1.25, Math.max(1.0, 1 + (rmsDb + 60) / 100));

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-8 select-none">
      {/* Central Soft Luxury Tactile Circle */}
      <div className="relative flex items-center justify-center">
        {/* Soft luxury aura glow */}
        <div
          className={`absolute w-44 h-44 rounded-full blur-3xl transition-opacity duration-700 pointer-events-none ${
            isAiSpeaking
              ? 'bg-purple-500/30 opacity-100 animate-pulse'
              : isRecording
                ? 'bg-emerald-400/30 opacity-100'
                : 'bg-slate-700/20 opacity-40'
          }`}
        />

        {/* Outer Ripple Rings for AI Speech */}
        {isAiSpeaking && (
          <>
            <div className="absolute w-40 h-40 rounded-full border border-purple-400/40 animate-ping pointer-events-none" />
            <div className="absolute w-48 h-48 rounded-full border border-purple-500/20 pointer-events-none" />
          </>
        )}

        {/* Tactile Circle Button */}
        <button
          onClick={handleClick}
          style={{ transform: isRecording ? `scale(${normalizedRms})` : 'scale(1)' }}
          className={`relative z-10 w-32 h-32 rounded-full flex flex-col items-center justify-center transition-all duration-300 shadow-2xl cursor-pointer border ${
            isAiSpeaking
              ? 'bg-gradient-to-br from-purple-600 to-indigo-700 border-purple-300/40 text-white shadow-purple-600/40 hover:brightness-110 active:scale-95'
              : isRecording
                ? 'bg-gradient-to-br from-emerald-600 to-teal-700 border-emerald-300/40 text-white shadow-emerald-600/40 hover:brightness-110 active:scale-95'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
          }`}
          title={isAiSpeaking ? 'Кликните для тактильного прерывания (Barge-In)' : 'Включить / выключить микрофон'}
        >
          {isAiSpeaking ? (
            <>
              <Volume2 className="w-8 h-8 animate-bounce-short" />
              <span className="text-[10px] uppercase font-bold tracking-wider mt-1 text-purple-200">
                Прервать
              </span>
            </>
          ) : isRecording ? (
            <>
              <Mic className="w-8 h-8 animate-pulse" />
              <span className="text-[10px] uppercase font-bold tracking-wider mt-1 text-emerald-200">
                Слушаю
              </span>
            </>
          ) : (
            <>
              <MicOff className="w-8 h-8 text-slate-400" />
              <span className="text-[10px] uppercase font-bold tracking-wider mt-1 text-slate-400">
                Микрофон выкл
              </span>
            </>
          )}
        </button>
      </div>

      {/* Helper caption */}
      <div className="text-center">
        <p className="text-xs font-semibold text-slate-200">
          {statusText || (isAiSpeaking ? 'AI Bar-Raiser задает вопрос (кликните, чтобы ответить)' : isRecording ? 'Ваш микрофон активен — защищайте решение' : 'Нажмите на круг, чтобы включить микрофон')}
        </p>
        <p className="text-[10px] text-slate-400 mt-0.5">
          Тактильный Barge-In с рампой глушения 5 мс
        </p>
      </div>
    </div>
  );
};
