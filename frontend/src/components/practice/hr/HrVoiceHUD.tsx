import React from 'react';
import { useHrSimulatorStore } from '../../../store/useHrSimulatorStore';
import { HrAnchorCardsGrid } from './HrAnchorCardsGrid';
import { HrPacingTimerBar } from './HrPacingTimerBar';
import { HrTelemetryDashboard } from './HrTelemetryDashboard';
import { 
  PhoneOff, 
  Radio, 
  Mic, 
  MicOff, 
  Volume2, 
  ShieldAlert, 
  HeartHandshake, 
  Search,
  Sparkles
} from 'lucide-react';

export interface HrVoiceHUDProps {
  isConnected: boolean;
  isAiSpeaking: boolean;
  isRecording: boolean;
  isUserSpeaking: boolean;
  isPauseHolding: boolean;
  statusMessage: string;
  onCentralClick: () => void;
  onDisconnect: () => void;
}

const PERSONA_CONFIGS: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  friendly_sourcer: {
    label: 'Елена (Сорсер)',
    icon: HeartHandshake,
    color: 'text-pink-600 bg-pink-50 border-pink-200'
  },
  bank_compliance_officer: {
    label: 'Виктория (Комплаенс)',
    icon: ShieldAlert,
    color: 'text-amber-700 bg-amber-50 border-amber-200'
  },
  behavioral_conflict_hunter: {
    label: 'Дарья (STAR Lead)',
    icon: Search,
    color: 'text-purple-700 bg-purple-50 border-purple-200'
  }
};

export const HrVoiceHUD: React.FC<HrVoiceHUDProps> = ({
  isConnected,
  isAiSpeaking,
  isRecording,
  isUserSpeaking,
  isPauseHolding,
  statusMessage,
  onCentralClick,
  onDisconnect
}) => {
  const personaId = useHrSimulatorStore((state) => state.personaId);
  const mode = useHrSimulatorStore((state) => state.mode);
  const liveTranscript = useHrSimulatorStore((state) => state.liveCandidateTranscript);

  const persona = PERSONA_CONFIGS[personaId] || PERSONA_CONFIGS.friendly_sourcer;
  const PersonaIcon = persona.icon;

  return (
    <div className="flex flex-col gap-4 p-5 rounded-2xl bg-gradient-to-b from-[#FFF0F5]/90 via-white to-pastel-lavender/25 border border-pastel-accentRose/30 shadow-sm relative overflow-hidden">
      {/* Background Pulse Aura */}
      <div
        className={`absolute -top-14 -right-14 w-48 h-48 rounded-full blur-3xl transition-opacity duration-700 pointer-events-none ${
          isAiSpeaking
            ? 'bg-rose-400/30 opacity-100 animate-pulse'
            : isPauseHolding
            ? 'bg-amber-400/30 opacity-100 animate-pulse'
            : isUserSpeaking
            ? 'bg-emerald-500/35 opacity-100 animate-pulse'
            : isRecording
            ? 'bg-emerald-400/20 opacity-80'
            : 'bg-slate-300/20 opacity-40'
        }`}
      />

      {/* Top Header Bar */}
      <div className="flex items-center justify-between z-10 gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Persona Badge */}
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border shadow-2xs ${persona.color}`}>
            <PersonaIcon className="w-3.5 h-3.5" />
            <span>{persona.label}</span>
          </div>

          {/* Mode Pill */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-slate-200 text-xs font-semibold text-slate-600 shadow-2xs">
            <Radio className="w-3 h-3 text-pastel-accentRose animate-pulse" />
            <span>{mode === 'full_screening_simulation' ? 'Полный скрининг' : 'Микро-дрилл (75с)'}</span>
          </div>
        </div>

        {/* Disconnect Button */}
        <button
          onClick={onDisconnect}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-rose-600 px-3 py-1.5 rounded-xl hover:bg-rose-50 transition cursor-pointer"
          title="Завершить симуляцию"
        >
          <PhoneOff className="w-3.5 h-3.5" />
          <span>Завершить</span>
        </button>
      </div>

      {/* Tactile Barge-In Center Circle */}
      <div className="relative my-2 flex flex-col items-center">
        <button
          onClick={onCentralClick}
          className={`w-28 h-28 rounded-full flex flex-col items-center justify-center transition-all duration-300 shadow-lg cursor-pointer transform active:scale-95 z-10 ${
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
              ? 'Нажмите для тактильного перебивания ИИ (Barge-In)'
              : 'Микрофон активен. Говорите свободно.'
          }
        >
          {isAiSpeaking ? (
            <>
              <Volume2 className="w-8 h-8 animate-bounce mb-1" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Перебить</span>
            </>
          ) : isUserSpeaking ? (
            <>
              <Mic className="w-8 h-8 animate-pulse mb-1" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Слушаю...</span>
            </>
          ) : isRecording ? (
            <>
              <Mic className="w-8 h-8 mb-1" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Говорите</span>
            </>
          ) : (
            <>
              <MicOff className="w-8 h-8 mb-1 text-slate-300" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Ожидание</span>
            </>
          )}
        </button>

        {/* Status Message */}
        <div className="mt-3 text-xs font-semibold text-slate-600 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-pastel-accentRose" />
          <span>{statusMessage || (isAiSpeaking ? 'ИИ задает вопрос...' : 'Озвучьте ответ с ключевыми фактами')}</span>
        </div>

        {/* Live Transcript Subtitles */}
        {liveTranscript && (
          <div className="mt-2 max-w-lg text-center text-xs text-slate-500 italic bg-white/70 px-3 py-1.5 rounded-lg border border-slate-100">
            «{liveTranscript.slice(-100)}»
          </div>
        )}
      </div>

      {/* Pacing SLA Bar */}
      <HrPacingTimerBar />

      {/* Zero-Latency KWS Anchor Cards Grid */}
      <HrAnchorCardsGrid />

      {/* Telemetry Dashboard (WPM, Hesitation, Fillers) */}
      <HrTelemetryDashboard />
    </div>
  );
};
