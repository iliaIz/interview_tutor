import React, { useState, useEffect, useRef } from 'react';
import { useLiveVoiceSession } from '../../../audio/useLiveVoiceSession';
import { ClientKeywordSpotter } from '../../../audio/ClientKeywordSpotter';
import { useHrSimulatorStore } from '../../../store/useHrSimulatorStore';
import { formatHrStartCtaLabel, resolveDisplayAnchors } from '../../../store/hrAnchorResolver';
import { useInterviewConfig } from '../../../hooks/useInterviewConfig';
import { VOICE_DEFAULTS } from '../../../config/voiceDefaults';
import { HrVoiceHUD } from './HrVoiceHUD';
import { HrScorecardModal } from './HrScorecardModal';
import { HrQuestionStudyDeck } from './HrQuestionStudyDeck';
import { HrQuestionSelector } from './HrQuestionSelector';
import { HrModeSelector } from './HrModeSelector';
import { HrScopeSelector } from './HrScopeSelector';
import { HrSessionMode, HrPersonaId, HrQuestionRubricItem, HrStepControlAction, HrBeatScope, HR_VOICE_EVENTS } from '@interview-prep/shared';
import {
  Play,
  Briefcase,
  UserCheck,
  Sparkles,
  BookOpen,
  Mic,
  List
} from 'lucide-react';

