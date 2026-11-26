import React, { useState } from 'react';
import type { TutorPersona } from '@interview-prep/shared';
import { usePracticeTutorStore } from '../../../store/usePracticeTutorStore';
import { useAppStore } from '../../../store/useAppStore';
import { HintTiersDropdown } from './HintTiersDropdown';
import { TutorQuickActionChips } from './TutorQuickActionChips';
import { TutorMessageList } from './TutorMessageList';
import { TutorInputFooter } from './TutorInputFooter';
import { resolveTutorDomain } from './TutorDomain';
import { buildLivePracticeContext } from './practiceContextBuilder';
import { X, MessageSquare, Mic, Bot } from 'lucide-react';

const PERSONA_LABELS: Record<TutorPersona, { name: string; badge: string }> = {
  junior_explainer: { name: 'Junior Explainer', badge: '🟢 L1: Начинающий' },
  middle_scaffold: { name: 'Middle Peer-Programmer', badge: '🟡 L2: Коллега' },
  senior_socratic: { name: 'Senior Socratic', badge: '🟣 L3: Сократ' },
  faang_interviewer: { name: 'FAANG Staff Interviewer', badge: '🔴 L4: Архитектор' },
  company_interviewer: { name: 'Company Bar-Raiser', badge: '🏦 L5: Product Engineer Lead' }
};

const PracticeTutorDrawerContent: React.FC = () => {
  const toggleOpen = usePracticeTutorStore((s) => s.toggleOpen);
  const toggleCompass = usePracticeTutorStore((s) => s.toggleCompass);
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

  const activeChallengeCategory = useAppStore((s) => s.activePracticeChallenge?.category || '');
  const activeChallengeTrack = useAppStore((s) => s.activePracticeChallenge?.track || '');
  const activeChallengeTitle = useAppStore((s) => s.activePracticeChallenge?.title || '');
  const hasActiveTxScenario = useAppStore((s) => Boolean(s.activeTransactionLabScenarioId));

  const [inputVal, setInputVal] = useState('');

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

  // Reads fresh workspace/editor state only on explicit user action dispatch.
  const resolveDispatchContext = () =>
    activeContext || buildLivePracticeContext(useAppStore.getState(), domain, persona, assistanceLevel);

  const handleSend = () => {
    if (!inputVal.trim() || isLoading) return;
    const text = inputVal;
    setInputVal('');
    void sendMessage(text, resolveDispatchContext());
  };

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full sm:w-[420px] bg-white/95 backdrop-blur-2xl border-l border-pastel-accentRose/30 shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
      <div className="px-4 py-3 border-b border-pastel-border/70 bg-gradient-to-r from-[#FFF0F5] via-white to-pastel-lavender/30 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
          <div className="w-8 h-8 rounded-xl bg-pastel-accentRose/10 border border-pastel-accentRose/30 flex items-center justify-center shrink-0">
            <Bot className="w-4 h-4 text-pastel-accentRose" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-xs text-slate-800 truncate">
                {activeContext ? activeContext.domain : 'AI-Напарник (Co-Pilot)'}
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white text-pastel-accentRoseText border border-pastel-accentRose/20 shrink-0">
                {activeContext?.arena === 'sql_arena'
                  ? '🐘 PostgreSQL 16'
                  : activeContext?.arena === 'companies'
                    ? `🏦 ${companyName || 'Product Engineer'}`
                    : PERSONA_LABELS[persona].badge}
              </span>
            </div>
            <p className="text-[10px] text-slate-500 truncate">
              {activeContext ? activeContext.entityTitle : 'Парное программирование & Socratic Tutor'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 shrink-0">
            <button
              onClick={() => setModality('text')}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-bold transition cursor-pointer ${
                modality === 'text' ? 'bg-white text-pastel-text shadow-2xs' : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Текстовый диалог со стримингом"
            >
              <MessageSquare className="w-3 h-3" />
              <span>Текст</span>
            </button>
            <button
              onClick={() => setModality('voice')}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-bold transition cursor-pointer ${
                modality === 'voice' ? 'bg-white text-pastel-accentRose shadow-2xs' : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Голосовой диалог Gemini Live"
            >
              <Mic className="w-3 h-3" />
              <span>Голос</span>
            </button>
          </div>
          <button
            onClick={() => toggleOpen(false)}
            className="w-7 h-7 shrink-0 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition cursor-pointer"
            title="Закрыть шторку"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="px-4 py-2 border-b border-pastel-border/50 bg-slate-50/50 flex flex-col gap-1.5 shrink-0">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Степень подсказок:</span>
          <span className="text-[11px] font-semibold text-slate-600">{personaLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4].map((lvl) => (
            <button
              key={lvl}
              onClick={() => setAssistanceLevel(lvl)}
              className={`flex-1 py-1 rounded-lg text-[10px] font-bold border transition cursor-pointer text-center ${
                assistanceLevel === lvl
                  ? 'bg-pastel-accentRose text-white border-pastel-accentRose shadow-2xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-pastel-accentRose/40'
              }`}
            >
              {lvl === 1 ? 'Junior' : lvl === 2 ? 'Middle' : lvl === 3 ? 'Senior' : 'FAANG'}
            </button>
          ))}
        </div>
      </div>

      <div className="px-3 py-2 border-b border-pastel-border/40 bg-white flex items-center gap-1.5 overflow-x-auto shrink-0 no-scrollbar">
        {!activeContext && (
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
  if (!isOpen) return null;
  return <PracticeTutorDrawerContent />;
};
