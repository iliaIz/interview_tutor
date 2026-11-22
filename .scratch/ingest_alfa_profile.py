import json

alfa_profile = {
    "id": "alfa_digital",
    "name": "АО «Альфа-Банк» (Alfa Digital & А-Токен)",
    "brandColor": "#EF3124",
    "logoBadge": "🅰️",
    "tagline": "Senior Java & HighLoad FinTech: ЦФА «А-Токен», Waves Enterprise, Kafka EOS & Zero-Downtime PostgreSQL",
    "culture": {
        "engineeringParadigm": "Product-minded Senior Engineer с глубоким пониманием физики JVM, транзакционной надежности и нулевой толерантностью к дефектам в финансовых потоках.",
        "metricsFocus": [
            "P99 Latency < 10ms",
            "Zero-Downtime DDL миграции",
            "Exactly-Once Processing (EOS 2PC)",
            "100% Data Integrity (Double-Entry Bookkeeping)",
            "HikariCP Zero Connection Starvation"
        ],
        "redFlags": [
            "Поверхностные ответы на уровне синтаксиса без понимания физики (JMM, MVCC, Page Cache).",
            "Использование double или float для денежных сумм вместо BigDecimal.",
            "Внешние сетевые вызовы (HTTP/RPC) внутри @Transactional (удержание коннектов HikariCP).",
            "Незнание устройства платформы «А-Токен» (утверждение, что она построена на Hyperledger вместо Waves Enterprise).",
            "Синхронизация на interned строках или static HashMap без потокобезопасности."
        ],
        "greenFlags": [
            "Рассуждения от первопричины (L1/L2 кэш-линии, JMM StoreLoad барьеры, xmin/xmax, sendfile Zero-Copy).",
            "Владение формулой Литтла (L = λ × W) и официальным расчетом пулов HikariCP.",
            "Архитектурное решение Dual Write через Transactional Outbox + Debezium CDC.",
            "Глубокое понимание специфики блокчейна Waves Enterprise, СКЗИ КриптоПро ГОСТ КС2 и SOAP интеграции с АБС."
        ]
    },
    "expressRunbook": {
        "pitchScriptMarkdown": "«Здравствуйте! Я Senior Java-разработчик со специализацией на высоконагруженных финтех-системах, распределенных транзакциях и платформенной надежности.\n\nВ фокусе моей экспертизы — проектирование отказоустойчивых бэкендов на Java 21, Spring Boot и PostgreSQL под требованиями Zero-Downtime и 100% финансовой консистентности. Работал с устранением распределенного Dual Write через Transactional Outbox с Debezium CDC, калибровкой пулов HikariCP по закону Литтла и гарантией Exactly-Once в Kafka.\n\nВ Альфа-Банке мне особенно интересна платформа цифровых финансовых активов «А-Токен»: синергия блокчейна Waves Enterprise, криптографии ГОСТ КС2 и надежного связывания с медленными банковскими АБС по SOAP. Готов глубоко погрузиться в проектирование сервисов выпуска и обращения ЦФА с защитой от Double-Spending и перегрузок на первичных размещениях.»",
        "mustReviewTaskIds": [
            "cr-alfa-01",
            "lc-alfa-01",
            "sql-alfa-01",
            "L3-PERF-HIKARICP-STARVATION",
            "L4-DIST-IDEMPOTENT-OUTBOX"
        ],
        "mustReviewTasks": [
            {"taskId": "cr-alfa-01", "title": "PaymentController: 8+ багов за 15 минут", "targetArena": "incidents", "badge": "🅰️ Code Review"},
            {"taskId": "lc-alfa-01", "title": "SegmentedConcurrentHashMap (40 мин)", "targetArena": "practice", "badge": "⚡ Concurrency"},
            {"taskId": "sql-alfa-01", "title": "Покупатели Laptop и Monitor (INTERSECT vs HAVING)", "targetArena": "sql_arena", "badge": "📊 SQL"},
            {"taskId": "L3-PERF-HIKARICP-STARVATION", "title": "Калибровка пула HikariCP по закону Литтла", "targetArena": "system_design", "badge": "🏛️ HLD"},
            {"taskId": "L4-DIST-IDEMPOTENT-OUTBOX", "title": "Idempotent Payment & Transactional Outbox", "targetArena": "system_design", "badge": "🏛️ HLD"}
        ],
        "checklist": [
            "Четко сформулируйте ответ по памяти JVM: стек фреймов, Eden/Survivor, Metaspace в нативной памяти, Off-heap zero-copy sendfile.",
            "Вспомните JMM: StoreLoad барьер при volatile, эволюцию локов HotSpot (Biased -> Thin -> Fat), LongAdder stripe cells.",
            "Повторите MVCC PostgreSQL: xmin, xmax, Dead Tuples, почему VACUUM спасает от 2-миллиардного Wraparound.",
            "Помните: в Альфа-Банке «А-Токен» построен на WAVES ENTERPRISE (НЕ Hyperledger!), смарт-контракты в Docker-контейнерах, СКЗИ КриптоПро ГОСТ КС2.",
            "На лайв-кодинге и код-ревью: ZERO double в финансах (только BigDecimal HALF_EVEN), никаких HTTP-вызовов внутри @Transactional."
        ]
    },
    "stages": [
        {
            "id": "alfa-stage-1-screening",
            "stageNumber": 1,
            "title": "1. Технический скрининг (1 час)",
            "format": "voice_fit",
            "estimatedMinutes": 60,
            "description": "Теоретический блиц по 27 ключевым Senior-вопросам, экспресс-ревью платёжного контроллера (CR-01), лайв-кодинг сегментированной ConcurrentHashMap (LC-01) и 5 SQL-задач в PGlite.",
            "targetArena": "voice_modal",
            "targetEntityId": "alfa_screening_deck",
            "weight": 0.4
        },
        {
            "id": "alfa-stage-2-system-design",
            "stageNumber": 2,
            "title": "2. Глубокий тех и System Design (1.5 часа)",
            "format": "system_design",
            "estimatedMinutes": 90,
            "description": "Калибровка пулов HikariCP по закону Литтла (SD-01), топология Kafka EOS и Cooperative Sticky (SD-02), Transactional Outbox + Debezium (SD-03), расследование деградации БД (SD-04) и архитектура ЦФА «А-Токен» (Waves Enterprise + SOAP АБС).",
            "targetArena": "system_design",
            "targetEntityId": "L4-DIST-IDEMPOTENT-OUTBOX",
            "weight": 0.6
        }
    ],
    "competencies": [
        {
            "id": 1,
            "title": "Память JVM и Low-Latency сборка мусора",
            "category": "engineering",
            "categoryLabel": "Core Engineering",
            "iconName": "Cpu",
            "techStack": "Java 21, JVM Internals, G1, ZGC",
            "description": "Глубокое понимание жизненного цикла объектов, стека потока, Metaspace, Off-heap Direct Memory и механизмов ультранизких пауз STW в ZGC (Colored Pointers, Load Barriers).",
            "interviewQuestion": "Как физически работают Colored Pointers в ZGC и почему ArrayList практически всегда эффективнее LinkedList по кэш-линиям CPU?",
            "barRaiserExpectation": "Кандидат объясняет 4 бита метаданных в указателе, самовосстановление ссылок через Load Barrier без глобальной паузы, и 64-байтные CPU cache lines."
        },
        {
            "id": 2,
            "title": "Многопоточность и JMM инварианты",
            "category": "engineering",
            "categoryLabel": "Concurrency",
            "iconName": "Zap",
            "techStack": "JMM, ReentrantLock, LongAdder, CAS",
            "description": "Модель памяти Java, правила happens-before, переупорядочивание инструкций, эволюция локов HotSpot и масштабируемые структуры данных.",
            "interviewQuestion": "Почему LongAdder масштабируется под высокой конкуренцией на многоядерных CPU значительно лучше AtomicLong?",
            "barRaiserExpectation": "Кандидат называет шардирование по ячейкам Cell[] с хэшированием по потоку и устранение contention на одном общем cache line по сравнению с CAS-спином в AtomicLong."
        },
        {
            "id": 3,
            "title": "Spring Framework: Подкапотка и транзакции",
            "category": "engineering",
            "categoryLabel": "Frameworks",
            "iconName": "Layers",
            "techStack": "Spring Boot 3.3, Spring AOP, WebFlux",
            "description": "Устройство CGLIB против JDK Dynamic Proxy, связь Connection с ThreadLocal в TransactionSynchronizationManager, ловушка self-invocation.",
            "interviewQuestion": "Что физически происходит при вызове this.method() с @Transactional(REQUIRES_NEW) изнутри того же сервиса?",
            "barRaiserExpectation": "Кандидат четко формулирует обход прокси-обертки Spring, отсутствие открытия новой транзакции и объединение с текущей, объясняя связь с AOP-перехватчиком."
        },
        {
            "id": 4,
            "title": "PostgreSQL: MVCC, блокировки и Zero-Downtime",
            "category": "engineering",
            "categoryLabel": "Data Storage",
            "iconName": "Database",
            "techStack": "PostgreSQL 16, Liquibase, Flyway, B-Tree",
            "description": "Физическое устройство кортежей, xmin/xmax, удаление Dead Tuples вакуумом, предотвращение Transaction Wraparound, SSI Write Skew и безопасные миграции.",
            "interviewQuestion": "Зачем нужен VACUUM в PostgreSQL и что произойдет, если база данных достигнет 2 миллиардов транзакций без его работы?",
            "barRaiserExpectation": "Кандидат описывает freeze транзакций, предотвращение ухода старых данных в будущее из-за переполнения 32-битного счетчика xid и вакуумизацию страниц буферного кэша."
        },
        {
            "id": 5,
            "title": "Apache Kafka: Exactly-Once и Zero-Copy",
            "category": "engineering",
            "categoryLabel": "Messaging",
            "iconName": "Terminal",
            "techStack": "Apache Kafka 3.7+, EOS, Page Cache",
            "description": "Внутреннее устройство сегментов лога, передача данных через системный вызов sendfile без копирования в user-space, 2PC транзакционный координатор.",
            "interviewQuestion": "Как физически реализуется Zero-Copy передача сообщений из брокера Kafka в сетевую карту?",
            "barRaiserExpectation": "Кандидат называет системный вызов sendfile, чтение из OS Page Cache напрямую в DMA буфер сетевого адаптера без переключения контекста ядра и аллокации в JVM Heap."
        },
        {
            "id": 6,
            "title": "Распределенные системы: Dual Write и SAGA",
            "category": "engineering",
            "categoryLabel": "Distributed",
            "iconName": "Server",
            "techStack": "Transactional Outbox, Debezium CDC, SAGA, Resilience4j",
            "description": "Устранение несогласованности при одновременной записи в БД и отправке в шину, компенсирующие транзакции и защита от каскадных сбоев.",
            "interviewQuestion": "В чем фундаментальное отличие Polling Worker против Debezium CDC при реализации Transactional Outbox?",
            "barRaiserExpectation": "Кандидат обосновывает накладные расходы поллинга SELECT FOR UPDATE SKIP LOCKED на диск СУБД против неблокирующего вычитывания WAL-логов PostgreSQL через pgoutput/Debezium."
        },
        {
            "id": 7,
            "title": "DevOps, Kubernetes и cgroups",
            "category": "engineering",
            "categoryLabel": "Infrastructure",
            "iconName": "Box",
            "techStack": "Kubernetes, Docker, cgroups v2, OpenSearch MDC",
            "description": "Жизненный цикл Pod, антипаттерны в Liveness/Readiness пробах, Graceful Shutdown через preStop хуки, cgroups лимиты памяти в контейнерах.",
            "interviewQuestion": "Почему проверка соединения с базой данных внутри Liveness-пробы пода — это катастрофический антипаттерн?",
            "barRaiserExpectation": "Кандидат объясняет каскадный рестарт всех подов микросервиса при кратковременном сетевом сбое БД, что добивает базу лавиной повторных подключений при старте."
        },
        {
            "id": 8,
            "title": "Платформа «А-Токен» (ЦФА) и FinTech",
            "category": "product",
            "categoryLabel": "Banking & CFA",
            "iconName": "Shield",
            "techStack": "Waves Enterprise, КриптоПро ГОСТ КС2, Misys Equation SOAP",
            "description": "Архитектура распределенного реестра для выпуска цифровых финансовых активов (ФЗ №259), криптографическая подпись, защита от Double-Spending и Hardcap.",
            "interviewQuestion": "На базе какой платформы построен «А-Токен» и как организована защита от Double-Spending при пиковом первичном размещении?",
            "barRaiserExpectation": "Кандидат твердо знает, что платформа построена на Waves Enterprise (не Hyperledger!), использует ГОСТ-шифрование и атомарную резервацию баланса в СУБД с последующим подтверждением в смарт-контракте."
        },
        {
            "id": 9,
            "title": "Инженерное мышление и надежность",
            "category": "quality_ai",
            "categoryLabel": "Mindset",
            "iconName": "CheckCircle",
            "techStack": "Bar-Raiser, Root Cause, Production Triage",
            "description": "Умение расследовать аварии от первопричины, не маскировать симптомы костылями, отстаивать архитектурные инварианты перед бизнесом.",
            "interviewQuestion": "Что вы предпримете, если в продакшене время отклика базы данных выросло в 10 раз, а пул соединений HikariCP полностью исчерпан?",
            "barRaiserExpectation": "Кандидат предлагает не увеличивать размер пула вслепую, а проверить pg_stat_activity и pg_locks на предмет блокировок от DDL миграций или отсутствующих индексов."
        }
    ],
    "specReviewChecklist": [
        {
            "id": 1,
            "title": "Финансовая точность (Zero Float)",
            "tag": "FinTech Invariant",
            "question": "Все ли расчеты денежных балансов и процентов используют BigDecimal с явным указанием масштаба и RoundingMode.HALF_EVEN?",
            "deliverable": "Отсутствие примитивов double/float в финансовых DTO и сущностях.",
            "dangerIfMissing": "Накопление погрешностей округления и расхождение балансов бухгалтерского учета."
        },
        {
            "id": 2,
            "title": "Изоляция пулов HikariCP от сетевых RPC",
            "tag": "Resilience",
            "question": "Исключены ли внешние синхронные вызовы (HTTP, SOAP к АБС, gRPC) из контекста @Transactional?",
            "deliverable": "Вынос внешних запросов до открытия или после фиксации транзакции БД.",
            "dangerIfMissing": "Зависание соединений СУБД при задержках на стороне АБС, каскадное исчерпание пула и отказ сервиса."
        },
        {
            "id": 3,
            "title": "Атомарность публикации (Transactional Outbox)",
            "tag": "Architecture",
            "question": "Гарантирована ли отправка событий в Kafka строго после коммита транзакции в СУБД?",
            "deliverable": "Использование таблицы outbox_events и Debezium CDC вместо прямого вызова kafkaTemplate.send().",
            "dangerIfMissing": "Отправка фантомных сообщений в шину при откате транзакции базы данных."
        },
        {
            "id": 4,
            "title": "Zero-Downtime DDL миграции",
            "tag": "Database",
            "question": "Используются ли безопасные многошаговые миграции без блокировки ACCESS EXCLUSIVE?",
            "deliverable": "Добавление колонок с NULL, создание индексов CONCURRENTLY, удаление в фазе Contract.",
            "dangerIfMissing": "Блокировка таблицы на чтение и запись в продакшене во время релиза."
        },
        {
            "id": 5,
            "title": "Идемпотентность потребителей Kafka",
            "tag": "Kafka",
            "question": "Защищены ли консьюмеры от повторной обработки сообщений при ребалансировке Consumer Group?",
            "deliverable": "Идемпотентный ключ обработки (idempotency key) с уникальным индексом в СУБД.",
            "dangerIfMissing": "Двойное списание или повторное зачисление средств клиентам."
        },
        {
            "id": 6,
            "title": "Безопасность cgroups и Graceful Shutdown",
            "tag": "Infrastructure",
            "question": "Настроен ли preStop хук для корректного завершения обработки активных транзакций в K8s?",
            "deliverable": "preStop: sleep 15 + spring.lifecycle.timeout-per-shutdown-phase: 30s.",
            "dangerIfMissing": "Резкое уничтожение пода сигналом SIGKILL и обрыв пользовательских финансовых операций."
        }
    ],
    "starScenarios": [
        {
            "id": 1,
            "title": "Ликвидация аварии с исчерпанием пула соединений HikariCP",
            "tagline": "Little's Law & Индексация в HighLoad",
            "badge": "⚡ Production Incident",
            "interviewQuestion": "Расскажите о самом сложном инциденте деградации базы данных, который вам довелось расследовать.",
            "situation": "В высоконагруженном сервисе платежей в часы пик начались массовые таймауты HikariCP (Connection is not available). Сервис перестал отвечать, бизнес терял миллионы рублей.",
            "task": "Локализовать первопричину без слепого увеличения размера пула и восстановить пропускную способность за минимальное время.",
            "action": [
                "Снял мгновенный срез активных запросов через pg_stat_activity и pg_locks.",
                "Обнаружил, что метод аудита выполнял медленный Seq Scan по миллионной таблице без индекса, удерживая соединение 800 мс вместо 5 мс.",
                "Создал составной индекс с опцией CONCURRENTLY без блокировки таблицы на запись.",
                "Скорректировал размер пула HikariCP по формуле Литтла (Pool = 2 * Cores + Spindles = 32)."
            ],
            "result": "Время отклика базы вернулось к норме (3 мс), очередь в пуле соединений обнулилась, задержки P99 упали до 8 мс.",
            "strongHireTakeaway": "Глубокое понимание того, что увеличение пула при деградации СУБД лишь усугубляет Context Switching и добивает базу.",
            "redFlagToAvoid": "Предложение 'просто увеличить пул до 200 коннектов' или рестартовать базу без анализа локов."
        },
        {
            "id": 2,
            "title": "Внедрение Transactional Outbox на базе Debezium CDC",
            "tagline": "Устранение проблемы Dual Write",
            "badge": "🏛️ Distributed Systems",
            "interviewQuestion": "Как вы решали задачу гарантированной доставки событий при одновременной записи в БД и Kafka?",
            "situation": "В микросервисе заказов происходили регулярные расхождения: заказ сохранялся в БД, но из-за сетевого сбоя вызов KafkaTemplate падал. Потребители не получали событие, что приводило к срыву отгрузок.",
            "task": "Спроектировать надежную архитектуру сквозной доставки событий без использования тяжеловесного и ненадежного 2PC/XA.",
            "action": [
                "Создал таблицу outbox_events, куда бизнес-события записываются в той же транзакции базы данных.",
                "Развернул Debezium PostgreSQL Connector, считывающий WAL-логи через плагин pgoutput без нагрузки на дисковый пул СУБД.",
                "Настроил отправку в Kafka с idempotent producer (acks=all, max.in.flight.requests.per.connection=1).",
                "Реализовал идемпотентных потребителей с проверкой уникального event_id."
            ],
            "result": "Достигнута гарантия At-Least-Once доставки на транспортном уровне и Exactly-Once на прикладном уровне. Расхождения между БД и Kafka снизились до 0.",
            "strongHireTakeaway": "Понимание разницы между неблокирующим чтением WAL через CDC и тяжелым поллингом через SELECT FOR UPDATE SKIP LOCKED.",
            "redFlagToAvoid": "Использование двух независимых try-catch блоков для БД и Kafka или распределенных транзакций XA."
        },
        {
            "id": 3,
            "title": "Защита платформы от Double-Spending при первичном размещении ЦФА",
            "tagline": "HighLoad Concurrency & А-Токен",
            "badge": "💳 CFA & FinTech",
            "interviewQuestion": "Как вы обеспечиваете защиту от превышения лимитов и двойных списаний в высококонкурентных сценариях?",
            "situation": "При открытии книги заявок на первичное размещение облигаций на платформе ЦФА тысячи инвесторов отправляют заявки одновременно в первую секунду. Сумма заявок не должна превысить жесткий Hardcap выпуска.",
            "task": "Исключить овербукинг и двойные списания средств инвесторов при нагрузке 5000 RPS.",
            "action": [
                "Использовал атомарное условное обновление баланса в СУБД (UPDATE issue SET allocated = allocated + amount WHERE id = ? AND allocated + amount <= hardcap).",
                "Для распределенной синхронизации с блокчейном Waves Enterprise применил двухфазную фиксацию статуса через смарт-контракт.",
                "Реализовал шлюз с очередью RabbitMQ/Kafka для сглаживания пиковой нагрузки (Rate Limiting и Throttling)."
            ],
            "result": "Выпуск на 1 млрд рублей был полностью размещен за 45 секунд без единой ошибки овербукинга или коллизии баланса.",
            "strongHireTakeaway": "Владение атомарными предикативными обновлениями на уровне СУБД без избыточных медленных блокировок всей таблицы.",
            "redFlagToAvoid": "Чтение баланса через обычный SELECT с последующим UPDATE в коде Java (классический race condition Lost Update)."
        },
        {
            "id": 4,
            "title": "Интеграция микросервисов с медленной АБС по SOAP",
            "tagline": "Изоляция отказов и Bulkhead",
            "badge": "🛡️ Legacy Integration",
            "interviewQuestion": "Как изолировать современный микросервис от медленных и нестабильных легаси-систем банка?",
            "situation": "Микросервис выпуска карт обращался к центральной автоматизированной банковской системе (АБС) по SOAP. Периодически АБС отвечала дольше 30 секунд, что приводило к зависанию потоков микросервиса и падению клиентского мобильного банка.",
            "task": "Построить надежный буферный слой, предотвращающий каскадный отказ мобильного приложения при деградации АБС.",
            "action": [
                "Внедрил Resilience4j Circuit Breaker с переходом в Half-Open состояние при 50% ошибок за скользящее окно 100 запросов.",
                "Настроил Bulkhead пул потоков, жестко выделив не более 10 параллельных обращений к SOAP АБС, чтобы не истощать основной пул сервиса.",
                "Перевел клиентские операции на асинхронную модель с немедленной выдачей трекинг-номера (ACCEPTED 202) и последующим уведомлением через WebSocket/Push."
            ],
            "result": "Мобильный банк перестал деградировать при сбоях АБС; клиенты получают мгновенный отклик, а операции надежно досылаются при восстановлении доступности.",
            "strongHireTakeaway": "Проектирование систем с учетом неизбежности отказов внешних зависимостей (Design for Failure).",
            "redFlagToAvoid": "Синхронные блокирующие вызовы без таймаутов и Circuit Breaker."
        }
    ],
    "customQuickActionChips": [
        {"id": "alfa-grill-jvm", "label": "🅰️ Загриль по JVM и памяти", "prompt": "Проведи жесткий экзамен уровня Senior Java в Альфа-Банке: задай мне глубокий вопрос по устройству памяти JVM (Stack, Metaspace, Off-heap) или механизмам ZGC. Требуй ответов от первопричины."},
        {"id": "alfa-grill-concurrency", "label": "⚡ Экзамен по Concurrency", "prompt": "Задай мне сложный вопрос по JMM, happens-before, эволюции локов HotSpot или LongAdder. Оценивай точность и выявляй малейшие неточности."},
        {"id": "alfa-grill-atoken", "label": "🪙 Архитектура «А-Токен»", "prompt": "Давай разберем архитектуру платформы ЦФА «А-Токен»: блокчейн Waves Enterprise, интеграцию с АБС и защиту от Double-Spending. Проверь мою готовность ко 2-му этапу собеседования."}
    ]
}

# Update company_profiles.json
with open('json/company_profiles.json', 'r', encoding='utf-8') as f:
    profiles = json.load(f)

updated = [p for p in profiles if p['id'] != 'alfa_digital']
updated.append(alfa_profile)

with open('json/company_profiles.json', 'w', encoding='utf-8') as f:
    json.dump(updated, f, indent=2, ensure_ascii=False)

print(f'Successfully ingested Alfa Digital profile! Total profiles: {len(updated)}')
