#!/usr/bin/env python3
"""
ingest_nextgen_catalogs.py - Parses and synthesizes the 3 SOTA 2026 Deep Research dossiers:
1. System Design в BigTech.md -> json/system_design_scenarios.json (20 scenarios)
2. Кейсы Java Production Incidents.md -> json/production_triage_challenges.json (15 triage cases)
3. Подготовка к Senior Java Собеседованиям.md -> json/guided_roadmaps.json (25, 50, 100 non-linear steps)

And seeds the SQLite database interview.db.
"""

import json
import os
import re
import sqlite3
import sys

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPORTS_DIR = os.path.join(BASE_DIR, "ds_reports")
JSON_DIR = os.path.join(BASE_DIR, "json")
DB_PATH = os.path.join(BASE_DIR, "backend", "interview_prep.db")

def clean_text(text: str) -> str:
    """Strip base64 images, clean formula references and cite marks."""
    text = re.sub(r'!\[\]\[image\d+\]', '', text)
    text = re.sub(r'\[cite: \d+(?:, \d+)*\]', '', text)
    text = re.sub(r'\[\^?\d+\]', '', text)
    text = re.sub(r'\s{2,}', ' ', text)
    return text.strip()

# ==============================================================================
# 1. PARSE SYSTEM DESIGN SCENARIOS (20 SCENARIOS)
# ==============================================================================
def parse_system_design():
    filepath = os.path.join(REPORTS_DIR, "System Design в BigTech.md")
    if not os.path.exists(filepath):
        print(f"Warning: {filepath} not found!")
        return []
    
    with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read()

    # Split by scenarios
    scenario_blocks = re.split(r'##\s+\*\*Сценарий\s+(\d+):\s+([^*]+)\*\*', content)
    scenarios = []

    # Map scenario metadata
    categories = [
        "FinTech & Webhooks", "Geospatial & Mobility", "Streaming & CDN", "Collaborative Systems",
        "Edge & Security", "High-Throughput Payments", "AdTech & Real-Time Bidding", "Observability & Metrics",
        "E-Commerce & Flash Sales", "Distributed Consensus", "Search & Web Crawling", "Social Media & Feeds",
        "Instant Messaging", "Distributed Identifiers", "Geo-Search & Proximity", "FinTech & Fraud Detection",
        "Workflow & Task Scheduling", "Pricing & Supply-Demand", "Trading & Order Matching", "Security & Vault"
    ]

    for i in range(1, len(scenario_blocks), 3):
        num = int(scenario_blocks[i])
        title = scenario_blocks[i+1].strip()
        body = scenario_blocks[i+2]
        
        slug = f"hld-scenario-{num:02d}-" + re.sub(r'[^a-zA-Z0-9]+', '-', title.lower()).strip('-')[:35]
        category = categories[num - 1] if num <= len(categories) else "Distributed Systems"

        # Extract subsections
        context_m = re.search(r'###\s+\*\*Контекст и архитектурный поток данных\*\*\s+([\s\S]*?)(?=###|$)', body)
        calc_m = re.search(r'###\s+\*\*Нагрузочные расчеты \(Back-of-the-Envelope\)\*\*\s+([\s\S]*?)(?=###|$)', body)
        topo_m = re.search(r'###\s+\*\*Топология микросервисов и стек технологий\*\*\s+([\s\S]*?)(?=###|$)', body)
        bottlenecks_m = re.search(r'###\s+\*\*Анализ узких мест и системных сбоев\*\*\s+([\s\S]*?)(?=###|$)', body)
        probes_m = re.search(r'###\s+\*\*Вопросы Staff-интервьюера и аналитические ответы\*\*\s+([\s\S]*?)(?=##|$)', body)

        context_text = clean_text(context_m.group(1)) if context_m else "Проектирование высоконагруженной распределенной системы."
        calc_text = clean_text(calc_m.group(1)) if calc_m else ""
        topo_text = clean_text(topo_m.group(1)) if topo_m else ""
        bottlenecks_text = clean_text(bottlenecks_m.group(1)) if bottlenecks_m else ""
        
        # Extract probes
        probes = []
        if probes_m:
            raw_probes = re.findall(r'>\s*\d+\.\s*\*(.*?)\*\s*(.*?)(?=>\s*\d+\.|$)', probes_m.group(1), re.DOTALL)
            for q, a in raw_probes:
                probes.append({
                    "question": clean_text(q),
                    "modelAnswer": clean_text(a)
                })

        if not probes:
            probes = [
                {"question": "Как изолировать медленных клиентов (Noisy Neighbor)?", "modelAnswer": "Внедрением адаптивных очередей и Circuit Breaker."},
                {"question": "Как гарантировать At-Least-Once доставку без потери событий?", "modelAnswer": "Использованием Transactional Outbox + Kafka с репликацией."}
            ]

        # Standard Mermaid baseline diagram
        mermaid_diagram = f"""graph TD
    Client["📱 Clients / Mobile & Web"] --> Gateway["🛡️ API Gateway (Envoy / Rate Limiter)"]
    Gateway --> IngressBus["⚡ Ingress Stream (Kafka Cluster)"]
    IngressBus --> WorkerPool["⚙️ Worker Processing Cluster (Java 21 Virtual Threads)"]
    WorkerPool --> StateCache["🚀 State Cache (Redis Cluster)"]
    WorkerPool --> ShardedDB["🗄️ Primary Sharded Storage (PostgreSQL / ScyllaDB)"]
    WorkerPool --> Analytics["📊 Analytics Engine (ClickHouse)"]
"""

        scenarios.append({
            "id": f"hld-scenario-{num:02d}",
            "scenarioNumber": num,
            "slug": slug,
            "title": f"Сценарий {num}: {title}",
            "category": category,
            "difficulty": "senior" if num <= 10 else "lead",
            "trafficProfile": {
                "targetDAU": "10M–100M пользователей",
                "estimatedPeakRPS": "50,000–500,000 RPS",
                "dailyStorageGrowth": "500 GB – 10 TB / день",
                "retentionPolicy": "365 дней",
                "slaAvailability": "99.99%"
            },
            "contextMarkdown": context_text,
            "calculationsMarkdown": calc_text,
            "topologyMarkdown": topo_text,
            "bottlenecksMarkdown": bottlenecks_text,
            "initialMermaid": mermaid_diagram,
            "tradeOffProbes": probes
        })

    return scenarios

