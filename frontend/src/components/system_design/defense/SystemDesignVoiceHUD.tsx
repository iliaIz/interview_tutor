import React from 'react';
import { 
  Radio, PhoneOff, Mic, MicOff, AlertOctagon, CheckCircle2, 
  Sparkles, ShieldAlert, Cpu, Send, Volume2, ShieldCheck, Flame
} from 'lucide-react';

interface SystemDesignVoiceHUDProps {
  isConnected: boolean;
  isAiSpeaking: boolean;
  isRecording: boolean;
  isMuted: boolean;
  statusMessage: string;
  chaosAlert: { failureType: string; targetId: string; context: string } | null;
  observationCount: number;
  onDismissChaos: () => void;
  onToggleMic: () => void;
  onFinishTurn: () => void;
  onDisconnect: () => void;
  onBargeIn: () => void;
}

export const SystemDesignVoiceHUD: React.FC<SystemDesignVoiceHUDProps> = ({
  isConnected,
  isAiSpeaking,
  isRecording,
  isMuted,
  statusMessage,
  chaosAlert,
  observationCount,
  onDismissChaos,
  onToggleMic,
  onFinishTurn,
  onDisconnect,
  onBargeIn
}) => {
  if (!isConnected) return null;

  return (
    <div className="flex flex-col gap-2 w-full max-w-4xl mx-auto animate-fade-in font-sans">
      {/* 1. Chaos Monkey Alert Banner (if chaos injected by Bar-Raiser) */}
      {chaosAlert && (
        <div className="flex items-center justify-between p-3 rounded-2xl bg-gradient-to-r from-rose-500 via-pink-600 to-amber-600 text-white shadow-lg border border-white/20 animate-bounce-short">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <Flame className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-white/20">
                  🔥 Chaos Monkey Injection
                </span>
                <span className="text-xs font-bold font-mono">[{chaosAlert.failureType}]</span>
              </div>
              <p className="text-xs text-white/90 leading-tight mt-0.5">
                Целевой узел: <strong className="underline">{chaosAlert.targetId}</strong>. {chaosAlert.context}
              </p>
            </div>
          </div>

          <button
            onClick={onDismissChaos}
            className="text-xs px-2.5 py-1 rounded-lg bg-white/20 hover:bg-white/30 transition text-white shrink-0 ml-2 font-bold cursor-pointer"
          >
            Понятно
          </button>
        </div>
      )}

      {/* 2. Main Voice Interaction Strip */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 sm:px-4 sm:py-2.5 rounded-2xl bg-white/95 dark:bg-slate-900/95 border border-pastel-accentRose/40 shadow-md backdrop-blur-md relative overflow-hidden">
        {/* Soft luxury aura glow */}
        <div 
          className={`absolute -top-10 -right-10 w-32 h-32 rounded-full blur-2xl pointer-events-none transition-opacity duration-700 ${
            isAiSpeaking ? 'bg-purple-500/25 opacity-100 animate-pulse' : isRecording ? 'bg-emerald-400/25 opacity-100' : 'opacity-0'
          }`} 
        />

        {/* Left: Radio Pill & Status */}
        <div className="flex items-center gap-3 min-w-0 w-full sm:w-auto">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-800 text-[11px] font-bold text-purple-700 dark:text-purple-300 shrink-0 shadow-2xs">
            <Radio className="w-3.5 h-3.5 text-purple-600 animate-pulse" />
            <span className="hidden sm:inline">Live Bar-Raiser Defense</span>
            <span className="sm:hidden">Bar-Raiser</span>
          </div>

          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">
              {statusMessage}
            </span>
          </div>

          {observationCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold font-mono shrink-0 hidden md:inline-flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-600" />
              <span>{observationCount} signals</span>
            </span>
          )}
        </div>

        {/* Right: Audio Playout Controls & Turn Handshake */}
        <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
          {/* Tactile Barge-In / Mute button */}
          {isAiSpeaking ? (
            <button
              onClick={onBargeIn}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-100 hover:bg-purple-200 text-purple-800 text-xs font-bold transition cursor-pointer active:scale-95"
              title="Перебить ответ (Barge-in)"
            >
              <Volume2 className="w-3.5 h-3.5 text-purple-600 animate-bounce" />
              <span>Перебить</span>
            </button>
          ) : (
            <button
              onClick={onToggleMic}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer active:scale-95 ${
                isRecording 
                  ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-300' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {isRecording ? <Mic className="w-3.5 h-3.5 text-emerald-600 animate-pulse" /> : <MicOff className="w-3.5 h-3.5 text-slate-400" />}
              <span>{isRecording ? 'Микрофон вкл' : 'Микрофон выкл'}</span>
            </button>
          )}

          {/* Symmetrical Dual-Sided Handshake Turn Finisher */}
          <button
            onClick={onFinishTurn}
            disabled={isAiSpeaking}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-pastel-accentViolet hover:from-purple-700 hover:to-purple-800 text-white text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-40 active:scale-95 touch-manipulation"
            title="Завершить ход и передать слово Bar-Raiser"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Закончить мысль</span>
          </button>

          {/* Disconnect button */}
          <button
            onClick={onDisconnect}
            className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
            title="Завершить голосовую защиту"
          >
            <PhoneOff className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
