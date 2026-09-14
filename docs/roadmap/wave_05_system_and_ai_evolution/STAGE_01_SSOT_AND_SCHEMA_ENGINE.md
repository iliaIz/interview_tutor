# 🛠️ Stage 1 Specification: SSOT Data Layer & Isomorphic Invariant Engine

> **Статус:** `SPECIFICATION_LOCKED`  
> **Версия:** `1.1.0-RECONCILED` (Полная синхронизация с отчётами Deep Research B1–B5)  
> **Дата:** 14 сентября 2026 г.  
> **Программа:** Wave 05 — System & AI Evolution  
> **Родительский RFC:** [`04_MASTER_SYSTEM_DESIGN_RFC.md`](04_MASTER_SYSTEM_DESIGN_RFC.md)  
> **Инварианты:** `INV-01` (SSOT), `INV-02` (Decoupled Presentation & Transport), `INV-03` (Isomorphic Invariant Validation), `INV-05` (Zero-Broken-Routes).

---

## 1. Executive Summary & Problem Scope

### 1.1. Ликвидируемый технический долг (As-Is Defect)
В существующей кодовой базе `interview_tutor` зафиксирован критический архитектурный дефект — **каталожный рассинхрон (Split-Brain Paradox)**:
1. **Хранилище 1 (Backend SQLite):** Таблица `system_design_challenges`, сидируемая из `json/system_design_scenarios.json` (10 устаревших макро-сценариев).
2. **Хранилище 2 (Frontend Client Bundle):** Статически скомпилированный `frontend/src/components/system_design/katas/MicroKatasCatalog.ts` (8 канонических кат L3/L4 со встроенным кодом симуляции `runSimulation`).
3. **Хранилище 3 (Frontend Client Bundle):** Статически скомпилированный `frontend/src/components/system_design/scaffolding/FadedScaffoldingCatalog.ts` (5 инцидентов со встроенными узлами `@xyflow/react` и пиксельными координатами).
4. **Разрыв роутинга Академии:** В `frontend/src/store/useAppStore.ts` (строки 464–476) переход по шагам курсов из `json/guided_roadmaps.json` (где указаны `hld-micro-01`..`08` и `hld-faded-01`..`03`) запрашивает `/api/system-design/scenarios`. Поскольку этих идентификаторов нет в бэкендовой SQLite, запрос завершается тихим сбоем, открывая пустую вкладку.
5. **Отсутствие контракта Tri-Studio:** Существующие структуры содержат либо только граф (Studio 2), либо только код (Studio 1), либо только промпт (Studio 3), вынуждая разработчиков хардкодить связанные данные в компонентах React.

### 1.2. Целевое состояние (To-Be Architecture)
* **26 канонических Git-манифестов** в формате JSON, полностью заземленных на эмпирические исследования Phase B (B1–B5):
  * **5 L3 Junior:** Single-Box Concurrency, Memory & Hardware Invariants (HikariCP, Cache Stampede, DB Index Write-Amp, Token Bucket, Nginx Buffering).
  * **5 L4 Middle:** Distributed Primitives & Async Invariants (Snowflake NTP, Idempotent Outbox, Kafka Rebalance Lag, Lock Fencing, Social Feed Fanout).
  * **10 L5 Senior:** 5 Distributed Core (`DIST-SYS-001`..`005`) + 5 Modern AI Infrastructure (`AI-INFRA-001`..`005`).
  * **6 L6/L7 Staff & Principal:** Planetary Cellular, HLC Consensus, 10k GPU Fleet, FinOps Streaming, Active-Active DR, RTB Bidding.