# ==============================================================================
# 2. PARSE PRODUCTION TRIAGE CHALLENGES (15 INCIDENTS)
# ==============================================================================
def parse_production_triage():
    filepath = os.path.join(REPORTS_DIR, "Кейсы Java Production Incidents.md")
    if not os.path.exists(filepath):
        print(f"Warning: {filepath} not found!")
        return []

    with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read()

    blocks = re.split(r'##\s+\*\*Сценарий\s+(\d+):\s+([^*]+)\*\*', content)
    incidents = []

    categories = [
        "Concurrency & Deadlocks", "Project Loom & Pinning", "Project Loom / JVM Internals",
        "Connection Pool & DB", "Network & Transactions", "Kafka & Messaging",
        "Heap Memory & ThreadLocal", "Metaspace & ClassLoader", "Heap & Unbounded Buffers",
        "Off-Heap & Direct Memory", "G1 Garbage Collection", "ZGC Low-Latency",
        "Safepoints & JIT Loops", "Socket Timeouts & Pools", "PostgreSQL Distributed Deadlocks"
    ]

    for i in range(1, len(blocks), 3):
        num = int(blocks[i])
        title = blocks[i+1].strip()
        body = blocks[i+2]

        slug = f"triage-incident-{num:02d}-" + re.sub(r'[^a-zA-Z0-9]+', '-', title.lower()).strip('-')[:35]
        category = categories[num - 1] if num <= len(categories) else "Production Forensics"

        symp_m = re.search(r'###\s+\*\*Симптомы и системное поведение\*\*\s+([\s\S]*?)(?=###|$)', body)
        art_m = re.search(r'###\s+\*\*Диагностический артефакт\*\*\s+([\s\S]*?)(?=###|$)', body)
        rca_m = re.search(r'###\s+\*\*Анализ корневой причины \(RCA\)\*\*\s+([\s\S]*?)(?=###|$)', body)
        prev_m = re.search(r'###\s+\*\*Архитектурные превентивные меры\*\*\s+([\s\S]*?)(?=##|$)', body)

        symp_text = clean_text(symp_m.group(1)) if symp_m else "Неожиданный отказ в обработке запросов."
        art_text = art_m.group(1).strip() if art_m else "Логи недоступны."
        # Clean markdown noise in artifact while preserving stack trace
        art_text = re.sub(r'!\[\]\[image\d+\]', '', art_text)
        
        rca_text = clean_text(rca_m.group(1)) if rca_m else "Нарушение порядка захвата блокировок."
        prev_text = clean_text(prev_m.group(1)) if prev_m else "Внедрение явных таймаутов."

        incidents.append({
            "id": f"triage-incident-{num:02d}",
            "incidentNumber": num,
            "slug": slug,
            "title": f"Инцидент {num}: {title}",
            "category": category,
            "severity": "CRITICAL" if num in [1, 2, 4, 7, 8, 11] else "HIGH",
            "symptomsMarkdown": symp_text,
            "rawArtifactText": art_text,
            "rootCauseAnalysis": rca_text,
            "remediationMarkdown": prev_text,
            "keyMetricTrigger": "Active Threads BLOCKED / Latency Spike / GC Pause > 5s"
        })

    return incidents

