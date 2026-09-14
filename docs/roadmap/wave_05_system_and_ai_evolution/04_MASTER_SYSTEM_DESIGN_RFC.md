# 🏛️ Master RFC: The Multi-Scale Capability Arena (MSCA)
## Unified Modern Systems Architecture, Discrete-Event Queueing Physics, and Isomorphic SSOT Ingestion

> **Статус:** `PENDING_REVIEW`  
> **Версия:** `1.0.0-PROPOSED`  
> **Дата:** 14 сентября 2026 г.  
> **Программа:** Wave 05 — System & AI Evolution  
> **Основание:** 4 отчёта Deep Research (`docs/roadmap/reports/20260914/`), Эмпирический аудит кодовой базы (`01_BASELINE_DEFECT_AUDIT.md`), Решения DEC-01 — DEC-14 (`03_DECISIONS_AND_HYPOTHESES_LOG.md`).

---

## 1. Executive Summary & Hard Architectural Invariants

### 1.1. Контекст и проблема
Историческая архитектура платформы `interview_tutor` эволюционировала дискретно: базовый текстовый каталог задач в SQLite сосуществовал с независимыми клиентскими каталогами микро-кат (`MicroKatasCatalog.ts`) и полуготовых сценариев (`FadedScaffoldingCatalog.ts`). В результате возник критический архитектурный дефект — **каталожный рассинхрон (Split-Brain Paradox)**:
1. База данных бэкенда хранит 10 устаревших сценариев, не зная о 50+ интерактивных микро-катах.
2. Маршруты Академии (`guided_roadmaps.json`) ведут на полноразмерный холст `SystemDesignArena`, минуя специализированные микро-арены `MicroKataArena`.
3. Обучение «System Design» оторвано от физики рантайма (Java 21 Virtual Threads, JVM, память) и инфраструктуры современного ИИ (инференс LLM, векторные базы, HBM), сводясь к пассивному рисованию прямоугольников без математической верификации стабильности очередей.

### 1.2. Цель RFC
Ликвидировать дефект Split-Brain и преобразовать платформу в **Multi-Scale Capability Arena (MSCA)** — передовую обучающую и оценочную среду, объединяющую низкоуровневый рантайм, дискретно-событийный симулятор распределенных систем и устную защиту перед AI Bar-Raiser на базе единого источника истины (SSOT).

### 1.3. Архитектурные инварианты MSCA (Non-Negotiable Invariants)
* **INV-01 (Single Source of Truth):** Никаких захардкоженных каталогов сценариев в TypeScript-бандле клиента. Единственным источником сценариев, микро-кат и шагов курсов является Git-манифест, валидируемый по единой схеме **TypeBox** и сидируемый в базу данных.
* **INV-02 (Decoupled Presentation & Transport):** Модель представления React Flow (координаты сетки, зум, визуальные порты) строго отделена от семантического графа топологии (DAG узлов, типы соединений, SLA-параметры).
* **INV-03 (Isomorphic Invariant Validation):** Валидация архитектурных решений студента изоморфна: один и тот же движок (топологические алгоритмы графов + песочница Common Expression Language — CEL) выполняется на клиенте для мгновенной подсветки и на сервере для валидации коммита в `user_progress_ledger`.
* **INV-04 (Hardware-Grounded Physical Simulation):** Симулятор в Web Worker опирается на физику оборудования (roofline-модели FLOPs/BW, задержки NVLink/RoCE, формулы очередей $M/G/1$ и $G/G/c$). Запрещена генерация случайных псевдозадержек.
* **INV-05 (Zero-Broken-Routes Invariant):** Ни один шаг курсов Академии не может ссылаться на несуществующий или несоответствующий типу задачи экран.

---

## 2. Макро-таксономия: The Multi-Scale Capability Arena (MSCA)

Осенью 2026 года границы между Backend Engineering, Distributed Systems и Machine Learning стерты: все они подчиняются физике пропускной способности памяти, сетевым задержкам и законам распределенного консенсуса. 

