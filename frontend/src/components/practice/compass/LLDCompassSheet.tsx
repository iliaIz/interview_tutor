import React, { useState, useEffect } from 'react';
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
  Zap,
  Flame,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';
import { CodeViewer } from '../../CodeViewer';

interface CompassRule {
  id: string;
  number: string;
  title: string;
  badge: string;
  badgeColor: string;
  icon: React.ReactNode;
  summary: string;
  formulaOrCode: string;
  checklist: string[];
}

const LLD_RULES: CompassRule[] = [
  {
    id: 'TIME_VIRTUALIZATION',
    number: '01',
    title: 'Детерминизм времени (Time Virtualization Invariant)',
    badge: 'Zero-Sleep Invariant',
    badgeColor: 'text-indigo-700 bg-indigo-100 border-indigo-200',
    icon: <Clock className="w-4 h-4 text-indigo-600" />,
    summary:
      'В любых LLD задачах со скользящими окнами (Rate Limiter, Cache TTL, Event Scheduler, Token Bucket) время обязано инжектироваться через конструктор (Clock clock). Это позволяет тестировать временные окна детерминированно за 0 мс через Clock.fixed() без нестабильного Thread.sleep().',
    formulaOrCode: `// Time Virtualization Invariant: Clock инжектируется в конструктор
public class TokenBucketRateLimiter {
    private final Clock clock;
    private Instant lastRefill;

    public TokenBucketRateLimiter(Clock clock) {
        this.clock = Objects.requireNonNull(clock, "clock must not be null");
        this.lastRefill = clock.instant();
    }

    public boolean tryAcquire(int tokens) {
        Instant now = clock.instant(); // НИКАКИХ System.currentTimeMillis()!
        refill(now);
        return consume(tokens);
    }
}`,
    checklist: [
      'В коде сервиса нет прямых вызовов System.currentTimeMillis(), Instant.now() или LocalDate.now()?',
      'Clock инжектируется через конструктор с дефолтным значением Clock.systemUTC()?',
      'Unit-тесты используют Clock.fixed(instant, zone) или Clock.offset() для мгновенных проверок без задержек?'
    ]
  },
  {
    id: 'FINANCIAL_PRECISION',
    number: '02',
    title: 'Финансовая точность (Banker’s Rounding & BigDecimal)',
    badge: 'Money Invariant',
    badgeColor: 'text-emerald-700 bg-emerald-100 border-emerald-200',
    icon: <ShieldAlert className="w-4 h-4 text-emerald-600" />,
    summary:
      'Плавающая точка IEEE-754 порождает скрытые погрешности (0.1 + 0.2 != 0.3). Для балансов, комиссий и счетов используйте BigDecimal с банковским округлением (HALF_EVEN) или целые единицы (микроценты). Инициализация строго через BigDecimal.valueOf() или new BigDecimal("10.50"), но никогда new BigDecimal(10.50).',
    formulaOrCode: `// Строго BigDecimal с банковским округлением (HALF_EVEN) и явным масштабом
public record Money(BigDecimal amount, Currency currency) {
    public Money {
        Objects.requireNonNull(amount, "amount required");
        Objects.requireNonNull(currency, "currency required");
        amount = amount.setScale(4, RoundingMode.HALF_EVEN);
    }

    public Money divide(long divisor) {
        return new Money(amount.divide(BigDecimal.valueOf(divisor), 4, RoundingMode.HALF_EVEN), currency);
    }
}`,
    checklist: [
      'Все денежные суммы, остатки и комиссии объявлены как BigDecimal (без double/float)?',
      'При операциях деления .divide() всегда указан явный scale и RoundingMode.HALF_EVEN?',
      'Создание BigDecimal осуществляется через BigDecimal.valueOf() или строковый конструктор?'
    ]
  },
  {
    id: 'DEADLOCK_FREE_CONCURRENCY',
    number: '03',
    title: 'Дедлок-фри многопоточность (Ordered Locking Hierarchy)',
    badge: 'Thread Safety',
    badgeColor: 'text-rose-700 bg-rose-100 border-rose-200',
    icon: <Layers className="w-4 h-4 text-rose-600" />,
    summary:
      'При параллельном переводе между счетами (A->B и B->A) встречные потоки вызывают дедлок. Блокировки обязаны захватываться в детерминированном глобальном порядке (например, по id1.compareTo(id2)). Предпочитайте ConcurrentHashMap, StampedLock и атомики (AtomicLong, LongAdder) глобальным synchronized-блокам.',
    formulaOrCode: `// Глобальный порядок захвата локов: lock(min) -> lock(max)
public void transfer(Account from, Account to, BigDecimal amount) {
    Account first = from.id().compareTo(to.id()) < 0 ? from : to;
    Account second = from.id().compareTo(to.id()) < 0 ? to : from;

    first.lock().lock();
    try {
        second.lock().lock();
        try {
            from.debit(amount);
            to.credit(amount);
        } finally {
            second.lock().unlock();
        }
    } finally {
        first.lock().unlock();
    }
}`,
    checklist: [
      'Исключен ли встречный дедлок через строгое упорядочивание захвата локов?',
      'Использованы ли lock-free структуры (ConcurrentHashMap, AtomicLong, LongAdder) где возможно?',
      'Освобождаются ли блокировки ReentrantLock строго в блоке finally?'
    ]
  },
  {
    id: 'ISP_AND_VALUE_OBJECTS',
    number: '04',
    title: 'Неизменяемость и богатый домен (Java 21 Records & ISP)',
    badge: 'Domain Driven',
    badgeColor: 'text-sky-700 bg-sky-100 border-sky-200',
    icon: <Sparkles className="w-4 h-4 text-sky-600" />,
    summary:
      'Не передавайте бессвязные примитивы String userId, long amount. Создавайте строгие доменные типы: record AccountId(UUID id), record Money(BigDecimal amount, Currency currency). Разделяйте интерфейсы (ISP): читатели не должны видеть мутирующие методы (отдельно Reader, отдельно Writer).',
    formulaOrCode: `// Java 21 Records для строгого самодокументированного домена
public record AccountId(UUID value) {
    public AccountId {
        Objects.requireNonNull(value, "AccountId cannot be null");
    }
}

// Interface Segregation Principle: разделяем чтение и запись
public interface AccountReader {
    Optional<Account> findById(AccountId id);
}

public interface AccountWriter {
    void save(Account account);
}`,
    checklist: [
      'Неизменяемые DTO, события и составные ключи объявлены как Java 21 record?',
      'Домен защищен от Primitive Obsession через строгие Value Objects?',
      'Интерфейсы сервисов лаконичны и разделены по принципу Interface Segregation (ISP)?'
    ]
  },
  {
    id: 'FAIL_FAST_AND_INVARIANTS',
    number: '05',
    title: 'Защита инвариантов и Fail-Fast состояние',
    badge: 'State Machine',
    badgeColor: 'text-amber-700 bg-amber-100 border-amber-200',
    icon: <Crosshair className="w-4 h-4 text-amber-600" />,
    summary:
      'Проверяйте инварианты немедленно в конструкторе (Objects.requireNonNull, аргументы > 0). Если сущность управляет состояниями (например, PENDING -> SUCCESS / FAILED), любые недопустимые переходы обязаны выбрасывать типизированные бизнес-исключения, а коллекции защищаться через List.copyOf().',
    formulaOrCode: `// Fail-Fast валидация в конструкторе + иммутабельные коллекции
public record Order(OrderId id, List<OrderItem> items, OrderStatus status) {
    public Order {
        Objects.requireNonNull(id, "id must not be null");
        if (items == null || items.isEmpty()) {
            throw new IllegalArgumentException("Order must contain at least 1 item");
        }
        items = List.copyOf(items); // Защита от внешней мутации коллекции
    }

    public Order transitionTo(OrderStatus nextStatus) {
        if (!status.canTransitionTo(nextStatus)) {
            throw new IllegalStateException("Cannot transition from " + status + " to " + nextStatus);
        }
        return new Order(id, items, nextStatus);
    }
}`,
    checklist: [
      'Все входные параметры валидируются в компактном конструкторе до инициализации полей?',
      'Недопустимые переходы конечного автомата выбрасывают типизированное исключение?',
      'Внутренние коллекции защищены от внешних мутаций через List.copyOf()?'
    ]
  }
];

