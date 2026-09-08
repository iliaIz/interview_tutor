import React, { useEffect } from 'react';
import { usePracticeTutorStore } from '../../../store/usePracticeTutorStore';
import { useAppStore } from '../../../store/useAppStore';
import {
  X,
  Compass,
  Clock,
  ShieldAlert,
  Layers,
  Sparkles,
  Crosshair,
  ChevronRight,
  Code2
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

const LLD_RULES: Array<Omit<RuleCardProps, 'onApply'>> = [
  {
    id: 'TIME_VIRTUALIZATION',
    name: '1. Детерминизм времени (Time Virtualization Invariant)',
    badge: 'Zero-Sleep Invariant',
    badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    icon: <Clock className="w-5 h-5 text-indigo-600" />,
    shortFormula: 'Никаких System.currentTimeMillis() и Thread.sleep(). Время инжектируется через java.time.Clock.',
    fullPrinciple: 'В любых LLD задачах со скользящими окнами (Rate Limiter, Cache TTL, Event Scheduler, Token Bucket) время обязано инжектироваться через конструктор (Clock clock). Это позволяет тестировать временные окна детерминированно за 0 мс через Clock.fixed() без нестабильного Thread.sleep().',
    checklist: [
      'В коде сервиса нет прямых вызовов System.currentTimeMillis() или Instant.now()?',
      'Clock инжектируется через конструктор (с дефолтом Clock.systemUTC())?',
      'Тесты используют Clock.fixed(instant, zone) или Clock.offset для мгновенных проверок?'
    ]
  },
  {
    id: 'FINANCIAL_PRECISION',
    name: '2. Финансовая точность (Banker’s Rounding & BigDecimal)',
    badge: 'Money Invariant',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    icon: <ShieldAlert className="w-5 h-5 text-emerald-600" />,
    shortFormula: 'Никаких double/float в деньгах. Только BigDecimal с явным scale и RoundingMode.HALF_EVEN.',
    fullPrinciple: 'Плавающая точка IEEE-754 порождает скрытые погрешности (0.1 + 0.2 != 0.3). Для балансов, комиссий и счетов используйте BigDecimal с банковским округлением (HALF_EVEN) или целые единицы (микроценты). Инициализация строго через BigDecimal.valueOf() или new BigDecimal("10.50"), но никогда new BigDecimal(10.50).',
    checklist: [
      'Все денежные суммы, остатки и комиссии объявлены как BigDecimal?',
      'При операциях деления .divide() всегда указан явный scale и RoundingMode.HALF_EVEN?',
      'Создание через BigDecimal.valueOf() или строковый конструктор new BigDecimal("...")?'
    ]
  },
  {
    id: 'DEADLOCK_FREE_CONCURRENCY',
    name: '3. Дедлок-фри многопоточность (Ordered Locking Hierarchy)',
    badge: 'Thread Safety',
    badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
    icon: <Layers className="w-5 h-5 text-rose-600" />,
    shortFormula: 'Глобальный порядок локов: lock(min(id1, id2)) -> lock(max(id1, id2)). Защита от встречного дедлока.',
    fullPrinciple: 'При параллельном переводе между счетами (A->B и B->A) встречные потоки вызывают дедлок. Блокировки обязаны захватываться в детерминированном глобальном порядке (например, по id1.compareTo(id2)). Предпочитайте ConcurrentHashMap, StampedLock и атомики (AtomicLong, LongAdder) глобальным synchronized-блокам.',
    checklist: [
      'Исключен ли встречный дедлок через сортировку ID блокируемых ресурсов?',
      'Использованы ли эффективные структуры (ConcurrentHashMap, AtomicLong, StampedLock)?',
      'Освобождаются ли блокировки ReentrantLock строго в блоке finally?'
    ]
  },
  {
    id: 'ISP_AND_VALUE_OBJECTS',
    name: '4. Неизменяемость и богатый домен (Java 21 Records & ISP)',
    badge: 'Domain Driven',
    badgeColor: 'bg-sky-50 text-sky-700 border-sky-200',
    icon: <Sparkles className="w-5 h-5 text-sky-600" />,
    shortFormula: 'Богатая модель (Rich Model) вместо Primitive Obsession. Record для DTO, событий и ключей.',
    fullPrinciple: 'Не передавайте бессвязные параметры String userId, long amount. Создавайте строгие доменные типы: record AccountId(UUID id), record Money(BigDecimal amount, Currency currency). Разделяйте интерфейсы (ISP): читатели не должны видеть мутирующие методы (отдельно Reader, отдельно Writer).',
    checklist: [
      'Неизменяемые DTO, события и составные ключи объявлены как Java 21 record?',
      'Домен защищен от Primitive Obsession через строгие Value Objects?',
      'Интерфейсы сервисов лаконичны и разделены по принципу Interface Segregation (ISP)?'
    ]
  },
  {
    id: 'FAIL_FAST_AND_INVARIANTS',
    name: '5. Защита инвариантов и Fail-Fast состояние',
    badge: 'State Machine & Invariants',
    badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
    icon: <Crosshair className="w-5 h-5 text-amber-600" />,
    shortFormula: 'Fail-Fast валидация на входе. Невалидное состояние объекта принципиально невозможно.',
    fullPrinciple: 'Проверяйте инварианты немедленно в конструкторе (Objects.requireNonNull, аргументы > 0). Если сущность управляет состояниями (например, PENDING -> SUCCESS / FAILED), любые недопустимые переходы обязаны выбрасывать типизированные бизнес-исключения, а коллекции возвращаться через Collections.unmodifiableList().',
    checklist: [
      'Все входные параметры валидируются в конструкторе до изменения полей?',
      'Недопустимые переходы статусов выбрасывают понятное IllegalStateException / DomainException?',
      'Внутренние коллекции защищены от внешней мутации (defensive copying)?'
    ]
  }
];

export const LLDCompassSheet: React.FC = () => {
  const { isCompassOpen, toggleCompass, groundRule } = usePracticeTutorStore();
  const {
    activePracticeChallenge,
    practiceWorkspaceFiles,
    activeWorkspaceFileIndex
  } = useAppStore();

  // Close on Escape
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

  const currentFile = practiceWorkspaceFiles[activeWorkspaceFileIndex] || practiceWorkspaceFiles[0];

  const handleApplyRule = (ruleId: string) => {
    groundRule(ruleId, {
      kataId: activePracticeChallenge?.id || 'kata',
      kataTitle: activePracticeChallenge?.title || 'LLD Challenge',
      kataCategory: activePracticeChallenge?.category || 'LLD & Machine Coding',
      kataInstructions: activePracticeChallenge?.instructionsMarkdown || '',
      activeFilePath: currentFile?.path || 'src/main/java/Service.java',
      activeFileContent: currentFile?.content || ''
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-start p-2 sm:p-4 bg-slate-950/50 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="w-full max-w-5xl bg-white/95 backdrop-blur-2xl rounded-3xl border border-purple-500/30 shadow-2xl overflow-hidden flex flex-col my-auto transition-all">
        {/* Header Bar */}
        <div className="px-5 sm:px-8 py-4 border-b border-pastel-border/60 bg-gradient-to-r from-purple-50 via-white to-indigo-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-100 border border-purple-300/60 flex items-center justify-center shadow-xs text-purple-700">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-800 tracking-tight">
                  LLD Compass: 5 Золотых Заповедей Архитектора (Java 21)
                </h2>
                <span className="hidden sm:inline text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-300/50">
                  Ctrl + /
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Хардкорные инварианты BigTech Machine Coding. Нажмите «Применить к моему коду» для проверки напарником.
              </p>
            </div>
          </div>

          <button
            onClick={() => toggleCompass(false)}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            title="Закрыть (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Rules Grid */}
        <div className="p-5 sm:p-8 grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 bg-slate-50/50 max-h-[75dvh] overflow-y-auto custom-scrollbar">
          {LLD_RULES.map((rule) => (
            <div
              key={rule.id}
              className="flex flex-col justify-between p-5 rounded-2xl bg-white border border-slate-200/80 hover:border-purple-300 shadow-xs hover:shadow-md transition-all duration-200 group"
            >
              <div>
                {/* Rule Title & Badge */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 group-hover:scale-105 transition-transform">
                      {rule.icon}
                    </div>
                    <h3 className="text-sm font-bold text-slate-800 leading-snug">
                      {rule.name}
                    </h3>
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border shrink-0 ${rule.badgeColor}`}>
                    {rule.badge}
                  </span>
                </div>

                {/* Short Formula */}
                <div className="p-2.5 rounded-xl bg-slate-50/80 border border-slate-200/60 mb-3">
                  <p className="text-xs font-semibold text-slate-700 leading-relaxed font-mono">
                    {rule.shortFormula}
                  </p>
                </div>

                {/* Full Principle */}
                <p className="text-xs text-slate-600 mb-4 leading-relaxed">
                  {rule.fullPrinciple}
                </p>

                {/* Checklist */}
                <div className="space-y-1.5 mb-4">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Чек-лист инварианта:
                  </span>
                  {rule.checklist.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs text-slate-600">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0 mt-1.5" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={() => handleApplyRule(rule.id)}
                className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold bg-purple-50 text-purple-700 hover:bg-purple-600 hover:text-white border border-purple-200/60 transition-all cursor-pointer shadow-2xs group-hover:border-purple-600"
              >
                <Code2 className="w-4 h-4" />
                <span>Применить к моему коду</span>
                <ChevronRight className="w-3.5 h-3.5 opacity-60" />
              </button>
            </div>
          ))}
        </div>

        {/* Footer Note */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200/60 flex items-center justify-between text-xs text-slate-500">
          <span>Соблюдение этих 5 правил гарантирует прохождение Machine Coding на грейд Senior (L5/L6)</span>
          <span className="font-mono text-[11px] text-slate-400">Нажмите Esc для закрытия</span>
        </div>
      </div>
    </div>
  );
};
