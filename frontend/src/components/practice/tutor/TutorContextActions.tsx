import React, { useState } from 'react';
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

interface TutorContextActionsProps {
  domain: ChallengeDomain;
  onOpenCompass: () => void;
  onOpenWhiteboard: () => void;
  hasUnseenWhiteboardUpdate?: boolean;
  onSendMessage: (text: string) => void;
  onRequestHintTier: (tier: number) => void;
}

export const TutorContextActions: React.FC<TutorContextActionsProps> = ({
  domain,
  onOpenCompass,
  onOpenWhiteboard,
  hasUnseenWhiteboardUpdate,
  onSendMessage,
  onRequestHintTier
}) => {
  const [showHintTiersMenu, setShowHintTiersMenu] = useState(false);

  return (
    <div className="border-b border-pastel-border/60 bg-white/90 backdrop-blur-xs flex flex-col shrink-0">
      {/* Primary Action Chips Bar */}
      <div className="px-3 py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        {/* DOMAIN: LLD & MACHINE CODING */}
        {domain === 'lld' && (
          <>
            <button
              onClick={onOpenCompass}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 text-[11px] font-bold transition shrink-0 cursor-pointer shadow-2xs"
              title="LLD Compass: 5 Золотых Заповедей Архитектора (Ctrl + /)"
            >
              <Compass className="w-3.5 h-3.5 text-purple-600" />
              <span>LLD Компас</span>
            </button>

            <button
              onClick={onOpenWhiteboard}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold transition shrink-0 cursor-pointer shadow-2xs ${
                hasUnseenWhiteboardUpdate
                  ? 'bg-amber-100 text-amber-900 border border-amber-400 animate-pulse'
                  : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200'
              }`}
              title="Интерактивная доска проектирования классов (Alt + W)"
            >
              <LayoutTemplate className={`w-3.5 h-3.5 ${hasUnseenWhiteboardUpdate ? 'text-amber-600 animate-spin' : 'text-indigo-600'}`} />
              <span>Доска ИИ</span>
              {hasUnseenWhiteboardUpdate && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
              )}
            </button>

            <button
              onClick={() => onSendMessage('Помоги составить архитектурный чеклист для этой задачи: сущности, интерфейсы, инварианты.')}
              className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition shrink-0 cursor-pointer"
              title="Запросить декомпозицию и интерфейсы"
            >
              <Layers className="w-3 h-3 text-slate-500" />
              <span>Чеклист ТЗ</span>
            </button>

            <button
              onClick={() => onSendMessage('Объясни, как правильно инжектировать java.time.Clock и настроить BigDecimal с RoundingMode.HALF_EVEN для этой системы.')}
              className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[11px] font-bold transition shrink-0 cursor-pointer"
              title="Инварианты Clock и BigDecimal"
            >
              <Clock className="w-3 h-3 text-emerald-600" />
              <span>Clock & Money</span>
            </button>

            <button
              onClick={() => onSendMessage('Как безопасно организовать упорядоченный захват блокировок или использовать ConcurrentHashMap для исключения дедлоков?')}
              className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition shrink-0 cursor-pointer"
              title="Потокобезопасность"
            >
              <Lock className="w-3 h-3 text-slate-500" />
              <span>Дедлок-фри</span>
            </button>
          </>
        )}

        {/* DOMAIN: UNIT TESTING & MUTATIONS */}
        {domain === 'testing' && (
          <>
            <button
              onClick={() => setShowHintTiersMenu(!showHintTiersMenu)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-xl border text-[11px] font-bold transition shrink-0 cursor-pointer ${
                showHintTiersMenu
                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                  : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200'
              }`}
            >
              <Lightbulb className="w-3 h-3 text-amber-600" />
              <span>Подсказка (RIPR)</span>
              {showHintTiersMenu ? (
                <ChevronUp className="w-3 h-3 opacity-60" />
              ) : (
                <ChevronDown className="w-3 h-3 opacity-60" />
              )}
            </button>

            <button
              onClick={onOpenCompass}
              className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-pastel-rose text-pastel-accentRoseText hover:bg-pastel-accentRose hover:text-white border border-pastel-accentRose/30 text-[11px] font-bold transition shrink-0 cursor-pointer"
            >
              <Compass className="w-3 h-3" />
              <span>Компас (Ctrl+/)</span>
            </button>

            <button
              onClick={() => onSendMessage('Объясни, почему выжили мутанты в моем тесте и как их поймать?')}
              className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition shrink-0 cursor-pointer"
            >
              <Sparkles className="w-3 h-3 text-slate-500" />
              <span>Мутанты</span>
            </button>
          </>
        )}

        {/* DOMAIN: TRANSACTIONS LAB */}
        {domain === 'transactions' && (
          <>
            <button
              onClick={onOpenCompass}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 text-[11px] font-bold transition shrink-0 cursor-pointer shadow-2xs"
            >
              <Compass className="w-3.5 h-3.5 text-purple-600" />
              <span>Tx Компас</span>
            </button>

            <button
              onClick={onOpenWhiteboard}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold transition shrink-0 cursor-pointer shadow-2xs ${
                hasUnseenWhiteboardUpdate
                  ? 'bg-amber-100 text-amber-900 border border-amber-400 animate-pulse'
                  : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200'
              }`}
            >
              <LayoutTemplate className="w-3.5 h-3.5 text-indigo-600" />
              <span>Схема транзакций</span>
            </button>

            <button
              onClick={() => onSendMessage('Объясни разницу между READ COMMITTED и REPEATABLE READ в этом сценарии транзакции.')}
              className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition shrink-0 cursor-pointer"
            >
              <Database className="w-3 h-3 text-slate-500" />
              <span>Изоляция & Блокировки</span>
            </button>

            <button
              onClick={() => onSendMessage('Как работает Self-Invocation bypass в Spring AOP прокси и как его предотвратить?')}
              className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition shrink-0 cursor-pointer"
            >
              <ShieldCheck className="w-3 h-3 text-slate-500" />
              <span>Self-Invocation</span>
            </button>
          </>
        )}

        {/* DOMAIN: CONCURRENCY LAB */}
        {domain === 'concurrency' && (
          <>
            <button
              onClick={onOpenCompass}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 text-[11px] font-bold transition shrink-0 cursor-pointer shadow-2xs"
            >
              <Compass className="w-3.5 h-3.5 text-purple-600" />
              <span>Loom Компас</span>
            </button>

            <button
              onClick={onOpenWhiteboard}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 text-[11px] font-bold transition shrink-0 cursor-pointer shadow-2xs"
            >
              <LayoutTemplate className="w-3.5 h-3.5 text-indigo-600" />
              <span>Доска потоков</span>
            </button>

            <button
              onClick={() => onSendMessage('Как обнаружить и устранить Carrier Thread Pinning в Java 21 Virtual Threads (synchronized vs ReentrantLock)?')}
              className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition shrink-0 cursor-pointer"
            >
              <Lock className="w-3 h-3 text-slate-500" />
              <span>Pinning & Races</span>
            </button>
          </>
        )}
      </div>

      {/* Non-overlapping Accordion Panel for Progressive RIPR Hints (Testing Only) */}
      {domain === 'testing' && showHintTiersMenu && (
        <div className="px-3 py-2 bg-amber-50/70 border-t border-amber-200/60 flex flex-col gap-1 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="text-[10px] font-bold text-amber-800 uppercase tracking-wider mb-0.5">
            Ступени наводящих подсказок (RIPR Model):
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
            <button
              onClick={() => {
                onRequestHintTier(0);
                setShowHintTiersMenu(false);
              }}
              className="text-left px-2 py-1 rounded-lg bg-white/90 hover:bg-white border border-amber-200 text-xs transition cursor-pointer"
            >
              <span className="font-bold text-slate-800">Ур. 0: Синтаксис</span>
              <span className="block text-[10px] text-slate-500">Импорты, типы и компиляция</span>
            </button>
            <button
              onClick={() => {
                onRequestHintTier(1);
                setShowHintTiersMenu(false);
              }}
              className="text-left px-2 py-1 rounded-lg bg-white/90 hover:bg-white border border-amber-200 text-xs transition cursor-pointer"
            >
              <span className="font-bold text-slate-800">Ур. 1: Reachability</span>
              <span className="block text-[10px] text-slate-500">Достижимость ветки логики</span>
            </button>
            <button
              onClick={() => {
                onRequestHintTier(2);
                setShowHintTiersMenu(false);
              }}
              className="text-left px-2 py-1 rounded-lg bg-white/90 hover:bg-white border border-amber-200 text-xs transition cursor-pointer"
            >
              <span className="font-bold text-slate-800">Ур. 2: Infection</span>
              <span className="block text-[10px] text-slate-500">Какое состояние портит дефект</span>
            </button>
            <button
              onClick={() => {
                onRequestHintTier(3);
                setShowHintTiersMenu(false);
              }}
              className="text-left px-2 py-1 rounded-lg bg-white/90 hover:bg-white border border-amber-200 text-xs transition cursor-pointer"
            >
              <span className="font-bold text-slate-800">Ур. 3: Boundary</span>
              <span className="block text-[10px] text-slate-500">Граничный входной параметр</span>
            </button>
            <button
              onClick={() => {
                onRequestHintTier(4);
                setShowHintTiersMenu(false);
              }}
              className="text-left px-2 py-1 rounded-lg bg-white/90 hover:bg-white border border-amber-200 text-xs transition cursor-pointer sm:col-span-2"
            >
              <span className="font-bold text-slate-800">Ур. 4: Изоморфный пример</span>
              <span className="block text-[10px] text-slate-500">Аналогичный паттерн проверки инварианта</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
