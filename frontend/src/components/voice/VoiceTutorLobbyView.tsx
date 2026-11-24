/**
 * VoiceTutorLobbyView.tsx
 * Initial lobby presentation for Voice Tutor session.
 * Cognitive Bounding Limit: <= 120 lines.
 */

import React from 'react';
import { Play, Mic, Settings2, Loader2 } from 'lucide-react';
import { InterviewConfig } from '../../types/interviewConfig';
import { VOICE_DEFAULTS } from '../../config/voiceDefaults';

export interface VoiceTutorLobbyViewProps {
  tutorMode: 'deep_dive' | 'socratic' | 'eli5' | 'free_chat';
  setTutorMode: (mode: 'deep_dive' | 'socratic' | 'eli5' | 'free_chat') => void;
  startLiveInterview: () => void;
  systemHealth: { isAiReady: boolean };
  setIsSettingsOpen: (open: boolean) => void;
  interviewConfig: InterviewConfig;
}

export const VoiceTutorLobbyView: React.FC<VoiceTutorLobbyViewProps> = ({
  tutorMode,
  setTutorMode,
  startLiveInterview,
  systemHealth,
  setIsSettingsOpen,
  interviewConfig
}) => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 p-2">
      <div className="relative">
        <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-pastel-accentRose via-pink-400 to-pastel-accentViolet p-1 shadow-xl flex items-center justify-center animate-pulse">
          <div className="w-full h-full rounded-full bg-white flex items-center justify-center text-3xl">
            🧠
          </div>
        </div>
        <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white p-1 rounded-full border-2 border-white shadow-xs">
          <Mic className="w-3.5 h-3.5" />
        </div>
      </div>

      <div className="space-y-1">
        <h4 className="font-bold text-pastel-text text-sm">
          Голосовой AI-Тьютор готов к разбору
        </h4>
        <p className="text-xs text-pastel-muted leading-relaxed max-w-xs">
          Задавайте любые вопросы по коду и теории слева. ИИ детально объяснит физику процессов под капотом.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
        {[
          { id: 'deep_dive' as const, label: '🔬 Под капот' },
          { id: 'socratic' as const, label: '🤔 Сократ' },
          { id: 'eli5' as const, label: '💡 ELI5' },
          { id: 'free_chat' as const, label: '💬 Свободный' }
        ].map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setTutorMode(m.id)}
            className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all cursor-pointer border ${
              tutorMode === m.id
                ? 'bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet text-white border-transparent shadow-xs'
                : 'bg-white/80 hover:bg-slate-100 border-slate-200 text-slate-600'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="w-full max-w-xs space-y-2 pt-2">
        <button
          type="button"
          onClick={startLiveInterview}
          disabled={!systemHealth.isAiReady}
          className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-pastel-accentRose via-pink-500 to-pastel-accentViolet text-white font-bold text-xs hover:scale-[1.02] active:scale-[0.98] transition shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
        >
          {!systemHealth.isAiReady ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Инициализация AI Шлюза...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current" />
              <span>Начать голосовой разбор</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={() => setIsSettingsOpen(true)}
          className="w-full py-2 px-3 rounded-2xl bg-white hover:bg-pastel-card border border-pastel-border text-pastel-text text-[11px] font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs hover:border-pastel-accentViolet/50 group"
        >
          <Settings2 className="w-3.5 h-3.5 text-pastel-accentViolet group-hover:rotate-45 transition-transform" />
          <span>⚙️ Все настройки (Голос: {interviewConfig.voice || VOICE_DEFAULTS.voice})</span>
        </button>
      </div>
    </div>
  );
};
