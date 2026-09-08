import React, { useState, useEffect } from 'react';
import {
  Compass,
  X,
  Layers,
  Database,
  AlertTriangle,
  Flame,
  CheckCircle2,
  HelpCircle,
  Clock,
  ShieldAlert,
  Zap,
  BookOpen
} from 'lucide-react';
import { CodeViewer } from '../../CodeViewer';

interface TransactionCompassSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onAskTutorAboutRule?: (ruleTitle: string, ruleSummary: string) => void;
}

interface CompassRule {
  id: string;
  number: string;
  title: string;
  badge: string;
  badgeColor: string;
  summary: string;
  formulaOrCode?: string;
  checklist: string[];
}

const COMPASS_RULES: CompassRule[] = [
  {
    id: 'cglib-lifecycle',
    number: '01',
    title: 'Жизненный цикл CGLIB-прокси и ловушка Self-Invocation',
    badge: 'AOP Architecture',
    badgeColor: 'text-violet-700 bg-violet-100 border-violet-200',
    summary:
      'Spring создает класс-наследник (CGLIB Subclass). Перехватчик TransactionInterceptor активируется ТОЛЬКО при внешнем вызове через прокси. Вызов this.innerMethod() выполняется внутри целевого инстанса напрямую (invokevirtual), полностью минуя прокси и аннотацию @Transactional.',
    formulaOrCode:
      'Caller -> CGLIB Proxy -> TransactionInterceptor -> PlatformTransactionManager -> Target Method',
    checklist: [
      'Метод вызывается из внешнего Spring-бина или через инжектированный self-reference?',
      'Метод объявлен как public? (private и protected методы тихо игнорируются Spring AOP)',
      'Класс и метод не являются final? (CGLIB не может переопределять final методы)'
    ]
  },
  {
    id: 'propagation-matrix',
    number: '02',
    title: 'Матрица распространения транзакций (Propagation Matrix)',
    badge: 'Transaction Boundaries',
    badgeColor: 'text-blue-700 bg-blue-100 border-blue-200',
    summary:
      'Распространение определяет поведение границ транзакции при вложенных вызовах и число занимаемых соединений из пула.',
    formulaOrCode:
      'REQUIRED: текущая или новая (1 conn) | REQUIRES_NEW: suspend + 2-й коннект из пула | NESTED: JDBC Savepoint (1 conn) | MANDATORY: падать без транзакции',
    checklist: [
      'REQUIRED (дефолт): присоединиться к текущей транзакции или создать новую',
      'REQUIRES_NEW: приостановить текущую, взять 2-е соединение из HikariCP, закоммитить и возобновить 1-ю',
      'NESTED: создать точку сохранения (Savepoint) в рамках того же соединения без риска истощения пула',
      'SUPPORTS: выполняется в транзакции, если есть, иначе без транзакции'
    ]
  },
  {
    id: 'rollback-invariants',
    number: '03',
    title: 'Правила отката и ловушка UnexpectedRollbackException',
    badge: 'Rollback Invariants',
    badgeColor: 'text-rose-700 bg-rose-100 border-rose-200',
    summary:
      'По умолчанию Spring откатывает транзакцию ТОЛЬКО на RuntimeException и Error. Checked exceptions (IOException, SQLException) приводят к коммиту! При падении дочернего REQUIRED метода транзакция помечается setRollbackOnly() — перехват в try-catch приведет к UnexpectedRollbackException при коммите родителя.',
    formulaOrCode:
      '@Transactional(rollbackFor = Exception.class) // Обязательно для checked exceptions',
    checklist: [
      'Настроен ли rollbackFor = Exception.class для методов, бросающих проверяемые исключения?',
      'Если дочерний метод падает, а родитель должен продолжить работу: используется REQUIRES_NEW или NESTED?',
      'Отсутствует ли наивный try-catch вокруг дочернего REQUIRED метода (защита от UnexpectedRollbackException)?'
    ]
  },
  {
    id: 'hikaricp-deadlock-theorem',
    number: '04',
    title: 'Теорема Вулдриджа о взаимной блокировке пула HikariCP',
    badge: 'Deadlock Math',
    badgeColor: 'text-amber-700 bg-amber-100 border-amber-200',
    summary:
      'При синхронном вызове REQUIRES_NEW поток удерживает первое соединение и ожидает второе из того же пула. Если параллельные потоки T разберут все соединения P, наступает циклический дедлок: никто не может завершиться.',
    formulaOrCode:
      'Минимальный размер пула для гарантии отсутствия дедлока: P >= T * (D - 1) + 1 (где D — глубина соединений на поток)',
    checklist: [
      'Рассчитана ли емкость пула: при T=10 потоков и глубине D=2 (REQUIRES_NEW) необходимо P >= 10*(2-1)+1 = 11 соединений',
      'Установлен ли адекватный connectionTimeout (дефолт 30с слишком долог для отказа при пиковой нагрузке)?',
      'Рассмотрен ли перевод вспомогательных задач (аудит, отправка) на асинхронный Outbox Pattern?'
    ]
  },
  {
    id: 'performance-hygiene',
    number: '05',
    title: 'Гигиена производительности: ReadOnly и Idle-in-Transaction',
    badge: 'Performance & Hygiene',
    badgeColor: 'text-emerald-700 bg-emerald-100 border-emerald-200',
    summary:
      'Флаг readOnly = true включает FlushMode.MANUAL в Hibernate, отключая создание снимков памяти для dirty-checking (экономия до 70% RAM). Антипаттерн Idle-in-Transaction: удержание JDBC-соединения во время сетевого I/O парализует СУБД и исчерпывает пул.',
    formulaOrCode:
      'Сетевой I/O (REST, Kafka, S3) -> БЕЗ транзакции (NONE). Запись в БД -> короткий @Transactional(REQUIRED)',
    checklist: [
      'Включен ли readOnly = true для всех методов чтения (выборка списков, отчетов)?',
      'Вынесены ли все медленные внешние HTTP-запросы и генерации файлов за пределы транзакции?',
      'Установлен ли явный timeout на транзакциях для предотвращения зависания долгих блокировок?'
    ]
  }
];