* **Единый контракт TypeBox (`@sinclair/typebox`)** для всех трёх студий: `studio_1_runtime`, `studio_2_simulation`, `studio_3_bar_raiser`.
* **Поддержка грейда `L7_PRINCIPAL`** и канонических ID по маске `^[A-Za-z0-9_-]+$`.
* **Двухключевой индекс разрешения (`canonical_id` + `legacy_aliases`)**, гарантирующий `INV-05 (Zero-Broken-Routes)` для всех 49 шагов System Design в курсах Академии.
* **Изолированный пакет `@interview-prep/shared`**, исключающий порчу TypeScript `rootDir` в бэкенде.
* **Изоморфный движок валидации** (топологические графовые алгоритмы + песочница CEL на базе `cel-js`).

---

## 2. Структура каталогов и размещение артефактов

```
interview_tutor/
├── shared/                               # Независимый пакет общих контрактов и валидаторов
│   ├── package.json                      # @interview-prep/shared (CJS/ESM exports)
│   ├── tsconfig.json
│   └── src/
│       ├── schemas/
│       │   ├── manifest.ts               # Полная TypeBox схема Tri-Studio манифестов
│       │   └── generated/
│       │       └── manifest.schema.json  # Скомпилированная JSON Schema Draft-07
│       └── validation/
│           ├── invariantEngine.ts        # Изоморфный валидатор (Graph + CEL)
│           └── celEvaluator.ts           # Безопасный CEL-рантайм (cel-js)
├── scenarios/
│   └── manifests/
│       ├── l3_junior/                    # 5 канонических сценариев уровня L3
│       │   ├── L3-PERF-HIKARICP-STARVATION.json
│       │   ├── L3-PERF-CACHE-STAMPEDE.json
│       │   ├── L3-PERF-DB-INDEX-WRITEAMP.json
│       │   ├── L3-CONC-TOKENBUCKET-LOCK.json
│       │   └── L3-NET-NGINX-BUFFERING.json
│       ├── l4_middle/                    # 5 канонических сценариев уровня L4
│       │   ├── L4-DIST-SNOWFLAKE-NTP.json
│       │   ├── L4-DIST-IDEMPOTENT-OUTBOX.json
│       │   ├── L4-DIST-KAFKA-REBALANCE-LAG.json
│       │   ├── L4-DIST-LOCK-FENCING.json
│       │   └── L4-DIST-SOCIAL-FEED-FANOUT.json
│       ├── l5_senior/                    # 10 канонических сценариев уровня L5
│       │   ├── DIST-SYS-001.json         # Raft Multi-Raft Partitioned Ledger
│       │   ├── DIST-SYS-002.json         # CRDT Real-Time Collaborative Canvas
│       │   ├── DIST-SYS-003.json         # LSM-Tree High-Throughput Time-Series
│       │   ├── DIST-SYS-004.json         # Edge CDN & Dynamic Cache Invalidation
│       │   ├── DIST-SYS-005.json         # Distributed Workflow Orchestration (Temporal/Borg)
│       │   ├── AI-INFRA-001.json         # Continuous Batching LLM Inference (vLLM)
│       │   ├── AI-INFRA-002.json         # PagedAttention Memory Manager
│       │   ├── AI-INFRA-003.json         # Distributed Vector Database (HNSW + Hybrid RRF)
│       │   ├── AI-INFRA-004.json         # Multimodal Streaming Ingestion Pipeline
│       │   └── AI-INFRA-005.json         # Autonomous Agentic Multi-Model Orchestration
│       └── l6_l7_staff/                  # 6 канонических сценариев уровня L6 / L7
│           ├── FIN-CELL-8092.json        # Cellular Architecture with Zero Blast-Radius (L7)
│           ├── DB-CONS-9104.json         # Planetary Multi-Master with Hybrid Logical Clocks (L6)
│           ├── GPU-SCHED-7741.json       # 10,000-GPU Cluster Gang-Scheduling & NVLink (L7)
│           ├── STREAM-FIN-6218.json      # 500 Tbps FinOps Zero-Copy eBPF Pipeline (L6)
│           ├── HA-MCLOUD-5520.json       # Multi-Cloud Active-Active DR RPO=0 / RTO<30s (L6)
│           └── RTB-AUCTION-4401.json     # Global 10M QPS RTB Ad Bidding with 10ms SLA (L6)
├── backend/
│   └── src/
│       ├── services/
│       │   ├── db.ts                     # SQLite с таблицами system_design_manifests и aliases
│       │   └── scenarioLoader.ts         # Загрузчик Git-манифестов и сидер SQLite
│       └── routes/
│           └── systemDesign.ts           # REST API с двунаправленным поиском (id + alias)
└── scripts/
    └── verify_manifests.ts               # CI-валидатор 100% манифестов против схемы TypeBox
```