Платформа реорганизуется вокруг **Континуума масштаба (Continuum of Scale)**, материализованного в трёх интерактивных студиях:

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 THE MULTI-SCALE ARENA                                       │
├───────────────────────────────┬───────────────────────────────┬─────────────────────────────┤
│    STUDIO 1: RUNTIME &        │      STUDIO 2: TOPOLOGY &     │   STUDIO 3: MULTIMODAL      │
│    FORENSICS WORKBENCH        │      DES SIMULATION CANVAS    │   BAR-RAISER DEFENSE        │
│   (Micro / Meso Scale)        │      (Meso / Macro Scale)     │   (Apex Synthesis)          │
├───────────────────────────────┼───────────────────────────────┼─────────────────────────────┤
│ • Java 21/24 Virtual Threads  │ • React Flow + Web Worker DES │ • Voice AI (Principal L6+)  │
│   (JEP 491, carrier pinning)  │ • $M/G/1$ & $G/G/c$ Solvers   │ • Blast-radius challenges   │
│ • JMM Memory Barriers & LLD   │ • Chaos Monkey Fault Injection│ • Trade-off defense         │
│ • Continuous Batching Kernels │ • Real-time Queuing Telemetry │ • Operational triage runbook│
│ • PagedAttention & KV-Cache   │ • CEL Invariant Verification  │ • Adaptive Socratic probing │
└───────────────────────────────┴───────────────────────────────┴─────────────────────────────┘
                                               ▲
                                               │
                        ┌──────────────────────┴──────────────────────┐
                        │     ADAPTIVE PSYCHOMETRIC ENGINE            │
                        │     Bayesian Knowledge Tracing (BKT)        │
                        │     3-Parameter Logistic IRT (θ, a, b, c)   │
                        └─────────────────────────────────────────────┘
