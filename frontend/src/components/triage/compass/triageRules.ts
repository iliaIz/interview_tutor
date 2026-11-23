export interface CompassSection {
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

export const TRIAGE_RULES: CompassSection[] = [
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
