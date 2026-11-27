import React from 'react';
import type { TutorPersona } from '@interview-prep/shared';
import { usePracticeTutorStore } from '../../../store/usePracticeTutorStore';
import { useAppStore } from '../../../store/useAppStore';
import { HintTiersDropdown } from './HintTiersDropdown';
import { TutorQuickActionChips } from './TutorQuickActionChips';
import { TutorMessageList } from './TutorMessageList';
import { TutorInputFooter } from './TutorInputFooter';
import { resolveTutorDomain, DOMAIN_LABELS } from './TutorDomain';
import { buildLivePracticeContext } from './practiceContextBuilder';
import { usePracticeVoice } from './PracticeVoiceContext';
import { X, MessageSquare, Mic, Bot, EyeOff } from 'lucide-react';

const PERSONA_LABELS: Record<TutorPersona, { name: string; badge: string }> = {
  junior_explainer: { name: 'Junior Explainer', badge: 'L1: Начинающий' },
  middle_scaffold: { name: 'Middle Peer-Programmer', badge: 'L2: Коллега' },
  senior_socratic: { name: 'Senior Socratic', badge: 'L3: Сократ' },
  faang_interviewer: { name: 'FAANG Staff Interviewer', badge: 'L4: Архитектор' },
  company_interviewer: { name: 'Company Bar-Raiser', badge: 'L5: Product Lead' }
};

export interface PracticeTutorPanelContentProps {
  mode?: 'drawer' | 'dock';
}