```

### 2.1. Студия 1: Runtime & Forensics Workbench (Micro/Meso)
* **Назначение:** Отработка низкоуровневой механики исполнения, профилирования и устранения узких мест в коде сервисов.
* **Ключевые сценарии:**
  * *Concurrency & Pinning Sandbox:* Воспроизведение блокировок пула соединений при вызове `synchronized` блоков в виртуальных потоках Java 21; детекция JFR-событий `jdk.VirtualThreadPinned`; миграция на `ReentrantLock` и рантайм Java 24 (JEP 491).
  * *Memory Layout & Cache Coherence:* Анализ false sharing кэш-линий процессора, применение `@Contended`, атомарные CAS-структуры без блокировок (Disruptor RingBuffer).
  * *Inference Kernel Mechanics:* Моделирование выгрузки весов модели в HBM, задержки fused-ядер FlashAttention, пагинация страниц памяти PagedAttention при фрагментации KV-кэша.

### 2.2. Студия 2: Discrete-Event Simulation & Topology Canvas (Meso/Macro)
* **Назначение:** Сборка распределенных топологий с динамической симуляцией стохастической нагрузки в фоновом Web Worker.
* **Функциональность:**
  * Узлы топологии — это параметризованные математические очереди (емкость, распределение поступления, дисперсия времени обслуживания).
  * Режим инъекции сбоев (Chaos Monkey): симуляция разрыва сетевых линков между AZ, деградация дискового ввода-вывода (IOPS stall), отказ лидер-ноды Raft.
  * Мгновенный аналитический расчет задержек $P99$ и $P99.9$ без зависания UI-потока.

### 2.3. Студия 3: Multimodal Bar-Raiser Defense Arena (Apex)
* **Назначение:** Защита спроектированной системы в формате живого диалога с AI-интервьюером уровня Principal/Staff Engineer.
* **Механика:**
  * AI-интервьюер получает телеметрию из Студии 2: «Ваша симуляция показывает всплеск $P99$ до 4.8 секунд при росте трафика на 20%. Почему вы поставили асинхронную очередь перед стримером токенов вместо backpressure с load-shedding?».
  * Оценка выставляется по 4 критериям: глубина понимания компромиссов (Trade-Off Defensibility), локализация радиуса поражения (Blast-Radius Isolation), устойчивость к стресс-вопросам и операционная убежденность (Operational Conviction).

---

## 3. Педагогическая механика: Когнитивная лестница (Junior $\rightarrow$ Staff)

### 3.1. Преодоление «синдрома пустого холста»: Backward Fading
Обучение строится по принципу затухающих лесов (Renkl & Atkinson):
1. **Worked Example (Эталонный разбор):** Студент изучает 100% готовую архитектуру. Интерактивная трассировка пакета от браузера до БД.
2. **Faded Completion Task (Достраивание с дефектом):** Готовая на 80% система с намеренной уязвимостью (например, несбалансированные шарды или отсутствие кэша перед тяжелыми запросами). Студент диагностирует проблему и достраивает недостающие 20%.
3. **Independent Design (Свободное проектирование):** Построение архитектуры с нуля под строгие требования SLO, бюджета и отказоустойчивости.

### 3.2. Цикл Predict-Observe-Explain (POE)
Перед запуском симуляции студент обязан сформулировать прогноз:
* *Predict:* Выбор гипотезы («Добавление Redis кэша снизит $P99$ задержку базы данных до 10 мс»).
* *Observe:* Запуск стресс-теста в Web Worker. Наблюдение за реальными метриками (например, Cache Stampede при истечении TTL и падение базы).
* *Explain:* AI просит объяснить физическую причину расхождения прогноза с наблюдаемым поведением и предложить стабилизирующее архитектурное решение (XFetch, probabilistic early expiration).

### 3.3. 4-Уровневая матрица перехода квалификаций

| Уровень | Доменные границы | Ключевые концепции | Антипаттерны уровня |
| :--- | :--- | :--- | :--- |
| **Junior (L3/L4 Baseline)** | **Single-Box Architecture** | Жизненный цикл HTTP/TCP-запроса, DNS, обратный прокси (Nginx), sizing пула соединений (HikariCP, Little's Law $L=\lambda W$), выбор индексов (B-Tree vs Hash), базовый Cache-Aside. | Попытка проектировать микросервисы и Kafka там, где достаточно монолита с правильными индексами. |
| **Middle (L4+/L5- Bridge)** | **2–3 Tier Distributed Systems** | Репликация Master-Replica, партиционирование данных, брокеры сообщений (Kafka), идемпотентность через ключи идемпотентности, Dead-Letter Queues, грубые расчеты емкости (Back-of-the-envelope). | Пренебрежение лагом репликации при чтении после записи; отсутствие таймаутов на сетевых вызовах. |
| **Senior (L5 Enterprise)** | **Partitioned & Multi-Region Systems** | Active-Passive Multi-Region, распределенные транзакции (Saga, Outbox), консенсус (Raft), моделирование стабильности очередей ($M/G/1$, $G/G/c$), хвосты $P99.9$, адаптивный Load-Shedding (CoDel). | Проектирование распределенных блокировок через два региона; вера в гарантированную доставку сообщений. |
| **Staff / Principal (L6/L7 Apex)** | **Cell-Based & Planetary AI Infrastructure** | Active-Active Multi-Region, Cell-Based архитектура, аппаратные ускорители (NVLink, RoCE, HBM), непрерывный батчинг инференса, FinOps-моделирование, радиус поражения (Blast Radius Isolation). | Оптимизация happy-path вместо готовности к каскадным авариям; отсутствие четких runbook'ов деградации. |

---

## 4. Математика дискретно-событийного симулятора (DES)

Симулятор исполняется внутри выделенного Web Worker и обеспечивает latency расчёта $<0.5\text{ мс}$ на итерацию за счёт замкнутых аналитических формул.

### 4.1. Физический Roofline инференса LLM
Задержка инференса строго разделяется на две физические фазы:

#### 1. Фаза Prefill (Compute-Bound, расчет TTFT)
Вычисление всех $T_{\text{in}}$ токенов входного промпта:
$$T_{\text{prefill}} = \max\left(\frac{2 \cdot P \cdot T_{\text{in}}}{\Phi_{\text{peak}}}, \frac{P \cdot b_{\text{param}}}{BW_{\text{mem}}}\right)$$
где $P$ — число активных параметров модели, $\Phi_{\text{peak}}$ — пиковая производительность тензорных ядер (FLOP/s), $BW_{\text{mem}}$ — пропускная способность памяти HBM (Б/с), $b_{\text{param}}$ — разрядность весов (байты).

#### 2. Фаза Decode (Memory-Bandwidth-Bound, расчет TPOT / ITL)
Авторегрессионная генерация токена:
$$T_{\text{decode}} = \frac{P \cdot b_{\text{param}} + 2 \cdot b_{\text{kv}} \cdot L \cdot d_{\text{model}} \cdot S_{\text{ctx}}}{BW_{\text{mem}}}$$
где $L$ — число слоев, $d_{\text{model}}$ — размерность скрытого слоя, $S_{\text{ctx}}$ — суммарный контекст в KV-кэше, $b_{\text{kv}}$ — разрядность KV-кэша.

#### 3. Continuous Batching & KV-Cache Exhaustion
Динамический размер батча $B_t$ на шаге $t$:
$$B_t = \min\left(B_{\text{max}}, \left\lfloor \frac{M_{\text{HBM}} - P \cdot b_{\text{param}}}{2 \cdot b_{\text{kv}} \cdot L \cdot d_{\text{model}} \cdot \bar{S}_{\text{ctx}}} \right\rfloor\right)$$
При нехватке блоков памяти PagedAttention симулятор активирует вытеснение (preemption) запросов с наименьшим приоритетом обратно в очередь ожидания.

### 4.2. Векторный поиск (ANN) и семантическое кэширование
* **HNSW:** Задержка поиска масштабируется логарифмически:
  $$T_{\text{HNSW}} \approx T_{\text{hop}} \cdot M \cdot \ln(N) \cdot \frac{efSearch}{M}$$
  Точность поиска (Recall): $\text{Recall} \approx 1 - \exp(-\alpha \cdot efSearch^{\beta})$.
* **Hybrid Search (BM25 + Dense RRF):**
  $$RRF\_Score(d) = \sum_{m \in \{\text{dense}, \text{sparse}\}} \frac{1}{k + r_m(d)},\quad k = 60$$
* **Штампоустойчивость семантического кэша (XFetch):**
  Упреждающее асинхронное обновление горячего ключа в фоне до наступления TTL:
  $$\text{Recompute} \iff t - \beta \cdot \delta \cdot \ln(\text{rand}()) > \text{expiry}$$
  где $\delta$ — время вычисления запроса моделью, $\beta > 0$ — агрессивность обновления.

### 4.3. Аналитические солверы очередей в Web Worker
* **$M/G/1$ (Pollaczek-Khinchine):**
  $$W_q = \frac{\rho}{\mu(1-\rho)} \cdot \left(\frac{1 + C_s^2}{2}\right)$$
  где $C_s^2 = \frac{\sigma_s^2}{(\mathbb{E}[S])^2}$ — коэффициент вариации времени обработки.
* **$G/G/c$ (Allen-Cunneen):**
  $$W_q \approx \frac{P_c}{c\mu(1-\rho)} \cdot \left(\frac{C_a^2 + C_s^2}{2}\right)$$
* **Квантили $P99$ и $P99.9$ (Аппроксимация Кимуры и разложение Корниша-Фишера):**
  Вместо симуляции миллионов событий квантили рассчитываются аналитически через первые моменты распределения ($\mu, \sigma^2, \gamma_1$):
  $$P_{99} \approx \mathbb{E}[T] + \sigma_T \cdot \left(z_{0.99} + \frac{\gamma_1}{6}(z_{0.99}^2 - 1)\right)$$
  где $z_{0.99} = 2.326$, что обеспечивает мгновенный отклик ползунков UI при 60 FPS.

---

## 5. Single Source of Truth (SSOT): Схема и валидация

### 5.1. Ликвидация Split-Brain каталогов
Вся экосистема сценариев переводится на единую структуру манифестов в Git:

```
interview_tutor/
└── scenarios/
    ├── manifests/
    │   ├── l3_single_box_gateway.json
    │   ├── l4_ecommerce_cache_invalidation.json
    │   ├── l5_llm_rag_serving_gateway.json
    │   └── l6_planetary_ledger_cell.json
    └── schemas/
        └── scenario_manifest.schema.json (TypeBox Generated)