export const LLDCompassSheet: React.FC = () => {
  const { isCompassOpen, toggleCompass, groundRule, sendMessage } = usePracticeTutorStore();
  const {
    activePracticeChallenge,
    practiceWorkspaceFiles,
    activeWorkspaceFileIndex
  } = useAppStore();

  const [activeTabId, setActiveTabId] = useState<string>(LLD_RULES[0].id);

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
  const activeRule = LLD_RULES.find((r) => r.id === activeTabId) || LLD_RULES[0];

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

  const handleAskTutor = () => {
    toggleCompass(false);
    void sendMessage(
      `Разъясни архитектурный инвариант «${activeRule.title}». Как реализовать его в текущем решении ${currentFile?.path || 'сервиса'}?`,
      {
        kataId: activePracticeChallenge?.id || 'kata',
        kataTitle: activePracticeChallenge?.title || 'LLD Challenge',
        kataCategory: activePracticeChallenge?.category || 'LLD & Machine Coding',
        kataInstructions: activePracticeChallenge?.instructionsMarkdown || '',
        activeFilePath: currentFile?.path || 'src/main/java/Service.java',
        activeFileContent: currentFile?.content || ''
      }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-start p-2 sm:p-4 bg-slate-950/40 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="w-full max-w-5xl bg-white/98 backdrop-blur-2xl rounded-3xl border border-purple-200/80 shadow-2xl overflow-hidden flex flex-col my-auto transition-all">
        {/* Header Bar */}
        <div className="px-5 sm:px-8 py-4 border-b border-slate-100 bg-gradient-to-r from-purple-50/70 via-white to-indigo-50/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white shadow-sm shadow-purple-200">
              <Compass className="w-5 h-5 text-white animate-spin-slow" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-slate-900 tracking-tight">
                  LLD Compass
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                  5 Золотых Заповедей Архитектора (Java 21)
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Хардкорные инварианты BigTech Machine Coding: детерминизм времени, BigDecimal, deadlock-free и богатый домен
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => toggleCompass(false)}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            title="Закрыть (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body: Sidebar Tabs + Active Rule Workspace */}
        <div className="grid grid-cols-1 md:grid-cols-12 min-h-[460px]">
          {/* Rules Selector Sidebar (5 cols) */}
          <div className="md:col-span-5 p-4 border-r border-slate-100 bg-slate-50/60 space-y-2">
            <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider px-2">
              Заповеди Machine Coding
            </span>
            <div className="space-y-1.5">
              {LLD_RULES.map((rule) => {
                const isActive = rule.id === activeTabId;
                return (
                  <button
                    key={rule.id}
                    type="button"
                    onClick={() => setActiveTabId(rule.id)}
                    className={`w-full p-3 rounded-2xl text-left transition flex items-start gap-3 cursor-pointer border ${
                      isActive
                        ? 'bg-white text-slate-900 border-purple-300 shadow-sm ring-1 ring-purple-200'
                        : 'bg-transparent hover:bg-white/80 text-slate-600 border-transparent hover:border-slate-200 text-xs'
                    }`}
                  >
                    <span
                      className={`text-xs font-mono font-bold px-2 py-0.5 rounded-lg shrink-0 ${
                        isActive ? 'bg-purple-600 text-white' : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {rule.number}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs truncate flex items-center gap-1.5">
                        {rule.title}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate mt-0.5">{rule.badge}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Quick Practice Tip Card */}
            <div className="p-3.5 rounded-2xl bg-purple-50/50 border border-purple-100/80 text-purple-950 mt-4 space-y-1">
              <div className="text-[11px] font-bold flex items-center gap-1.5 text-purple-800">
                <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                <span>Zero-Phantom Fallback:</span>
              </div>
              <p className="text-[10px] text-purple-700 leading-relaxed">
                AST-правила проверяют инъекцию Clock и отсутствие double в деньгах при каждой компиляции.
              </p>
            </div>
          </div>

          {/* Active Rule Workspace (7 cols) */}
          <div className="md:col-span-7 p-6 flex flex-col justify-between space-y-5 bg-white">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${activeRule.badgeColor}`}>
                  {activeRule.badge}
                </span>
                <span className="text-xs text-slate-400 font-mono font-bold">
                  Заповедь {activeRule.number} / 05
                </span>
              </div>

              <h3 className="text-base font-extrabold text-slate-900 leading-snug">
                {activeRule.title}
              </h3>

              <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
                {activeRule.summary}
              </p>

              {/* Code Snippet Box (CodeMirror Unified SOTA) */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-rose-500" />
                  Эталонный архитектурный инвариант (Java 21):
                </span>
                <div className="rounded-xl overflow-hidden border border-slate-800 shadow-xs">
                  <CodeViewer
                    code={activeRule.formulaOrCode}
                    language="java"
                    showLineNumbers={false}
                  />
                </div>
              </div>

              {/* Checklist */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Критерии проверки на собеседовании:
                </span>
                <div className="space-y-1.5">
                  {activeRule.checklist.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl bg-emerald-50/50 border border-emerald-200/60 text-xs text-emerald-950 flex items-start gap-2"
                    >
                      <span className="font-bold font-mono text-emerald-700 shrink-0">✓</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
              <div className="text-[11px] text-slate-400">
                Горячая клавиша: <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border text-slate-600 font-mono">Ctrl + /</kbd>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAskTutor}
                  className="py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition flex items-center gap-1.5 cursor-pointer"
                  title="Задать вопрос ИИ-напарнику"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  <span>Спросить ИИ</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleApplyRule(activeRule.id)}
                  className="py-2 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold text-xs shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                  title="Передать правило контекстом в AI-тьютор"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Применить к моему коду</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LLDCompassSheet;
