import React, { useState, useEffect } from 'react';
import { usePracticeTutorStore } from '../../../store/usePracticeTutorStore';
import { useAppStore } from '../../../store/useAppStore';
import {
  X,
  Compass,
  CheckCircle2,
  Crosshair,
  Layers,
  ShieldAlert,
  Clock,
  Sparkles,
  Flame,
  Zap,
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

const TESTING_RULES: CompassRule[] = [
  {
    id: 'AAA_PATTERN',
    number: '01',
    title: 'Паттерн AAA (Arrange — Act — Assert)',
    badge: 'Test Structure',
    badgeColor: 'text-emerald-700 bg-emerald-100 border-emerald-200',
    icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
    summary:
      'Тест должен визуально читаться как строгий сценарий: Arrange готовит стабы и параметры, Act делает ровно один вызов, Assert верифицирует контракт через выразительный assertThat(). Один тест — ровно одно бизнес-действие.',
    formulaOrCode: `// 1. Arrange: подготовка изолированного контекста и стабов
var clock = Clock.fixed(Instant.parse("2026-09-09T10:00:00Z"), ZoneOffset.UTC);
var service = new PaymentService(bankPort, clock);
var request = new PaymentRequest(new AccountId("acc-1"), Money.of(100));

// 2. Act: ровно ОДИН целевой бизнес-вызов
var result = service.execute(request);

// 3. Assert: строгая проверка инвариантов контракта через AssertJ
assertThat(result.status()).isEqualTo(PaymentStatus.SUCCESS);
assertThat(result.transactionId()).isNotNull();`,
    checklist: [
      'Тест визуально разделен пустыми строками на 3 явных блока (Arrange, Act, Assert)?',
      'В секции Act выполняется ровно один метод сервиса?',
      'Использован выразительный fluent AssertJ (assertThat) вместо устаревшего JUnit assertEquals?'
    ]
  },
  {
    id: 'MUTANT_ADVERSARY',
    number: '02',
    title: 'Тест как охотник на мутантов (Adversary Testing & AssertJ)',
    badge: 'Mutation Killing',
    badgeColor: 'text-rose-700 bg-rose-100 border-rose-200',
    icon: <Crosshair className="w-4 h-4 text-rose-600" />,
    summary:
      '100% Line Coverage ничего не гарантирует без проверки жестких границ. Мутационное тестирование (PIT) инжектирует дефекты: меняет > на >=, удаляет вызовы, подменяет булевы флаги. Тест обязан убивать мутанта падением.',
    formulaOrCode: `// Проверка строгой границы диапазона: мутант >= vs > обязан умереть!
assertThat(rateLimiter.tryAcquire(CAPACITY)).isTrue();
assertThat(rateLimiter.tryAcquire(1)).isFalse(); // Граница исчерпана

// Проверка граничных исключений и контракта ошибок
assertThatThrownBy(() -> rateLimiter.tryAcquire(-1))
    .isInstanceOf(IllegalArgumentException.class)
    .hasMessageContaining("Permits must be strictly positive");`,
    checklist: [
      'Проверены ли все критические границы (строго меньше, ровно на границе, строго больше)?',
      'Проверены ли null, пустые коллекции, отрицательные значения и исключения?',
      'Упадет ли тест, если в коде закомментировать строку побочного эффекта?'
    ]
  },
  {
    id: 'STATE_VS_INTERACTION',
    number: '03',
    title: 'Проверка состояния против избыточного мокирования (State vs verify)',
    badge: 'Assertion Design',
    badgeColor: 'text-sky-700 bg-sky-100 border-sky-200',
    icon: <Layers className="w-4 h-4 text-sky-600" />,
    summary:
      'Избыточный verify() связывает тест со скрытыми деталями реализации и ломается при малейшем рефакторинге. Если метод возвращает результат — проверяйте возвращенное состояние (State Verification). verify() нужен только для внешних side-эффектов (Kafka, HTTP, Email).',
    formulaOrCode: `// ПРАВИЛЬНО: проверка состояния (State Verification) возвращаемого объекта
var updatedUser = userService.updateEmail(userId, newEmail);
assertThat(updatedUser.email()).isEqualTo(newEmail);

// verify() используем ТОЛЬКО для внешних команд с побочным эффектом (I/O)
verify(notificationClient, times(1)).sendEmailNotification(eq(newEmail));
verifyNoMoreInteractions(notificationClient);`,
    checklist: [
      'Не проверяются ли приватные вызовы или промежуточные геттеры через verify()?',
      'Для методов с возвращаемым значением проверяется ли результирующее состояние?',
      'Для void-команд явно зафиксировано количество внешних обращений (times(1), never())?'
    ]
  },
  {
    id: 'FOWLER_MOCKS_LAW',
    number: '04',
    title: 'Закон Моков Фаулера (Fowler’s Law of Mocks)',
    badge: 'Isolation Boundaries',
    badgeColor: 'text-amber-700 bg-amber-100 border-amber-200',
    icon: <ShieldAlert className="w-4 h-4 text-amber-600" />,
    summary:
      'Value Objects, Java 21 Record, доменные сущности и коллекции обязаны создаваться настоящими через new. Моки допустимы ТОЛЬКО для внешних границ (Secondary Ports: REST-клиенты, JDBC, очереди сообщений, Clock).',
    formulaOrCode: `// Доменные DTO и Record создаем НАСТОЯЩИМИ через new (НИКАКИХ МОКОВ!)
var account = new Account(new AccountId("acc-42"), Money.of(500));

// Мокаем ТОЛЬКО внешний порт удаленной интеграции (Secondary Port)
given(forexPort.getExchangeRate(Currency.USD, Currency.EUR))
    .willReturn(new BigDecimal("0.9200"));

var converted = exchangeService.convert(account, Currency.EUR);
assertThat(converted.amount()).isEqualByComparingTo("460.00");`,
    checklist: [
      'Все сущности домена, DTO и Value Objects инстанциируются через new?',
      'Мокируются исключительно внешние порты (REST, DB, внешние микросервисы)?',
      'Тест не превратился в тавтологию (мок возвращает то же самое, что проверяется)?'
    ]
  },
  {
    id: 'DETERMINISM_AND_CLOCK',
    number: '05',
    title: 'Детерминизм времени и отказ от Thread.sleep (Clock Invariant)',
    badge: 'Zero-Sleep Testing',
    badgeColor: 'text-indigo-700 bg-indigo-100 border-indigo-200',
    icon: <Clock className="w-4 h-4 text-indigo-600" />,
    summary:
      'Тесты с Thread.sleep() нестабильны (flaky) и замедляют CI/CD. Инжектируйте java.time.Clock в конструктор сервиса. В юнит-тестах сдвигайте виртуальное время за 0 мс через Clock.fixed() или Clock.offset(). Для асинхронности используйте Awaitility.',
    formulaOrCode: `// Виртуальное время: мгновенный сдвиг окон за 0 мс БЕЗ Thread.sleep()
var fixedClock = Clock.fixed(Instant.parse("2026-09-09T12:00:00Z"), ZoneOffset.UTC);
var slidingWindowRateLimiter = new SlidingWindowRateLimiter(5, fixedClock);

// Сдвигаем виртуальное время вперед на 60 секунд
var futureClock = Clock.offset(fixedClock, Duration.ofSeconds(60));
slidingWindowRateLimiter.setClock(futureClock);

// Лимит мгновенно сброшен, тест выполнен за 0.001 мс!
assertThat(slidingWindowRateLimiter.tryAcquire()).isTrue();`,
    checklist: [
      'В тестируемом коде и тестах полностью отсутствуют Thread.sleep() и System.currentTimeMillis()?',
      'Clock инжектируется через конструктор с дефолтом Clock.systemUTC()?',
      'Асинхронные проверки многопоточности используют Awaitility.await().untilAsserted(...)?'
    ]
  }
];

export const TestingCompassSheet: React.FC = () => {
  const { isCompassOpen, toggleCompass, groundRule, sendMessage } = usePracticeTutorStore();
  const {
    activePracticeChallenge,
    practiceWorkspaceFiles,
    activeWorkspaceFileIndex
  } = useAppStore();

  const [activeTabId, setActiveTabId] = useState<string>(TESTING_RULES[0].id);

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
  const activeRule = TESTING_RULES.find((r) => r.id === activeTabId) || TESTING_RULES[0];

  const handleApplyRule = (ruleId: string) => {
    groundRule(ruleId, {
      kataId: activePracticeChallenge?.id || 'kata',
      kataTitle: activePracticeChallenge?.title || 'Testing Kata',
      kataCategory: activePracticeChallenge?.category || 'Testing & Mutation',
      kataInstructions: activePracticeChallenge?.instructionsMarkdown || '',
      activeFilePath: currentFile?.path || 'src/test/java/Test.java',
      activeFileContent: currentFile?.content || '',
      survivingMutants: activePracticeChallenge?.mutants
    });
  };

  const handleAskTutor = () => {
    toggleCompass(false);
    void sendMessage(
      `Разъясни заповедь тестирования «${activeRule.title}». Как применить её в контексте моего текущего файла ${currentFile?.path || 'теста'}?`,
      {
        kataId: activePracticeChallenge?.id || 'kata',
        kataTitle: activePracticeChallenge?.title || 'Testing Kata',
        kataCategory: activePracticeChallenge?.category || 'Testing & Mutation',
        kataInstructions: activePracticeChallenge?.instructionsMarkdown || '',
        activeFilePath: currentFile?.path || 'src/test/java/Test.java',
        activeFileContent: currentFile?.content || '',
        survivingMutants: activePracticeChallenge?.mutants
      }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-start p-2 sm:p-4 bg-slate-950/40 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="w-full max-w-5xl bg-white/98 backdrop-blur-2xl rounded-3xl border border-rose-200/80 shadow-2xl overflow-hidden flex flex-col my-auto transition-all">
        {/* Header Bar */}
        <div className="px-5 sm:px-8 py-4 border-b border-slate-100 bg-gradient-to-r from-rose-50/70 via-white to-indigo-50/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center text-white shadow-sm shadow-rose-200">
              <Compass className="w-5 h-5 text-white animate-spin-slow" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-slate-900 tracking-tight">
                  Testing Compass
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                  5 Золотых Заповедей Инженера Тестирования (Java 21)
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Квинтэссенция надежности тестов SOTA 2026: AAA, AssertJ, охота на мутантов и нулевой Thread.sleep
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
              Заповеди надежности тестов
            </span>
            <div className="space-y-1.5">
              {TESTING_RULES.map((rule) => {
                const isActive = rule.id === activeTabId;
                return (
                  <button
                    key={rule.id}
                    type="button"
                    onClick={() => setActiveTabId(rule.id)}
                    className={`w-full p-3 rounded-2xl text-left transition flex items-start gap-3 cursor-pointer border ${
                      isActive
                        ? 'bg-white text-slate-900 border-rose-300 shadow-sm ring-1 ring-rose-200'
                        : 'bg-transparent hover:bg-white/80 text-slate-600 border-transparent hover:border-slate-200 text-xs'
                    }`}
                  >
                    <span
                      className={`text-xs font-mono font-bold px-2 py-0.5 rounded-lg shrink-0 ${
                        isActive ? 'bg-rose-500 text-white' : 'bg-slate-200 text-slate-600'
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
            <div className="p-3.5 rounded-2xl bg-rose-50/50 border border-rose-100/80 text-rose-950 mt-4 space-y-1">
              <div className="text-[11px] font-bold flex items-center gap-1.5 text-rose-800">
                <Sparkles className="w-3.5 h-3.5 text-rose-500" />
                <span>Мутационное тестирование:</span>
              </div>
              <p className="text-[10px] text-rose-700 leading-relaxed">
                Если в песочнице выжили мутанты (PIT), проверьте границы и строгие проверки AssertJ по этому компасу.
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
                  Эталонный пример реализации (Java 21 & AssertJ):
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
                  className="py-2 px-4 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white font-bold text-xs shadow-sm transition flex items-center gap-1.5 cursor-pointer"
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

export default TestingCompassSheet;
