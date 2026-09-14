# 🛠️ Stage 1 Specification: SSOT Data Layer & Isomorphic Invariant Engine

> **Статус:** `SPECIFICATION_LOCKED`  
> **Версия:** `1.0.0`  
> **Дата:** 14 сентября 2026 г.  
> **Программа:** Wave 05 — System & AI Evolution  
> **Родительский RFC:** [`04_MASTER_SYSTEM_DESIGN_RFC.md`](04_MASTER_SYSTEM_DESIGN_RFC.md)  
> **Инварианты:** `INV-01` (SSOT), `INV-02` (Decoupled Presentation & Transport), `INV-03` (Isomorphic Invariant Validation).

---

## 1. Executive Summary & Problem Scope

### 1.1. Ликвидируемый технический долг (As-Is Defect)
В текущей кодовой базе `interview_tutor` зафиксирован критический дефект **каталожного рассинхрона (Split-Brain Paradox)**:
1. **Хранилище 1 (Backend SQLite):** Таблица `system_design_scenarios`, сидируемая из `json/system_design_scenarios.json` (10 сценариев).
2. **Хранилище 2 (Frontend Client Bundle):** Статически скомпилированный `frontend/src/components/system_design/katas/MicroKatasCatalog.ts` (8 канонических кат уровня L0 со встроенным кодом симуляции `runSimulation`).
3. **Хранилище 3 (Frontend Client Bundle):** Статически скомпилированный `frontend/src/components/system_design/scaffolding/FadedScaffoldingCatalog.ts` (5 инцидентов со встроенными узлами `@xyflow/react` и пиксельными координатами).
4. **Конфликт слоёв:** Файлы сценариев импортируют React-типы (`Node, Edge from '@xyflow/react'`), из-за чего топологии невозможно валидировать на стороне бэкенда или в headless CI-тестах.

### 1.2. Целевое состояние (To-Be Architecture)
* Единый каталог Git-манифестов `scenarios/manifests/*.json`.
* Строгая типизация на **TypeBox (`@sinclair/typebox`)** с генерацией JSON Schema Draft-07.
* Изоморфный движок валидации (Graph Traversal + Sandboxed CEL), идентично работающий на клиенте и сервере.
* Единая база SQLite, сидируемая из манифестов, отдающая легковесный Transport DAG без React Flow артефактов.

---

## 2. Структура каталогов и размещение артефактов

```
interview_tutor/
├── shared/
│   └── src/
│       └── schemas/
│           ├── manifest.ts            # TypeBox схемы манифестов (Single Source of Truth)
│           └── generated/
│               └── manifest.schema.json # Сгенерированная JSON Schema Draft-07
├── scenarios/
│   └── manifests/
│       ├── katas/                     # Бывшие MicroKatasCatalog.ts (L3/L0)
│       │   ├── kata-01-consistent-hashing.json
│       │   ├── kata-02-cache-aside.json
│       │   └── ... (8 файлов)
│       ├── scaffolding/               # Бывшие FadedScaffoldingCatalog.ts (L4/L2)
│       │   ├── incident-01-payment-deadlock.json
│       │   ├── incident-02-connection-leak.json
│       │   └── ... (5 файлов)
│       └── macro/                     # Бывшие system_design_scenarios.json (L5/L6)
│           ├── macro-01-llm-gateway-serving.json
│           ├── macro-02-global-financial-ledger.json
│           └── ... (10 файлов)
├── backend/
│   └── src/
│       ├── services/
│       │   ├── scenarioLoader.ts      # Парсер манифестов и сидер SQLite
│       │   └── invariantEngine.ts     # Серверный валидатор (Graph + CEL)
│       └── routes/
│           └── scenarios.ts           # REST API: GET /api/scenarios, GET /api/scenarios/:id
└── scripts/
    └── verify_manifests.ts            # CI-скрипт валидации 100% манифестов по JSON Schema
```

---

## 3. Спецификация контрактов TypeBox (`shared/src/schemas/manifest.ts`)

