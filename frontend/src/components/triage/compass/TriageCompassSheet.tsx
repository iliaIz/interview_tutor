import React, { useState, useEffect } from 'react';
import {
  Compass,
  X,
  Activity,
  Cpu,
  Database,
  Terminal,
  Clock,
  CheckCircle2,
  HelpCircle,
  ShieldAlert,
  Flame,
  Zap,
  Server,
  Layers,
  AlertTriangle,
  Lock
} from 'lucide-react';

interface TriageCompassSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onAskTutorAboutRule?: (ruleTitle: string, ruleSummary: string) => void;
}

interface CompassSection {
  id: string;
  number: string;
  title: string;
  badge: string;
  badgeColor: string;
  summary: string;
  detailsTable?: Array<{ metric: string; value: string; note: string }>;
  formulaOrCode?: string;
  checklist: string[];
}

const TRIAGE_RULES: CompassSection[] = [
  {
    id: 'thread-states',
    number: '01',
    title: 'Дифференциация состояний потоков в HotSpot & Java 21',
    badge: 'Thread Forensics',
    badgeColor: 'text-amber-800 bg-amber-100 border-amber-200',
    summary:
      'Состояния потоков в jstack нельзя читать буквально. Поток в состоянии RUNNABLE при 0% CPU на самом деле висит в сокетном вызове операционной системы (socketRead0). BLOCKED означает исключительно ожидание встроенного монитора synchronized.',
    detailsTable: [
      { metric: 'RUNNABLE (On-CPU)', value: '100% CPU', note: 'Активные вычисления: плотные циклы, регулярные выражения, криптография' },
      { metric: 'RUNNABLE (Socket I/O)', value: '0% CPU', note: 'Поток ждет ответ от сети/СУБД в SocketInputStream.socketRead0 или EPoll.wait' },
      { metric: 'BLOCKED (on monitor)', value: '0% CPU', note: 'Ожидание входа в монитор synchronized (- waiting to lock <0x...>)' },
      { metric: 'WAITING (parking)', value: '0% CPU', note: 'Ожидание в LockSupport.park(): HikariCP, CompletableFuture, воркеры пула' },
      { metric: 'TIMED_WAITING', value: '0% CPU', note: 'Ожидание с таймаутом: Thread.sleep, socketRead с таймаутом, poll(timeout)' },
      { metric: 'Loom Carrier Pinning', value: '0–5% CPU', note: 'VirtualThread заблокирован внутри synchronized, парализуя несущий ForkJoinPool worker' }
    ],
    formulaOrCode: `// Как отличить реальные вычисления от сетевого ожидания:
if (thread.state == 'RUNNABLE') {
  if (host_cpu_utilization > 80% && top_H_tid_consuming_cpu) {
    // Вычислительное зацикливание: Regex, JSON parsing, бесконечный цикл
  } else {
    // Внешнее сетевое ожидание: socketRead0, медленная БД, зависший микросервис
  }
}`,
    checklist: [
      'Проверен ли CPU на хосте: если RUNNABLE, но CPU 0% — это сокетный I/O, а не алгоритмический цикл!',
      'Проверена ли строка - waiting to lock <0x...>: кто держит этот объект (- locked <0x...>)?',
      'Если включен Project Loom: нет ли VirtualThread.parkOnCarrierThread внутри synchronized?'
    ]
  },
  {
    id: 'deadlock-hikaricp',
    number: '02',
    title: 'Алгоритм поиска Deadlock & HikariCP Connection Starvation',
    badge: 'Deadlocks & Pools',
    badgeColor: 'text-rose-700 bg-rose-100 border-rose-200',
    summary:
      'Взаимная блокировка может происходить как внутри JVM на мониторах, так и на уровне пула соединений БД при вложенных транзакциях. При REQUIRES_NEW один HTTP-поток захватывает 2 соединения, вызывая стопроцентный дедлок при T_threads >= Pool_size.',
    detailsTable: [
      { metric: 'Java-Level Deadlock', value: 'Tarjan SCC cycle', note: 'Искать секцию "Found one Java-level deadlock:" в конце jstack' },
      { metric: 'HikariCP Pool Depletion', value: 'waiting > 0, active = max', note: 'Все соединения заняты, потоки зависли в ConcurrentBag.borrow' },
      { metric: 'Nested REQUIRES_NEW Trap', value: 'T_threads >= P_size', note: 'Внешняя транзакция держит коннект C1, внутренняя ждет C2 из того же пула' },
      { metric: 'idle in transaction', value: 'pg_stat_activity', note: 'БД ожидает команду от бэкенда, который ушел в долгий HTTP-запрос' }
    ],
    formulaOrCode: `// Формула дедлока вложенного пула HikariCP:
// Если N потоков одновременно вошли в метод с @Transactional
// и внутри вызвали @Transactional(propagation = Propagation.REQUIRES_NEW):
if (concurrent_requests >= hikari_maximum_pool_size) {
  // Каждый поток захватил по 1 соединению и ждет 2-е соединение.
  // Пул исчерпан -> Взаимная блокировка до истечения connectionTimeout!
}`,
    checklist: [
      'Изучена ли секция "Found one Java-level deadlock:" в конце тред-дампа?',
      'Проверен ли pg_stat_activity: нет ли соединений в статусе idle in transaction > 10с?',
      'Вынесены ли сторонние REST-вызовы за пределы границ @Transactional?'
    ]
  },
  {
    id: 'memory-dominators',
    number: '03',
    title: 'Архитипы сбоев памяти: OldGen, Metaspace и Direct Off-Heap',
    badge: 'Memory Forensics',
    badgeColor: 'text-purple-700 bg-purple-100 border-purple-200',
    summary:
      'При утечках памяти критически важно различать три зоны: управляемую кучу (Heap OldGen), метаданные классов (Metaspace) и неуправляемые нативные буферы (Direct Off-Heap Netty). Сортировка MAT должна производиться по Retained Size, а не Shallow Size.',
    detailsTable: [
      { metric: 'OldGen Managed Leak', value: 'Dominator > 30% Heap', note: 'Бизнес-коллекции, статические карты, ThreadLocal без вызова remove()' },
      { metric: 'Metaspace / ClassLoader', value: 'OutOfMemoryError: Metaspace', note: 'Генерация CGLIB/ByteBuddy прокси без кэширования ClassLoader' },
      { metric: 'Netty Direct Buffer', value: 'Off-Heap / RSS OutOfMemory', note: 'ByteBuf без вызова ReferenceCountUtil.release(msg)' },
      { metric: 'Unbounded Queue', value: 'CLQ$Node == BusinessPayload', note: 'Число нод очереди строго совпадает с числом полезных объектов' }
    ],
    formulaOrCode: `// Путь к корню в Eclipse MAT (Path to GC Roots):
// 1. Построить Dominator Tree
// 2. Отсортировать по Retained Heap (а не по Shallow Heap!)
// 3. Выполнить "Path to GC Roots" -> Exclude soft/weak/phantom references
// 4. Найти Singleton Bean или ThreadLocal, удерживающий корень графа`,
    checklist: [
      'Проверен ли Dominator Tree: нет ли одного объекта, удерживающего > 30% всей кучи?',
      'Если падает Metaspace: проверено ли количество загруженных классов (Loaded Classes > 40k)?',
      'Если куча чистая (<20%), но контейнер убивает Kubernetes OOMKilled: включена ли проверка Direct Memory?'
    ]
  },
  {
    id: 'stw-gc-pauses',
    number: '04',
    title: 'STW-паузы: Humongous-объекты, Safepoints и Allocation Stalls',
    badge: 'GC & Latency',
    badgeColor: 'text-emerald-800 bg-emerald-100 border-emerald-200',
    summary:
      'Stop-The-World паузы вызываются не только нехваткой памяти, но и архитектурными ловушками: фрагментацией G1 из-за объектов размером > 50% региона, или оптимизацией C2 JIT, вырезающей Safepoint Polls из исчисляемых циклов.',
    detailsTable: [
      { metric: 'G1GC Humongous Alloc', value: 'Object > 50% Region', note: 'Прямая аллокация в OldGen -> to-space exhausted -> Full GC на десятки секунд' },
      { metric: 'ZGC Allocation Stall', value: 'Alloc Rate > GC Speed', note: 'Троттлинг потоков приложения при исчерпании свободных страниц ZGC' },
      { metric: 'Safepoint Sync Delay', value: 'Counted Loop C2', note: 'JIT вырезает проверку точки безопасности из циклов for(int i=0; i<N; i++)' },
      { metric: 'Kafka Group Eviction', value: 'STW > max.poll.interval', note: 'Брокер выгоняет консьюмера во время Full GC, запуская шторм ребалансировок' }
    ],
    formulaOrCode: `// Ловушка исчисляемого цикла (Counted Loop):
// Компилятор C2 разворачивает цикл со счетчиком int и удаляет Safepoint Poll:
for (int i = 0; i < massiveArray.length; i++) {
  // Этот поток заставляет ВСЮ JVM спать на Safepoint, пока цикл не завершится!
}
// Решение: -XX:+UseCountedLoopSafepoints или замена int на long i = 0L;`,
    checklist: [
      'Сопоставлен ли лог GC (-Xlog:gc*) со временем деградации p99 в APM?',
      'Если G1GC Full GC: нет ли в логах записей "humongous allocation request"?',
      'Если ZGC: нет ли в логах событий "Allocation Stall"?'
    ]
  },
  {
    id: 'scientific-triage',
    number: '05',
    title: 'Научный метод расследования: RED, USE и защита Blast Radius',
    badge: 'SRE Methodology',
    badgeColor: 'text-indigo-800 bg-indigo-100 border-indigo-200',
    summary:
      'Хаотичные рестарты и слепые догадки уничтожают цифровые улики и усугубляют каскадный сбой. Триаж на прод-аварии ведется строго по 4-шаговому циклу: Симптом -> Фальсифицируемая гипотеза -> Проверка телеметрии -> Безопасная ремедиация.',
    detailsTable: [
      { metric: 'RED Method (Customer)', value: 'Rate, Errors, Duration', note: 'RPS трафика, 5xx ошибки, p99 задержка — оценка боли пользователей' },
      { metric: 'USE Method (Resources)', value: 'Utilization, Saturation, Errors', note: 'Загрузка CPU/RAM, глубина очередей пулов/диска, аппаратные ошибки' },
      { metric: 'Blast Radius Control', value: 'Bounded Mitigation', note: 'Rate limiting / Shedding трафика вместо опасных правок конфигов наживую' },
      { metric: 'Forensic Preservation', value: 'jcmd Thread/Heap dump', note: 'Снятие дампа ПЕРЕД перезапуском пода, чтобы не потерять причину аварии' }
    ],
    formulaOrCode: `// 4 шага научного дежурства:
1. Symptom: Фиксация клиентского эффекта (RED) и насыщения ресурсов (USE).
2. Hypothesis: Формулировка причины (например, "Потоки висят на получении HikariCP коннекта").
3. Verification: Поиск точечного факта (jstack: 100 потоков в HikariPool.getConnection).
4. Mitigation: Локализация с минимальным радиусом поражения (Rate Limiting, Circuit Breaker).`,
    checklist: [
      'Снят ли тред-дамп и хип-дамп ПЕРЕД перезапуском пода?',
      'Сформулирована ли фальсифицируемая гипотеза перед открытием консоли?',
      'Проверен ли радиус поражения: не убьет ли масштабирование подов нижележащую БД?'
    ]
  }
];

