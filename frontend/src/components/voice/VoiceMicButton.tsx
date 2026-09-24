/**
 * VoiceMicButton.tsx
 * Soft Luxury Pastel Interactive Mic Button with Tactile Barge-In (SOTA Late 2026).
 * Single responsibility: visual state rendering and tactile interaction trigger.
 */

import React from 'react';
import { Mic, MicOff, Volume2, Sparkles, Loader2 } from 'lucide-react';
import { VoiceEngineState } from '../../audio/types';

export interface VoiceMicButtonProps {
  state: VoiceEngineState;
  isMuted: boolean;
  rmsDb: number;
  onClick: () => void;
  onToggleMute: () => void;
}

export const VoiceMicButton: React.FC<VoiceMicButtonProps> = ({
  state,
  isMuted,
  rmsDb,
  onClick,
  onToggleMute
}) => {
  const isConnecting = state === 'CONNECTING';
  const isAiSpeaking = state === 'AI_SPEAKING';
  const isListening = state === 'LISTENING';
  const isError = state === 'ERROR';

  // Compute aura glow scale based on microphone RMS dB (-100 to 0)
  const normalizedLevel = Math.max(0, Math.min(1, (rmsDb + 60) / 40));
  const glowScale = isListening ? 1 + normalizedLevel * 0.35 : 1;

  return (
    <div className="relative flex flex-col items-center justify-center my-6">
      {/* Outer Atmospheric Aura */}
      <div
        className={`absolute rounded-full transition-all duration-300 pointer-events-none ${
          isAiSpeaking
            ? 'w-44 h-44 bg-rose-300/30 blur-2xl animate-pulse'
            : isListening
            ? 'w-44 h-44 bg-emerald-300/30 blur-2xl animate-pulse'
            : isConnecting
            ? 'w-40 h-40 bg-amber-300/20 blur-xl animate-spin'
            : 'w-36 h-36 bg-gray-200/20 blur-lg'
        }`}
        style={{ transform: `scale(${glowScale})` }}
      />

      {/* Central Tactile Button */}
      <button
        type="button"
        onClick={onClick}
        disabled={isConnecting}
        aria-label={
          isAiSpeaking
            ? 'Прервать ответ ИИ (Barge-in)'
            : isListening
            ? 'Передать ответ ИИ'
            : 'Микрофон'
        }
        className={`relative z-10 w-28 h-28 rounded-full flex flex-col items-center justify-center shadow-xl transition-all duration-300 transform active:scale-95 ${
          isAiSpeaking
            ? 'bg-gradient-to-tr from-rose-100 via-rose-50 to-pink-100 border-2 border-rose-300/80 text-rose-700 shadow-rose-200/50 hover:shadow-rose-300/80 ring-4 ring-rose-100/60'
            : isListening
            ? 'bg-gradient-to-tr from-emerald-100 via-emerald-50 to-teal-100 border-2 border-emerald-400 text-emerald-800 shadow-emerald-200/60 ring-4 ring-emerald-100/60'
            : isConnecting
            ? 'bg-amber-50 border-2 border-amber-300 text-amber-700 animate-pulse'
            : isError
            ? 'bg-red-50 border-2 border-red-300 text-red-700'
            : 'bg-white/80 border-2 border-slate-200 text-slate-600'
        }`}
      >
        {isConnecting && <Loader2 className="w-10 h-10 animate-spin text-amber-600" />}
        {isAiSpeaking && (
          <>
            <Volume2 className="w-10 h-10 text-rose-600 animate-bounce" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 mt-1">
              Прервать
            </span>
          </>
        )}
        {isListening && (
          <>
            <Mic className="w-10 h-10 text-emerald-700" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 mt-1">
              Говорите
            </span>
          </>
        )}
        {state === 'IDLE' && <Sparkles className="w-10 h-10 text-slate-400" />}
        {isError && <MicOff className="w-10 h-10 text-red-500" />}
      </button>

      {/* Mute Accessory Pill */}
      {isListening && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleMute();
          }}
          className={`mt-4 px-3 py-1 rounded-full text-xs font-semibold border flex items-center gap-1.5 transition-all ${
            isMuted
              ? 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'
              : 'bg-white/90 border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          {isMuted ? <MicOff className="w-3.5 h-3.5 text-red-600" /> : <Mic className="w-3.5 h-3.5 text-emerald-600" />}
          <span>{isMuted ? 'Микрофон выключен' : 'Отключить звук'}</span>
        </button>
      )}
    </div>
  );
};
