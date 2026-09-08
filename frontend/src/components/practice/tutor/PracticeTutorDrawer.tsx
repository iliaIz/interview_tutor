import React, { useState, useRef, useEffect } from 'react';
import { usePracticeTutorStore, TutorPersona } from '../../../store/usePracticeTutorStore';
import { useAppStore } from '../../../store/useAppStore';
import { PracticeVoiceHUD } from './PracticeVoiceHUD';
import { TutorWorkspaceTools, TutorPromptShelf } from './TutorContextActions';
import { getChallengeDomain, ChallengeDomain } from '../../../utils/challengeDomain';
import {
  X,
  MessageSquare,
  Mic,
  Send,
  Sparkles,
  ShieldAlert,
  Trash2,
  Square,
  User,
  Bot
} from 'lucide-react';

const getPersonaLabels = (domain: ChallengeDomain): Record<TutorPersona, { name: string; desc: string; badge: string }> => {
  if (domain === 'lld') {
    return {
      junior_explainer: {
        name: 'Junior Explainer',
        desc: 'Теплый наставник, простые аналогии, скелеты классов и рекордов Java 21',
        badge: '🟢 L1: Начинающий'
      },
      middle_scaffold: {
        name: 'Middle Peer-Programmer',
        desc: 'Опытный коллега, паттерны GoF, Clock injection, BigDecimal',
        badge: '🟡 L2: Коллега'
      },
      senior_socratic: {
        name: 'Senior Socratic',
        desc: 'Строгий Сократ: архитектурные инварианты, декомпозиция, чистые интерфейсы',
        badge: '🟣 L3: Сократ'
      },
      faang_interviewer: {
        name: 'FAANG Staff Architect',
        desc: 'Высокая планка: потокобезопасность, OCP, масштабируемость и zero-alloc',
        badge: '🔴 L4: Архитектор'
      }
    };
  }

  if (domain === 'transactions') {
    return {
      junior_explainer: {
        name: 'Junior Explainer',
        desc: 'Теплый наставник, понятные примеры ACID и аномалий БД',
        badge: '🟢 L1: Начинающий'
      },
      middle_scaffold: {
        name: 'Middle Peer-Programmer',
        desc: 'Опытный коллега, уровни изоляции, Self-Invocation, блокировки',
        badge: '🟡 L2: Коллега'
      },
      senior_socratic: {
        name: 'Senior Socratic',
        desc: 'Строгий Сократ: дедлоки в БД, фантомные чтения, propagation',
        badge: '🟣 L3: Сократ'
      },
      faang_interviewer: {
        name: 'FAANG Staff Architect',
        desc: 'Высокая планка: распределенные транзакции, 2PC, Outbox, CDC',
        badge: '🔴 L4: Архитектор'
      }
    };
  }

  // Default: testing
  return {
    junior_explainer: {
      name: 'Junior Explainer',
      desc: 'Теплый наставник, простые аналогии, готовые шаблоны AssertJ',
      badge: '🟢 L1: Начинающий'
    },
    middle_scaffold: {
      name: 'Middle Peer-Programmer',
      desc: 'Опытный коллега, наводящие подсказки, лучшие практики',
      badge: '🟡 L2: Коллега'
    },
    senior_socratic: {
      name: 'Senior Socratic',
      desc: 'Строгий Сократ: никакого готового кода, только наводящие вопросы',
      badge: '🟣 L3: Сократ'
    },
    faang_interviewer: {
      name: 'FAANG Staff Interviewer',
      desc: 'Высокая планка: blast radius, детерминизм, архитектура тестов',
      badge: '🔴 L4: Архитектор'
    }
  };
};