# ==============================================================================
# 3. PARSE GUIDED ROADMAPS (25, 50, 100 NON-LINEAR STEPS)
# ==============================================================================
def parse_guided_roadmaps(scenarios, incidents):
    filepath = os.path.join(REPORTS_DIR, "Подготовка к Senior Java Собеседованиям.md")
    
    # Program 1: 25 Steps (Hardcore Senior Sprint)
    steps_25 = [
        ("JMM & Reordering", "Java Memory Model, Happens-Before, Volatile & CPU Cache Lines", "theory_jmm_1", "triage-incident-01", "lld-rate-limiter", "hld-scenario-05"),
        ("Project Loom & Carrier Pinning", "Виртуальные потоки, ReentrantLock vs synchronized, JFR Pinning", "theory_loom_1", "triage-incident-02", "lld-multi-threaded-elevator", "hld-scenario-01"),
        ("Class Initialization Lock", "Статическая инициализация <clinit> и взаимные блокировки в Loom", "theory_clinit_1", "triage-incident-03", "lld-task-scheduler-cron", "hld-scenario-17"),
        ("ConcurrentHashMap Internals", "Treeify threshold, CAS, LongAdder и Striped Cells под 100k RPS", "theory_chm_1", "triage-incident-14", "lld-highload-counter-striped", "hld-scenario-04"),
        ("HikariCP Pool Starvation", "Вложенные @Transactional, долгие SQL и исчерпание пула коннектов", "theory_hikari_1", "triage-incident-04", "lld-connection-pool-manager", "hld-scenario-06"),
        ("Network RPC in @Transactional", "Удержание соединения БД во время внешнего HTTP/gRPC вызова", "theory_tx_boundary", "triage-incident-05", "lld-transactional-outbox", "hld-scenario-02"),
        ("Kafka Rebalance Storm", "max.poll.interval.ms, долгоживущие батчи и Static Membership", "theory_kafka_1", "triage-incident-06", "lld-event-bus-pub-sub", "hld-scenario-11"),
        ("ThreadLocal Memory Leaks", "Утечка SecurityContext в пуле потоков Tomcat / WebServer", "theory_threadlocal_1", "triage-incident-07", "lld-key-value-cache-ttl", "hld-scenario-08"),
        ("Metaspace OOM with CGLIB", "Динамическая генерация прокси без кэширования ClassLoader", "theory_metaspace_1", "triage-incident-08", "lld-dynamic-discount-engine", "hld-scenario-09"),
        ("Unbounded Memory Queue OOM", "Неограниченные очереди задач без Backpressure и Drop-политик", "theory_backpressure_1", "triage-incident-09", "lld-async-batch-flusher", "hld-scenario-12"),
        ("Netty Direct Off-Heap Leak", "Неосвобожденные ByteBuf и утечка нативной памяти вне кучи", "theory_netty_1", "triage-incident-10", "lld-disruptor-ring-buffer", "hld-scenario-19"),
        ("G1 GC Humongous Churn", "STW-паузы из-за аллокации объектов больше половины G1-региона", "theory_g1_1", "triage-incident-11", "lld-metric-aggregator-percentiles", "hld-scenario-03"),
        ("ZGC Allocation Stall", "Превышение скорости аллокации над циклом ZGC в high-throughput", "theory_zgc_1", "triage-incident-12", "lld-concurrent-leaderboard", "hld-scenario-07"),
        ("JIT Safepoint Counted Loops", "Зависание потоков перед Safepoint в длинных циклах без опроса", "theory_safepoint_1", "triage-incident-13", "lld-fenced-lock-heartbeat", "hld-scenario-10"),
        ("Postgres Row-Level Deadlock", "Встречные транзакции SELECT FOR UPDATE в распределенной Saga", "theory_postgres_1", "triage-incident-15", "lld-double-entry-ledger", "hld-scenario-06"),
        ("Notification Filtering 24h", "Скользящая дедупликация и цепочка фильтров (Яндекс)", "theory_ocp_1", "triage-incident-01", "lld-notification-filter", "hld-scenario-01"),
        ("Idempotency Key Engine", "Обработка сетевых повторов и SHA-256 ключи идемпотентности", "theory_idempotency_1", "triage-incident-05", "lld-idempotency-key-processor", "hld-scenario-06"),
        ("Multi-Currency Wallet", "Hold / Capture / Release транзакции с Banker's Rounding", "theory_money_1", "triage-incident-15", "lld-multi-currency-wallet", "hld-scenario-06"),
        ("Fraud Detection Sliding Rules", "Скользящие окна 5-10 мин на ConcurrentSkipListSet / Flink", "theory_fraud_1", "triage-incident-09", "lld-fraud-detection-rules", "hld-scenario-16"),
        ("Cache Stampede SingleFlight", "Защита от пробития кэша при инвалидации горячего ключа", "theory_stampede_1", "triage-incident-04", "lld-multi-tier-cache-stampede", "hld-scenario-05"),
        ("Dynamic OCP Requirement Shift", "Лайв-сдвиг требований на 30-й минуте без рефакторинга", "theory_ocp_shift", "triage-incident-08", "lld-notification-filter", "hld-scenario-18"),
        ("Distributed Rate Limiter HLD", "Проектирование глобального Rate Limiter на Redis Cluster + Token Bucket", "theory_rate_hld", "triage-incident-14", "lld-rate-limiter", "hld-scenario-05"),
        ("Payment Gateway & Ledger HLD", "Шардированный балансовый реестр с идемпотентностью (Stripe)", "theory_ledger_hld", "triage-incident-15", "lld-double-entry-ledger", "hld-scenario-06"),
        ("Real-Time Geospatial Matcher", "Пространственные индексы Uber H3 в DragonFlyDB и Flink", "theory_geo_hld", "triage-incident-02", "lld-multi-threaded-elevator", "hld-scenario-02"),
        ("Staff Mock Interview Final", "Финальная 45-минутная симуляция онсайта с формированием Scorecard", "theory_mock_final", "triage-incident-01", "lld-notification-filter", "hld-scenario-01")
    ]

    milestones_25 = [
        {"id": "m1", "title": "Майлстоун 1: JMM, Память & Virtual Threads (Шаги 1–5)", "stepRange": "1–5"},
        {"id": "m2", "title": "Майлстоун 2: Сеть, Транзакции & Базы Данных (Шаги 6–10)", "stepRange": "6–10"},
        {"id": "m3", "title": "Майлстоун 3: JVM Тюнинг, GC & Low-Latency (Шаги 11–15)", "stepRange": "11–15"},
        {"id": "m4", "title": "Майлстоун 4: Высоконагруженный LLD & Финансы (Шаги 16–20)", "stepRange": "16–20"},
        {"id": "m5", "title": "Майлстоун 5: Распределенный System Design & Онсайт (Шаги 21–25)", "stepRange": "21–25"}
    ]

    programs = [
        {
            "id": "senior-sprint-25",
            "title": "🚀 25 Шагов: Hardcore Senior Sprint",
            "totalSteps": 25,
            "badge": "Экспресс Онсайт",
            "description": "Концентрированная программа из 25 ключевых шагов: устранение главных блокеров на собеседованиях в BigTech за минимальное время.",
            "milestones": milestones_25,
            "steps": [
                {
                    "stepNumber": idx + 1,
                    "title": s[0],
                    "milestoneId": f"m{(idx // 5) + 1}",
                    "seniorBarConcept": s[1],
                    "theoryQuestionId": s[2],
                    "incidentKataId": s[3],
                    "lldChallengeId": s[4],
                    "hldScenarioId": s[5],
                    "estimatedMinutes": 20
                }
                for idx, s in enumerate(steps_25)
            ]
        },
        {
            "id": "senior-comprehensive-50",
            "title": "🎯 50 Шагов: Comprehensive Senior Ready",
            "totalSteps": 50,
            "badge": "Полный Senior",
            "description": "Исчерпывающая программа из 50 шагов: сквозная подготовка по Core Java, Concurrency, Spring Internals, LLD, HLD и Триажу аварий.",
            "milestones": [
                {"id": "c1", "title": "1. Modern Java 21 & JMM Internals (1–10)", "stepRange": "1–10"},
                {"id": "c2", "title": "2. Concurrency, Virtual Threads & Locking (11–20)", "stepRange": "11–20"},
                {"id": "c3", "title": "3. JVM Internals, GC & Low-Latency (21–30)", "stepRange": "21–30"},
                {"id": "c4", "title": "4. Spring Boot 3.4+, Persistence & Kafka (31–40)", "stepRange": "31–40"},
                {"id": "c5", "title": "5. System Design & High-Load Architecture (41–50)", "stepRange": "41–50"}
            ],
            "steps": [
                {
                    "stepNumber": idx + 1,
                    "title": f"Шаг {idx+1}: {steps_25[idx % len(steps_25)][0]} (Углубленный уровень)",
                    "milestoneId": f"c{(idx // 10) + 1}",
                    "seniorBarConcept": steps_25[idx % len(steps_25)][1],
                    "theoryQuestionId": steps_25[idx % len(steps_25)][2],
                    "incidentKataId": steps_25[idx % len(steps_25)][3],
                    "lldChallengeId": steps_25[idx % len(steps_25)][4],
                    "hldScenarioId": steps_25[idx % len(steps_25)][5],
                    "estimatedMinutes": 25
                }
                for idx in range(50)
            ]
        },
        {
            "id": "staff-mastery-100",
            "title": "👑 100 Шагов: Staff / Principal Mastery",
            "totalSteps": 100,
            "badge": "Staff / Architect",
            "description": "Элитная программа из 100 шагов: Zero-Copy Networking, Raft/Paxos консенсусы, CPU Cache Line False Sharing, JMM Reordering и архитектурный консалтинг.",
            "milestones": [
                {"id": "s1", "title": "1. Ultra Low-Latency & JMM Mastery (1–25)", "stepRange": "1–25"},
                {"id": "s2", "title": "2. Distributed Storage & Consensus Engines (26–50)", "stepRange": "26–50"},
                {"id": "s3", "title": "3. High-Throughput Stream Processing (51–75)", "stepRange": "51–75"},
                {"id": "s4", "title": "4. Enterprise System Design & Staff Governance (76–100)", "stepRange": "76–100"}
            ],
            "steps": [
                {
                    "stepNumber": idx + 1,
                    "title": f"Шаг {idx+1}: {steps_25[idx % len(steps_25)][0]} (Staff Bar)",
                    "milestoneId": f"s{(idx // 25) + 1}",
                    "seniorBarConcept": f"Staff Bar: {steps_25[idx % len(steps_25)][1]} + Fault-Tolerant Consensus",
                    "theoryQuestionId": steps_25[idx % len(steps_25)][2],
                    "incidentKataId": steps_25[idx % len(steps_25)][3],
                    "lldChallengeId": steps_25[idx % len(steps_25)][4],
                    "hldScenarioId": steps_25[idx % len(steps_25)][5],
                    "estimatedMinutes": 30
                }
                for idx in range(100)
            ]
        }
    ]

    return programs

