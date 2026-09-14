# 🏛️ Master RFC: The Multi-Scale Capability Arena (MSCA)
## Unified Modern Systems Architecture, Discrete-Event Queueing Physics, and Isomorphic SSOT Ingestion

> **Статус:** `SPECIFICATION_LOCKED`  
> **Версия:** `1.1.0-RECONCILED` (Полная синхронизация с отчётами Deep Research B1–B5)  
> **Дата:** 14 сентября 2026 г.  
> **Программа:** Wave 05 — System & AI Evolution  
> **Основание:** 5 отчётов Deep Research (`docs/roadmap/reports/20260914/`), Эмпирический аудит кодовой базы (`01_BASELINE_DEFECT_AUDIT.md`), Решения DEC-01 — DEC-15 (`03_DECISIONS_AND_HYPOTHESES_LOG.md`).

---

## 1. Executive Summary & Hard Architectural Invariants

### 1.1. Контекст и проблема
Историческая архитектура платформы `interview_tutor` эволюционировала дискретно: базовый текстовый каталог задач в SQLite сосуществовал с независимыми клиентскими каталогами микро-кат (`MicroKatasCatalog.ts`) и полуготовых сценариев (`FadedScaffoldingCatalog.ts`). В результате возник критический архитектурный дефект — **каталожный рассинхрон (Split-Brain Paradox)**:
1. База данных бэкенда хранит 10 устаревших сценариев, не зная о микро-катах и современных сценариях распределенных систем.
2. Маршруты Академии (`guided_roadmaps.json`) ведут на полноразмерный холст `SystemDesignArena`, минуя специализированные микро-арены `MicroKataArena` и выдавая пустые экраны из-за несовпадения ID.
3. Обучение «System Design» оторвано от физики рантайма (Java 21 Virtual Threads, JVM, память) и инфраструктуры современного ИИ (инференс LLM, векторные базы, HBM), сводясь к пассивному рисованию прямоугольников без математической верификации стабильности очередей.

### 1.2. Цель RFC
Ликвидировать дефект Split-Brain и преобразовать платформу в **Multi-Scale Capability Arena (MSCA)** — передовую обучающую и оценочную среду, объединяющую низкоуровневый рантайм, дискретно-событийный симулятор распределенных систем и устную защиту перед AI Bar-Raiser на базе единого источника истины (SSOT).

