import React, { useEffect } from 'react';
import { usePracticeTutorStore } from '../../../store/usePracticeTutorStore';
import { useAppStore } from '../../../store/useAppStore';
import {
  X,
  Compass,
  Clock,
  ShieldCheck,
  Lock,
  Layers,
  Zap,
  Sparkles,
  ChevronRight
} from 'lucide-react';

interface RuleCardProps {
  id: string;
  name: string;
  badge: string;
  badgeColor: string;
  icon: React.ReactNode;
  shortFormula: string;
  fullPrinciple: string;
  checklist: string[];
  onApply: () => void;
}

const LLD_RULE_CARDS: Array<Omit<RuleCardProps, 'onApply'>> = [
  {
    id: 'CLOCK_INJECTION',
    name: '1. Инжекция Виртуального Времени (Clock)',
    badge: 'Детерминизм 0мс',
    badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    icon: <Clock className="w-5 h-5 text-indigo-600" />,
    shortFormula: 'Никаких System.currentTimeMillis() и Thread.sleep(). Время инжектируется через java.time.Clock.',
    fullPrinciple: 'В сервисах с временными окнами (Rate Limiter, TTL Cache, Token Bucket, Sliding Window) запрещено напрямую опрашивать системные часы. Clock передается через конструктор. Тесты проверяют окна через Clock.fixed() и Clock.offset() детерминированно за 0 мс.',
    checklist: [
      'В доменных классах отсутствует System.currentTimeMillis() и Instant.now()?',
      'Clock инжектируется через конструктор сервиса?',
      'Тесты проверяют истечение таймаутов без реального Thread.sleep()?'
    ]
  },
  {
    id: 'MONEY_PRECISION',
    name: '2. Финансовая Точность (BigDecimal)',
    badge: 'Финансовая строгость',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    icon: <ShieldCheck className="w-5 h-5 text-emerald-600" />,
    shortFormula: 'Никаких double и float для денег. Строгий BigDecimal с явным масштабом и RoundingMode.HALF_EVEN.',
    fullPrinciple: 'Числа с плавающей точкой IEEE-754 накапливают ошибки округления. Все балансы, комиссии, цены и суммы используют BigDecimal. Сравнение выполняется через compareTo() == 0, а деление — с обязательным указанием scale и RoundingMode.HALF_EVEN (Banker’s rounding).',
    checklist: [
      'В денежных структурах нет типов double и float?',
      'При делении всегда указан явный scale и RoundingMode.HALF_EVEN?',
      'Сравнение балансов использует compareTo() == 0 или AssertJ .isEqualByComparingTo()?'
    ]
  },
  {
    id: 'DEADLOCK_FREE_ORDERING',
    name: '3. Иерархический Захват Блокировок (Lock Ordering)',
    badge: 'Защита от дедлоков',
    badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
    icon: <Lock className="w-5 h-5 text-rose-600" />,
    shortFormula: 'При операциях между двумя ресурсами захватывайте замки строго по порядку ID: min(id1, id2) -> max(id1, id2).',
    fullPrinciple: 'Если поток A переводит с аккаунта #1 на #2, а поток B — с #2 на #1, одновременный захват lock1 и lock2 вызывает классический циклический дедлок. Сортировка ID перед захватом гарантирует отсутствие взаимоблокировок.',
    checklist: [
      'Ресурсы сортируются перед захватом: min(id1, id2), затем max(id1, id2)?',
      'Используется try-finally блок для гарантированного unlock()?',
      'Корректно обработан пограничный случай id1 == id2 (перевод самому себе)?'
    ]
  },
  {
    id: 'SOLID_BOUNDARIES',
    name: '4. Чистые Границы SOLID и GoF Паттерны',
    badge: 'Чистая архитектура',
    badgeColor: 'bg-sky-50 text-sky-700 border-sky-200',
    icon: <Layers className="w-5 h-5 text-sky-600" />,
    shortFormula: 'Проектируйте от интерфейсов и доменных инвариантов. Используйте Стратегию, Фабрику и Records.',
    fullPrinciple: 'Бизнес-правила (стратегии списания, алгоритмы матчинга, фильтры) инкапсулируются в интерфейсы (Strategy Pattern). Неизменяемые структуры и события объявляются через Java 21 Records. Классы компактны и соблюдают Single Responsibility.',
    checklist: [
      'Выделены ли интерфейсы для вариативных алгоритмов (Strategy)?',
      'Являются ли DTO и события иммутабельными Java 21 Records?',
      'Отсутствуют ли God-объекты с сотнями строк смешанной ответственности?'
    ]
  },
  {
    id: 'THREAD_SAFETY_AND_MEMORY',
    name: '5. Потокобезопасность и Видимость Памяти',
    badge: 'Java Memory Model',
    badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
    icon: <Zap className="w-5 h-5 text-amber-600" />,
    shortFormula: 'Используйте ConcurrentHashMap.compute(), AtomicLong, StampedLock и volatile.',
    fullPrinciple: 'HashMap не потокобезопасен. Избегайте грубых synchronized на весь метод: применяйте ConcurrentHashMap с атомарными операциями computeIfAbsent/compute, атомики (AtomicLong, AtomicReference) или StampedLock/ReentrantReadWriteLock.',
    checklist: [
      'Используются ли потокобезопасные структуры данных (ConcurrentHashMap)?',
      'Атомарно ли изменение состояния (compute, compareAndSet)?',
      'Обеспечена ли видимость разделяемых флагов через volatile/Happens-Before?'
    ]
  }
];