export const TransactionCompassSheet: React.FC<TransactionCompassSheetProps> = ({
  isOpen,
  onClose,
  onAskTutorAboutRule
}) => {
  const [activeTabId, setActiveTabId] = useState<string>(COMPASS_RULES[0].id);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const activeRule = COMPASS_RULES.find((r) => r.id === activeTabId) || COMPASS_RULES[0];

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-start p-2 sm:p-4 bg-slate-950/40 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="w-full max-w-5xl bg-white/98 backdrop-blur-2xl rounded-3xl border border-violet-200/80 shadow-2xl overflow-hidden flex flex-col my-auto transition-all">
        {/* Header Bar */}
        <div className="px-5 sm:px-8 py-4 border-b border-slate-100 bg-gradient-to-r from-violet-50 via-white to-rose-50/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white shadow-sm shadow-violet-200">
              <Compass className="w-5 h-5 text-white animate-spin-slow" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-slate-900 tracking-tight">
                  Transaction Compass
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-800 border border-violet-200">
                  5 Золотых Заповедей Spring Transactions
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Архитектурная шпаргалка по CGLIB-прокси, матрице распространения и теореме пула соединений
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            title="Закрыть (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body: Sidebar Tabs + Active Rule Details */}
        <div className="grid grid-cols-1 md:grid-cols-12 min-h-[440px]">
          {/* Rules Selector Sidebar (4 cols) */}
          <div className="md:col-span-5 p-4 border-r border-slate-100 bg-slate-50/60 space-y-2">
            <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider px-2">
              Правила архитектуры
            </span>
            <div className="space-y-1.5">
              {COMPASS_RULES.map((rule) => {
                const isActive = rule.id === activeTabId;
                return (
                  <button
                    key={rule.id}
                    type="button"
                    onClick={() => setActiveTabId(rule.id)}
                    className={`w-full p-3 rounded-2xl text-left transition flex items-start gap-3 cursor-pointer border ${
                      isActive
                        ? 'bg-white text-slate-900 border-violet-300 shadow-sm ring-1 ring-violet-200'
                        : 'bg-transparent hover:bg-white/80 text-slate-600 border-transparent hover:border-slate-200 text-xs'
                    }`}
                  >
                    <span
                      className={`text-xs font-mono font-bold px-2 py-0.5 rounded-lg shrink-0 ${
                        isActive ? 'bg-violet-600 text-white' : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {rule.number}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold leading-snug">{rule.title}</div>
                      <div className="text-[10px] text-slate-400 truncate mt-0.5">{rule.badge}</div>
                    </div>
                  </button>
                );
              })}
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

              {/* Code Snippet / Formula Box */}
              {activeRule.formulaOrCode && (
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-rose-500" />
                    Ключевая формула / Архитектурный паттерн:
                  </span>
                  <div className="rounded-xl overflow-hidden border border-slate-800 shadow-xs">
                    <CodeViewer
                      code={activeRule.formulaOrCode}
                      language="java"
                      showLineNumbers={false}
                    />
                  </div>
                </div>
              )}

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
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <div className="text-[11px] text-slate-400">
                Горячая клавиша: <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border text-slate-600 font-mono">Ctrl + /</kbd>
              </div>

              {onAskTutorAboutRule && (
                <button
                  type="button"
                  onClick={() => onAskTutorAboutRule(activeRule.title, activeRule.summary)}
                  className="py-2 px-4 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-bold text-xs shadow-sm transition flex items-center gap-2 cursor-pointer"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Спросить ИИ-Тьютора об этом правиле</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
