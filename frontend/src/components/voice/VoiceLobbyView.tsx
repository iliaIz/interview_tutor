import React from 'react';
import {
  Mic,
  GraduationCap,
  ShieldCheck,
  Microscope,
  Activity,
  Sparkles,
  FastForward,
  Play,
  Loader2,
  Settings2,
  Volume2,
  Zap,
  Scale
} from 'lucide-react';
import { InterviewConfig } from '../../types/interviewConfig';
import { PersonaSelector } from '../PersonaSelector';
import { FAANG_PERSONAS, TARGET_GRADES } from '../../types/personas';
import { AudioPlayoutManager } from '../../services/AudioPlayoutManager';

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
  setIsSettingsOpen: (open: boolean) => void;
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
  systemHealth,
  setIsSettingsOpen
}) => {
  return (
    <div className="my-6 flex flex-col items-center justify-center text-center space-y-5">
      <div className="relative">
        <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-pastel-accentRose via-pink-400 to-pastel-accentViolet p-1 shadow-xl flex items-center justify-center animate-pulse">
          <div className="w-full h-full rounded-full bg-white flex items-center justify-center text-3xl">
            {interviewConfig.persona === 'amazon_bar_raiser'
              ? '📦'
              : interviewConfig.persona === 'google_staff'
              ? '🔍'
              : interviewConfig.persona === 'yandex_core'
              ? '🔴'
              : (interviewConfig.strategy === 'socratic_tutoring' ? '🌸' : '👩‍💻')}
          </div>
        </div>
        <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white p-1.5 rounded-full border-2 border-white shadow-xs">
          <Mic className="w-4 h-4" />
        </div>
      </div>

      <div className="max-w-md space-y-1.5 px-2">
        <h4 className="font-bold text-pastel-text text-base">
          {isBatchMode
            ? `Готовы пройти серию из ${totalQuestions} вопросов?`
            : `${FAANG_PERSONAS[interviewConfig.persona || 'mentor']?.name || 'ИИ-интервьюер'} готов к диалогу`}
        </h4>
        <p className="text-xs text-pastel-muted leading-relaxed">
          {isBatchMode
            ? 'Режим "Без рук" (Hands-Free): ИИ последовательно задаст каждый вопрос темы, оценит ваши ответы и сам переведет к следующему.'
            : (interviewConfig.persona && interviewConfig.persona !== 'mentor')
            ? `Официальная симуляция найма BigTech (${FAANG_PERSONAS[interviewConfig.persona].company}). Оценивает грейд ${TARGET_GRADES[interviewConfig.targetGrade || 'L5_SENIOR']?.badge}.`
            : 'Интервьюер поздоровается голосом и зачитает вопрос. Вы можете отвечать своими словами и уточнять детали.'}
        </p>

        <div className="pt-1 flex flex-wrap items-center justify-center gap-2">
          {/* Turn Mode Pill */}
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] font-bold shadow-2xs ${
            (interviewConfig.turnMode || 'manual') === 'auto'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
              : 'bg-amber-50 text-amber-800 border-amber-300'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${
              (interviewConfig.turnMode || 'manual') === 'auto' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
            }`} />
            <span>{(interviewConfig.turnMode || 'manual') === 'auto' ? '⚡ Авто-VAD' : '✋ По очереди'}</span>
          </span>

          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-pastel-card border border-pastel-border text-[11px] font-semibold text-pastel-text shadow-2xs">
            {interviewConfig.strategy === 'socratic_tutoring' ? (
              <GraduationCap className="w-3.5 h-3.5 text-pastel-accentRose" />
            ) : (
              <ShieldCheck className="w-3.5 h-3.5 text-pastel-accentViolet" />
            )}
            <span>
              {FAANG_PERSONAS[interviewConfig.persona || 'mentor']?.badge || 'Ментор'} • {interviewConfig.voice}
            </span>
          </span>

          {/* Language Switcher (RU / EN) */}
          <div className="flex items-center gap-1 bg-white/90 p-1 rounded-2xl border border-pastel-border shadow-2xs">
            <button
              type="button"
              onClick={() => handleConfigChange({ ...interviewConfig, language: 'ru' })}
              className={`px-2 py-0.5 rounded-xl text-[10px] font-bold transition-all cursor-pointer ${
                interviewConfig.language !== 'en'
                  ? 'bg-pastel-accentViolet text-white shadow-2xs'
                  : 'text-pastel-muted hover:text-pastel-text'
              }`}
            >
              🇷🇺 RU
            </button>
            <button
              type="button"
              onClick={() => handleConfigChange({ ...interviewConfig, language: 'en' })}
              className={`px-2 py-0.5 rounded-xl text-[10px] font-bold transition-all cursor-pointer ${
                interviewConfig.language === 'en'
                  ? 'bg-pastel-accentRose text-white shadow-2xs'
                  : 'text-pastel-muted hover:text-pastel-text'
              }`}
            >
              🇬🇧 EN
            </button>
          </div>

          <button
            type="button"
            onClick={() => handleConfigChange({ ...interviewConfig, deepDive: !interviewConfig.deepDive })}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer border ${
              interviewConfig.deepDive
                ? 'bg-gradient-to-r from-pastel-accentRose/20 to-pastel-accentViolet/20 border-pastel-accentViolet text-pastel-accentViolet shadow-2xs'
                : 'bg-white/80 hover:bg-slate-100 border-slate-200 text-slate-400'
            }`}
            title="Кликните для переключения глубокого зондирования"
          >
            <Microscope className="w-3.5 h-3.5" />
            <span>🔬 Deep-Dive</span>
          </button>

          <button
            type="button"
            onClick={() => handleConfigChange({ ...interviewConfig, liveCoaching: !interviewConfig.liveCoaching })}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer border ${
              interviewConfig.liveCoaching
                ? 'bg-emerald-50 border-emerald-400 text-emerald-700 shadow-2xs'
                : 'bg-white/80 hover:bg-slate-100 border-slate-200 text-slate-400'
            }`}
            title="Кликните для переключения обучения на лету"
          >
            <GraduationCap className="w-3.5 h-3.5" />
            <span>🎓 Обучение</span>
          </button>

          {/* Speech Coach Mode Selector */}
          <div className="flex items-center gap-1 bg-white/90 p-1 rounded-2xl border border-pastel-border shadow-2xs">
            <span className="text-[10px] font-bold text-pastel-muted pl-2 pr-1 flex items-center gap-1">
              <Activity className="w-3 h-3 text-pastel-accentRose" />
              Коучинг:
            </span>
            <button
              type="button"
              onClick={() => updateSpeechCoachingMode('adaptive')}
              className={`px-2 py-0.5 rounded-xl text-[10px] font-bold transition-all cursor-pointer ${
                speechCoachingMode === 'adaptive'
                  ? 'bg-pastel-accentViolet text-white shadow-2xs'
                  : 'text-pastel-muted hover:text-pastel-text'
              }`}
              title="Умный режим: STAR для опыта/аварий, PREP для компромиссов, Rule of 3 для теории"
            >
              ✨ Адаптивный
            </button>
            <button
              type="button"
              onClick={() => updateSpeechCoachingMode('always')}
              className={`px-2 py-0.5 rounded-xl text-[10px] font-bold transition-all cursor-pointer ${
                speechCoachingMode === 'always'
                  ? 'bg-pastel-accentRose text-white shadow-2xs'
                  : 'text-pastel-muted hover:text-pastel-text'
              }`}
              title="Принудительный STAR/PREP тренажер на всех вопросах"
            >
              🎯 Всегда STAR
            </button>
            <button
              type="button"
              onClick={() => updateSpeechCoachingMode('off')}
              className={`px-2 py-0.5 rounded-xl text-[10px] font-bold transition-all cursor-pointer ${
                speechCoachingMode === 'off'
                  ? 'bg-slate-300 text-slate-700'
                  : 'text-pastel-muted hover:text-pastel-text'
              }`}
              title="Отключить речевой анализ"
            >
              Выкл
            </button>
          </div>

          {/* 3-Tier Calibration Spectrum (Strictness Level) */}
          <div className="flex items-center gap-1 bg-white/90 p-1 rounded-2xl border border-pastel-border shadow-2xs">
            <span className="text-[10px] font-bold text-pastel-muted pl-2 pr-1 flex items-center gap-1">
              <Scale className="w-3 h-3 text-pastel-accentViolet" />
              Строгость:
            </span>
            <button
              type="button"
              onClick={() => handleConfigChange({ ...interviewConfig, strictness: 'learning' })}
              className={`px-2 py-0.5 rounded-xl text-[10px] font-bold transition-all cursor-pointer ${
                interviewConfig.strictness === 'learning'
                  ? 'bg-emerald-500 text-white shadow-2xs font-extrabold'
                  : 'text-pastel-muted hover:text-pastel-text'
              }`}
              title="🟢 Обучение: подсказки и поддержка без давления, акцент на понимание сути"
            >
              🟢 Обучение
            </button>
            <button
              type="button"
              onClick={() => handleConfigChange({ ...interviewConfig, strictness: 'standard' })}
              className={`px-2 py-0.5 rounded-xl text-[10px] font-bold transition-all cursor-pointer ${
                (!interviewConfig.strictness || interviewConfig.strictness === 'standard')
                  ? 'bg-amber-500 text-white shadow-2xs font-extrabold'
                  : 'text-pastel-muted hover:text-pastel-text'
              }`}
              title="🟡 Собеседование L5: объективная проверка без поддакивания, иммунитет к поверхностным оговоркам"
            >
              🟡 L5
            </button>
            <button
              type="button"
              onClick={() => handleConfigChange({ ...interviewConfig, strictness: 'hardcore' })}
              className={`px-2 py-0.5 rounded-xl text-[10px] font-bold transition-all cursor-pointer ${
                interviewConfig.strictness === 'hardcore'
                  ? 'bg-rose-500 text-white shadow-2xs font-extrabold'
                  : 'text-pastel-muted hover:text-pastel-text'
              }`}
              title="🔴 Bar-Raiser L6: бескомпромиссная проверка крайних случаев, архитектурных компромиссов и контрактов"
            >
              🔴 L6 Bar-Raiser
            </button>
          </div>
        </div>
      </div>

      {/* FAANG Persona & Grade Calibration Selector */}
      <PersonaSelector
        selectedPersona={interviewConfig.persona || 'mentor'}
        selectedGrade={interviewConfig.targetGrade || 'L5_SENIOR'}
        selectedVoice={interviewConfig.voice}
        onSelectPersona={(p, recommendedVoice) => {
          handleConfigChange({
            ...interviewConfig,
            persona: p,
            voice: recommendedVoice || interviewConfig.voice
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

      {/* Action Buttons: START + SETTINGS */}
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

        <button
          type="button"
          onClick={() => setIsSettingsOpen(true)}
          className="w-full py-2.5 px-4 rounded-2xl bg-white hover:bg-pastel-card border border-pastel-border text-pastel-text text-xs font-semibold transition flex items-center justify-center gap-2 cursor-pointer shadow-2xs hover:border-pastel-accentViolet/50 group"
        >
          <Settings2 className="w-4 h-4 text-pastel-accentViolet group-hover:rotate-45 transition-transform" />
          <span>⚙️ Все настройки (Режим, голос, стратегия, VAD)</span>
        </button>
      </div>
    </div>
  );
};