export const PracticeTutorDrawer: React.FC = () => {
  const {
    isOpen,
    toggleOpen,
    toggleCompass,
    modality,
    setModality,
    persona,
    setPersona,
    assistanceLevel,
    setAssistanceLevel,
    messages,
    isLoading,
    currentStreamingText,
    sendMessage,
    requestHint,
    abortGeneration,
    clearMessages,
    initContextWelcome
  } = usePracticeTutorStore();

  const {
    activePracticeChallenge,
    practiceWorkspaceFiles,
    activeWorkspaceFileIndex,
    setActiveWorkspaceView,
    hasUnseenWhiteboardUpdate
  } = useAppStore();

  const [inputVal, setInputVal] = useState('');
  const [isRiprOpen, setIsRiprOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Responsive Resizable Drawer Width (SOTA Pro-IDE Drag-to-Resize)
  const [drawerWidth, setDrawerWidth] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('practice_tutor_width');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 380 && parsed <= 850) return parsed;
      }
      return window.innerWidth >= 1536 ? 560 : window.innerWidth >= 1280 ? 520 : 480;
    }
    return 500;
  });
  const [isResizing, setIsResizing] = useState(false);

  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = Math.max(380, Math.min(window.innerWidth * 0.55, window.innerWidth - e.clientX));
      setDrawerWidth(newWidth);
    };

    const handleMouseUp = () => {
      if (isResizing) {
        setIsResizing(false);
        try {
          localStorage.setItem('practice_tutor_width', String(Math.round(drawerWidth)));
        } catch {}
      }
    };

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, drawerWidth]);

  const domain = getChallengeDomain(activePracticeChallenge);
  const personaLabels = getPersonaLabels(domain);

  // Initialize context-aware welcome message when opening new challenge
  useEffect(() => {
    if (activePracticeChallenge && messages.length <= 1 && messages[0]?.id.startsWith('welcome')) {
      initContextWelcome(domain, activePracticeChallenge.title);
    }
  }, [activePracticeChallenge?.id, domain]);

  const currentFile = practiceWorkspaceFiles[activeWorkspaceFileIndex] || practiceWorkspaceFiles[0];

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentStreamingText]);

  if (!isOpen) return null;

  const currentContext = {
    kataId: activePracticeChallenge?.id || 'kata',
    kataTitle: activePracticeChallenge?.title || 'Testing Kata',
    kataCategory: activePracticeChallenge?.category || 'Testing & Mutation',
    kataInstructions: activePracticeChallenge?.instructionsMarkdown || '',
    activeFilePath: currentFile?.path || 'src/test/java/Test.java',
    activeFileContent: currentFile?.content || '',
    survivingMutants: activePracticeChallenge?.mutants
  };

  const handleSend = () => {
    if (!inputVal.trim() || isLoading) return;
    const text = inputVal;
    setInputVal('');
    sendMessage(text, currentContext);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      style={{
        width: typeof window !== 'undefined' && window.innerWidth >= 640 ? `${drawerWidth}px` : '100%',
        maxWidth: '100vw'
      }}
      className={`fixed inset-y-0 right-0 z-40 bg-white/95 backdrop-blur-2xl border-l border-pastel-accentRose/30 shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200 ${
        isResizing ? 'cursor-ew-resize select-none' : ''
      }`}
    >
      {/* Left Border Drag-to-Resize Handle */}
      <div
        onMouseDown={startResizing}
        title="Потяните для изменения ширины AI-напарника"
        className="hidden sm:block absolute top-0 bottom-0 left-0 w-2 hover:w-3 bg-transparent hover:bg-pastel-accentRose/30 active:bg-pastel-accentRose/60 cursor-ew-resize z-50 transition-all group"
      >
        <div className="h-10 w-1 bg-slate-300 group-hover:bg-pastel-accentRose rounded-full absolute top-1/2 -translate-y-1/2 left-0.5" />
      </div>

      {/* Drawer Header */}
      <div className="px-4 py-3 border-b border-pastel-border/70 bg-gradient-to-r from-[#FFF0F5] via-white to-pastel-lavender/30 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-pastel-accentRose/10 border border-pastel-accentRose/30 flex items-center justify-center">
            <Bot className="w-4 h-4 text-pastel-accentRose" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-xs text-slate-800">AI-Напарник (Co-Pilot)</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white text-pastel-accentRoseText border border-pastel-accentRose/20">
                {personaLabels[persona].badge}
              </span>
            </div>
            <p className="text-[10px] text-slate-500">Парное программирование & Socratic Tutor</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Modality Switcher */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
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
            className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Scaffolding Persona & Assistance Level Controls */}
      <div className="px-4 py-2 border-b border-pastel-border/50 bg-slate-50/50 flex flex-col gap-1.5 shrink-0">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Степень подсказок:</span>
          <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-600">
            <span>{personaLabels[persona].name}</span>
          </div>
        </div>

        {/* 4-Stage Assistance Slider */}
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

      {/* Top Workspace Tools Bar (Pinned Persistent Navigation) */}
      <TutorWorkspaceTools
        domain={domain}
        onOpenCompass={() => toggleCompass(true)}
        onOpenWhiteboard={() => setActiveWorkspaceView('whiteboard')}
        hasUnseenWhiteboardUpdate={hasUnseenWhiteboardUpdate}
        isRiprOpen={isRiprOpen}
        onToggleRipr={() => setIsRiprOpen(!isRiprOpen)}
      />

      {/* Main Messages & Voice HUD Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
        {modality === 'voice' && (
          <div className="mb-4">
            <PracticeVoiceHUD />
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div className="flex items-center gap-1.5 mb-1 px-1 text-[10px] font-semibold text-slate-400">
              {msg.role === 'user' ? (
                <>
                  <span>Вы</span>
                  <User className="w-3 h-3" />
                </>
              ) : (
                <>
                  <Bot className="w-3 h-3 text-pastel-accentRose" />
                  <span>AI-Напарник</span>
                </>
              )}
            </div>

            <div
              className={`p-3 rounded-2xl text-xs leading-relaxed max-w-[92%] shadow-xs break-words whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-gradient-to-br from-pastel-accentRose to-pink-600 text-white rounded-tr-xs'
                  : msg.role === 'system'
                  ? 'bg-rose-50 text-rose-800 border border-rose-200 rounded-tl-xs'
                  : 'bg-white text-slate-800 border border-slate-200/80 rounded-tl-xs'
              }`}
            >
              {msg.content}

              {msg.leakDetected && (
                <div className="mt-2.5 p-2 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-1.5 text-[10px] text-amber-800 font-semibold">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>Socratic Anti-Cheat: Прямой код скрыт для тренировки самостоятельного мышления.</span>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Live Streaming Delta */}
        {isLoading && currentStreamingText && (
          <div className="flex flex-col items-start animate-in fade-in duration-150">
            <div className="flex items-center gap-1.5 mb-1 px-1 text-[10px] font-semibold text-slate-400">
              <Bot className="w-3 h-3 text-pastel-accentRose" />
              <span>AI-Напарник печатает...</span>
            </div>
            <div className="p-3 rounded-2xl text-xs leading-relaxed max-w-[92%] bg-white text-slate-800 border border-pastel-accentRose/40 shadow-xs rounded-tl-xs whitespace-pre-wrap">
              {currentStreamingText}
              <span className="inline-block w-1.5 h-3.5 bg-pastel-accentRose ml-1 animate-pulse" />
            </div>
          </div>
        )}

        {isLoading && !currentStreamingText && (
          <div className="flex items-center gap-2 text-xs text-slate-400 italic p-2">
            <Bot className="w-4 h-4 text-pastel-accentRose animate-bounce" />
            <span>AI-напарник анализирует код...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Prompts Shelf (Flex-wrap, non-truncated) */}
      <TutorPromptShelf
        domain={domain}
        onSendMessage={(text) => sendMessage(text, currentContext)}
        isRiprOpen={isRiprOpen}
        onRequestHintTier={(tier) => {
          requestHint(tier, currentContext);
          setIsRiprOpen(false);
        }}
        onCloseRipr={() => setIsRiprOpen(false)}
      />

      {/* Drawer Input Footer */}
      <div className="p-3 border-t border-pastel-border/60 bg-white/80 shrink-0">
        <div className="relative flex items-end gap-1.5 bg-slate-50 border border-slate-200 rounded-2xl p-1.5 focus-within:border-pastel-accentRose focus-within:ring-2 focus-within:ring-pastel-accentRose/20 transition">
          <textarea
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Спросить напарника по коду или тесту... (Enter для отправки)"
            rows={2}
            className="flex-1 bg-transparent border-none resize-none text-xs text-slate-800 focus:outline-hidden p-1.5 leading-relaxed placeholder:text-slate-400"
          />

          <div className="flex items-center gap-1">
            {isLoading ? (
              <button
                onClick={abortGeneration}
                className="w-8 h-8 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center transition cursor-pointer"
                title="Остановить генерацию"
              >
                <Square className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!inputVal.trim()}
                className="w-8 h-8 rounded-xl bg-pastel-rose hover:bg-pastel-accentRose text-pastel-accentRoseText hover:text-white disabled:opacity-40 flex items-center justify-center transition cursor-pointer shadow-2xs"
                title="Отправить (Enter)"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between mt-2 px-1 text-[10px] text-slate-400">
          <button
            onClick={clearMessages}
            className="flex items-center gap-1 hover:text-slate-600 transition cursor-pointer"
          >
            <Trash2 className="w-3 h-3" />
            <span>Очистить чат</span>
          </button>
          <span>Shift + Enter для новой строки</span>
        </div>
      </div>
    </div>
  );
};
