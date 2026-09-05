import json
import sqlite3
import sys

sys.stdout.reconfigure(encoding='utf-8')

with open('json/guided_roadmaps.json', 'r', encoding='utf-8') as f:
    roadmaps = json.load(f)

# 1. Fix broken links in senior-bigtech-sprint-25 and java21-concurrency-master-15
fixed_links = 0
for rm in roadmaps:
    if rm['id'] == 'senior-bigtech-sprint-25':
        for s in rm['steps']:
            if s['stepNumber'] == 20 and s.get('targetScenarioId') == 'lld-lock-free-stack':
                s['targetScenarioId'] = 'kata_test_lock_free_ringbuffer_contention'
                s['title'] = 'Lock-Free RingBuffer (CAS & Contention)'
                s['seniorBarConcept'] = 'Lock-free ring buffer на базе AtomicReferenceArray и CAS без блокировок'
                fixed_links += 1

    if rm['id'] == 'java21-concurrency-master-15':
        for s in rm['steps']:
            if s['stepNumber'] == 5 and s.get('targetScenarioId') == 'lld-lock-free-stack':
                s['targetScenarioId'] = 'kata_test_lock_free_ringbuffer_contention'
                s['title'] = 'Lock-Free RingBuffer (CAS Contention)'
                s['seniorBarConcept'] = 'Построение lock-free структур данных на CAS и AtomicReference'
                fixed_links += 1
            elif s['stepNumber'] == 15 and s.get('targetScenarioId') == 'lld-highload-trading-matching-engine':
                s['targetScenarioId'] = 'mc_flash_sale_engine'
                s['title'] = 'HighLoad Inventory Reservation & Flash Sale'
                s['seniorBarConcept'] = 'Резервирование инвентаря без дедлоков под высокой конкуренцией'
                fixed_links += 1

print(f"Fixed {fixed_links} broken scenario links.")

