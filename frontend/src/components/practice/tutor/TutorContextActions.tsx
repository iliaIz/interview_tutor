import React from 'react';
import { ChallengeDomain } from '../../../utils/challengeDomain';
import {
  Compass,
  Lightbulb,
  Sparkles,
  ChevronDown,
  ChevronUp,
  LayoutTemplate,
  Layers,
  Clock,
  ShieldCheck,
  Lock,
  Database
} from 'lucide-react';

/* =========================================================================
 * 1. WORKSPACE TOOLS BAR (Pinned at the top of drawer)
 * Persistent environment navigation tools: Compass, AI Whiteboard, etc.
 * ========================================================================= */

interface TutorWorkspaceToolsProps {
  domain: ChallengeDomain;
  onOpenCompass: () => void;
  onOpenWhiteboard: () => void;
  hasUnseenWhiteboardUpdate?: boolean;
  isRiprOpen?: boolean;
  onToggleRipr?: () => void;
}

export const TutorWorkspaceTools: React.FC<TutorWorkspaceToolsProps> = ({
  domain,
  onOpenCompass,
  onOpenWhiteboard,
  hasUnseenWhiteboardUpdate,
  isRiprOpen,
  onToggleRipr
}) => {
  return (
    <div className="px-3.5 py-2 border-b border-pastel-border/60 bg-gradient-to-r from-slate-50/80 via-white to-pastel-lavender/20 flex items-center justify-between gap-2 shrink-0">
      <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
        <span>Инструменты:</span>
      </div>

      <div className="flex items-center gap-2">
        {/* DOMAIN: LLD & MACHINE CODING */}
        {domain === 'lld' && (
          <>
            <button
              onClick={onOpenCompass}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 text-xs font-bold transition cursor-pointer shadow-2xs"
              title="LLD Compass: 5 Золотых Заповедей Архитектора (Ctrl + /)"
            >
              <Compass className="w-3.5 h-3.5 text-purple-600" />
              <span>LLD Компас</span>
            </button>

            <button
              onClick={onOpenWhiteboard}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs ${
                hasUnseenWhiteboardUpdate
                  ? 'bg-amber-100 text-amber-900 border border-amber-400 animate-pulse'
                  : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200'
              }`}
              title="Интерактивная доска проектирования классов (Alt + W)"
            >
              <LayoutTemplate className={`w-3.5 h-3.5 ${hasUnseenWhiteboardUpdate ? 'text-amber-600 animate-spin' : 'text-indigo-600'}`} />
              <span>Доска ИИ</span>
              {hasUnseenWhiteboardUpdate && (
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
              )}
            </button>
          </>
        )}

        {/* DOMAIN: UNIT TESTING & MUTATIONS */}
        {domain === 'testing' && (
          <>
            <button
              onClick={onOpenCompass}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-pastel-rose text-pastel-accentRoseText hover:bg-pastel-accentRose hover:text-white border border-pastel-accentRose/30 text-xs font-bold transition cursor-pointer shadow-2xs"
              title="Testing Compass (Ctrl + /)"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Компас</span>
            </button>

            {onToggleRipr && (
              <button
                onClick={onToggleRipr}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer shadow-2xs ${
                  isRiprOpen
                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                    : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200'
                }`}
                title="Ступени подсказок RIPR"
              >
                <Lightbulb className="w-3.5 h-3.5 text-amber-600" />
                <span>Подсказка RIPR</span>
                {isRiprOpen ? <ChevronUp className="w-3 h-3 opacity-60" /> : <ChevronDown className="w-3 h-3 opacity-60" />}
              </button>
            )}
          </>
        )}

        {/* DOMAIN: TRANSACTIONS LAB */}
        {domain === 'transactions' && (
          <>
            <button
              onClick={onOpenCompass}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 text-xs font-bold transition cursor-pointer shadow-2xs"
            >
              <Compass className="w-3.5 h-3.5 text-purple-600" />
              <span>Tx Компас</span>
            </button>

            <button
              onClick={onOpenWhiteboard}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 text-xs font-bold transition cursor-pointer shadow-2xs"
            >
              <LayoutTemplate className="w-3.5 h-3.5 text-indigo-600" />
              <span>Схема транзакций</span>
            </button>
          </>
        )}

        {/* DOMAIN: CONCURRENCY LAB */}
        {domain === 'concurrency' && (
          <>
            <button
              onClick={onOpenCompass}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 text-xs font-bold transition cursor-pointer shadow-2xs"
            >
              <Compass className="w-3.5 h-3.5 text-purple-600" />
              <span>Loom Компас</span>
            </button>

            <button
              onClick={onOpenWhiteboard}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 text-xs font-bold transition cursor-pointer shadow-2xs"
            >
              <LayoutTemplate className="w-3.5 h-3.5 text-indigo-600" />
              <span>Доска потоков</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
};


/* =========================================================================
 * 2. PROMPT STARTERS SHELF (Positioned above message input)
 * Natural flex-wrap chips that send prompt queries without truncation.
 * ========================================================================= */

interface TutorPromptShelfProps {
  domain: ChallengeDomain;
  onSendMessage: (text: string) => void;
  isRiprOpen?: boolean;
  onRequestHintTier?: (tier: number) => void;
  onCloseRipr?: () => void;
}

export const TutorPromptShelf: React.FC<TutorPromptShelfProps> = ({
  domain,
  onSendMessage,
  isRiprOpen,
  onRequestHintTier,
  onCloseRipr
}) => {
  return (
    <div className="border-t border-pastel-border/60 bg-slate-50/90 backdrop-blur-xs flex flex-col shrink-0">
      {/* RIPR Accordion (Testing domain only) */}
      {domain === 'testing' && isRiprOpen && onRequestHintTier && (
        <div className="px-3.5 py-2.5 bg-amber-50/80 border-b border-amber-200/60 flex flex-col gap-1.5 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">
              Ступени наводящих подсказок (RIPR):
            </span>
            {onCloseRipr && (
              <button
                onClick={onCloseRipr}
                className="text-[10px] text-amber-600 hover:text-amber-800 font-semibold cursor-pointer"
              >
                Скрыть
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            <button
              onClick={() => onRequestHintTier(0)}
              className="text-left px-2.5 py-1.5 rounded-lg bg-white/95 hover:bg-white border border-amber-200 text-xs transition cursor-pointer shadow-2xs"
            >
              <span className="font-bold text-slate-800 block">Ур. 0: Синтаксис</span>
              <span className="text-[10px] text-slate-500">Импорты, типы и компиляция</span>
            </button>
            <button
              onClick={() => onRequestHintTier(1)}
              className="text-left px-2.5 py-1.5 rounded-lg bg-white/95 hover:bg-white border border-amber-200 text-xs transition cursor-pointer shadow-2xs"
            >
              <span className="font-bold text-slate-800 block">Ур. 1: Reachability</span>
              <span className="text-[10px] text-slate-500">Достижимость ветки логики</span>
            </button>
            <button
              onClick={() => onRequestHintTier(2)}
              className="text-left px-2.5 py-1.5 rounded-lg bg-white/95 hover:bg-white border border-amber-200 text-xs transition cursor-pointer shadow-2xs"
            >
              <span className="font-bold text-slate-800 block">Ур. 2: Infection</span>
              <span className="text-[10px] text-slate-500">Какое состояние портит дефект</span>
            </button>
            <button
              onClick={() => onRequestHintTier(3)}
              className="text-left px-2.5 py-1.5 rounded-lg bg-white/95 hover:bg-white border border-amber-200 text-xs transition cursor-pointer shadow-2xs"
            >
              <span className="font-bold text-slate-800 block">Ур. 3: Boundary</span>
              <span className="text-[10px] text-slate-500">Граничный входной параметр</span>
            </button>
            <button
              onClick={() => onRequestHintTier(4)}
              className="text-left px-2.5 py-1.5 rounded-lg bg-white/95 hover:bg-white border border-amber-200 text-xs transition cursor-pointer shadow-2xs sm:col-span-2"
            >
              <span className="font-bold text-slate-800 block">Ур. 4: Изоморфный пример</span>
              <span className="text-[10px] text-slate-500">Аналогичный паттерн проверки инварианта</span>
            </button>
          </div>
        </div>
      )}

      {/* Suggested Quick Action Chips (Natural flex-wrap) */}
      <div className="px-3.5 py-2 flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1 shrink-0">
          Спросить:
        </span>

        {/* LLD & Machine Coding Prompts */}
        {domain === 'lld' && (
          <>
            <button
              onClick={() => onSendMessage('Помоги составить архитектурный чеклист для этой задачи: сущности, интерфейсы, инварианты.')}
              className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-bold transition cursor-pointer shadow-2xs"
            >
              <Layers className="w-3 h-3 text-slate-500" />
              <span>Чеклист ТЗ</span>
            </button>

            <button
              onClick={() => onSendMessage('Объясни, как правильно инжектировать java.time.Clock и настроить BigDecimal с RoundingMode.HALF_EVEN для этой системы.')}
              className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-50/90 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[11px] font-bold transition cursor-pointer shadow-2xs"
            >
              <Clock className="w-3 h-3 text-emerald-600" />
              <span>Clock & Money</span>
            </button>

            <button
              onClick={() => onSendMessage('Как безопасно организовать упорядоченный захват блокировок или использовать ConcurrentHashMap для исключения дедлоков?')}
              className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-bold transition cursor-pointer shadow-2xs"
            >
              <Lock className="w-3 h-3 text-slate-500" />
              <span>Дедлок-фри</span>
            </button>

            <button
              onClick={() => onSendMessage('Какие паттерны проектирования GoF (Стратегия, Фабрика, Декоратор) лучше применить в этой архитектуре?')}
              className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-purple-50/80 hover:bg-purple-100 text-purple-700 border border-purple-200 text-[11px] font-bold transition cursor-pointer shadow-2xs"
            >
              <Sparkles className="w-3 h-3 text-purple-600" />
              <span>Паттерны GoF</span>
            </button>
          </>
        )}

        {/* Testing Prompts */}
        {domain === 'testing' && (
          <>
            <button
              onClick={() => onSendMessage('Объясни, почему выжили мутанты в моем тесте и как их поймать?')}
              className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-bold transition cursor-pointer shadow-2xs"
            >
              <Sparkles className="w-3 h-3 text-pastel-accentRose" />
              <span>Анализ мутантов</span>
            </button>

            <button
              onClick={() => onSendMessage('Какие граничные случаи и эквивалентные классы нужно проверить в первую очередь?')}
              className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-bold transition cursor-pointer shadow-2xs"
            >
              <ShieldCheck className="w-3 h-3 text-emerald-600" />
              <span>Граничные кейсы</span>
            </button>
          </>
        )}

        {/* Transactions Prompts */}
        {domain === 'transactions' && (
          <>
            <button
              onClick={() => onSendMessage('Объясни разницу между READ COMMITTED и REPEATABLE READ в этом сценарии транзакции.')}
              className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-bold transition cursor-pointer shadow-2xs"
            >
              <Database className="w-3 h-3 text-slate-500" />
              <span>Изоляция & Блокировки</span>
            </button>

            <button
              onClick={() => onSendMessage('Как работает Self-Invocation bypass в Spring AOP прокси и как его предотвратить?')}
              className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-bold transition cursor-pointer shadow-2xs"
            >
              <ShieldCheck className="w-3 h-3 text-slate-500" />
              <span>Self-Invocation</span>
            </button>
          </>
        )}

        {/* Concurrency Prompts */}
        {domain === 'concurrency' && (
          <>
            <button
              onClick={() => onSendMessage('Как обнаружить и устранить Carrier Thread Pinning в Java 21 Virtual Threads (synchronized vs ReentrantLock)?')}
              className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-bold transition cursor-pointer shadow-2xs"
            >
              <Lock className="w-3 h-3 text-slate-500" />
              <span>Pinning & Loom</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
};