### 1.3. Архитектурные инварианты MSCA (Non-Negotiable Invariants)
* **INV-01 (Single Source of Truth):** Никаких захардкоженных каталогов сценариев в TypeScript-бандле клиента. Единственным источником сценариев, микро-кат и шагов курсов является каталог 26 Git-манифестов, валидируемый по единой схеме **TypeBox** и сидируемый в базу данных.
* **INV-02 (Decoupled Presentation & Transport):** Модель представления React Flow (координаты сетки, зум, визуальные порты) строго отделена от семантического графа топологии (DAG узлов, типы соединений, SLA-параметры).
* **INV-03 (Isomorphic Invariant Validation):** Валидация архитектурных решений студента изоморфна: один и тот же движок (топологические алгоритмы графов + песочница Common Expression Language — CEL) выполняется на клиенте для мгновенной подсветки и на сервере для валидации коммита в `user_progress_ledger`.
* **INV-04 (Hardware-Grounded Physical Simulation):** Симулятор в Web Worker опирается на физику оборудования (roofline-модели FLOPs/BW, задержки NVLink/RoCE, формулы очередей $M/G/1$ и $G/G/c$). Запрещена генерация случайных псевдозадержек.
* **INV-05 (Zero-Broken-Routes Invariant):** Ни один шаг курсов Академии не может ссылаться на несуществующий или несоответствующий типу задачи экран. Обеспечивается двухключевым индексом разрешения (`canonical_id` + `legacy_aliases`).

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
│ • Java 21/24 Virtual Threads  │ • React Flow + Web Worker DES │ • Voice AI (Principal L6/L7)│
│   (JEP 491, carrier pinning)  │ • $M/G/1$ & $G/G/c$ Solvers   │ • Blast-radius challenges   │
│ • JMM Memory Barriers & LLD   │ • Chaos Monkey Fault Injection│ • Trade-off defense         │
│ • Continuous Batching Kernels │ • Real-time Queuing Telemetry │ • Operational triage runbook│
│ • PagedAttention & KV-Cache   │ • CEL Invariant Verification  │ • Adaptive Socratic probing │
└───────────────────────────────┴───────────────────────────────┴─────────────────────────────┘
```

### 2.1. Студия 1: Runtime & Forensics Workbench (Micro/Meso)
* **Назначение:** Отработка низкоуровневой механики исполнения, профилирования и устранения узких мест в коде сервисов.
* **Ключевые сценарии:**
  * *Concurrency & Pinning Sandbox:* Воспроизведение блокировок пула соединений при вызове `synchronized` блоков в виртуальных потоках Java 21; детекция JFR-событий `jdk.VirtualThreadPinned`; миграция на `ReentrantLock` и рантайм Java 24 (JEP 491).
  * *HikariCP Little's Law:* Калькулятор sizing'а пула соединений БД и физическая демонстрация троттлинга CPU context-switch при переразмеривании пула.
  * *Inference Kernel Mechanics:* Моделирование выгрузки весов модели в HBM, задержки fused-ядер FlashAttention, пагинация страниц памяти PagedAttention при фрагментации KV-кэша.

### 2.2. Студия 2: Discrete-Event Simulation & Topology Canvas (Meso/Macro)
* **Назначение:** Сборка распределенных топологий с динамической симуляцией стохастической нагрузки в фоновом Web Worker.
* **Функциональность:**
  * Узлы топологии — это параметризованные математические очереди (емкость, распределение поступления, дисперсия времени обслуживания).
  * Режим инъекции сбоев (Chaos Monkey): симуляция разрыва сетевых линков между AZ, деградация дискового ввода-вывода (IOPS stall), отказ лидер-ноды Raft.
  * Мгновенный аналитический расчет задержек $P99$ и $P99.9$ без зависания UI-потока.
  * Интерактивный цикл Predict-Observe-Explain (POE).

### 2.3. Студия 3: Multimodal Bar-Raiser Defense Arena (Apex)
* **Назначение:** Защита спроектированной системы в формате живого диалога с AI-интервьюером уровня Principal/Staff Engineer по 5-фазному конечному автомату (Report B5).
* **Механика:**
  * AI-интервьюер получает телеметрию из Студии 2.
  * Оценка выставляется по формальной JSON-схеме Draft 2020-12 с калибровкой грейда от L3 до L7.

---

## 3. Педагогическая механика: Когнитивная лестница (Junior $\rightarrow$ Principal)

### 3.1. Преодоление «синдрома пустого холста»: Backward Fading
Обучение строится по принципу затухающих лесов (Renkl & Atkinson):
1. **Worked Example (Эталонный разбор):** Студент изучает 100% готовую архитектуру. Интерактивная трассировка пакета от браузера до БД.
2. **Faded Completion Task (Достраивание с дефектом):** Готовая на 80% система с намеренной уязвимостью. Студент диагностирует проблему и достраивает недостающие 20%.
3. **Independent Design (Свободное проектирование):** Построение архитектуры с нуля под строгие требования SLO, бюджета и отказоустойчивости.

### 3.2. 5-Уровневая матрица перехода квалификаций (L3–L7)

| Уровень | Доменные границы | Ключевые концепции | Антипаттерны уровня |
| :--- | :--- | :--- | :--- |
| **Junior (L3 Baseline)** | **Single-Box Architecture** | Жизненный цикл HTTP/TCP-запроса, DNS, Nginx буферизация, sizing пула HikariCP ($L=\lambda W$), B-Tree vs Hash индексы, базовый Cache-Aside. | Попытка проектировать микросервисы и Kafka там, где достаточно монолита с правильными индексами. |
| **Middle (L4 Bridge)** | **2–3 Tier Distributed Systems** | Репликация Master-Replica, партиционирование данных, брокеры сообщений (Kafka), идемпотентность через outbox, замки с fencing tokens. | Пренебрежение лагом репликации при чтении после записи; отсутствие таймаутов на сетевых вызовах. |
| **Senior (L5 Enterprise)** | **Partitioned & Multi-Region Systems** | Active-Passive Multi-Region, Saga, Raft консенсус, модели очередей ($M/G/1$, $G/G/c$), хвосты $P99.9$, PagedAttention, HNSW. | Проектирование распределенных блокировок через два региона; слепая вера в гарантированную доставку сообщений. |
| **Staff (L6 Lead)** | **Cell-Based & Planetary Systems** | Active-Active Multi-Region, Cell-Based архитектура, Spanner-like TrueTime/HLC, FinOps eBPF pipelines, радиус поражения. | Оптимизация happy-path вместо готовности к каскадным авариям; отсутствие четких runbook'ов деградации. |
| **Principal (L7 Apex)** | **Planetary AI Fleet & Zero Blast-Radius** | 10 000 GPU Borg scheduling, NVLink vs RoCE all-reduce topology, zero blast-radius cellular partitioning, глобальный arbitrage. | Локальная оптимизация подсистем в ущерб TCO организации; игнорирование аппаратных пределов полупроводников. |

---

## 4. Single Source of Truth (SSOT): Спецификация манифестов

Все 26 сценариев описываются универсальной схемой TypeBox, объединяющей все три студии:

```typescript
import { Type, Static } from '@sinclair/typebox';

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
  studio_1_runtime: Type.Optional(Type.Object({
    language: Type.Union([Type.Literal('java21'), Type.Literal('sql'), Type.Literal('nginx'), Type.Literal('typescript'), Type.Literal('python')]),
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
  })),
  studio_2_simulation: Type.Object({
    topology: Type.Object({
      nodes: Type.Array(Type.Any()),
      edges: Type.Array(Type.Any())
    }),
    slos: Type.Object({
      p99_latency_max_ms: Type.Number(),
      availability_target_nines: Type.Number(),
      monthly_budget_max_usd: Type.Number()
    }),
    traffic_profile: Type.Object({
      pattern: Type.Union([Type.Literal('POISSON'), Type.Literal('BURSTY'), Type.Literal('DIURNAL')]),
      lambda_mean_rps: Type.Number(),
      inter_arrival_cv: Type.Number(),
      read_ratio: Type.Number()
    }),
    invariants: Type.Array(Type.Any())
  }),
  studio_3_bar_raiser: Type.Object({
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
    }))
  })
});
```

---

## 5. Phased Implementation Roadmap

```
┌───────────────────────────┐     ┌───────────────────────────┐     ┌───────────────────────────┐     ┌───────────────────────────┐
│          STAGE 1          │     │          STAGE 2          │     │          STAGE 3          │     │          STAGE 4          │
│   SSOT & SCHEMA ENGINE    │ ──► │  DES SIMULATION WORKER    │ ──► │  TRI-STUDIO UI & ROUTING  │ ──► │ VOICE DEFENSE & MIGRATION │
│                           │     │                           │     │                           │     │                           │
│ • 26 Canonical Manifests  │     │ • Web Worker Architecture │     │ • MultiScaleCanvasHub     │     │ • Live Audio WebSocket    │
│ • @interview-prep/shared  │     │ • Single-Box & Queues Math│     │ • Academy Router Sync     │     │ • B5 Bar-Raiser Rubric    │
│ • Dual-Key Alias Resolver │     │ • Roofline & AI Solvers   │     │ • Forensic Code Editor    │     │ • Deprecation of Old Cat. │
│ • Isomorphic CEL Engine   │     │ • Planetary Blast Radius  │     │ • POE Interactive Loop    │     │ • 100% E2E Test Suite     │
└───────────────────────────┘     └───────────────────────────┘     └───────────────────────────┘     └───────────────────────────┘
```

### Stage 1: SSOT Data Layer & Isomorphic Invariant Engine
* **DoD:** 
  1. Независимый пакет `@interview-prep/shared` с типами TypeBox и JSON Schema Draft-07.
  2. 26 канонических манифестов JSON в `scenarios/manifests/` (5 L3, 5 L4, 10 L5, 6 L6/L7).
  3. Двухключевой резолвер SQLite (`system_design_manifests` + `system_design_aliases`).
  4. CI-валидатор `scripts/verify_manifests.ts` валидирует 100% манифестов за $<50\text{ мс}$.
  5. Изоморфный движок валидации (алгоритм Кана, BFS связности, предикаты CEL).

### Stage 2: Web Worker Discrete-Event Simulation Kernel
* **DoD:**
  1. Выделенный воркер `frontend/src/workers/desSimulator.worker.ts` собирается без ошибок Vite.
  2. Модули: `singleBoxResourceSolver` (HikariCP, Java 21 Virtual Threads, Nginx), `distributedQueueSolver` ($M/G/1$, $G/G/c$, Kimura $P99$), `aiRooflineSolver` (Prefill/Decode, PagedAttention), `planetaryCellularSolver` (Blast-radius, NVLink/RoCE).
  3. Время расчета графа из 15 узлов на 10 000 запросов $<10\text{ мс}$.
  4. Тесты физической сходимости с эталонными математическими моделями.

### Stage 3: Tri-Studio UI Unification & Academy Router Synchronization
* **DoD:**
  1. Полная ликвидация рассинхронизации роутинга: все 49 шагов курсов `guided_roadmaps.json` открывают канонические сценарии через `openSystemDesignById`.
  2. Контейнер `MultiScaleCanvasHub.tsx` объединяет Студии 1, 2 и 3 с поддержкой 60 FPS, `100dvh` и пастельной эстетики.
  3. Внедрен редактор кода CodeMirror с визуализаторами пула HikariCP, виртуальных потоков и страниц PagedAttention.
  4. Реализован цикл Predict-Observe-Explain (POE).

### Stage 4: Voice Bar-Raiser Integration, Progress Ledger & Full Migration
* **DoD:**
  1. Голосовая сессия Gemini Live поднимается через LiteLLM Proxy WebSocket по 5-фазному автомату.
  2. Строго соблюдены инварианты `AGENTS.md` (First-Turn Tool Lockdown, Dual Handshake, Tactile Barge-In).
  3. AI генерирует структурированный вердикт по схеме Draft 2020-12 (Report B5) с калибровкой L3–L7.
  4. Устаревшие файлы `MicroKatasCatalog.ts`, `FadedScaffoldingCatalog.ts` и `system_design_scenarios.json` полностью удалены.
  5. 100% E2E тестов проходят успешно.