export const PracticeTutorPanelContent: React.FC<PracticeTutorPanelContentProps> = ({
  mode = 'drawer'
}) => {
  const toggleOpen = usePracticeTutorStore((s) => s.toggleOpen);
  const toggleCompass = usePracticeTutorStore((s) => s.toggleCompass);
  const enterStealthMode = usePracticeTutorStore((s) => s.enterStealthMode);
  const modality = usePracticeTutorStore((s) => s.modality);
  const setModality = usePracticeTutorStore((s) => s.setModality);
  const persona = usePracticeTutorStore((s) => s.persona);
  const assistanceLevel = usePracticeTutorStore((s) => s.assistanceLevel);
  const setAssistanceLevel = usePracticeTutorStore((s) => s.setAssistanceLevel);
  const messages = usePracticeTutorStore((s) => s.messages);
  const isLoading = usePracticeTutorStore((s) => s.isLoading);
  const currentStreamingText = usePracticeTutorStore((s) => s.currentStreamingText);
  const sendMessage = usePracticeTutorStore((s) => s.sendMessage);
  const requestHint = usePracticeTutorStore((s) => s.requestHint);
  const abortGeneration = usePracticeTutorStore((s) => s.abortGeneration);
  const clearMessages = usePracticeTutorStore((s) => s.clearMessages);
  const activeContext = usePracticeTutorStore((s) => s.activeContext);

  const { isConnected: isVoiceConnected, isError: isVoiceError } = usePracticeVoice();

  const activeChallengeCategory = useAppStore((s) => s.activePracticeChallenge?.category || '');
  const activeChallengeTrack = useAppStore((s) => s.activePracticeChallenge?.track || '');
  const activeChallengeTitle = useAppStore((s) => s.activePracticeChallenge?.title || '');
  const hasActiveTxScenario = useAppStore((s) => Boolean(s.activeTransactionLabScenarioId));

  const inputVal = usePracticeTutorStore((s) => s.draftInput);
  const setInputVal = usePracticeTutorStore((s) => s.setDraftInput);

  const domain = resolveTutorDomain({
    category: activeChallengeCategory,
    track: activeChallengeTrack,
    title: activeChallengeTitle,
    hasActiveTxScenario
  });

  const companyName = activeContext?.companyContext?.companyName;
  const personaLabel =
    persona === 'company_interviewer' && companyName
      ? `${companyName} Bar-Raiser`
      : PERSONA_LABELS[persona].name;

  const isPracticeDomainContext =
    !activeContext || (activeContext.arena !== 'companies' && activeContext.arena !== 'sql_arena');

  const canEnterStealth = isVoiceConnected || isVoiceError || messages.length > 1;

  const resolveDispatchContext = () =>
    activeContext || buildLivePracticeContext(useAppStore.getState(), domain, persona, assistanceLevel);

  const handleSend = () => {
    if (!inputVal.trim() || isLoading) return;
    const text = inputVal;
    setInputVal('');
    void sendMessage(text, resolveDispatchContext());
  };

  const resolvedDomainHeader =
    activeContext?.arena === 'companies'
      ? companyName || 'Company Track'
      : activeContext?.arena === 'sql_arena'
      ? 'PostgreSQL 16 SQL'
      : DOMAIN_LABELS[domain];

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full w-full bg-white overflow-hidden">
      {/* Header */}
      <div className="px-3.5 py-2.5 border-b border-pastel-border/80 bg-pastel-bg/80 flex items-center justify-between shrink-0 gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="w-7 h-7 rounded-lg bg-pastel-rose border border-pastel-accentRose/30 flex items-center justify-center shrink-0 text-pastel-accentRoseText">
            <Bot className="w-4 h-4 text-current" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-xs text-pastel-text truncate">
                {resolvedDomainHeader}
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white text-pastel-accentRoseText border border-pastel-accentRose/25 shrink-0">
                {activeContext?.arena === 'sql_arena'
                  ? 'PostgreSQL 16'
                  : activeContext?.arena === 'companies'
                  ? companyName || 'Product Lead'
                  : PERSONA_LABELS[persona].badge}
              </span>
            </div>
            <p className="text-[10px] text-pastel-muted truncate">
              {activeContext?.entityTitle || activeChallengeTitle || 'Парное программирование'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <div
            role="tablist"
            aria-label="Режим общения с напарником"
            className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 shrink-0"
          >
            <button
              type="button"
              role="tab"
              aria-selected={modality === 'text'}
              onClick={() => setModality('text')}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-bold transition cursor-pointer ${
                modality === 'text' ? 'bg-white text-pastel-text shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Текстовый диалог со стримингом"
            >
              <MessageSquare className="w-3 h-3" />
              <span>Текст</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={modality === 'voice'}
              onClick={() => setModality('voice')}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-bold transition cursor-pointer ${
                modality === 'voice'
                  ? 'bg-white text-pastel-accentRoseText shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Голосовой диалог Gemini Live"
            >
              <Mic className="w-3 h-3" />
              <span>Голос</span>
            </button>
          </div>

          {canEnterStealth && (
            <button
              type="button"
              onClick={enterStealthMode}
              aria-label="Скрыть панель в тихий режим без разрыва связи"
              className="touch-target-44 flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition cursor-pointer shrink-0"
              title="Скрыть (тихий режим) — сессия продолжит работать в фоне"
            >
              <EyeOff className="w-3 h-3" />
              <span className="hidden xl:inline">Скрыть</span>
            </button>
          )}

          {mode === 'drawer' && (
            <button
              type="button"
              onClick={() => toggleOpen(false)}
              aria-label="Закрыть панель AI-Напарника"
              className="w-7 h-7 shrink-0 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 flex items-center justify-center transition cursor-pointer"
              title="Закрыть шторку"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Assistance Level Control */}
      <div className="px-3.5 py-2 border-b border-pastel-border/60 bg-slate-50/70 flex flex-col gap-1.5 shrink-0">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-pastel-muted">
            Степень подсказок:
          </span>
          <span className="text-[11px] font-semibold text-pastel-text">{personaLabel}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {[1, 2, 3, 4].map((lvl) => (
            <button
              key={lvl}
              type="button"
              onClick={() => setAssistanceLevel(lvl)}
              className={`flex-1 py-1 rounded-lg text-[10px] font-bold border transition cursor-pointer text-center ${
                assistanceLevel === lvl
                  ? 'bg-[#B5433E] text-white border-[#B5433E] shadow-2xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-pastel-accentRose/50'
              }`}
            >
              {lvl === 1 ? 'Junior' : lvl === 2 ? 'Middle' : lvl === 3 ? 'Senior' : 'FAANG'}
            </button>
          ))}
        </div>
      </div>

      {/* Hints & Quick Chips */}
      <div className="px-3 py-2 border-b border-pastel-border/50 bg-white flex flex-wrap items-center gap-1.5 shrink-0">
        {isPracticeDomainContext && (
          <HintTiersDropdown
            domain={domain}
            onSelectTier={(tier) => void requestHint(tier, resolveDispatchContext())}
          />
        )}
        <TutorQuickActionChips
          domain={domain}
          customChips={activeContext?.quickActionChips}
          onSendMessage={(text) => void sendMessage(text, resolveDispatchContext())}
          onOpenCompass={() => toggleCompass(true)}
        />
      </div>

      <TutorMessageList
        modality={modality}
        messages={messages}
        isLoading={isLoading}
        currentStreamingText={currentStreamingText}
        onFallbackToText={() => setModality('text')}
      />

      <TutorInputFooter
        inputVal={inputVal}
        isLoading={isLoading}
        onInputChange={setInputVal}
        onSend={handleSend}
        onAbort={abortGeneration}
        onClear={clearMessages}
      />
    </div>
  );
};

export const PracticeTutorDrawer: React.FC = () => {
  const isOpen = usePracticeTutorStore((s) => s.isOpen);
  const currentStudioTab = useAppStore((s) => s.currentStudioTab);
  const activePracticeChallenge = useAppStore((s) => s.activePracticeChallenge);
  const activeTransactionLabScenarioId = useAppStore((s) => s.activeTransactionLabScenarioId);

  const isPracticeIdeActive =
    currentStudioTab === 'practice' &&
    activePracticeChallenge !== null &&
    activeTransactionLabScenarioId === null;

  // Inside Practice IDE, PracticeCopilotDock owns the docked right rail
  if (isPracticeIdeActive || !isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full sm:w-[420px] bg-white/95 backdrop-blur-2xl border-l border-pastel-accentRose/30 shadow-2xl flex flex-col overflow-hidden">
      <PracticeTutorPanelContent mode="drawer" />
    </div>
  );
};
