import React, { useState, useEffect, useRef } from 'react';
import { useLiveVoiceSession } from '../../../audio/useLiveVoiceSession';
import { ClientKeywordSpotter } from '../../../audio/ClientKeywordSpotter';
import { useHrSimulatorStore } from '../../../store/useHrSimulatorStore';
import { HrVoiceHUD } from './HrVoiceHUD';
import { HrScorecardModal } from './HrScorecardModal';
import { HrQuestionStudyDeck } from './HrQuestionStudyDeck';
import { HrQuestionSelector } from './HrQuestionSelector';
import { HrSessionMode, HrPersonaId, HrQuestionRubricItem } from '@interview-prep/shared';
import { 
  Play, 
  Briefcase, 
  UserCheck, 
  Sparkles, 
  HeartHandshake,
  ShieldAlert,
  Search,
  BookOpen,
  Mic,
  List
} from 'lucide-react';

export const HrScreeningArena: React.FC = () => {
  const [mode, setMode] = useState<HrSessionMode>('rapid_fire_micro_drill');
  const [personaId, setPersonaId] = useState<HrPersonaId>('friendly_sourcer');
  const [isCatalogOpenMobile, setIsCatalogOpenMobile] = useState(false);

  const activeTab = useHrSimulatorStore((state) => state.activeTab);
  const setActiveTab = useHrSimulatorStore((state) => state.setActiveTab);
  const activeQuestion = useHrSimulatorStore((state) => state.activeQuestion);
  const fetchQuestions = useHrSimulatorStore((state) => state.fetchQuestions);
  const storeAnchorCards = useHrSimulatorStore((state) => state.anchorCards);
  const initializeSession = useHrSimulatorStore((state) => state.initializeSession);
  const registerFastKwsHit = useHrSimulatorStore((state) => state.registerFastKwsHit);

  const spotterRef = useRef<ClientKeywordSpotter | null>(null);

  const {
    state,
    metrics,
    statusMessage,
    connect,
    disconnect,
    handleInteraction
  } = useLiveVoiceSession();

  const isConnected = state !== 'IDLE' && state !== 'ERROR' && state !== 'COMPLETED';
  const isAiSpeaking = state === 'AI_SPEAKING';
  const isRecording = state === 'LISTENING';
  const isUserSpeaking = metrics.vadActive;
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

  const handleStartSimulation = async (targetQuestion?: HrQuestionRubricItem) => {
    const questionToRun = targetQuestion || activeQuestion;
    if (!questionToRun) return;

    setActiveTab('voice');
    initializeSession(mode, personaId, questionToRun);

    await connect({
      sessionType: mode === 'full_screening_simulation' ? 'hr_simulation' : 'hr_micro_drill',
      persona: personaId,
      hrMode: mode,
      hrPersonaId: personaId,
      dossierId: 'canonical_senior_java',
      jobId: 'fintech_highload_expansion',
      questionId: questionToRun.id,
      topic: questionToRun.title,
      questionText: questionToRun.canonicalQuestion
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
            <div className="hidden sm:flex items-center gap-2">
              <div className="flex p-1 bg-white border border-slate-200 rounded-xl text-xs">
                <button
                  onClick={() => setMode('rapid_fire_micro_drill')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer ${
                    mode === 'rapid_fire_micro_drill'
                      ? 'bg-pastel-accentRose text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Микро-дрилл
                </button>
                <button
                  onClick={() => setMode('full_screening_simulation')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer ${
                    mode === 'full_screening_simulation'
                      ? 'bg-pastel-accentRose text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Полный скрининг
                </button>
              </div>

              <div className="flex p-1 bg-white border border-slate-200 rounded-xl text-xs">
                <button
                  onClick={() => setPersonaId('friendly_sourcer')}
                  className={`p-1.5 rounded-lg transition cursor-pointer ${
                    personaId === 'friendly_sourcer' ? 'bg-pink-100 text-pink-700' : 'text-slate-400 hover:text-slate-600'
                  }`}
                  title="Елена — Дружелюбный сорсер"
                >
                  <HeartHandshake className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPersonaId('bank_compliance_officer')}
                  className={`p-1.5 rounded-lg transition cursor-pointer ${
                    personaId === 'bank_compliance_officer' ? 'bg-amber-100 text-amber-800' : 'text-slate-400 hover:text-slate-600'
                  }`}
                  title="Виктория — Офицер комплаенса"
                >
                  <ShieldAlert className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPersonaId('behavioral_conflict_hunter')}
                  className={`p-1.5 rounded-lg transition cursor-pointer ${
                    personaId === 'behavioral_conflict_hunter' ? 'bg-purple-100 text-purple-700' : 'text-slate-400 hover:text-slate-600'
                  }`}
                  title="Дарья — Охотник за конфликтами (STAR)"
                >
                  <Search className="w-4 h-4" />
                </button>
              </div>
            </div>
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
            <HrQuestionStudyDeck onStartVoiceDrill={() => handleStartSimulation()} />
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

                  <div className="w-full bg-slate-50 p-3 rounded-xl border border-slate-200/80 mb-5 text-left">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
                      <Briefcase className="w-3 h-3 text-pastel-accentRose" />
                      Смысловые якоря ответа
                    </div>
                    <div className="flex flex-wrap gap-1.5 text-xs">
                      {(activeQuestion?.requiredAnchors || []).map((a) => (
                        <span key={a.id} className="px-2 py-0.5 rounded-md bg-white border border-slate-200 font-medium text-slate-700 text-[11px]">
                          {a.label}
                        </span>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => handleStartSimulation()}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-pastel-accentRose hover:opacity-90 text-white font-bold text-sm shadow-md transition transform active:scale-95 cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-white" />
                    <span>Начать созвон ({activeQuestion?.targetDurationSec.minSec || 60}–{activeQuestion?.targetDurationSec.maxSec || 80}с)</span>
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
                  onCentralClick={handleInteraction}
                  onDisconnect={disconnect}
                />
              )}
            </div>
          )}
        </main>
      </div>

      {/* Scorecard Modal on Round Completion */}
      <HrScorecardModal onRetry={() => handleStartSimulation()} />
    </div>
  );
};