export const HrScreeningArena: React.FC = () => {
  const [mode, setMode] = useState<HrSessionMode>('tutor_rehearsal');
  const [personaId, setPersonaId] = useState<HrPersonaId>('mentor_coach');
  const [isCatalogOpenMobile, setIsCatalogOpenMobile] = useState(false);
  const { config: interviewConfig } = useInterviewConfig();
  const activeVoice = interviewConfig.voice || VOICE_DEFAULTS.voice;

  const activeTab = useHrSimulatorStore((state) => state.activeTab);
  const setActiveTab = useHrSimulatorStore((state) => state.setActiveTab);
  const activeQuestion = useHrSimulatorStore((state) => state.activeQuestion);
  const selectedChunkId = useHrSimulatorStore((state) => state.selectedChunkId);
  const setSelectedChunkId = useHrSimulatorStore((state) => state.setSelectedChunkId);
  const selectedStartBeatId = useHrSimulatorStore((state) => state.selectedStartBeatId);
  const setSelectedStartBeatId = useHrSimulatorStore((state) => state.setSelectedStartBeatId);
  const guidedBeatScope = useHrSimulatorStore((state) => state.guidedBeatScope);
  const setGuidedBeatScope = useHrSimulatorStore((state) => state.setGuidedBeatScope);
  const masteredBeatsByQuestion = useHrSimulatorStore((state) => state.masteredBeatsByQuestion);
  const fetchQuestions = useHrSimulatorStore((state) => state.fetchQuestions);
  const storeAnchorCards = useHrSimulatorStore((state) => state.anchorCards);
  const initializeSession = useHrSimulatorStore((state) => state.initializeSession);
  const registerFastKwsHit = useHrSimulatorStore((state) => state.registerFastKwsHit);

  const spotterRef = useRef<ClientKeywordSpotter | null>(null);

  const {
    state,
    vadActive,
    statusMessage,
    dialogueTurns,
    connect,
    disconnect,
    handleInteraction,
    sendCustomFrame
  } = useLiveVoiceSession();

  const isConnected = state !== 'IDLE' && state !== 'ERROR' && state !== 'COMPLETED';
  const isAiSpeaking = state === 'AI_SPEAKING';
  const isRecording = state === 'LISTENING';
  const isUserSpeaking = vadActive;
  const isPauseHolding = state === 'AI_THINKING' || state === 'COMMITTING';

  // Load questions catalog on mount
  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  // Keyword spotter lifecycle
  useEffect(() => {
    if (isConnected && isRecording) {
      if (!spotterRef.current) {
        spotterRef.current = new ClientKeywordSpotter({
          onAnchorHit: (anchorId: string, latencyMs: number) => {
            registerFastKwsHit(anchorId, latencyMs);
          }
        });
        spotterRef.current.start();
      }
      spotterRef.current.setAnchorCards(storeAnchorCards);
    } else {
      spotterRef.current?.stop();
      spotterRef.current = null;
    }

    return () => {
      spotterRef.current?.stop();
      spotterRef.current = null;
    };
  }, [isConnected, isRecording, storeAnchorCards, registerFastKwsHit]);

  const handleStartSimulation = async (
    targetQuestion?: HrQuestionRubricItem,
    overrideMode?: HrSessionMode,
    guidedOverrides?: { startBeatId?: string | null; beatScope?: HrBeatScope }
  ) => {
    const questionToRun = targetQuestion || activeQuestion;
    if (!questionToRun) return;

    const effectiveMode = overrideMode || mode;
    if (overrideMode && overrideMode !== mode) {
      setMode(overrideMode);
    }

    const effectiveScope: HrBeatScope = guidedOverrides?.beatScope ?? guidedBeatScope;
    const effectiveStartBeatId =
      guidedOverrides?.startBeatId !== undefined
        ? guidedOverrides.startBeatId
        : selectedStartBeatId;

    if (guidedOverrides?.beatScope) setGuidedBeatScope(guidedOverrides.beatScope);
    if (guidedOverrides?.startBeatId !== undefined) setSelectedStartBeatId(guidedOverrides.startBeatId);

    setActiveTab('voice');
    const isCoachMode = effectiveMode === 'tutor_rehearsal' || effectiveMode === 'guided_zero_start';
    const effectivePersona = isCoachMode ? 'mentor_coach' : personaId;
    if (isCoachMode && personaId !== 'mentor_coach') {
      setPersonaId('mentor_coach');
    }
    initializeSession(effectiveMode, effectivePersona, questionToRun, {
      startBeatId: effectiveStartBeatId,
      beatScope: effectiveScope
    });

    await connect({
      sessionType: isCoachMode
        ? 'hr_tutor'
        : effectiveMode === 'full_screening_simulation'
        ? 'hr_simulation'
        : 'hr_micro_drill',
      persona: effectivePersona,
      hrMode: effectiveMode,
      hrPersonaId: effectivePersona,
      dossierId: 'canonical_senior_java',
      jobId: 'fintech_highload_expansion',
      questionId: questionToRun.id,
      topic: questionToRun.title,
      questionText: questionToRun.canonicalQuestion,
      chunkId: effectiveMode === 'guided_zero_start' ? undefined : selectedChunkId || undefined,
      startBeatId: effectiveMode === 'guided_zero_start' ? effectiveStartBeatId || undefined : undefined,
      beatScope: effectiveMode === 'guided_zero_start' ? effectiveScope : undefined
    });
  };

  const handleStepControl = (
    action: HrStepControlAction,
    extra?: { beatIndex?: number; cueVisible?: boolean }
  ) => {
    sendCustomFrame({
      type: HR_VOICE_EVENTS.HR_STEP_CONTROL,
      payload: {
        action,
        beatIndex: extra?.beatIndex,
        cueVisible: extra?.cueVisible
      }
    });
  };

  return (
    <div className="h-[calc(100dvh-4rem)] w-full flex flex-col p-3 sm:p-4 md:p-6 bg-slate-50 overflow-hidden">
      {/* Top Controls Bar */}
      <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-slate-200 shrink-0 gap-3 flex-wrap">
        <div>
          <h1 className="text-base sm:text-lg md:text-xl font-bold text-slate-900 flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-pastel-accentRose" />
            Голосовой HR-симулятор &amp; Скрининг
          </h1>
          <p className="text-[11px] sm:text-xs text-slate-500">
            Обучение ответам с нуля: эталоны, ловушки, смысловые якоря и голосовой блиц
          </p>
        </div>

        {/* Studio Modality Tab Switcher ([📘 Эталон и разбор] vs [🎙️ Голосовой тренажер]) */}
        <div className="flex items-center gap-2">
          <div className="flex p-1 bg-white border border-slate-200 rounded-xl text-xs shadow-2xs">
            <button
              onClick={() => setActiveTab('study')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                activeTab === 'study'
                  ? 'bg-pastel-accentViolet text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Эталон и разбор</span>
            </button>
            <button
              onClick={() => setActiveTab('voice')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                activeTab === 'voice'
                  ? 'bg-pastel-accentRose text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Голосовая арена</span>
            </button>
          </div>

          {/* Persona & Mode Pickers (When in voice tab) */}
          {activeTab === 'voice' && !isConnected && (
            <HrModeSelector
              mode={mode}
              personaId={personaId}
              activeVoice={activeVoice}
              onSelectMode={setMode}
              onSelectPersona={setPersonaId}
            />
          )}

          {/* Mobile Catalog Drawer Toggle */}
          <button
            onClick={() => setIsCatalogOpenMobile(!isCatalogOpenMobile)}
            className="md:hidden p-2 rounded-xl bg-white border border-slate-200 text-slate-600"
            title="Каталог вопросов"
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Content Arena */}
      <div className="flex-1 min-h-0 pt-3 flex gap-4 overflow-hidden">
        {/* Desktop Left Sidebar: Question Matrix Catalog */}
        <aside className="hidden md:block w-72 lg:w-80 shrink-0 bg-white rounded-2xl border border-slate-200/90 p-3 overflow-y-auto shadow-2xs">
          <HrQuestionSelector />
        </aside>

        {/* Mobile Catalog Modal Overlay */}
        {isCatalogOpenMobile && (
          <div className="md:hidden fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs flex p-4">
            <div className="w-full max-w-sm bg-white rounded-2xl p-4 overflow-y-auto my-auto shadow-xl">
              <div className="flex justify-between items-center mb-3">
                <span className="font-bold text-sm text-slate-900">Каталог вопросов</span>
                <button
                  onClick={() => setIsCatalogOpenMobile(false)}
                  className="text-xs text-slate-400 font-bold px-2 py-1 rounded bg-slate-100"
                >
                  Закрыть
                </button>
              </div>
              <HrQuestionSelector onSelect={() => setIsCatalogOpenMobile(false)} />
            </div>
          </div>
        )}

        {/* Right Active Panel: Study Deck OR Voice Arena */}
        <main className="flex-1 min-w-0 overflow-y-auto px-1">
          {activeTab === 'study' ? (
            /* Tab 1: Pedagogical Worked-Example Study Deck */
            <HrQuestionStudyDeck
              onStartVoiceDrill={(overrideMode) =>
                handleStartSimulation(
                  undefined,
                  overrideMode,
                  overrideMode === 'guided_zero_start'
                    ? { startBeatId: null, beatScope: 'all_from_beat' }
                    : undefined
                )
              }
              onStartBeatVoice={(beatId) =>
                handleStartSimulation(undefined, 'guided_zero_start', {
                  startBeatId: beatId,
                  beatScope: 'single_beat'
                })
              }
            />
          ) : (
            /* Tab 2: Multimodal Voice Training Arena */
            <div className="w-full max-w-3xl mx-auto py-2">
              {!isConnected ? (
                /* Voice Lobby Card */
                <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center text-center">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-pink-100 to-rose-50 flex items-center justify-center text-pastel-accentRose mb-3 shadow-2xs">
                    <Sparkles className="w-7 h-7" />
                  </div>

                  <h2 className="text-base sm:text-lg font-bold text-slate-900 mb-1">
                    {activeQuestion?.title || 'Готовы к HR-созвону?'}
                  </h2>
                  <p className="text-xs text-slate-500 max-w-md mb-4 leading-relaxed">
                    «{activeQuestion?.canonicalQuestion || 'Расскажите о себе.'}»
                  </p>

                  <HrScopeSelector
                    mode={mode}
                    activeQuestion={activeQuestion}
                    selectedChunkId={selectedChunkId}
                    selectedStartBeatId={selectedStartBeatId}
                    guidedBeatScope={guidedBeatScope}
                    masteredBeatIds={activeQuestion ? masteredBeatsByQuestion[activeQuestion.id] || [] : []}
                    onSelectChunkId={setSelectedChunkId}
                    onSelectStartBeatId={setSelectedStartBeatId}
                    onSelectGuidedBeatScope={setGuidedBeatScope}
                  />

                  <div className="w-full bg-slate-50 p-3 rounded-xl border border-slate-200/80 mb-5 text-left">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
                      <Briefcase className="w-3 h-3 text-pastel-accentRose" />
                      Смысловые якоря ответа
                    </div>
                    <div className="flex flex-wrap gap-1.5 text-xs">
                      {resolveDisplayAnchors(
                        activeQuestion,
                        storeAnchorCards,
                        mode,
                        selectedStartBeatId,
                        guidedBeatScope
                      ).map((a) => (
                        <span
                          key={a.id}
                          className="px-2 py-0.5 rounded-md bg-white border border-slate-200 font-medium text-slate-700 text-[11px]"
                        >
                          {a.label}
                        </span>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => handleStartSimulation()}
                    className={`flex items-center gap-2 px-6 py-3 rounded-xl hover:opacity-90 text-white font-bold text-sm shadow-md transition transform active:scale-95 cursor-pointer ${
                      mode === 'guided_zero_start' ? 'bg-indigo-600' : 'bg-pastel-accentRose'
                    }`}
                  >
                    <Play className="w-4 h-4 fill-white" />
                    <span>
                      {formatHrStartCtaLabel(activeQuestion, mode, selectedStartBeatId, guidedBeatScope)}
                    </span>
                  </button>
                </div>
              ) : (
                /* Active Voice HUD */
                <HrVoiceHUD
                  isConnected={isConnected}
                  isAiSpeaking={isAiSpeaking}
                  isRecording={isRecording}
                  isUserSpeaking={isUserSpeaking}
                  isPauseHolding={isPauseHolding}
                  statusMessage={statusMessage}
                  dialogueTurns={dialogueTurns}
                  onStepControl={handleStepControl}
                  onCentralClick={handleInteraction}
                  onDisconnect={disconnect}
                />
              )}
            </div>
          )}
        </main>
      </div>

      {/* Scorecard Modal on Round Completion (examiner modes only) */}
      {mode !== 'tutor_rehearsal' && mode !== 'guided_zero_start' && (
        <HrScorecardModal onRetry={() => handleStartSimulation()} />
      )}
    </div>
  );
};