```

База данных SQLite сидируется исключительно из этих манифестов. Бандл клиента компилирует только типы TypeBox, загружая данные манифестов по требованию через REST API с локальным кэшированием в IndexedDB.

### 5.2. Спецификация TypeBox Canonical Manifest

```typescript
import { Type, Static } from '@sinclair/typebox';

export const NodeConstraintSchema = Type.Object({
  id: Type.String(),
  type: Type.String(),
  min_instances: Type.Optional(Type.Integer({ minimum: 1 })),
  max_instances: Type.Optional(Type.Integer()),
  allowed_types: Type.Optional(Type.Array(Type.String())),
  required_config: Type.Optional(Type.Record(Type.String(), Type.Any()))
});

export const InvariantRuleSchema = Type.Object({
  id: Type.String(),
  description: Type.String(),
  severity: Type.Union([Type.Literal('error'), Type.Literal('warning')]),
  rule_type: Type.Union([
    Type.Literal('graph_connectivity'),
    Type.Literal('cycle_detection'),
    Type.Literal('path_traversal'),
    Type.Literal('cel_expression')
  ]),
  expression: Type.String() // CEL predicate or graph query
});

export const ChallengeManifestSchema = Type.Object({
  schema_version: Type.Literal('1.0.0'),
  canonical_id: Type.String({ pattern: '^[a-z0-9-]+$' }),
  target_level: Type.Union([
    Type.Literal('L3_JUNIOR'),
    Type.Literal('L4_MIDDLE'),
    Type.Literal('L5_SENIOR'),
    Type.Literal('L6_STAFF')
  ]),
  archetype: Type.String(),
  title: Type.String(),
  problem_statement: Type.String(),
  slos: Type.Object({
    p99_latency_ms: Type.Number(),
    availability_nines: Type.Number({ minimum: 90, maximum: 99.999 }),
    max_monthly_budget_usd: Type.Number()
  }),
  traffic_profile: Type.Object({
    arrival_distribution: Type.Union([Type.Literal('POISSON'), Type.Literal('BURSTY')]),
    lambda_mean_rps: Type.Number(),
    ca_coefficient: Type.Number(),
    prompt_tokens_mean: Type.Optional(Type.Number()),
    generation_tokens_mean: Type.Optional(Type.Number())
  }),
  scaffolding: Type.Object({
    mode: Type.Union([
      Type.Literal('WORKED_EXAMPLE'),
      Type.Literal('FADED_COMPLETION'),
      Type.Literal('INDEPENDENT')
    ]),
    prefilled_nodes: Type.Array(Type.Any()),
    prefilled_edges: Type.Array(Type.Any()),
    locked_node_ids: Type.Array(Type.String())
  }),
  invariants: Type.Array(InvariantRuleSchema)
});

