import React from 'react';
import { useHrSimulatorStore } from '../../../store/useHrSimulatorStore';
import { useInterviewConfig } from '../../../hooks/useInterviewConfig';
import { VOICE_DEFAULTS } from '../../../config/voiceDefaults';
import { HrAnchorCardsGrid } from './HrAnchorCardsGrid';
import { HrPacingTimerBar } from './HrPacingTimerBar';
import { HrTelemetryDashboard } from './HrTelemetryDashboard';
import { HrGuidedLadderBar } from './HrGuidedLadderBar';
import { HrLiveSubtitleCard } from './HrLiveSubtitleCard';
import { HrStepControlAction } from '@interview-prep/shared';
import { 
  PhoneOff, 
  Radio, 
  Mic, 
  MicOff, 
  Volume2, 
  ShieldAlert, 
  HeartHandshake, 
  Search,
  Sparkles,
  GraduationCap
} from 'lucide-react';

export interface HrVoiceHUDProps {
  isConnected: boolean;
  isAiSpeaking: boolean;
  isRecording: boolean;
  isUserSpeaking: boolean;
  isPauseHolding: boolean;
  statusMessage: string;
  dialogueTurns?: Array<{ id?: string; role: 'ai' | 'user' | 'system'; text: string }>;
  onStepControl?: (action: HrStepControlAction, extra?: { beatIndex?: number; cueVisible?: boolean }) => void;
  onCentralClick: () => void;
  onDisconnect: () => void;
}

const PERSONA_CONFIGS: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  mentor_coach: {
    label: 'Ольга (Коуч)',
    icon: GraduationCap,
    color: 'text-purple-700 bg-purple-50 border-purple-200'
  },
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
  dialogueTurns = [],
  onStepControl,
  onCentralClick,
  onDisconnect
}) => {
  const personaId = useHrSimulatorStore((state) => state.personaId);
  const mode = useHrSimulatorStore((state) => state.mode);
  const activeQuestion = useHrSimulatorStore((state) => state.activeQuestion);
  const guidedStepState = useHrSimulatorStore((state) => state.guidedStepState);
  const masteredBeatsByQuestion = useHrSimulatorStore((state) => state.masteredBeatsByQuestion);
  const liveTranscript = useHrSimulatorStore((state) => state.liveCandidateTranscript);
  const { config: interviewConfig } = useInterviewConfig();
  const isManualMode = (interviewConfig.turnMode || VOICE_DEFAULTS.turnMode) === 'manual';
  const activeVoice = interviewConfig.voice || VOICE_DEFAULTS.voice;

  const lastAiTurn = [...dialogueTurns].reverse().find((t) => t.role === 'ai');
  const activeBeatIds = (activeQuestion?.microBeats || []).map((b) => b.id);
  const masteredIdsForQ = activeQuestion ? masteredBeatsByQuestion[activeQuestion.id] || [] : [];

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
            <span>
              {mode === 'full_screening_simulation'
                ? 'Полный скрининг'
                : mode === 'guided_zero_start'
                ? 'С нуля (Повтор)'
                : mode === 'tutor_rehearsal'
                ? 'Репетиция'
                : 'Микро-дрилл (75с)'}{' '}
              • {activeVoice} • {isManualMode ? 'По кнопке' : 'Авто-VAD'}
            </span>
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
              : isManualMode
              ? 'Нажмите, чтобы завершить ответ и отправить его ИИ'
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

      {/* Spec 40 Guided Micro-Chunk Ladder Bar */}
      {mode === 'guided_zero_start' && guidedStepState && onStepControl && (
        <HrGuidedLadderBar
          stepState={guidedStepState}
          beatIds={activeBeatIds}
          masteredBeatIds={masteredIdsForQ}
          onStepControl={onStepControl}
        />
      )}

      {/* Pacing SLA Bar (Hidden during zero-start micro-chunks for calm pacing) */}
      {mode !== 'guided_zero_start' && <HrPacingTimerBar />}

      {/* Live AI Subtitle + Toggleable Micro-Beat Cue Card */}
      {(mode === 'guided_zero_start' || mode === 'tutor_rehearsal') && (
        <HrLiveSubtitleCard
          lastAiText={lastAiTurn?.text}
          stepState={mode === 'guided_zero_start' ? guidedStepState : null}
          onPeekCue={
            onStepControl && guidedStepState
              ? () => onStepControl('toggle_cue', { cueVisible: true })
              : undefined
          }
        />
      )}

      {/* Zero-Latency KWS Anchor Cards Grid */}
      <HrAnchorCardsGrid />

      {/* Telemetry Dashboard (WPM, Hesitation, Fillers) */}
      <HrTelemetryDashboard />
    </div>
  );
};