# 2. Rebalance staff-principal-track-60
# Let's inspect the current milestones and steps
for rm in roadmaps:
    if rm['id'] == 'staff-principal-track-60':
        print(f"\nProcessing {rm['id']}...")
        steps = rm['steps']
        # Currently 60 steps.
        # Let's rebalance arenas across 60 steps:
        # Target:
        # - 22 Machine Coding (LLD) (high-impact Staff level)
        # - 22 System Design (HLD)
        # - 10 SRE Incident Triage
        # - 6 Theory / Oral Architecture Defense
        
        # Load available HLD scenarios
        with open('json/system_design_scenarios.json', 'r', encoding='utf-8') as sf:
            sd_scenarios = json.load(sf)
            if isinstance(sd_scenarios, dict): sd_scenarios = sd_scenarios.get('scenarios', [])
            sd_ids = [sc['id'] for sc in sd_scenarios]

        # Load available Triage incidents
        with open('json/production_triage_challenges.json', 'r', encoding='utf-8') as tf:
            triage_incidents = json.load(tf)
            if isinstance(triage_incidents, dict): triage_incidents = triage_incidents.get('incidents', [])
            triage_ids = [ti['id'] for ti in triage_incidents]

        print(f"Available SD IDs: {len(sd_ids)}, Triage IDs: {len(triage_ids)}")

        # Milestone 1: Distributed Core & Concurrency (Steps 1-15)
        # 8 LLD, 4 HLD, 2 Triage, 1 Theory
        # Milestone 2: HighLoad Architecture & Fault Tolerance (Steps 16-30)
        # 6 HLD, 5 LLD, 3 Triage, 1 Oral
        # Milestone 3: SRE Triage, Forensics & Data Consistency (Steps 31-45)
        # 4 Triage, 5 HLD, 4 LLD, 2 Theory/Oral
        # Milestone 4: Global Scale & Principal Defense (Steps 46-60)
        # 7 HLD, 5 LLD, 1 Triage, 2 Oral Defense

        # Let's assign balanced modalities to staff steps
        sd_idx = 0
        triage_idx = 0
        
        # Map of step numbers to desired arena & scenario
        rebalanced_plan = {
            # Milestone 1 (1-15):
            1: ('theory', None, 'core_java', 'Java 21 Memory Model & Hardware Ergonomics', 'JMM Happens-Before, MESI/MOESI cache coherence, CPU memory barriers, False Sharing'),
            2: ('testing_mutation', 'kata_test_lock_free_ringbuffer_contention', 'concurrency', 'Lock-Free Ring Buffer (CAS & Contention)', 'CAS AtomicReferenceArray, Cacheline Padding, LMAX Disruptor'),
            3: ('machine_coding', 'lld-read-write-lock-writer-pref', 'concurrency', 'Read-Write Lock with Writer Preference', 'Предотвращение Starvation писателей под преобладающей нагрузкой читателей'),
            4: ('system_design', 'hld-micro-07', 'system_design', 'Partitioning & Consistent Hashing', 'Проектирование алгоритма консистентного хэширования с виртуальными узлами'),
            5: ('incident_triage', 'triage-incident-03', 'forensics', 'Virtual Thread Carrier Pinning Triage', 'Диагностика захвата OS-потока в synchronized блоках под нагрузкой'),
            6: ('machine_coding', 'lld-concurrent-leaderboard', 'concurrency', 'Real-Time Concurrent Leaderboard', 'Высококонкурентный скоринг игроков на основе ConcurrentSkipListMap'),
            7: ('system_design', 'hld-micro-04', 'system_design', 'Distributed Deduplication & Idempotency', 'Двухуровневый дедупликатор на Redis/Bloom Filter и реляционном персисте'),
            8: ('machine_coding', 'lld-idempotency-key-processor', 'fintech', 'Distributed Idempotency Processor', 'SHA-256 хэширование payload, atomic token reservation, idempotency TTL'),
            9: ('system_design', 'hld-scenario-01', 'system_design', 'Global URL Shortener & Analytics', 'Балансировка 100k RPS, распределенный Base62 генератор, репликация'),
            10: ('incident_triage', 'triage-incident-02', 'forensics', 'Thread Pool Starvation & Queue Overflow', 'Аварийный триаж переполнения блокирующей очереди и каскадного отказа'),
            11: ('machine_coding', 'lld-double-entry-ledger', 'fintech', 'Double-Entry Accounting Ledger', 'Упорядоченные блокировки по ID счетов (Deadlock-free transfer), Banker’s rounding'),
            12: ('system_design', 'hld-scenario-02', 'system_design', 'High-Throughput Rate Limiter Service', 'Многоуровневый Token Bucket + Sliding Window Counter на кластере Redis'),
            13: ('machine_coding', 'lld-rate-limiter', 'concurrency', 'Distributed Rate Limiter Core', 'Алгоритм Sliding Window Log с минимизацией памяти и блокировок'),
            14: ('system_design', 'hld-faded-01', 'system_design', 'Faded Architecture: E-Commerce Checkout', 'Устранение SPOF и организация очередей заказов в отказоустойчивом кластере'),
            15: ('oral_interview', None, 'concurrency', 'Socratic Defense: Concurrency & Transaction Boundaries', 'Устная защита выбора механизмов синхронизации перед ИИ Bar-Raiser'),

            # Milestone 2 (16-30):
            16: ('theory', None, 'databases', 'Distributed Transactions & 2PC vs SAGA', 'Dual-Write Problem, Outbox Pattern, TCC (Try-Confirm-Cancel), Идемпотентность компенсирующих транзакций'),
            17: ('transactions', 'distributed_saga_compensating_actions', 'databases', 'Two-Phase Compensating Saga', 'Моделирование распределенной Саги с откатами через компенсирующие действия'),
            18: ('transactions', 'hikaricp_pool_deadlock', 'databases', 'HikariCP Pool Starvation Deadlock', 'Расчет пула соединений по формуле Вулдриджа под вложенными транзакциями'),
            19: ('machine_coding', 'lld-transactional-outbox', 'fintech', 'Transactional Outbox & Poller Engine', 'Надежная доставка событий в Kafka через Debezium CDC / Poller без дубликатов'),
            20: ('system_design', 'hld-scenario-03', 'system_design', 'Distributed KV Store & Quorum Consensus', 'Кворумное чтение и запись (W+R>N), векторные часы, антиэнтропия'),
            21: ('incident_triage', 'triage-incident-04', 'forensics', 'Metaspace OOM & ClassLoader Leak', 'Расследование утечки метаспейса динамических прокси и CGLIB генераторов'),
            22: ('machine_coding', 'lld-payment-routing-engine', 'fintech', 'Smart Payment Routing & Fallback Engine', 'Динамический выбор платежного шлюза по latency, success rate и fallback'),
            23: ('system_design', 'hld-scenario-04', 'system_design', 'Event-Driven Notification Platform', 'Миллиарды пуш-уведомлений, приоритетные очереди, circuit breaker на SMS шлюзы'),
            24: ('incident_triage', 'triage-incident-06', 'forensics', 'Circular Database Deadlock', 'Триаж взаимных блокировок транзакций PostgreSQL при обновлении связанных строк'),
            25: ('machine_coding', 'lld-notification-filter', 'bigtech', 'Notification Deduplication Engine', '24-часовая дедупликация и скользящие окна подавления спама'),
            26: ('system_design', 'hld-scenario-05', 'system_design', 'Distributed Web Crawler & URL Frontier', 'Архитектура распределенного краулера, политесс, распределение очередей по доменам'),
            27: ('system_design', 'hld-faded-02', 'system_design', 'Faded Architecture: Real-Time Auction', 'Устранение задержек и консистентность ставок под пиковой нагрузкой'),
            28: ('machine_coding', 'lld-fenced-lock-heartbeat', 'concurrency', 'Distributed Fenced Lock Simulation', 'Монотонно возрастающие токены fencing, аренда блокировки, heartbeat'),
            29: ('incident_triage', 'triage-incident-07', 'forensics', 'Kafka Consumer Lag & Rebalance Storm', 'Триаж каскадного ребаланса партиций Kafka из-за долгого цикла обработки'),
            30: ('oral_interview', None, 'system_design', 'Socratic Defense: HighLoad Fault Tolerance', 'Устная защита стратегий деградации, Graceful Shutdown и изоляции сбоев'),

            # Milestone 3 (31-45):
            31: ('theory', None, 'system_design', 'Consensus Algorithms: Raft, Paxos & Gossip', 'Leader Election, Log Replication, Split-Brain prevention, Quorum intersection'),
            32: ('system_design', 'hld-scenario-06', 'system_design', 'Real-Time Collaborative Document Editing', 'OT (Operational Transformation) vs CRDT, WebSockets mesh, snapshot storage'),
            33: ('machine_coding', 'lld-event-bus-pub-sub', 'concurrency', 'Thread-Safe Event Bus with Topic Subscriptions', 'Высокопроизводительный In-Memory брокер с буферизацией и диспетчеризацией'),
            34: ('incident_triage', 'triage-incident-08', 'forensics', 'HikariCP Leak & Idle-in-Transaction', 'Поиск незакрытых соединений в пуле и блокирующих внешних HTTP-вызовов'),
            35: ('system_design', 'hld-scenario-07', 'system_design', 'Video Streaming & Content Delivery Network (CDN)', 'HLS/DASH чанки, распределенный кэш, Origin Shielding, транскодирование'),
            36: ('machine_coding', 'lld-metric-aggregator-percentiles', 'bigtech', 'Tagged Metric Aggregator (P50, P95, P99)', 'Потоковый расчет процентилей на базе T-Digest / HdrHistogram без OOM'),
            37: ('system_design', 'hld-scenario-08', 'system_design', 'Ride-Sharing Dispatch & Geospatial Tracking', 'QuadTree / Geohash, хранение перемещений водителей, сопоставление поблизости'),
            38: ('incident_triage', 'triage-incident-09', 'forensics', 'Long GC Pauses & Old Gen Fragmentation', 'Анализ GC логов G1/ZGC, настройка регионов и устранение evacuation failure'),
            39: ('machine_coding', 'lld-subscription-billing-engine', 'fintech', 'Subscription Billing Engine with Grace Periods', 'Периодический биллинг с мягкими grace-периодами, ретраями и вебхуками'),
            40: ('system_design', 'hld-scenario-09', 'system_design', 'Stock Exchange Order Book & Matching Engine', 'Двусторонний стакан заявок (Limit Order Book), FIFO приоритеты, sub-ms задержки'),
            41: ('incident_triage', 'triage-incident-10', 'forensics', 'PostgreSQL Connection Exhaustion & Statement Timeout', 'Падение базы от наплыва медленных запросов, настройка PgBouncer'),
            42: ('system_design', 'hld-faded-03', 'system_design', 'Faded Architecture: IoT Telemetry Ingestion', 'Проектирование конвейера приема 1M RPS с датчиков без потери данных'),
            43: ('machine_coding', 'lld-task-scheduler-cron', 'bigtech', 'Distributed Cron Task Scheduler', 'Лидер-следящая координация, Cron парсер, распределение задач по нодам'),
            44: ('system_design', 'hld-scenario-10', 'system_design', 'Search Engine Autocomplete & Typeahead', 'Trie на распределенном кэше, ранжирование по популярности, дедупликация'),
            45: ('oral_interview', None, 'forensics', 'Socratic Defense: Forensic Root Cause Analysis', 'Устная защита гипотезы аварии и постмортема перед Главным инженером'),

            # Milestone 4 (46-60):
            46: ('theory', None, 'system_design', 'Multi-Region Active-Active & Data Sovereignty', 'Conflict-Free Replicated Data Types, Cross-Region Latency, GDPR/152-ФЗ, Local Writes'),
            47: ('system_design', 'hld-scenario-11', 'system_design', 'Distributed Logging & APM Tracing Platform', 'OpenTelemetry, ClickHouse / Elasticsearch буферизация, P99 поиск по трейсам'),
            48: ('system_design', 'hld-scenario-12', 'system_design', 'E-Commerce Flash Sale & Virtual Waiting Room', 'Очереди ожидания (Virtual Queue), сброс избыточного трафика, защита склада'),
            49: ('machine_coding', 'lld-circuit-breaker-engine', 'concurrency', 'Industrial Circuit Breaker State Machine', 'Состояния CLOSED, OPEN, HALF_OPEN, кольцевой буфер ошибок, concurrency guards'),
            50: ('system_design', 'hld-scenario-13', 'system_design', 'Real-Time Gaming Leaderboard & Matchmaking', 'Redis Sorted Sets, ELO matchmaking, распределение игровых сессий по регионам'),
            51: ('incident_triage', 'triage-incident-15', 'forensics', 'Disaster Recovery & Split-Brain Simulation', 'Расследование рассинхронизации реплик базы данных при изоляции дата-центра'),
            52: ('system_design', 'hld-scenario-14', 'system_design', 'Social Network Feed Generation (Fan-out on write vs read)', 'Гибридный Fan-out для инфлюенсеров, кэширование таймлайнов пользователей'),
            53: ('machine_coding', 'lld-splitwise-debt-simplification', 'fintech', 'Expense Sharing & Debt Simplification', 'Минимизация транзакций взаимозачетов через графовый алгоритм потоков'),
            54: ('system_design', 'hld-scenario-15', 'system_design', 'Distributed Blob Storage & Metadata Service', 'Chunking, Content-Addressable Storage (CAS), репликация метаданных'),
            55: ('system_design', 'hld-scenario-16', 'system_design', 'Ad Click Event Aggregation & Fraud Detection', 'Лямбда/Каппа архитектура, скользящие окна Flink, защита от скликивания'),
            56: ('machine_coding', 'lld-order-state-machine', 'bigtech', 'Order Lifecycle State Machine', 'Детерминированный переход состояний заказа с аудит-логом и блокировками'),
            57: ('system_design', 'hld-scenario-17', 'system_design', 'Vector Database for AI Semantic Search', 'HNSW / IVF-PQ индексация эмбеддингов, шардирование по сходству векторов'),
            58: ('system_design', 'hld-scenario-18', 'system_design', 'Distributed Job Queue & Dead Letter Queue (DLQ)', 'Гарантии At-least-once, видимость сообщений (Visibility Timeout), DLQ политики'),
            59: ('oral_interview', None, 'system_design', 'Staff Bar-Raiser: Trade-offs & Compromises', 'Устное интервью с Amazon Bar-Raiser: выбор архитектурных компромиссов'),
            60: ('oral_interview', None, 'system_design', 'Principal Defense: End-to-End System Architecture', 'Комплексная защита архитектуры многорегиональной платформы перед комитетом')
        }

        # Apply plan
        rebalanced_steps = []
        for s in steps:
            s_num = s['stepNumber']
            if s_num in rebalanced_plan:
                arena, sc_id, domain, title, concept = rebalanced_plan[s_num]
                s['targetArena'] = arena
                s['targetScenarioId'] = sc_id
                s['domain'] = domain
                s['title'] = title
                s['seniorBarConcept'] = concept
                s['requiredForGrade'] = 'L6/L7'
                s['pedagogicalRationale'] = f"Развивает компетенции Staff/Principal инженера в домене {domain} ({concept[:80]}...)"
            rebalanced_steps.append(s)

        rm['steps'] = rebalanced_steps
        
        # Recount arenas
        counts = {}
        for s in rm['steps']:
            a = s.get('targetArena')
            counts[a] = counts.get(a, 0) + 1
        print(f"Rebalanced staff-principal-track-60 counts: {counts}")

# Save updated guided_roadmaps.json
with open('json/guided_roadmaps.json', 'w', encoding='utf-8') as f:
    json.dump(roadmaps, f, ensure_ascii=False, indent=2)

print("\nSaved updated json/guided_roadmaps.json.")

# Sync into SQLite
conn = sqlite3.connect('backend/data/interview.db')
c = conn.cursor()

# 3. Normalize difficulty in coding_challenges table
c.execute("UPDATE coding_challenges SET difficulty = LOWER(difficulty)")
print(f"Normalized difficulty in coding_challenges: {c.rowcount} rows updated.")

# Resync roadmaps into guided_roadmaps table
for rm in roadmaps:
    total_steps = len(rm.get('steps', []))
    c.execute("""
        INSERT INTO guided_roadmaps (id, title, category, total_steps, manifest_json, updated_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET
            title = excluded.title,
            category = excluded.category,
            total_steps = excluded.total_steps,
            manifest_json = excluded.manifest_json,
            updated_at = CURRENT_TIMESTAMP
    """, (rm['id'], rm['title'], rm['category'], total_steps, json.dumps(rm, ensure_ascii=False)))

conn.commit()
print("Synchronized all 8 roadmaps into backend/data/interview.db.")
conn.close()