export type ChallengeManifest = Static<typeof ChallengeManifestSchema>;
```

### 5.3. Изоморфный движок валидации инвариантов (Graph + CEL)
1. **Топологический слой (Graph Traversal):**
   * Проверка циклов через алгоритм Кана (Kahn's algorithm).
   * Проверка связности: существование пути `Client -> Ingress -> Service -> Storage`.
   * Запрет прямых соединений `Client -> Database` (минуя API Gateway).
2. **Предикатный слой (Sandboxed Common Expression Language — CEL):**
   * Вычисление нетривиальных условий без уязвимостей выполнения `eval()`:
   ```cel
   simulation.p99_latency_ms <= manifest.slos.p99_latency_ms &&
   simulation.monthly_cost_usd <= manifest.slos.max_monthly_budget_usd &&
   graph.nodes.filter(n, n.type == 'llm_service').all(s, s.queue_length < 500)
   ```

### 5.4. Идемпотентный реестр прогресса (Unified Ledger)
Таблица SQLite `user_progress_ledger` фиксирует попытки студентов по стабильным каноническим идентификаторам:

```sql
CREATE TABLE IF NOT EXISTS user_progress_ledger (
    entry_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    canonical_id TEXT NOT NULL,
    manifest_version TEXT NOT NULL,
    status TEXT CHECK(status IN ('STARTED', 'PASSED', 'FAILED')) NOT NULL,
    completion_vector TEXT NOT NULL, -- JSON-массив выполненных инвариантов
    p99_achieved_ms REAL,
    cost_achieved_usd REAL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, canonical_id, manifest_version)
);
```

Курсы Академии (`guided_roadmaps.json`) содержат ссылки только на `canonical_id`, что гарантирует вечную целостность ссылок при обновлении версий сценариев.

---

## 6. Phased Implementation Roadmap (План реализации по этапам)

Реализация декомпозируется на 4 фазы со строгими критериями приёмки (Definition of Done):

```
┌───────────────────────────┐     ┌───────────────────────────┐     ┌───────────────────────────┐     ┌───────────────────────────┐
│          STAGE 1          │     │          STAGE 2          │     │          STAGE 3          │     │          STAGE 4          │
│   SSOT & SCHEMA ENGINE    │ ──► │  DES SIMULATION WORKER    │ ──► │  TRI-STUDIO UI & ROUTING  │ ──► │ VOICE DEFENSE & MIGRATION │
│                           │     │                           │     │                           │     │                           │
│ • TypeBox Schemas         │     │ • Web Worker Architecture │     │ • React Flow Canvas Hub   │     │ • Live Audio WebSocket    │
│ • Manifest Manifests Dir  │     │ • Roofline LLM Math       │     │ • Academy Router Sync     │     │ • SQLite Ledger Backfill  │
│ • Isomorphic CEL Engine   │     │ • $M/G/1$ & $G/G/c$ Solv. │     │ • Runtime Workbench Mini  │     │ • Deprecation of Old Cat. │
│ • CI Schema Validator     │     │ • Chaos Monkey Core       │     │ • POE Interactive Loop    │     │ • 100% E2E Test Suite     │
└───────────────────────────┘     └───────────────────────────┘     └───────────────────────────┘     └───────────────────────────┘
```

### Stage 1: SSOT Data Layer & Isomorphic Invariant Engine
* **DoD:** 
  1. Пакет схем TypeBox в `backend/src/schemas/manifest.ts` с генерацией JSON Schema.
  2. Все 36 микро-кат и 14 сценариев мигрированы из TypeScript-кода в канонические `.json` манифесты.
  3. Изоморфный движок на базе `@google/cel-spec` (или легковесного CEL-JS) валидирует граф топологии в тестах.
  4. Скрипт `scripts/verify_manifests.py` валидирует 100% сценариев в CI.

### Stage 2: Web Worker Discrete-Event Simulation Kernel
* **DoD:**
  1. Создан выделенный воркер `frontend/src/workers/desSimulator.worker.ts`.
  2. Реализованы модули: Roofline LLM (Prefill/Decode), PagedAttention KV-Cache, HNSW Vector DB, XFetch Cache.
  3. Реализованы аналитические солверы очередей Кимуры и Корниша-Фишера ($P99 < 0.5\text{ мс}$).
  4. Модуль Chaos Monkey поддерживает сценарии сбоев сети и диска.

### Stage 3: Tri-Studio UI Unification & Academy Router Synchronization
* **DoD:**
  1. Устранена рассинхронизация роутинга: все шаги `guided_roadmaps.json` привязаны к каноническим `canonical_id`.
  2. Холст `@xyflow/react` разделяет модель представления и семантический DAG; добавлены AI-ноды (Vector DB, LLM Gateway, Semantic Cache, GPU Cluster).
  3. Реализован интерфейс цикла Predict-Observe-Explain (POE).
  4. Внедрён модуль `Runtime & Forensics Workbench` для задач L3/L4 (пулы HikariCP, пиннинг виртуальных потоков).

### Stage 4: Voice Bar-Raiser Integration, Progress Ledger & Full Migration
* **DoD:**
  1. Голосовой AI в Студии 3 подключается к телеметрии холста через LiteLLM Proxy и Gemini Live WebSocket.
  2. Внедрена таблица `user_progress_ledger` с автоматической миграцией старого прогресса пользователей.
  3. Полностью удалены устаревшие файлы `MicroKatasCatalog.ts` и `FadedScaffoldingCatalog.ts`.
  4. Все E2E и компонентные тесты проходят со 100% успехом.

---

## 7. Риски и стратегии минимизации

1. **Риск деградации производительности симуляции в браузере:**
   * *Митигация:* Использование аналитических двухмоментных солверов (Кимура/Корниш-Фишер) вместо прямого отслеживания миллионов дискретных событий. Вынос всех вычислений в фоновый Web Worker с передачей через `Transferable ArrayBuffer`.
2. **Риск усложнения онбординга для Junior-инженеров:**
   * *Митигация:* Строгая изоляция Студии 1 (Single-Box HTTP/DB) от сложных распределенных нод. Использование затухающих лесов (Worked Examples) на начальных этапах.
3. **Риск несовместимости манифестов при обновлениях:**
   * *Митигация:* Версионирование манифестов (`schema_version: '1.0.0'`) и версионирование записей в реестре `user_progress_ledger`.

---

## 8. Заключение
Данный Master RFC переводит InterviewPrep AI из категории простых тренажеров для рисования схем в высшую лигу образовательных и оценочных инженерных платформ мирового уровня (SOTA 2026), объединяя академическую строгость математики очередей с реальной практикой высоконагруженных систем.