const RuleCard: React.FC<RuleCardProps> = ({
  id,
  name,
  badge,
  badgeColor,
  icon,
  shortFormula,
  fullPrinciple,
  checklist,
  onApply
}) => {
  return (
    <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-sm hover:shadow-md hover:border-pastel-accentRose/50 transition duration-200 flex flex-col justify-between space-y-3 group">
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeColor}`}>
            {badge}
          </span>
          <div className="p-1 rounded-lg bg-slate-50 group-hover:bg-pastel-rose transition">
            {icon}
          </div>
        </div>

        <h4 className="font-bold text-xs text-slate-800 leading-snug mb-1">{name}</h4>
        <p className="text-[11px] font-semibold text-pastel-accentRoseText leading-tight mb-2">
          "{shortFormula}"
        </p>
        <p className="text-xs text-slate-600 leading-relaxed mb-3">{fullPrinciple}</p>

        <div className="space-y-1.5 pt-2 border-t border-slate-100">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Чек-лист для кода:
          </span>
          <ul className="space-y-1 text-xs text-slate-700">
            {checklist.map((item, idx) => (
              <li key={idx} className="flex items-start gap-1.5">
                <span className="text-pastel-accentRose font-bold shrink-0">•</span>
                <span className="text-[11px]">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <button
        onClick={onApply}
        className="w-full mt-2 py-2 px-3 rounded-xl bg-slate-50 hover:bg-gradient-to-r hover:from-pastel-accentRose hover:to-pink-600 hover:text-white text-slate-700 text-xs font-bold transition flex items-center justify-center gap-1.5 border border-slate-200 hover:border-transparent cursor-pointer shadow-2xs"
      >
        <Sparkles className="w-3.5 h-3.5" />
        <span>Спросить тьютора по правилу</span>
        <ChevronRight className="w-3.5 h-3.5 opacity-60" />
      </button>
    </div>
  );
};

export const LldCompassSheet: React.FC = () => {
  const { isCompassOpen, toggleCompass, groundRule } = usePracticeTutorStore();
  const { activePracticeChallenge, practiceWorkspaceFiles, activeWorkspaceFileIndex } = useAppStore();

  const currentFile = practiceWorkspaceFiles[activeWorkspaceFileIndex] || practiceWorkspaceFiles[0];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isCompassOpen) {
        toggleCompass(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCompassOpen, toggleCompass]);

  if (!isCompassOpen) return null;

  const handleApplyRule = (ruleId: string) => {
    const context = {
      kataId: activePracticeChallenge?.id || 'lld-kata',
      kataTitle: activePracticeChallenge?.title || 'LLD Architecture Challenge',
      kataCategory: activePracticeChallenge?.category || 'Low-Level Design (LLD)',
      kataInstructions: activePracticeChallenge?.instructionsMarkdown || '',
      activeFilePath: currentFile?.path || 'src/main/java/Service.java',
      activeFileContent: currentFile?.content || '',
      activeCompassRuleId: ruleId
    };

    groundRule(ruleId, context);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
      <div className="w-full max-w-5xl max-h-[90dvh] bg-pastel-bg border border-pastel-accentRose/40 shadow-2xl rounded-3xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-pastel-border bg-white/90 backdrop-blur-md flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-pastel-accentRose to-purple-500 text-white flex items-center justify-center shadow-xs">
              <Compass className="w-5 h-5 animate-spin-slow" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-slate-900">
                  LLD Компас: 5 Золотых Заповедей Архитектуры
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                  Java 21 LTS
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Детерминизм времени, финансовая строгость, потокобезопасность и чистые границы SOLID
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <kbd className="hidden sm:inline px-2 py-1 bg-slate-100 border border-slate-200 rounded-lg text-[10px] font-mono text-slate-500">
              Esc для закрытия
            </kbd>
            <button
              onClick={() => toggleCompass(false)}
              className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Cards Grid Body */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {LLD_RULE_CARDS.map((rule) => (
            <RuleCard
              key={rule.id}
              {...rule}
              onApply={() => handleApplyRule(rule.id)}
            />
          ))}

          {/* Socratic Anti-Cheat Card */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-900 via-slate-900 to-purple-950 text-white border border-purple-500/30 flex flex-col justify-between shadow-md">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/30 text-purple-200 border border-purple-400/30">
                  Инженерный Барометр
                </span>
              </div>
              <h4 className="font-bold text-xs text-white mb-1.5">Парный Socratic AI-архитектор</h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                Напарник не пишет за вас готовый код задачи, но указывает на нарушение принципов
                детерминизма, отсутствие блокировок, гонки данных и опасные вызовы System.currentTimeMillis().
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-purple-200">
              <span>Горячая клавиша:</span>
              <kbd className="px-2 py-0.5 rounded bg-white/10 font-mono text-xs font-bold">
                Ctrl + /
              </kbd>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