---

## 3. Спецификация контрактов TypeBox (`shared/src/schemas/manifest.ts`)

```typescript
import { Type, Static } from '@sinclair/typebox';

// 1. Семантические типы узлов архитектуры
export const SemanticNodeType = Type.Union([
  // Ingress & Routing
  Type.Literal('dns'),
  Type.Literal('load_balancer'),
  Type.Literal('api_gateway'),
  Type.Literal('cdn'),
  Type.Literal('cell_router'),
  // Compute Runtimes
  Type.Literal('app_service'),
  Type.Literal('microservice'),
  Type.Literal('worker_pool'),
  Type.Literal('gpu_inference_node'),
  Type.Literal('orchestrator_agent'),
  // Caching & In-Memory
  Type.Literal('redis_cache'),
  Type.Literal('memcached'),
  Type.Literal('semantic_cache'),
  // Data Storage
  Type.Literal('rdbms_primary'),
  Type.Literal('rdbms_replica'),
  Type.Literal('nosql_document'),
  Type.Literal('lsm_key_value'),
  Type.Literal('vector_database'),
  Type.Literal('object_storage_s3'),
  // Messaging & Streaming
  Type.Literal('kafka_topic'),
  Type.Literal('message_queue'),
  Type.Literal('ebpf_stream_ingest')
]);

// 2. Транспортный узел (декуплен от пиксельных координат React Flow)
export const TransportNodeSchema = Type.Object({
  id: Type.String({ minLength: 1 }),
  type: SemanticNodeType,
  title: Type.String(),
  grid_position: Type.Object({
    col: Type.Integer({ minimum: 0 }),
    row: Type.Integer({ minimum: 0 })
  }),
  params: Type.Record(Type.String(), Type.Any()),
  is_locked: Type.Optional(Type.Boolean({ default: false }))
});

// 3. Транспортное ребро
export const TransportEdgeSchema = Type.Object({
  id: Type.String({ minLength: 1 }),
  source: Type.String(),
  target: Type.String(),
  protocol: Type.Union([
    Type.Literal('http_rest'),
    Type.Literal('grpc'),
    Type.Literal('tcp_socket'),
    Type.Literal('async_event'),
    Type.Literal('db_protocol'),
    Type.Literal('nvlink_roce')
  ]),
  is_locked: Type.Optional(Type.Boolean({ default: false }))
});

// 4. Правила валидации инвариантов (CEL & Graph Traversal)
export const InvariantRuleSchema = Type.Object({
  id: Type.String(),
  description: Type.String(),
  severity: Type.Union([Type.Literal('ERROR'), Type.Literal('WARNING')]),
  category: Type.Union([
    Type.Literal('TOPOLOGY_GRAPH'),
    Type.Literal('PERFORMANCE_SLO'),
    Type.Literal('FINANCIAL_BUDGET'),
    Type.Literal('FAULT_TOLERANCE'),
    Type.Literal('HARDWARE_RESOURCE')
  ]),
  rule_type: Type.Union([
    Type.Literal('NO_DIRECT_ACCESS'),       // запрет путей Client -> DB
    Type.Literal('CYCLE_DETECTION'),         // запрет циклических синхронных RPC
    Type.Literal('MANDATORY_INTERMEDIARY'),  // обязательный узел (кэш, очередь)
    Type.Literal('CEL_EXPRESSION')           // предикат на Common Expression Language
  ]),
  config: Type.Record(Type.String(), Type.Any())
});

// 5. Контракт Студии 1: Runtime & Forensics Workbench
export const Studio1RuntimeSchema = Type.Object({
  language: Type.Union([
    Type.Literal('java21'),
    Type.Literal('sql'),
    Type.Literal('nginx'),
    Type.Literal('typescript'),
    Type.Literal('python')
  ]),
  source_files: Type.Array(Type.Object({
    path: Type.String(),
    content: Type.String(),
    is_editable: Type.Boolean()
  })),
  faded_bug: Type.Optional(Type.Object({
    line_number: Type.Integer(),
    description: Type.String(),
    bug_pattern: Type.String()
  })),
  correct_fix_diff: Type.Optional(Type.String()),
  ast_rule_invariants: Type.Optional(Type.Array(Type.String()))
});

// 6. Контракт Студии 2: Topology Canvas & DES Simulation
export const Studio2SimulationSchema = Type.Object({
  topology: Type.Object({
    nodes: Type.Array(TransportNodeSchema),
    edges: Type.Array(TransportEdgeSchema)
  }),
  slos: Type.Object({
    p99_latency_max_ms: Type.Number({ minimum: 0.1 }),
    availability_target_nines: Type.Number({ minimum: 90, maximum: 99.9999 }),
    monthly_budget_max_usd: Type.Number({ minimum: 0 })
  }),
  traffic_profile: Type.Object({
    pattern: Type.Union([Type.Literal('POISSON'), Type.Literal('BURSTY'), Type.Literal('DIURNAL')]),
    lambda_mean_rps: Type.Number({ minimum: 1 }),
    inter_arrival_cv: Type.Number({ minimum: 0.01 }),
    read_ratio: Type.Number({ minimum: 0, maximum: 1 }),
    prompt_tokens_mean: Type.Optional(Type.Number()),
    generation_tokens_mean: Type.Optional(Type.Number())
  }),
  roofline_params: Type.Optional(Type.Object({
    peak_flops_tflops: Type.Optional(Type.Number()),
    memory_bandwidth_tb_s: Type.Optional(Type.Number()),
    weight_bits: Type.Optional(Type.Number()),
    kv_bits: Type.Optional(Type.Number())
  })),
  chaos_scenarios: Type.Optional(Type.Array(Type.Object({
    id: Type.String(),
    name: Type.String(),
    trigger_second: Type.Number(),
    duration_second: Type.Number(),
    fault_type: Type.String(),
    target_node_id: Type.Optional(Type.String()),
    target_edge_id: Type.Optional(Type.String()),
    impact_multiplier: Type.Number()
  }))),
  invariants: Type.Array(InvariantRuleSchema)
});

// 7. Контракт Студии 3: Multimodal Bar-Raiser Defense Arena
export const Studio3BarRaiserSchema = Type.Object({
  probing_ladder: Type.Object({
    stage_1_validation: Type.String(),
    stage_2_tightening: Type.String(),
    stage_3_adversarial: Type.String(),
    stage_4_squeeze: Type.String()
  }),
  counter_probes: Type.Array(Type.Object({
    buzzword: Type.String(),
    trigger_regex: Type.String(),
    counter_question: Type.String(),
    expected_staff_answer: Type.String()
  })),
  evaluation_rubric_override: Type.Optional(Type.Record(Type.String(), Type.Any()))
});

// 8. Канонический Манифест Сценария (SSOT)
export const ChallengeManifestSchema = Type.Object({
  $schema: Type.Optional(Type.String()),
  canonical_id: Type.String({ pattern: '^[A-Za-z0-9_-]+$' }),
  legacy_aliases: Type.Array(Type.String()),
  version: Type.String({ pattern: '^\\d+\\.\\d+\\.\\d+$' }),
  target_level: Type.Union([
    Type.Literal('L3_JUNIOR'),
    Type.Literal('L4_MIDDLE'),
    Type.Literal('L5_SENIOR'),
    Type.Literal('L6_STAFF'),
    Type.Literal('L7_PRINCIPAL')
  ]),
  archetype: Type.String(),
  title: Type.String({ minLength: 5 }),
  subtitle: Type.String(),
  problem_statement: Type.String({ minLength: 20 }),
  pedagogical_mode: Type.Union([
    Type.Literal('WORKED_EXAMPLE'),
    Type.Literal('FADED_COMPLETION'),
    Type.Literal('INDEPENDENT_DESIGN')
  ]),
  studio_1_runtime: Type.Optional(Studio1RuntimeSchema),
  studio_2_simulation: Studio2SimulationSchema,
  studio_3_bar_raiser: Studio3BarRaiserSchema
});

export type ChallengeManifest = Static<typeof ChallengeManifestSchema>;
export type TransportNode = Static<typeof TransportNodeSchema>;
export type TransportEdge = Static<typeof TransportEdgeSchema>;
export type InvariantRule = Static<typeof InvariantRuleSchema>;
export type Studio1Runtime = Static<typeof Studio1RuntimeSchema>;
export type Studio2Simulation = Static<typeof Studio2SimulationSchema>;
export type Studio3BarRaiser = Static<typeof Studio3BarRaiserSchema>;
```