```typescript
import { Type, Static } from '@sinclair/typebox';

// 1. Семантические типы узлов архитектуры
export const SemanticNodeType = Type.Union([
  // Infrastructure & Routing
  Type.Literal('dns'),
  Type.Literal('load_balancer'),
  Type.Literal('api_gateway'),
  Type.Literal('cdn'),
  // Compute Runtimes
  Type.Literal('app_service'),
  Type.Literal('microservice'),
  Type.Literal('worker_pool'),
  Type.Literal('gpu_inference_node'),
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
  Type.Literal('message_queue')
]);

// 2. Транспортный узел (декуплен от React Flow!)
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
    Type.Literal('db_protocol')
  ]),
  is_locked: Type.Optional(Type.Boolean({ default: false }))
});

// 4. Правила валидации инвариантов
export const InvariantRuleSchema = Type.Object({
  id: Type.String(),
  description: Type.String(),
  severity: Type.Union([Type.Literal('ERROR'), Type.Literal('WARNING')]),
  category: Type.Union([
    Type.Literal('TOPOLOGY_GRAPH'),
    Type.Literal('PERFORMANCE_SLO'),
    Type.Literal('FINANCIAL_BUDGET'),
    Type.Literal('SECURITY_ISOLATION')
  ]),
  rule_type: Type.Union([
    Type.Literal('NO_DIRECT_ACCESS'),       // запрет путей типа client -> database
    Type.Literal('CYCLE_DETECTION'),         // запрет циклических вызовов
    Type.Literal('MANDATORY_INTERMEDIARY'),  // обязательное наличие узла (например, кэш или очередь)
    Type.Literal('CEL_EXPRESSION')           // предикат на Common Expression Language
  ]),
  config: Type.Record(Type.String(), Type.Any())
});

// 5. Канонический Манифест Сценария
export const ChallengeManifestSchema = Type.Object({
  $schema: Type.Optional(Type.String()),
  canonical_id: Type.String({ pattern: '^[a-z0-9-]+$' }),
  version: Type.String({ pattern: '^\\d+\\.\\d+\\.\\d+$' }),
  target_level: Type.Union([
    Type.Literal('L3_JUNIOR'),
    Type.Literal('L4_MIDDLE'),
    Type.Literal('L5_SENIOR'),
    Type.Literal('L6_STAFF')
  ]),
  archetype: Type.String(),
  title: Type.String({ minLength: 5 }),
  subtitle: Type.String(),
  problem_statement: Type.String({ minLength: 20 }),
  
  // Scaffolding & Режим обучения
  pedagogical_mode: Type.Union([
    Type.Literal('WORKED_EXAMPLE'),   // 100% собрано
    Type.Literal('FADED_COMPLETION'),  // достройка с дефектом
    Type.Literal('INDEPENDENT_DESIGN') // свободное проектирование
  ]),
  
  // SLO и лимиты
  slos: Type.Object({
    p99_latency_max_ms: Type.Number({ minimum: 1 }),
    availability_target_nines: Type.Number({ minimum: 90, maximum: 99.999 }),
    monthly_budget_max_usd: Type.Number({ minimum: 0 })
  }),
  
  // Профиль трафика для Web Worker DES
  traffic_profile: Type.Object({
    pattern: Type.Union([Type.Literal('POISSON'), Type.Literal('BURSTY'), Type.Literal('DIURNAL')]),
    lambda_mean_rps: Type.Number({ minimum: 1 }),
    inter_arrival_cv: Type.Number({ minimum: 0.1 }),
    read_ratio: Type.Number({ minimum: 0, maximum: 1 }),
    prompt_tokens_mean: Type.Optional(Type.Number()),
    generation_tokens_mean: Type.Optional(Type.Number())
  }),
  
  // Начальная топология
  topology: Type.Object({
    nodes: Type.Array(TransportNodeSchema),
    edges: Type.Array(TransportEdgeSchema)
  }),
  
  // Правила приёмки (Инварианты)
  invariants: Type.Array(InvariantRuleSchema)
});

export type ChallengeManifest = Static<typeof ChallengeManifestSchema>;
export type TransportNode = Static<typeof TransportNodeSchema>;
export type TransportEdge = Static<typeof TransportEdgeSchema>;
export type InvariantRule = Static<typeof InvariantRuleSchema>;
```

---

## 4. Изоморфный движок валидации (`shared/src/validation/invariantEngine.ts`)

Движок выполняется симметрично:
* **На клиенте:** в React-хуке `useTopologyValidation.ts` для мгновенной подсветки ошибок красным цветом на холсте.
* **На сервере:** в контроллере `POST /api/scenarios/:id/submit` для защиты базы данных от невалидных решений.

