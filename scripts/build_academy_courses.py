import json
import re
import os

def parse_senior_sprint(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Split into steps
    step_blocks = re.findall(r'### \*\*Шаг (\d+)\.\s*(.*?)\*\*(.*?)(?=### \*\*Шаг \d+|\Z)', content, re.DOTALL)
    steps = []
    
    milestones = [
        {"id": "m1", "title": "Майлстоун 1: Java 21, JMM & Virtual Threads", "stepRange": "1–5"},
        {"id": "m2", "title": "Майлстоун 2: Базы данных, MVCC & Kafka Streaming", "stepRange": "6–13"},
        {"id": "m3", "title": "Майлстоун 3: Распределенный System Design & HighLoad", "stepRange": "14–16"},
        {"id": "m4", "title": "Майлстоун 4: JVM Forensics & Анализ Дампов", "stepRange": "17–19"},
        {"id": "m5", "title": "Майлстоун 5: Concurrency, Безопасность & Отказоустойчивость", "stepRange": "20–25"}
    ]

    for num_str, title, block in step_blocks:
        num = int(num_str)
        if num > 25:
            continue
            
        m_id = "m1" if num <= 5 else "m2" if num <= 13 else "m3" if num <= 16 else "m4" if num <= 19 else "m5"
        
        concept_m = re.search(r'\*\s*\*\*Senior Bar Concept\*\*:\s*(.*?)(?=\n\*\s*\*\*|\Z)', block, re.DOTALL)
        concept = concept_m.group(1).strip() if concept_m else title.strip()
        
        trap_m = re.search(r'\*\s*\*\*Ловушка на собеседовании\*\*:\s*(.*?)(?=\n\*\s*\*\*|\Z)', block, re.DOTALL)
        trap = trap_m.group(1).strip() if trap_m else "Незнание внутренних механизмов реализации и граничных условий."
        
        theory_m = re.search(r'\*\s*\*Теоретический вопрос\*:\s*(.*?)(?=\n\s*\*|\n\*\s*\*|\Z)', block, re.DOTALL)
        theory_q = theory_m.group(1).strip() if theory_m else f"Разбор темы {title.strip()}"
        
        practice_m = re.search(r'\*\s*\*Практическая задача \((.*?)\)\*:\s*(.*?)(?=\n\s*\*|\n\*\s*\*|\Z)', block, re.DOTALL)
        task_type = practice_m.group(1).strip() if practice_m else "LLD"
        task_desc = practice_m.group(2).strip() if practice_m else f"Реализовать решение для {title.strip()}"
        
        bonus_m = re.search(r'\*\s*\*\*⭐ Bonus / Deep Dive\*\*:\s*(.*?)(?=\n\*\s*\*\*|\Z)', block, re.DOTALL)
        bonus_desc = bonus_m.group(1).strip() if bonus_m else "Углубленный анализ работы под предельными нагрузками."
        
        checklist_items = re.findall(r'\[\s*\]\s*(.*?)(?=\n\s*\*|\n\s*\[|\Z)', block)
        if not checklist_items:
            checklist_items = [
                f"Глубокое понимание {concept[:60]}",
                f"Успешная реализация практической задачи ({task_type})",
                "Готовность аргументировать компромиссы (Trade-offs) на собеседовании"
            ]
        else:
            checklist_items = [item.strip() for item in checklist_items]

        # Map to specific entity ids
        lld_map = {
            1: "lld-rate-limiter",
            2: "lld-multi-threaded-elevator",
            3: "lld-task-scheduler-cron",
            4: "lld-highload-counter-striped",
            5: "lld-connection-pool-manager",
            6: "lld-transactional-outbox",
            8: "lld-double-entry-ledger",
            9: "lld-distributed-lock-redis",
            11: "lld-consistent-hash-ring",
            13: "lld-saga-orchestrator",
            15: "lld-cache-stampede-xfetch",
            20: "lld-lock-free-stack",
            22: "lld-circuit-breaker-resilience",
            24: "lld-event-sourcing-cqrs",
            25: "lld-highload-trading-matching-engine"
        }
        
        hld_map = {
            6: "hld-scenario-01",
            14: "hld-scenario-02",
            15: "hld-scenario-03",
            16: "hld-scenario-04",
            22: "hld-scenario-05",
            24: "hld-scenario-06",
            25: "hld-scenario-07"
        }
        
        triage_map = {
            2: "triage-incident-02",
            5: "triage-incident-04",
            7: "triage-incident-07",
            9: "triage-incident-03",
            17: "triage-incident-01",
            18: "triage-incident-05",
            19: "triage-incident-06",
            25: "triage-incident-15"
        }

        steps.append({
            "stepNumber": num,
            "title": title.strip(),
            "milestoneId": m_id,
            "seniorBarConcept": concept,
            "interviewTrap": trap,
            "estimatedMinutes": 25,
            "coreRequirements": {
                "theoryTopic": "core",
                "theoryTitle": theory_q,
                "taskType": task_type.lower(),
                "taskDescription": task_desc,
                "lldChallengeSlug": lld_map.get(num),
                "hldScenarioId": hld_map.get(num),
                "triageIncidentId": triage_map.get(num)
            },
            "bonusDeepDive": {
                "title": "⭐ Bar-Raiser Углубление",
                "description": bonus_desc
            },
            "masteryChecklist": checklist_items,
            "crossCourseLinks": [f"concurrency-master:step-{num}"] if num in [1, 2, 4, 20] else []
        })

    return {
        "id": "senior-bigtech-sprint-25",
        "category": "career",
        "title": "🚀 Senior BigTech Sprint (25 Шагов)",
        "badge": "Экспресс Онсайт",
        "totalSteps": 25,
        "difficulty": "solid_senior",
        "estimatedDuration": "2 недели (интенсив)",
        "description": "Концентрированная программа из 25 ключевых шагов: устранение главных блокеров на собеседованиях в BigTech (Google, Meta, Stripe, Яндекс, Т-Банк, Авито).",
        "milestones": milestones,
        "steps": steps
    }

def parse_staff_track(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Search section 2 for Staff Track 60 steps
    # If explicit 60 steps are present, parse them; otherwise construct structured 60-step syllabus from the report
    milestones = [
        {"id": "sm1", "title": "Майлстоун 1: JVM Low-Level, JIT & Continuations Internals (Шаги 1–12)", "stepRange": "1–12"},
        {"id": "sm2", "title": "Майлстоун 2: Распределенный Консенсус, Raft & Storage Engines (Шаги 13–24)", "stepRange": "13–24"},
        {"id": "sm3", "title": "Майлстоун 3: Event Streaming, Zero-Copy & KRaft (Шаги 25–36)", "stepRange": "25–36"},
        {"id": "sm4", "title": "Майлстоун 4: Микросервисная Резильентность & Chaos Engineering (Шаги 37–48)", "stepRange": "37–48"},
        {"id": "sm5", "title": "Майлстоун 5: Архитектурное Лидерство, TCO & Bar-Raiser Defense (Шаги 49–60)", "stepRange": "49–60"}
    ]

    steps = []
    # Build 60 structured Staff steps
    for i in range(1, 61):
        m_id = "sm1" if i <= 12 else "sm2" if i <= 24 else "sm3" if i <= 36 else "sm4" if i <= 48 else "sm5"
        
        if i <= 12:
            titles = [
                "HotSpot Continuations & C++ ContinuationEntry Layout",
                "JIT C2 Compiler Inlining, Escape Analysis & Scalar Replacement",
                "Foreign Function & Memory API (FFM JEP 454) vs JNI Overhead",
                "Mechanical Sympathy: L1/L2/L3 Cache Line Invalidation & MOESI Protocol",
                "Off-Heap Direct ByteBuffer Memory Management & Netty Leak Forensics",
                "Generational ZGC Colored Pointers & Sub-Millisecond STW Mechanics",
                "Async-Profiler Flame Graphs & Kernel Syscall Latency Analysis",
                "Class Data Sharing (CDS) & Ahead-Of-Time (AOT) Spring Boot 3.3 Engine",
                "Bytecode Instrumentation, Java Agents & ByteBuddy In-Flight Rewriting",
                "Disruptor RingBuffer Lock-Free Architecture & Memory Barriers",
                "CAS Contention Elimination: Striped64, LongAdder & Cache Padding",
                "Scoped Values (JEP 446) & Structured Concurrency Under 100k Virtual Threads"
            ]
            title = titles[i-1]
            concept = f"Углубленная архитектура JVM и ядра ОС: {title}"
            trap = "Попытка оптимизации алгоритмов без учета аппаратных эффектов L1/L3 кэшей и барьеров StoreLoad."
            task_type = "lld"
            task_desc = f"Спроектировать высокопроизводительное решение с нулевой аллокацией для {title}."
            bonus = "Трассировка ассемблерных инструкций через HSDIS и Linux perf stat."
        elif i <= 24:
            idx = i - 13
            titles = [
                "Raft Consensus Protocol: Leader Election & Log Compaction",
                "Split-Brain Prevention, Fencing Tokens & Epoch Invariants",
                "PostgreSQL Shared Buffers, WAL Flush & Recovery Internals",
                "PostgreSQL Serializable Snapshot Isolation (SSI) & SIREAD Lock Escalation",
                "Distributed SQL Spanner / CockroachDB: TrueTime vs Hybrid Logical Clocks",
                "Consistent Hashing Ring with Virtual Nodes & Bounded-Loads Balancing",
                "Distributed Locking Redlock vs ZooKeeper/etcd Quorum Trade-offs",
                "Two-Phase Commit (2PC) vs Saga Orchestration Failure Modes",
                "Deterministic Double-Entry Financial Ledger Design with Banker's Rounding",
                "CQRS & Event Sourcing with Snapshotting and Deterministic Replay",
                "Transactional Outbox with Debezium CDC and Exactly-Once Guarantees",
                "Multi-Master Active-Active Database Replication & Conflict Resolution"
            ]
            title = titles[idx]
            concept = f"Распределенная согласованность и транзакционные хранилища: {title}"
            trap = "Игнорирование сетевых асимметричных разделений (Network Partitions) и фантомных записей."
            task_type = "hld"
            task_desc = f"Спроектировать архитектурный слой с доказанными гарантиями Safety и Liveness для {title}."
            bonus = "Формальная спецификация инвариантов на TLA+ и Chaos Testing сценарии."
        elif i <= 36:
            idx = i - 25
            titles = [
                "Kafka KRaft Consensus Metadata Engine vs ZooKeeper Cluster",
                "Kafka Zero-Copy sendfile() OS Kernel Transfer Mechanics",
                "Kafka Cooperative Sticky Assignor & Dynamic Rebalance Protocols",
                "Kafka Exactly-Once Semantics (EOS v2) & Transaction Coordinator",
                "Event-Driven Out-of-Order Processing: Flink Watermarks & Tumbling Windows",
                "Schema Evolution: Avro, Protobuf & Schema Registry Compatibility Rules",
                "Multi-Region Active-Active Kafka Cluster Replication (MirrorMaker 2)",
                "Kafka Dead Letter Queue (DLQ) & Retry Policy with Backoff Jitter",
                "High-Throughput Compression: Zstandard vs Snappy in Streaming Pipelines",
                "Idempotency Key Deduplication Engine with Redis & Bloom Filters",
                "Distributed Rate Limiter: Sliding Window Counter via Redis Lua Scripts",
                "Real-Time Stream Joining: Temporal Table Joins & State TTL Management"
            ]
            title = titles[idx]
            concept = f"Потоковая обработка больших данных и брокеры сообщений: {title}"
            trap = "Потеря сообщений при сбое брокера из-за некорректного acks=all и min.insync.replicas."
            task_type = "hld"
            task_desc = f"Разработать архитектуру потоковой обработки с гарантией RPO=0 для {title}."
            bonus = "Оптимизация сетевого стека 100GbE и тюнинг параметров socket.send.buffer.bytes."
        elif i <= 48:
            idx = i - 37
            titles = [
                "Circuit Breaker, Bulkhead & Rate Limiter Cascading Resilience",
                "Microservices Graceful Shutdown & Kubernetes SIGTERM Drain Lifecycle",
                "Observability: OpenTelemetry Distributed Tracing & W3C TraceContext",
                "Micrometer High-Cardinality Metrics & Prometheus 1.x / VictoriaMetrics",
                "Multi-Level Caching: L1 In-Memory Caffeine + L2 Distributed Redis",
                "Cache Stampede Protection: XFetch Probabilistic Early Recompute",
                "Zero-Downtime Database Schema Migration (Expand & Contract Pattern)",
                "Disaster Recovery Topologies: RPO=0 / RTO<30s Multi-DC Active-Passive",
                "gRPC vs REST vs GraphQL: Multiplexing, Flow Control & Protobuf Serialization",
                "OAuth2, OIDC & JWT Stateless Security Architecture with JWK Rotation",
                "mTLS & Dynamic Certificate Lifecycle Management with SPIFFE/SPIRE",
                "Chaos Engineering: Automated Fault Injection via Chaos Mesh & Toxiproxy"
            ]
            title = titles[idx]
            concept = f"Отказоустойчивость, безопасность и наблюдаемость: {title}"
            trap = "Каскадное падение кластера из-за отсутствия таймаутов и Bulkhead изоляции."
            task_type = "lld"
            task_desc = f"Реализовать отказоустойчивый шлюз с защитой от Retry Storm для {title}."
            bonus = "Симуляция 50% сбоев в сети и верификация автоматического восстановления."
        else:
            idx = i - 49
            titles = [
                "Infrastructure TCO & FinOps Optimization: Compute, Storage & Network",
                "Architecture Decision Records (ADR) & Trade-off Matrix Formalization",
                "Technical Debt Management & Modernization Roadmap Strategy",
                "Engineering Excellence & System Bar-Raiser Interview Protocol",
                "Capacity Planning & Forecasting Model for 10x Business Scale",
                "High-Frequency Trading Matching Engine: Sub-Microsecond Lock-Free OrderBook",
                "Geo-Distributed Multi-Region Collaborative Document Engine (CRDT)",
                "Distributed Ride-Sharing Dispatch & Spatial Indexing (H3 / S2)",
                "Global S3-Compatible Object Store with Erasure Coding",
                "Global Payment Ledger with Multi-Currency Double-Entry Invariants",
                "Distributed Task Scheduler for Billions of Scheduled Events",
                "Staff/Principal Bar-Raiser Defense & Comprehensive System Design Review"
            ]
            title = titles[idx]
            concept = f"Архитектурная стратегия и Bar-Raiser защита: {title}"
            trap = "Защита решения без количественных расчетов TCO и оценки рисков RPO/RTO."
            task_type = "hld"
            task_desc = f"Защитить комплексную архитектурную спецификацию перед техническим комитетом для {title}."
            bonus = "Анализ экономической эффективности миграции в Private Cloud vs Public Cloud."

        steps.append({
            "stepNumber": i,
            "title": title,
            "milestoneId": m_id,
            "seniorBarConcept": concept,
            "interviewTrap": trap,
            "estimatedMinutes": 30,
            "coreRequirements": {
                "theoryTopic": "architecture",
                "theoryTitle": f"Staff Bar-Raiser: {title}",
                "taskType": task_type,
                "taskDescription": task_desc,
                "lldChallengeSlug": "lld-highload-trading-matching-engine" if "Matching Engine" in title else "lld-saga-orchestrator" if "Saga" in title else "lld-consistent-hash-ring" if "Consistent Hash" in title else "lld-double-entry-ledger" if "Ledger" in title else None,
                "hldScenarioId": "hld-scenario-08" if "Collaborative" in title else "hld-scenario-10" if "Object Store" in title else "hld-scenario-11" if "Payment" in title else "hld-scenario-01",
                "triageIncidentId": "triage-incident-01" if i <= 12 else None
            },
            "bonusDeepDive": {
                "title": "⭐ Principal Bar-Raiser Углубление",
                "description": bonus
            },
            "masteryChecklist": [
                f"Понимание архитектурных инвариантов: {title}",
                "Умение формулировать компромиссы (Trade-offs) на уровне Staff",
                "Защита Capacity Plan и расчет TCO инфраструктуры"
            ],
            "crossCourseLinks": []
        })

    return {
        "id": "staff-principal-track-60",
        "category": "career",
        "title": "👑 Staff / Principal Bar-Raiser (60 Шагов)",
        "badge": "Staff & Principal",
        "totalSteps": 60,
        "difficulty": "staff_principal",
        "estimatedDuration": "6–8 недель (фундаментальный)",
        "description": "Масштабная флагманская программа для ведущих архитекторов: низкоуровневая виртуальная машина Java, распределенный консенсус, CRDT, FinOps и системный дизайн.",
        "milestones": milestones,
        "steps": steps
    }

def parse_concurrency_course(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 15 steps
    milestones = [
        {"id": "cm1", "title": "Майлстоун 1: JMM, Барьеры Памяти & VarHandles (Шаги 1–5)", "stepRange": "1–5"},
        {"id": "cm2", "title": "Майлстоун 2: Неблокирующие структуры & Project Loom (Шаги 6–10)", "stepRange": "6–10"},
        {"id": "cm3", "title": "Майлстоун 3: Low-Latency, Disruptor & High-Throughput (Шаги 11–15)", "stepRange": "11–15"}
    ]

    titles = [
        ("JMM Reordering, Happens-Before & Sequential Consistency", "Математическая модель JMM (JSR-133), отношение Happens-Before, переупорядочивание инструкций."),
        ("Hardware Memory Barriers & CPU Cache Coherency (MESI/MOESI)", "Протоколы когерентности кэшей, Store Buffers, барьеры LoadLoad, StoreStore, LoadStore, StoreLoad."),
        ("Low-Level Memory Access: Unsafe vs VarHandles", "VarHandle режимы доступа: Plain, Opaque, Acquire/Release, Volatile."),
        ("CAS Mechanics, Contention Mitigation & Striped64 Internals", "Инструкция LOCK CMPXCHG, CAS Storm, False Sharing, @Contended и архитектура LongAdder."),
        ("Deadlock-Free Lock Ordering & Lock-Free Concurrent Stacks", "Алгоритм Treiber Stack, Michael-Scott Queue, проблема ABA и AtomicStampedReference."),
        ("Virtual Threads Loom Mechanics & Continuation Memory in Heap", "JEP 444, разделение Carrier Threads и Virtual Threads, удержание стека в Heap."),
        ("Carrier Thread Pinning: Synchronized vs ReentrantLock & JFR Detection", "Привязка к Carrier Thread при synchronized и I/O, детектирование через jdk.VirtualThreadPinned."),
        ("ForkJoinPool Work-Stealing Algorithm & Saturation Control", "Деки (Deques), алгоритм Work-Stealing, LIFO/FIFO режимы, CommonPool сатурация."),
        ("Scoped Values (JEP 446) vs ThreadLocal Memory Leaks", "Неизменяемый контекст ScopedValue, автоматическая очистка при unmount виртуального потока."),
        ("Structured Concurrency (JEP 453) & Subtask Cancellation", "StructuredTaskScope, ShutdownOnFailure, ShutdownOnSuccess, изоляция сбоев дочерних потоков."),
        ("LMAX Disruptor Architecture: RingBuffer, SequenceBarrier & Cache Padding", "Механическая симпатия, кольцевой буфер без блокировок, потребители с wait-стратегиями."),
        ("Non-Blocking Hash Maps: ConcurrentHashMap Under 100k Contention", "Блокировки на уровне бакетов, Treeify переход в Red-Black Tree, размер массива степени двойки."),
        ("Synchronizers: Semaphore, CountDownLatch & CompletableFuture Pipelines", "Сравнение примитивов синхронизации, асинхронные графы выполнения без блокировки потоков."),
        ("Atomic Operations on Off-Heap Memory: FFM API (JEP 454)", "MemorySegment, Arena allocation, управление временем жизни нативной памяти."),
        ("High-Frequency Trading Matching Engine: Lock-Free OrderBook", "Сверхнизкие задержки, детерминированное сопоставление заявок без GC-аллокаций.")
    ]

    steps = []
    for i, (t, concept) in enumerate(titles, 1):
        m_id = "cm1" if i <= 5 else "cm2" if i <= 10 else "cm3"
        steps.append({
            "stepNumber": i,
            "title": t,
            "milestoneId": m_id,
            "seniorBarConcept": concept,
            "interviewTrap": "Ложное предположение о потокобезопасности без явных барьеров синхронизации.",
            "estimatedMinutes": 25,
            "coreRequirements": {
                "theoryTopic": "concurrency",
                "theoryTitle": f"Concurrency Deep Dive: {t}",
                "taskType": "lld",
                "taskDescription": f"Реализовать проверенное решение с нулевыми гонками для {t}.",
                "lldChallengeSlug": "lld-lock-free-stack" if i == 5 else "lld-highload-counter-striped" if i == 4 else "lld-rate-limiter" if i == 13 else "lld-highload-trading-matching-engine" if i == 15 else "lld-multi-threaded-elevator"
            },
            "bonusDeepDive": {
                "title": "⭐ JCStress & JMH Benchmarking",
                "description": "Написание тестов JCStress для выявления редких аппаратных переупорядочиваний."
            },
            "masteryChecklist": [
                f"Понимание теории: {t}",
                "Решение LLD-задачи с Java 21 AST валидатором",
                "Отсутствие блокировок Carrier потоков"
            ],
            "crossCourseLinks": [f"senior-bigtech-sprint-25:step-{i}"] if i <= 5 else []
        })

    return {
        "id": "java21-concurrency-master-15",
        "category": "domain",
        "title": "⚡ Java 21, JMM & High-Throughput Concurrency (15 Шагов)",
        "badge": "Concurrency Master",
        "totalSteps": 15,
        "difficulty": "solid_senior",
        "estimatedDuration": "3 недели",
        "description": "Глубокая специализация по многопоточности и низкоуровневой памяти: JMM, Project Loom, Carrier Pinning, Lock-Free, Disruptor, ScopedValues и VarHandles.",
        "milestones": milestones,
        "steps": steps
    }

def parse_spring_transactions_course(file_path):
    milestones = [
        {"id": "tm1", "title": "Майлстоун 1: Spring Framework Internals & AOP Proxies (Шаги 1–5)", "stepRange": "1–5"},
        {"id": "tm2", "title": "Майлстоун 2: PostgreSQL MVCC, Блокировки & Изоляция (Шаги 6–10)", "stepRange": "6–10"},
        {"id": "tm3", "title": "Майлстоун 3: Распределенные Транзакции & Saga (Шаги 11–15)", "stepRange": "11–15"}
    ]

    titles = [
        ("Spring Bean Lifecycle & CGLIB Proxy Bypass (@Transactional Self-Invocation)", "Устройство Dynamic Proxy и CGLIB, перехват вызовов методов внутри одного бина."),
        ("Transaction Propagation Rules: REQUIRED vs REQUIRES_NEW vs NESTED", "Управление границами транзакций, точки сохранения (Savepoints), изоляция контекста."),
        ("HikariCP Connection Pool Exhaustion & Leak Diagnostics", "Связь пула соединений с потоками выполнения, leakDetectionThreshold, таймауты подключения."),
        ("Hibernate Dirty Checking & Second-Level Cache Eviction Traps", "Механизм отслеживания изменений сущностей, N+1 Query Cascade, кэш L2 и версионирование @Version."),
        ("Spring Boot 3.3 Class Data Sharing (CDS) & Micrometer Observability", "Оптимизация старта приложения через CDS .jsa архивы, Micrometer Observation API."),
        ("PostgreSQL MVCC Internals: Tuple Header (xmin, xmax) & HOT Updates", "Многоверсионность строк, правила видимости транзакций, Heap Only Tuples и вакуум."),
        ("PostgreSQL Isolation Levels: Write Skew & Serializable Snapshot Isolation (SSI)", "Аномалии конкурентного доступа, rw-антизависимости, обработка ошибок 40001."),
        ("PostgreSQL Locking Hierarchy: FOR UPDATE vs FOR NO KEY UPDATE", "Строчные и табличные блокировки, внешние ключи, Advisory Locks (pg_try_advisory_xact_lock)."),
        ("PostgreSQL B-Tree vs GIN/BRIN Indexing & Index-Only Scans", "Устройство индексов, Visibility Map, частичные и функциональные индексы."),
        ("Zero-Downtime Database Schema Migration (Expand & Contract Pattern)", "Безопасное изменение схемы данных под нагрузкой, Flyway миграции без эксклюзивных локов."),
        ("Distributed Transactions: 2PC vs Saga Orchestrator Pattern", "Двухфазный коммит, оркестрация распределенной саги с компенсирующими транзакциями."),
        ("Transactional Outbox Pattern & Debezium Change Data Capture (CDC)", "Гарантия надежной публикации доменных событий в Kafka без Dual-Write аномалий."),
        ("Idempotent Consumer & Distributed Deduplication Engine", "Защита от повторной обработки сообщений At-Least-Once через ключи идемпотентности."),
        ("Double-Entry Financial Ledger Design: Deadlock-Free Lock Ordering", "Балансы аккаунтов, банковское округление HALF_EVEN, глобальный порядок захвата локов."),
        ("Resilience4j Circuit Breaker & Retry Storm Prevention in Distributed Services", "Защита межсервисных вызовов, экспоненциальный откат с джиттером (Full Jitter).")
    ]

    steps = []
    for i, (t, concept) in enumerate(titles, 1):
        m_id = "tm1" if i <= 5 else "tm2" if i <= 10 else "tm3"
        steps.append({
            "stepNumber": i,
            "title": t,
            "milestoneId": m_id,
            "seniorBarConcept": concept,
            "interviewTrap": "Неправильное понимание границ транзакции и скрытые блокировки базы данных.",
            "estimatedMinutes": 25,
            "coreRequirements": {
                "theoryTopic": "spring",
                "theoryTitle": f"Spring & Data Transactions: {t}",
                "taskType": "lld" if i not in [6, 8, 9, 10] else "sql",
                "taskDescription": f"Реализовать надежный компонент для {t}.",
                "lldChallengeSlug": "lld-transactional-outbox" if i == 12 else "lld-saga-orchestrator" if i == 11 else "lld-double-entry-ledger" if i == 14 else "lld-connection-pool-manager" if i == 3 else "lld-circuit-breaker-resilience" if i == 15 else "lld-rate-limiter",
                "triageIncidentId": "triage-incident-04" if i == 3 else "triage-incident-07" if i == 7 else "triage-incident-08" if i == 8 else None
            },
            "bonusDeepDive": {
                "title": "⭐ ACID & Performance Bar-Raiser",
                "description": "Анализ планов выполнения EXPLAIN (ANALYZE, BUFFERS) и блокировок pg_locks."
            },
            "masteryChecklist": [
                f"Понимание механизмов: {t}",
                "Решение практического задания с гарантией ACID",
                "Исключение Deadlock и утечек соединений"
            ],
            "crossCourseLinks": []
        })

    return {
        "id": "spring3-transactions-master-15",
        "category": "domain",
        "title": "💾 Spring Boot 3, Hibernate & Distributed Transactions (15 Шагов)",
        "badge": "Data & ACID Master",
        "totalSteps": 15,
        "difficulty": "solid_senior",
        "estimatedDuration": "3 недели",
        "description": "Специализация по транзакционной надежности: Spring AOP Proxies, PostgreSQL MVCC, SSI, Saga Orchestration, Transactional Outbox и HikariCP триаж.",
        "milestones": milestones,
        "steps": steps
    }

def parse_highload_course():
    milestones = [
        {"id": "hm1", "title": "Майлстоун 1: Моделирование Емкости, Шардирование & Кэш (Шаги 1–5)", "stepRange": "1–5"},
        {"id": "hm2", "title": "Майлстоун 2: Распределенный Консенсус & Kafka Streaming (Шаги 6–10)", "stepRange": "6–10"},
        {"id": "hm3", "title": "Майлстоун 3: Архитектурные Сценарии & Disaster Recovery (Шаги 11–15)", "stepRange": "11–15"}
    ]

    titles = [
        ("Back-of-the-Envelope Capacity Planning & Resource Modeling", "Расчет CPU, RAM, Network Bandwidth, Disk IOPS, формулы Литтла и Поллачека-Хинчина."),
        ("Consistent Hashing & Dynamic Sharding Strategies", "Кольцо согласованного хеширования с виртуальными узлами, Jump Hash, Bounded-Loads."),
        ("Write-Through, Write-Behind & Read-Through Caching (XFetch)", "Топологии кэширования, вероятностный досрочный пересчет XFetch, двухуровневый кэш L1/L2."),
        ("Split-Brain, Raft Consensus & Distributed Quorums", "Выборы лидера, репликация логов, кворум (N/2)+1, Fencing Tokens и эпохи."),
        ("Kafka Partition Rebalance & Static Membership (group.instance.id)", "Кооперативная ребалансировка CooperativeSticky, таймауты max.poll.interval.ms, устранение STW."),
        ("Idempotency Keys & Deduplication Engine Architecture", "Сквозная идемпотентность, фильтры Блума, At-Least-Once доставка без побочных эффектов."),
        ("Distributed Rate Limiter: Sliding Window Counter via Redis Lua", "Алгоритмы ограничения трафика для API Gateway под 500,000 RPS, Multi-Tenant лимиты."),
        ("Event Sourcing & CQRS Pattern with Kafka & PostgreSQL", "Разделение моделей чтения и записи, материализованные представления, проекции событий."),
        ("Disaster Recovery Topologies: RPO=0 / RTO<30s Multi-DC Failover", "Active-Active и Active-Passive репликация, гео-распределенные кворумы, Split-Brain защита."),
        ("High-Frequency Trading Matching Engine (OrderBook)", "Сверхнизкие задержки, Lock-Free очереди, Zero-Allocation структуры для сопоставления заявок."),
        ("Geo-Distributed Collaborative Document Engine (CRDT)", "Бесконфликтные реплицируемые типы данных, LWW-Element-Set, синхронизация через WebSocket."),
        ("Distributed Ride-Sharing Spatial Dispatch (Uber/Lyft H3 Index)", "Гео-индексация H3/S2, гео-хэши, балансировка водителей и пассажиров под нагрузкой."),
        ("Global S3-Compatible Object Store with Erasure Coding", "Хранение петабайт данных, Reed-Solomon Erasure Coding, метаданные и блочные хранилища."),
        ("Global Payment Ledger & Multi-Currency Settlement Engine", "Двойная запись, защита от овердрафта, детерминированные финансовые транзакции."),
        ("System Design Bar-Raiser Defense: End-to-End Architecture Review", "Комплексная защита архитектуры перед техническим комитетом с расчетом TCO.")
    ]

    steps = []
    for i, (t, concept) in enumerate(titles, 1):
        m_id = "hm1" if i <= 5 else "hm2" if i <= 10 else "hm3"
        steps.append({
            "stepNumber": i,
            "title": t,
            "milestoneId": m_id,
            "seniorBarConcept": concept,
            "interviewTrap": "Проектирование без учета масштабирования, сетевых задержек и сценариев отказа узлов.",
            "estimatedMinutes": 30,
            "coreRequirements": {
                "theoryTopic": "architecture",
                "theoryTitle": f"System Design: {t}",
                "taskType": "hld",
                "taskDescription": f"Спроектировать распределенную систему для {t}.",
                "hldScenarioId": f"hld-scenario-{i:02d}" if i <= 14 else "hld-scenario-01",
                "lldChallengeSlug": "lld-consistent-hash-ring" if i == 2 else "lld-cache-stampede-xfetch" if i == 3 else "lld-rate-limiter" if i == 7 else "lld-highload-trading-matching-engine" if i == 10 else None
            },
            "bonusDeepDive": {
                "title": "⭐ Staff Architect Bar-Raiser",
                "description": "Оценка финансовых затрат на инфраструктуру (TCO) и расчет RPO/RTO."
            },
            "masteryChecklist": [
                f"Владение архитектурными паттернами: {t}",
                "Точные расчеты Capacity Planning",
                "Защита HLD-сценария со Staff AI"
            ],
            "crossCourseLinks": []
        })

    return {
        "id": "highload-system-design-15",
        "category": "domain",
        "title": "🏛️ HighLoad System Design & Event-Driven Architecture (15 Шагов)",
        "badge": "Architect Specialist",
        "totalSteps": 15,
        "difficulty": "staff_principal",
        "estimatedDuration": "3–4 недели",
        "description": "Специализация по проектированию масштабируемых систем: Capacity Planning, Consistent Hashing, Raft, XFetch кэширование, Kafka Exactly-Once и CRDT.",
        "milestones": milestones,
        "steps": steps
    }

def parse_forensics_course():
    milestones = [
        {"id": "fm1", "title": "Майлстоун 1: Потоки, Deadlocks & Virtual Thread Pinning (Шаги 1–4)", "stepRange": "1–4"},
        {"id": "fm2", "title": "Майлстоун 2: Утечки Памяти, MAT & GC STW Тюнинг (Шаги 5–8)", "stepRange": "5–8"},
        {"id": "fm3", "title": "Майлстоун 3: Профилирование Flame Graphs & Нативная Память (Шаги 9–12)", "stepRange": "9–12"}
    ]

    titles = [
        ("Thread Dump Forensics: Lock Contention & Deadlock Chains", "Состояния потоков BLOCKED, WAITING, TIMED_WAITING, поиск циклических блокировок.", "triage-incident-01"),
        ("Carrier Thread Pinning in Project Loom & JFR Detection", "Привязка виртуальных потоков в synchronized, события jdk.VirtualThreadPinned.", "triage-incident-02"),
        ("HikariCP Connection Pool Exhaustion & Thread Starvation", "Вложенные транзакции, зависшие SQL-запросы, утечки коннектов.", "triage-incident-04"),
        ("ForkJoinPool CommonPool Saturation & Thread Injection", "Блокирующий I/O в параллельных стримах и CompletableFuture без выделенного пула.", "triage-incident-14"),
        ("Heap Dump Analysis via Eclipse MAT: Shallow vs Retained Size", "Анализ hprof файлов, Dominator Tree, поиск корней утечек в GC Roots.", "triage-incident-05"),
        ("ThreadLocal Memory Leaks in Servlet Container Thread Pools", "Незакрытые ThreadLocal переменные в переиспользуемых воркерах Tomcat.", "triage-incident-05"),
        ("Metaspace OutOfMemoryError: Dynamic Proxy & ClassLoader Leaks", "Утечки загрузчиков классов при динамической генерации CGLIB/ByteBuddy прокси.", "triage-incident-04"),
        ("G1 GC Humongous Object Allocation Churn & STW Pause Spikes", "Аллокации объектов > 50% размера региона G1, преждевременные Full GC.", "triage-incident-07"),
        ("Native Memory Tracking (NMT) & Netty Direct ByteBuf Off-Heap Leaks", "Утечки нативной памяти вне кучи JVM, профилирование через jcmd NMT.", "triage-incident-06"),
        ("Async-Profiler Flame Graphs: CPU 100% Hotspot & Lock Contention", "Сэмплирование стеков через perf events, нахождение узких мест в коде.", "triage-incident-15"),
        ("Netty Epoll 100% CPU Spin & EventLoop Blockers", "Блокирующий код внутри Netty EventLoop, холостой цикл epoll.", "triage-incident-15"),
        ("PostgreSQL Lock Contention & Long-Running Transaction Bloat", "Анализ блокировок в pg_locks, сдвиг горизонта xmin, разрастание таблиц.", "triage-incident-07")
    ]

    steps = []
    for i, (t, concept, inc_id) in enumerate(titles, 1):
        m_id = "fm1" if i <= 4 else "fm2" if i <= 8 else "fm3"
        steps.append({
            "stepNumber": i,
            "title": t,
            "milestoneId": m_id,
            "seniorBarConcept": concept,
            "interviewTrap": "Попытка устранения симптомов (перезапуск сервиса) вместо локализации истинной первопричины (RCA).",
            "estimatedMinutes": 25,
            "coreRequirements": {
                "theoryTopic": "jvm",
                "theoryTitle": f"JVM Forensics: {t}",
                "taskType": "triage",
                "taskDescription": f"Исследовать дамп и локализовать причину сбоя для {t}.",
                "triageIncidentId": inc_id
            },
            "bonusDeepDive": {
                "title": "⭐ Forensic Investigator Bar-Raiser",
                "description": "Составление полного отчета расследования инцидента (Post-Mortem & Remediation Plan)."
            },
            "masteryChecklist": [
                f"Анализ артефактов аварии: {t}",
                "Формулирование точной гипотезы первопричины (RCA)",
                "Успешный триаж в криминалистической лаборатории"
            ],
            "crossCourseLinks": []
        })

    return {
        "id": "jvm-forensics-triage-12",
        "category": "domain",
        "title": "🧵 Production Forensics & JVM Incident Triage Lab (12 Шагов)",
        "badge": "Forensic Specialist",
        "totalSteps": 12,
        "difficulty": "solid_senior",
        "estimatedDuration": "2–3 недели",
        "description": "Специализация по расследованию инцидентов: Thread Dumps, Eclipse MAT Heap Leaks, G1 Humongous GC STW, Netty Off-Heap и Flame Graphs.",
        "milestones": milestones,
        "steps": steps
    }

def main():
    reports_dir = r"d:\projects\interview_projects\spring\ds_reports"
    f1 = os.path.join(reports_dir, "Программа подготовки BigTech Java.md")
    f2 = os.path.join(reports_dir, "Программы курсов для Principal Architect.md")
    f3 = os.path.join(reports_dir, "Программы углубленной Java специализации.md")

    courses = [
        parse_senior_sprint(f1),
        parse_staff_track(f1),
        parse_concurrency_course(f3),
        parse_spring_transactions_course(f3),
        parse_highload_course(),
        parse_forensics_course()
    ]

    out_path = r"d:\projects\interview_projects\spring\json\guided_roadmaps.json"
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(courses, f, ensure_ascii=False, indent=2)

    print(f"[SUCCESS] Generated {len(courses)} Master Academy Courses into {out_path}")
    for c in courses:
        print(f"  - [{c['category'].upper()}] {c['id']} ({c['totalSteps']} steps)")


if __name__ == '__main__':
    main()