---

## 4. Изоморфный движок валидации (`shared/src/validation/invariantEngine.ts`)

Движок исполняется симметрично:
* **На клиенте:** в хуке `useTopologyValidation.ts` для мгновенной валидации холста за $<2\text{ мс}$.
* **На сервере:** в контроллере `POST /api/system-design/scenarios/:id/submit` для защиты БД от недопустимых состояний.

### 4.1. Топологический графовый слой
1. **Cycle Detection (Алгоритм Кана):**
   * Выявление циклических синхронных связей (`grpc`, `http_rest`), ведущих к дедлокам потоков.
2. **No Direct Access (BFS):**
   * Запрет прямых ребер `Client -> RDBMS` в обход шлюзов и балансировщиков.
3. **Mandatory Intermediary:**
   * Проверка обязательного наличия промежуточного кэша (`redis_cache`, `semantic_cache`) перед узлом типа `rdbms_primary` для высоконагруженных сценариев.

### 4.2. Изоморфная песочница CEL (`cel-js`)
Вычисление предикатов выполняется в изолированном контексте без использования уязвимого `eval()`:

```cel
// Валидация задержки и бюджета из симуляции
simulation.p99_latency_ms <= manifest.studio_2_simulation.slos.p99_latency_max_ms &&
simulation.monthly_cost_usd <= manifest.studio_2_simulation.slos.monthly_budget_max_usd

// Проверка наличия минимум 2 реплик для High Availability
graph.nodes.filter(n, n.type == 'rdbms_replica').size() >= 2

// Проверка включения алгоритма XFetch для кэша
graph.nodes.filter(n, n.type == 'semantic_cache').all(c, c.params.xfetch_enabled == true)
```

