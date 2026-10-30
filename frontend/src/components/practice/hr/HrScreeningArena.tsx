import React, { useState, useEffect, useRef } from 'react';
import { useLiveVoiceSession } from '../../../audio/useLiveVoiceSession';
import { ClientKeywordSpotter } from '../../../audio/ClientKeywordSpotter';
import { useHrSimulatorStore } from '../../../store/useHrSimulatorStore';
import { HrVoiceHUD } from './HrVoiceHUD';
import { HrScorecardModal } from './HrScorecardModal';
import { HrSessionMode, HrPersonaId, HrQuestionRubricItem } from '@interview-prep/shared';
import { 
  Play, 
  Briefcase, 
  UserCheck, 
  Sparkles, 
  HeartHandshake,
  ShieldAlert,
  Search
} from 'lucide-react';

export const HrScreeningArena: React.FC = () => {
  const [mode, setMode] = useState<HrSessionMode>('rapid_fire_micro_drill');
  const [personaId, setPersonaId] = useState<HrPersonaId>('friendly_sourcer');

  const storeAnchorCards = useHrSimulatorStore((state) => state.anchorCards);
  const initializeSession = useHrSimulatorStore((state) => state.initializeSession);
  const registerFastKwsHit = useHrSimulatorStore((state) => state.registerFastKwsHit);

  const spotterRef = useRef<ClientKeywordSpotter | null>(null);

  const {
    isConnected,
    isAiSpeaking,
    isRecording,
    isUserSpeaking,
    isPauseHolding,
    statusMessage,
    startSession,
    disconnectSession,
    handleCentralButtonClick
  } = useLiveVoiceSession();

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

  const handleStartSimulation = async () => {
    const defaultPitchQuestion: HrQuestionRubricItem = {
      id: 'q01_elevator_pitch',
      title: 'Elevator Pitch (75с)',
      canonicalQuestion: 'Расскажите о себе, вашем опыте и ключевых проектах.',
      referenceAnswer: 'Я тимлид и Java/Kotlin разработчик. 7.4 года работал в БФТ над высоконагруженными системами (15 млн документов, 2200 RPS). Оформлен по НПД (422-ФЗ). Ожидания 310-330к net.',
      targetDurationSec: {
        minSec: 60,
        maxSec: 80,
        hardCapSec: 90
      },
      requiredAnchors: [
        {
          id: 'a1',
          label: '7.4 года БФТ',
          category: 'architecture',
          matchStems: ['бфт', 'bft', 'бфт-холдинг'],
          weight: 2,
          status: 'PENDING'
        },
        {
          id: 'a2',
          label: 'НПД / 422-ФЗ',
          category: 'legal',
          matchStems: ['нпд', '422', 'самозанят'],
          weight: 3,
          status: 'PENDING'
        },
        {
          id: 'a3',
          label: '15 млн документов',
          category: 'metrics',
          matchStems: ['миллион', '15', 'документ'],
          weight: 2,
          status: 'PENDING'
        },
        {
          id: 'a4',
          label: '2200 RPS k6',
          category: 'metrics',
          matchStems: ['2200', 'rps', 'k6', 'нагруз'],
          weight: 2,
          status: 'PENDING'
        },
        {
          id: 'a5',
          label: '310–330к net',
          category: 'compensation',
          matchStems: ['310', '320', '330', 'нетт', 'рублей'],
          weight: 2,
          status: 'PENDING'
        }
      ],
      forbiddenPatterns: ['устал от легаси', 'токсичные процессы', 'ну типа', 'как бы'],
      phase: 'phase2_elevator_pitch'
    };

    initializeSession(mode, personaId, defaultPitchQuestion);

    await startSession({
      sessionType: mode === 'full_screening_simulation' ? 'hr_simulation' : 'hr_micro_drill',
      persona: personaId,
      hrMode: mode,
      hrPersonaId: personaId,
      dossierId: 'canonical_ilya_dossier',
      jobId: 'fintech_highload_core',
      questionId: defaultPitchQuestion.id,
      topic: defaultPitchQuestion.title,
      questionText: defaultPitchQuestion.canonicalQuestion
    });
  };

  return (
    <div className="h-[calc(100dvh-4rem)] w-full flex flex-col p-4 md:p-6 bg-slate-50 overflow-hidden">
      {/* Top Controls Bar */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200 shrink-0 gap-4 flex-wrap">
        <div>
          <h1 className="text-lg md:text-xl font-bold text-slate-900 flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-pastel-accentRose" />
            Голосовой HR-симулятор &amp; Скрининг
          </h1>
          <p className="text-xs text-slate-500">
            Канонический 75-секундный питч, софт-скиллы и анти-сикофантский разбор
          </p>
        </div>

        {!isConnected && (
          <div className="flex items-center gap-2">
            {/* Mode Selector */}
            <div className="flex p-1 bg-white border border-slate-200 rounded-xl text-xs">
              <button
                onClick={() => setMode('rapid_fire_micro_drill')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                  mode === 'rapid_fire_micro_drill'
                    ? 'bg-pastel-accentRose text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Микро-дрилл (75с)
              </button>
              <button
                onClick={() => setMode('full_screening_simulation')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                  mode === 'full_screening_simulation'
                    ? 'bg-pastel-accentRose text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Полный скрининг
              </button>
            </div>

            {/* Persona Selector */}
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
      </div>

      {/* Main Content Arena */}
      <div className="flex-1 min-h-0 pt-4 overflow-y-auto">
        {!isConnected ? (
          /* Lobby Card */
          <div className="max-w-2xl mx-auto my-auto p-6 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-pink-100 to-rose-50 flex items-center justify-center text-pastel-accentRose mb-4 shadow-2xs">
              <Sparkles className="w-8 h-8" />
            </div>

            <h2 className="text-base md:text-lg font-bold text-slate-900 mb-1">
              Готовы к HR-созвону?
            </h2>
            <p className="text-xs text-slate-500 max-w-md mb-6 leading-relaxed">
              Отработайте самопрезентацию без «воды» и оправданий. Говорите естественным голосом — ИИ слушает в реальном времени.
            </p>

            {/* Dossier Preview Chips */}
            <div className="w-full bg-slate-50 p-4 rounded-xl border border-slate-200/80 mb-6 text-left">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-pastel-accentRose" />
                Целевой профиль кандидата
              </div>
              <div className="flex flex-wrap gap-1.5 text-xs">
                <span className="px-2 py-1 rounded-md bg-white border border-slate-200 font-medium text-slate-700">Илья Ижуков (35 лет)</span>
                <span className="px-2 py-1 rounded-md bg-white border border-slate-200 font-medium text-slate-700">Lead Java/Kotlin</span>
                <span className="px-2 py-1 rounded-md bg-white border border-slate-200 font-medium text-slate-700">БФТ 7.4 лет</span>
                <span className="px-2 py-1 rounded-md bg-white border border-slate-200 font-medium text-slate-700">НПД / 422-ФЗ</span>
                <span className="px-2 py-1 rounded-md bg-white border border-slate-200 font-medium text-slate-700">310k–330k net</span>
              </div>
            </div>

            <button
              onClick={handleStartSimulation}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-pastel-accentRose hover:opacity-90 text-white font-bold text-sm shadow-md transition transform active:scale-95 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>Начать созвон</span>
            </button>
          </div>
        ) : (
          /* Active Voice HUD Arena */
          <div className="max-w-3xl mx-auto">
            <HrVoiceHUD
              isConnected={isConnected}
              isAiSpeaking={isAiSpeaking}
              isRecording={isRecording}
              isUserSpeaking={isUserSpeaking}
              isPauseHolding={isPauseHolding}
              statusMessage={statusMessage}
              onCentralClick={handleCentralButtonClick}
              onDisconnect={disconnectSession}
            />
          </div>
        )}
      </div>

      {/* Scorecard Modal on Round Completion */}
      <HrScorecardModal onRetry={handleStartSimulation} />
    </div>
  );
};