export const TriageCompassSheet: React.FC<TriageCompassSheetProps> = ({
  isOpen,
  onClose,
  onAskTutorAboutRule
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSectionId, setActiveSectionId] = useState<string>(TRIAGE_RULES[0].id);

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

  const filteredRules = TRIAGE_RULES.filter(
    (rule) =>
      rule.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rule.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rule.badge.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const currentRule =
    TRIAGE_RULES.find((r) => r.id === activeSectionId) || TRIAGE_RULES[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/50 backdrop-blur-md animate-in fade-in duration-200 font-sans">
      <div className="relative w-full max-w-5xl h-[88vh] max-h-[850px] bg-white/95 rounded-3xl shadow-2xl border border-slate-200/90 flex flex-col overflow-hidden text-slate-800">
        
        {/* Top Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200/80 bg-slate-50/80 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-600 to-rose-600 text-white flex items-center justify-center shadow-md">
              <Compass className="w-5 h-5 animate-spin-slow" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight text-slate-900">
                  Triage Compass • Золотые Правила SRE (2026)
                </h2>
                <span className="hidden sm:inline text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                  Ctrl + /
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Справочник криминалистики JVM, thread dumps, утечек памяти, пауз GC и методологий RED/USE
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
            title="Закрыть (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Navigation Bar */}
        <div className="p-3 border-b border-slate-200/60 bg-white flex flex-col sm:flex-row items-center gap-3 shrink-0">
          <div className="relative flex-1 w-full">
            <input
              type="text"
              placeholder="Поиск по правилам (например: thread states, deadlock, metaspace, humongous, RED/USE)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-100/80 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto no-scrollbar py-0.5">
            {filteredRules.map((rule) => (
              <button
                key={rule.id}
                type="button"
                onClick={() => setActiveSectionId(rule.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                  activeSectionId === rule.id
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>{rule.number}</span>
                <span className="hidden md:inline">{rule.badge}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content Body: Two columns on wide screens */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          <div className="space-y-4">
            
            {/* Rule Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <span className="text-xl font-black text-amber-700 font-mono">
                  #{currentRule.number}
                </span>
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900">
                  {currentRule.title}
                </h3>
              </div>
              <span
                className={`self-start sm:self-auto text-xs font-mono font-bold px-3 py-1 rounded-full border ${currentRule.badgeColor}`}
              >
                {currentRule.badge}
              </span>
            </div>

            {/* Summary */}
            <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200/80 text-xs sm:text-sm text-slate-700 leading-relaxed font-sans">
              {currentRule.summary}
            </div>

            {/* Details Table */}
            {currentRule.detailsTable && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-amber-600" />
                  <span>Эталонные ориентиры и сигнатуры:</span>
                </h4>
                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-slate-100/90 text-slate-600 border-b border-slate-200">
                      <tr>
                        <th className="p-2.5 sm:px-4 font-bold">Событие / Паттерн</th>
                        <th className="p-2.5 sm:px-4 font-bold text-amber-700">Значение</th>
                        <th className="p-2.5 sm:px-4 font-bold hidden sm:table-cell">Диагностический смысл</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {currentRule.detailsTable.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/80 transition">
                          <td className="p-2.5 sm:px-4 font-bold text-slate-800">{row.metric}</td>
                          <td className="p-2.5 sm:px-4 font-extrabold text-amber-800">{row.value}</td>
                          <td className="p-2.5 sm:px-4 text-slate-600 text-[11px] hidden sm:table-cell font-sans">
                            {row.note}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Code or Formula Snippet */}
            {currentRule.formulaOrCode && (
              <div className="space-y-1.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-rose-600" />
                  <span>Диагностический код & Формула:</span>
                </h4>
                <pre className="p-3.5 rounded-2xl bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto border border-slate-800 leading-relaxed shadow-inner">
                  {currentRule.formulaOrCode}
                </pre>
              </div>
            )}

            {/* Verification Checklist */}
            <div className="space-y-2 pt-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Чек-лист проверки гипотезы на собеседовании:</span>
              </h4>
              <ul className="grid grid-cols-1 gap-2 text-xs">
                {currentRule.checklist.map((item, idx) => (
                  <li
                    key={idx}
                    className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-2.5 text-slate-700"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span className="leading-snug">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

          </div>
        </div>

        {/* Bottom Footer Actions */}
        <div className="p-3.5 sm:p-4 border-t border-slate-200/80 bg-slate-50/80 flex items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 hidden sm:flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-slate-400" />
            <span>Используйте стрелки или кликайте по вкладкам для перехода между правилами</span>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {onAskTutorAboutRule && (
              <button
                type="button"
                onClick={() => onAskTutorAboutRule(currentRule.title, currentRule.summary)}
                className="px-4 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-extrabold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                <span>Спросить Incident Commander</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold transition cursor-pointer shadow-sm"
            >
              Закрыть (Esc)
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