---

## 5. Схема базы данных SQLite и двухключевой резолвер

### 5.1. DDL схемы (`backend/src/services/db.ts`)

```sql
-- Каноническая таблица манифестов
CREATE TABLE IF NOT EXISTS system_design_manifests (
    canonical_id TEXT PRIMARY KEY,
    version TEXT NOT NULL,
    target_level TEXT NOT NULL,
    archetype TEXT NOT NULL,
    pedagogical_mode TEXT NOT NULL,
    title TEXT NOT NULL,
    subtitle TEXT,
    problem_statement TEXT NOT NULL,
    slos_json TEXT NOT NULL,
    traffic_profile_json TEXT NOT NULL,
    topology_json TEXT NOT NULL,
    invariants_json TEXT NOT NULL,
    studio_1_json TEXT,
    studio_2_json TEXT NOT NULL,
    studio_3_json TEXT NOT NULL,
    raw_manifest_json TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Индекс разрешения псевдонимов (Zero Broken Routes)
CREATE TABLE IF NOT EXISTS system_design_aliases (
    alias TEXT PRIMARY KEY,
    canonical_id TEXT NOT NULL,
    FOREIGN KEY (canonical_id) REFERENCES system_design_manifests(canonical_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sd_alias_lookup ON system_design_aliases(alias);

-- Идемпотентный реестр прогресса пользователя
CREATE TABLE IF NOT EXISTS user_progress_ledger (
    ledger_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    canonical_id TEXT NOT NULL,
    manifest_version TEXT NOT NULL,
    status TEXT CHECK(status IN ('STARTED', 'PASSED', 'FAILED')) NOT NULL,
    completion_vector TEXT NOT NULL, -- JSON массив ID выполненных инвариантов
    p99_achieved_ms REAL,
    cost_achieved_usd REAL,
    bar_raiser_score INTEGER,
    attempt_count INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, canonical_id, manifest_version)
);
```

