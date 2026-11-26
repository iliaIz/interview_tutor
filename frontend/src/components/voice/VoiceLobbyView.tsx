import React from 'react';
import { Sparkles, FastForward, Play, Loader2 } from 'lucide-react';
import { InterviewConfig } from '../../types/interviewConfig';
import { PersonaSelector } from '../PersonaSelector';
import { AudioPlayoutManager } from '../../services/AudioPlayoutManager';
import { VoiceLobbyHero } from './lobby/VoiceLobbyHero';
import { VoiceLobbyModeSwitches } from './lobby/VoiceLobbyModeSwitches';

export interface VoiceLobbyViewProps {
  interviewConfig: InterviewConfig;
  handleConfigChange: (config: InterviewConfig) => void;
  isBatchMode: boolean;
  totalQuestions: number;
  speechCoachingMode: 'adaptive' | 'always' | 'off';
  updateSpeechCoachingMode: (mode: 'adaptive' | 'always' | 'off') => void;
  canResumeSession: boolean;
  activeBatchSession: any;
  handleResumeSession: () => void;
  handleStartFresh: () => void;
  startLiveInterview: () => void;
  systemHealth: { isAiReady: boolean };
}

export const VoiceLobbyView: React.FC<VoiceLobbyViewProps> = ({
  interviewConfig,
  handleConfigChange,
  isBatchMode,
  totalQuestions,
  speechCoachingMode,
  updateSpeechCoachingMode,
  canResumeSession,
  activeBatchSession,
  handleResumeSession,
  handleStartFresh,
  startLiveInterview,
  systemHealth
}) => {
  return (
    <div className="my-6 flex flex-col items-center justify-center text-center space-y-5">
      <VoiceLobbyHero
        interviewConfig={interviewConfig}
        isBatchMode={isBatchMode}
        totalQuestions={totalQuestions}
      />

      <VoiceLobbyModeSwitches
        interviewConfig={interviewConfig}
        handleConfigChange={handleConfigChange}
        speechCoachingMode={speechCoachingMode}
        updateSpeechCoachingMode={updateSpeechCoachingMode}
      />

      {/* FAANG Persona & Grade Calibration Selector */}
      <PersonaSelector
        selectedPersona={interviewConfig.persona || 'mentor'}
        selectedGrade={interviewConfig.targetGrade || 'L5_SENIOR'}
        selectedVoice={interviewConfig.voice}
        onSelectPersona={(p) => {
          handleConfigChange({
            ...interviewConfig,
            persona: p
          });
        }}
        onSelectGrade={(g) => {
          handleConfigChange({
            ...interviewConfig,
            targetGrade: g
          });
        }}
      />

      {/* Resume Session Card (if unfinished session exists) */}
      {canResumeSession && activeBatchSession && (
        <div className="w-full max-w-sm p-3.5 rounded-2xl bg-gradient-to-r from-pastel-accentViolet/15 via-white to-pastel-accentRose/15 border border-pastel-accentViolet/40 shadow-xs space-y-2 text-left animate-fadeIn">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-pastel-accentViolet animate-bounce" />
              <span className="text-xs font-bold text-pastel-text">
                Сохраненная сессия
              </span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pastel-accentViolet text-white">
              {Object.keys(activeBatchSession.results || {}).length} из {activeBatchSession.questions?.length || totalQuestions} пройдено
            </span>
          </div>
          <p className="text-[11px] text-pastel-muted leading-tight">
            Хотите продолжить с сохраненными баллами или начать заново?
          </p>
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                AudioPlayoutManager.warmup();
                handleResumeSession();
              }}
              className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet text-white font-bold text-xs shadow-xs hover:opacity-95 transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <FastForward className="w-3.5 h-3.5" />
              <span>Продолжить (#{Math.min(activeBatchSession.currentIndex + 1, totalQuestions)})</span>
            </button>
            <button
              type="button"
              onClick={handleStartFresh}
              className="py-2 px-3 rounded-xl bg-white hover:bg-slate-100 border border-pastel-border text-pastel-sub hover:text-pastel-text text-xs font-semibold transition cursor-pointer"
              title="Очистить чекпоинт и начать с вопроса #1"
            >
              С нуля
            </button>
          </div>
        </div>
      )}

      {/* Action Button: START */}
      <div className="w-full max-w-sm space-y-2.5">
        <button
          type="button"
          onClick={() => {
            AudioPlayoutManager.warmup();
            startLiveInterview();
          }}
          disabled={!systemHealth.isAiReady}
          className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-pastel-accentRose via-pink-500 to-pastel-accentViolet text-white font-bold text-sm hover:scale-[1.02] active:scale-[0.98] transition shadow-lg shadow-pink-200 flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50"
        >
          {!systemHealth.isAiReady ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Инициализация AI Шлюза...</span>
            </>
          ) : (
            <>
              <Play className="w-5 h-5 fill-current" />
              <span>
                {isBatchMode
                  ? `Начать собеседование (${totalQuestions} вопр.)`
                  : 'Начать собеседование'}
              </span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