### 4.1. Слой 1: Топологические графовые алгоритмы
1. **Проверка ацикличности (Cycle Detection):**
   * Алгоритм Кана (Kahn's Algorithm). Выявляет циклические синхронные вызовы сервисов, ведущие к дедлокам потоков.
2. **Запрещенные прямые соединения (No Direct Access):**
   * BFS-поиск запрещенных ребер: `Client -> RDBMS` без прохождения через `API Gateway` / `Load Balancer`.
3. **Обязательный посредник (Mandatory Intermediary):**
   * Проверка: *Любой путь от узла типа `app_service` к узлу `rdbms_primary` для тяжелых аналитических запросов обязан иметь ребро в `redis_cache`*.

### 4.2. Слой 2: Common Expression Language (CEL) Sandbox
Для вычисления сложных условий без небезопасного `eval()` используется легковесный парсер CEL (`@google/cel-spec` / `cel-js`):

```cel
// Пример 1: Проверка задержки и бюджета из результатов симуляции
simulation.p99_latency_ms <= manifest.slos.p99_latency_max_ms &&
simulation.monthly_cost_usd <= manifest.slos.monthly_budget_max_usd

// Пример 2: Проверка отказоустойчивости репликации
graph.nodes.filter(n, n.type == 'rdbms_replica').size() >= 2

// Пример 3: Проверка защиты от stampede в кэше
graph.nodes.filter(n, n.type == 'semantic_cache').all(c, c.params.xfetch_enabled == true)
```

---

## 5. Миграция данных и схема базы данных SQLite

### 5.1. Обновленная схема `backend/src/services/db.ts`

```sql
-- Таблица канонических сценариев (сидируется из manifests/)
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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
    attempt_count INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, canonical_id, manifest_version)
);
```

### 5.2. План декомпозиции и миграции старых каталогов
1. **`MicroKatasCatalog.ts` (8 кат):**
   * Параметры переносятся в `params`, математика и описание — в `problem_statement`.
   * JS-код `runSimulation` выносится из манифеста в математический воркер (Stage 2).
   * Сохраняются в `scenarios/manifests/katas/kata-*.json`.
2. **`FadedScaffoldingCatalog.ts` (5 инцидентов):**
   * Узлы React Flow очищаются от UI-полей (`selected`, `dragging`, пиксели) и конвертируются в `TransportNode` с сеткой `grid_position`.
   * Правила валидации конвертируются в декларативные `InvariantRuleSchema`.
   * Сохраняются в `scenarios/manifests/scaffolding/incident-*.json`.
3. **`system_design_scenarios.json` (10 макро-задач):**
   * Конвертируются в `scenarios/manifests/macro/macro-*.json`.

---

## 6. Definition of Done (DoD) для Stage 1

Этап считается завершенным **только** при выполнении следующих проверяемых условий:

1. [ ] **TypeBox Schemas:** Файл `shared/src/schemas/manifest.ts` скомпилирован без ошибок TypeScript и экспортирует типы и JSON Schema Draft-07.
2. [ ] **100% Manifest Migration:** Все 23 сценария (8 кат + 5 инцидентов + 10 макро) существуют в `scenarios/manifests/` в формате JSON.
3. [ ] **Automated CI Validation:** Скрипт `scripts/verify_manifests.ts` выполняет полную валидацию всех манифестов против схемы и завершается с кодом 0.
4. [ ] **Isomorphic Engine Tests:** Модульные тесты `invariantEngine.test.ts` подтверждают корректную работу поиска циклов, проверки связности и выполнения CEL-предикатов на синтетических топологиях.
5. [ ] **SQLite Seeder & REST API:** Бэкенд успешно сидирует манифесты в `system_design_manifests`, эндпоинты `GET /api/scenarios` и `GET /api/scenarios/:id` возвращают валидные контракты.
6. [ ] **Zero Compilation Regressions:** Сборка проекта (`npm run build` во фронтенде и бэкенде) проходит без ошибок.

---

## 7. Риски этапа и защита от техдолга

| Риск | Механизм предотвращения |
| :--- | :--- |
| **Утечка пиксельных координат в бэкенд** | Использование дискретной сетки `grid_position: { col, row }` в схеме. Координаты в пикселях вычисляются только во фронтенде: $X = \text{col} \times 160\text{px}$, $Y = \text{row} \times 100\text{px}$. |
| **Замедление валидации в CI** | TypeBox использует нативный валидатор JSON Schema, компилируемый в JS. Валидация 23 манифестов занимает $<15\text{ мс}$. |
| **Ломающие изменения для существующих пользователей** | Введение таблицы `user_progress_ledger` сохраняет обратную совместимость: старые записи прогресса мигрируются через скрипт бэкфилла по маппингу ID. |