### 5.2. Контроллер разрешения маршрутов (`GET /api/system-design/scenarios/:id`)
Контроллер ищет совпадение сначала в `canonical_id`, а затем в `system_design_aliases`. Это гарантирует, что как современные запросы (`L3-PERF-HIKARICP-STARVATION`), так и исторические ссылки курсов Академии (`hld-micro-01`, `kata-01-consistent-hashing`) мгновенно возвращают требуемый манифест без ошибок 404.

---

## 6. Монорепозитарная сборка пакета `@interview-prep/shared`

Для предотвращения дефекта компиляции Node.js (где `tsc` смещает структуру `dist/server.js` при импорте файлов вне `rootDir`), каталог `shared/` оформляется как независимый npm-пакет:

1. **`shared/package.json`:**
   ```json
   {
     "name": "@interview-prep/shared",
     "version": "1.0.0",
     "main": "dist/index.js",
     "types": "dist/index.d.ts",
     "scripts": {
       "build": "tsc"
     },
     "dependencies": {
       "@sinclair/typebox": "^0.34.52",
       "cel-js": "^0.8.2"
     }
   }
   ```
2. **Зависимости в `backend/package.json` и `frontend/package.json`:**
   `"@interview-prep/shared": "file:../shared"`.
3. При компиляции бэкенда `backend/src` остаётся единственным `rootDir`, и `dist/server.js` сохраняет правильный путь, исключая сбои запуска `npm start`.

---

## 7. Definition of Done (DoD) для Stage 1

1. [ ] **Isolated Shared Package:** Создан каталог `shared/` со своим `package.json` и `tsconfig.json`. Пакет собирается без ошибок и экспортирует типы и JSON Schema Draft-07.
2. [ ] **26 Canonical Manifests:** В каталоге `scenarios/manifests/` созданы все 26 файлов (5 L3, 5 L4, 10 L5, 6 L6/L7), содержащие полные секции `studio_1_runtime`, `studio_2_simulation` и `studio_3_bar_raiser`.
3. [ ] **Automated CI Validation:** Скрипт `scripts/verify_manifests.ts` валидирует все 26 манифестов против схемы TypeBox и завершается с кодом 0 за $<50\text{ мс}$.
4. [ ] **Dual-Key Alias Seeding:** Бэкенд сидирует манифесты и таблицу `system_design_aliases`. Проверено, что вызовы `GET /api/system-design/scenarios/hld-micro-01` и `GET /api/system-design/scenarios/L3-PERF-HIKARICP-STARVATION` возвращают корректные данные.
5. [ ] **Isomorphic Engine Tests:** Тесты `invariantEngine.test.ts` подтверждают выявление циклов, блокировку прямых путей Client $\to$ DB и выполнение предикатов CEL.
6. [ ] **Zero Compilation Regressions:** Сборка проекта (`npm run build` в backend и frontend) проходит чисто.