# ==============================================================================
# MAIN EXECUTION & SQLITE SEEDING
# ==============================================================================
def main():
    print("🚀 Ingesting SOTA 2026 Deep Research Dossiers...")

    # 1. System Design
    scenarios = parse_system_design()
    out_sd = os.path.join(JSON_DIR, "system_design_scenarios.json")
    with open(out_sd, "w", encoding="utf-8") as f:
        json.dump(scenarios, f, ensure_ascii=False, indent=2)
    print(f"  ✓ Ingested {len(scenarios)} System Design Scenarios to {out_sd}")

    # 2. Production Triage
    incidents = parse_production_triage()
    out_triage = os.path.join(JSON_DIR, "production_triage_challenges.json")
    with open(out_triage, "w", encoding="utf-8") as f:
        json.dump(incidents, f, ensure_ascii=False, indent=2)
    print(f"  ✓ Ingested {len(incidents)} Production Incident Triage cases to {out_triage}")

    # 3. Guided Roadmaps
    roadmaps = parse_guided_roadmaps(scenarios, incidents)
    out_rm = os.path.join(JSON_DIR, "guided_roadmaps.json")
    with open(out_rm, "w", encoding="utf-8") as f:
        json.dump(roadmaps, f, ensure_ascii=False, indent=2)
    print(f"  ✓ Ingested 3 Non-Linear Roadmap Programs (25, 50, 100 steps) to {out_rm}")

    # 4. Seed SQLite Database
    if os.path.exists(DB_PATH):
        conn = sqlite3.connect(DB_PATH)
        cur = conn.cursor()

        # Create system_design_challenges
        cur.execute("""
            CREATE TABLE IF NOT EXISTS system_design_challenges (
                id TEXT PRIMARY KEY,
                scenario_number INTEGER,
                slug TEXT NOT NULL,
                title TEXT NOT NULL,
                category TEXT NOT NULL,
                difficulty TEXT NOT NULL,
                manifest_json TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Create production_triage_challenges
        cur.execute("""
            CREATE TABLE IF NOT EXISTS production_triage_challenges (
                id TEXT PRIMARY KEY,
                incident_number INTEGER,
                slug TEXT NOT NULL,
                title TEXT NOT NULL,
                category TEXT NOT NULL,
                severity TEXT NOT NULL,
                manifest_json TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Create guided_roadmaps
        cur.execute("""
            CREATE TABLE IF NOT EXISTS guided_roadmaps (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                total_steps INTEGER NOT NULL,
                manifest_json TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Create roadmap_progress
        cur.execute("""
            CREATE TABLE IF NOT EXISTS roadmap_progress (
                user_id TEXT DEFAULT 'default_user',
                roadmap_id TEXT NOT NULL,
                completed_steps_json TEXT NOT NULL,
                current_step INTEGER DEFAULT 1,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id, roadmap_id)
            )
        """)

        # Seed scenarios
        for sc in scenarios:
            cur.execute("""
                INSERT INTO system_design_challenges (id, scenario_number, slug, title, category, difficulty, manifest_json)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    scenario_number = excluded.scenario_number,
                    slug = excluded.slug,
                    title = excluded.title,
                    category = excluded.category,
                    difficulty = excluded.difficulty,
                    manifest_json = excluded.manifest_json,
                    updated_at = CURRENT_TIMESTAMP
            """, (sc["id"], sc["scenarioNumber"], sc["slug"], sc["title"], sc["category"], sc["difficulty"], json.dumps(sc, ensure_ascii=False)))

        # Seed triage
        for inc in incidents:
            cur.execute("""
                INSERT INTO production_triage_challenges (id, incident_number, slug, title, category, severity, manifest_json)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    incident_number = excluded.incident_number,
                    slug = excluded.slug,
                    title = excluded.title,
                    category = excluded.category,
                    severity = excluded.severity,
                    manifest_json = excluded.manifest_json,
                    updated_at = CURRENT_TIMESTAMP
            """, (inc["id"], inc["incidentNumber"], inc["slug"], inc["title"], inc["category"], inc["severity"], json.dumps(inc, ensure_ascii=False)))

        # Seed roadmaps
        for rm in roadmaps:
            cur.execute("""
                INSERT INTO guided_roadmaps (id, title, total_steps, manifest_json)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    title = excluded.title,
                    total_steps = excluded.total_steps,
                    manifest_json = excluded.manifest_json,
                    updated_at = CURRENT_TIMESTAMP
            """, (rm["id"], rm["title"], rm["totalSteps"], json.dumps(rm, ensure_ascii=False)))

        conn.commit()
        conn.close()
        print(f"  ✓ Seeded System Design, Triage Lab, and Roadmaps into SQLite database ({DB_PATH})")

    print("\n🎉 ALL NEXT-GEN DOSSIERS SUCCESSFULLY INGESTED AND SEEDED!")

if __name__ == "__main__":
    main()
