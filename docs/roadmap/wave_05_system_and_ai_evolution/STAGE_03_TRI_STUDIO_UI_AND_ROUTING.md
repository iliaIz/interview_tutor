# 🛠️ Stage 3 Specification: Tri-Studio UI & Academy Routing Synchronization

> **Статус:** `SPECIFICATION_LOCKED`  
> **Версия:** `1.1.0-RECONCILED` (Синхронизация с Tri-Studio SSOT и ликвидация дефектов маршрутизации)  
> **Дата:** 14 сентября 2026 г.  
> **Программа:** Wave 05 — System & AI Evolution  
> **Родительский RFC:** [`04_MASTER_SYSTEM_DESIGN_RFC.md`](04_MASTER_SYSTEM_DESIGN_RFC.md)  
> **Инварианты:** `INV-01` (SSOT), `INV-02` (Decoupled Presentation & Transport), `INV-05` (Zero-Broken-Routes), Раздел 3 `AGENTS.md` (Soft Luxury Pastel UI).

---

## 1. Executive Summary & Problem Scope

### 1.1. Назначение этапа
1. Ликвидировать дефект тихого отказа маршрутизации в Академии: синхронизировать все 49 шагов курсов (`middle-java-spring-20`, `senior-bigtech-sprint-25`, `staff-principal-track-60`, `highload-system-design-15`) через двухключевой резолвер `canonical_id` и `legacy_aliases`.
2. Объединить разрозненные экраны в единый интерфейс **Multi-Scale Canvas Hub (`MultiScaleCanvasHub.tsx`)** с поддержкой переключения между тремя взаимосвязанными студиями:
   * **Студия 1 (Runtime & Forensics Workbench):** Низкоуровневый анализ кода на Java 21, конфигураций Nginx, SQL-индексов, пиннинга виртуальных потоков и сайзинга пулов соединений HikariCP (с использованием `@uiw/react-codemirror`).
   * **Студия 2 (Topology Canvas & DES Simulation):** Интерактивный холст на `@xyflow/react` с симулятором в Web Worker, циклом Predict-Observe-Explain (POE) и специализированными узлами AI-инфраструктуры (GPU Cluster, Vector DB, Semantic Cache).
   * **Студия 3 (Voice Bar-Raiser Defense Arena):** Интерфейс устной защиты перед AI Bar-Raiser с тактильным прерыванием (barge-in), живым радаром компетенций и карточкой вердикта.

### 1.2. Соблюдение стандартов UI/UX (Soft Luxury Pastel Aesthetics)
* В соответствии с разделом 3 `AGENTS.md`, поддерживается эстетика мягкой роскоши: тонкие обводки `#FFF0F5`, полупрозрачные карточки с `backdrop-blur-md`, акценты лаванды, розы и мягкие ауры фонового свечения.
* **100dvh Viewport Standard:** Все экраны, модальные окна и шторки студий используют строго `100dvh` (`h-[calc(100dvh-4rem)]`), полностью предотвращая скачки высоты вьюпорта при вызове мобильной клавиатуры.
* **Multi-Modal Reference-Counted Scroll Lock:** Модальные окна POE и шторки рантайма используют `useBodyScrollLock` со счетчиком ссылок `activeLocksCount`.

---

## 2. Архитектура компонентов интерфейса

```
frontend/src/components/system_design/
├── MultiScaleCanvasHub.tsx          # Главный контейнер Tri-Studio (табы: Runtime, Topology, Defense)
├── studio_1_runtime/                # Студия 1: Runtime & Forensics Workbench
│   ├── RuntimeForensicsDrawer.tsx   # Шторка детального анализа узла и кода
│   ├── ForensicCodeEditor.tsx       # Редактор CodeMirror (Java 21, SQL, Nginx) с подсветкой бага
│   ├── HikariPoolVisualizer.tsx     # Интерактивный калькулятор по формуле Литтла
│   ├── VirtualThreadPinningLab.tsx  # Визуализатор ForkJoinPool carrier-потоков и JFR-событий
│   └── PagedAttentionVisualizer.tsx # Карта блоков страниц HBM памяти (16 токенов на блок)
├── studio_2_topology/               # Студия 2: Topology Canvas & DES Simulation
│   ├── TopologyCanvas.tsx           # Холст React Flow 60 FPS с дискретной сеткой grid_position
│   ├── nodes/
│   │   ├── BaseSystemNode.tsx       # Базовый узел с бейджами задержки, утилизации и очереди
│   │   ├── GpuInferenceNode.tsx     # LLM узел (HBM индикатор, TTFT/TPOT метрики)
│   │   ├── VectorDatabaseNode.tsx   # Узел HNSW (Recall, efSearch, векторное пространство)
│   │   ├── SemanticCacheNode.tsx    # Узел кэша (Hit Rate, статус алгоритма XFetch)
│   │   └── CellularClusterNode.tsx  # Узел ячейки с расчетом Blast-Radius (L6/L7)
│   ├── edges/
│   │   └── ProtocolEdge.tsx         # Анимированное ребро со скоростью потока пакетов
│   ├── poe/                         # Интерактивный цикл Predict-Observe-Explain
│   │   ├── PredictModal.tsx         # Шаг 1: Выбор гипотезы до старта
│   │   ├── LiveTelemetryBar.tsx     # Шаг 2: Мониторинг в реальном времени под нагрузкой
│   │   └── SocraticExplainModal.tsx # Шаг 3: Сократический разбор расхождений
│   └── hooks/
│       ├── useSimulationWorker.ts   # Коммуникация с Web Worker DES (Stage 2)
│       └── useTopologyValidation.ts # Клиентский валидатор инвариантов (Stage 1)
└── studio_3_bar_raiser/             # Студия 3: Multimodal Defense Arena
    ├── VoiceDefenseArena.tsx        # Главный экран устной защиты
    ├── TactileVoiceCircle.tsx       # Интерактивный круг состояния речи с тактильным barge-in
    ├── LiveCompetencyRadar.tsx      # Радар 4 измерений компетенций (0-100)
    └── EvaluationVerdictModal.tsx   # Карточка вердикта Bar-Raiser с рекомендациями кат
```

---

## 3. Ликвидация дефекта маршрутизации в Академии (`INV-05`)

### 3.1. Анализ выявленного дефекта в `useAppStore.ts`
При клике на шаг курса, имеющий `targetArena: 'system_design'` и `targetScenarioId: 'hld-micro-01'`, стор выполнял запрос к `/api/system-design/scenarios`. Из-за отсутствия `hld-micro-01` в базе данных возвращался пустой результат, сценарий не активировался, и интерфейс переключался на пустой экран.

### 3.2. To-Be Решение: Автоматический резолвер с поддержкой Tri-Studio
В `frontend/src/store/useAppStore.ts` внедряется надежный резолвер сценариев:

```typescript
// frontend/src/store/useAppStore.ts
openSystemDesignById: async (scenarioIdOrAlias: string, preferredStudio?: 'runtime' | 'topology' | 'defense') => {
  try {
    // 1. Запрос к бэкенду, поддерживающему двунаправленный поиск по canonical_id и legacy_aliases
    const res = await fetch(`/api/system-design/scenarios/${encodeURIComponent(scenarioIdOrAlias)}`, { credentials: 'include' });
    if (!res.ok) {
      console.error(`Scenario not found: ${scenarioIdOrAlias}`);
      return;
    }
    const manifest: ChallengeManifest = await res.json();
    
    // 2. Определение активной студии по умолчанию
    let activeStudio: 'runtime' | 'topology' | 'defense' = preferredStudio || 'topology';
    if (!preferredStudio) {
      if (manifest.target_level === 'L3_JUNIOR' && manifest.studio_1_runtime) {
        activeStudio = 'runtime';
      } else if (manifest.target_level === 'L7_PRINCIPAL' || manifest.archetype === 'PLANETARY_CELLULAR') {
        activeStudio = 'topology';
      }
    }
    
    // 3. Атомарное обновление глобального состояния
    set({
      activeScenario: manifest,
      currentStudioTab: 'system_design',
      activeTriStudioMode: activeStudio
    });
  } catch (err) {
    console.error('Failed to resolve system design scenario:', err);
  }
}
```

Все шаги курсов в `json/guided_roadmaps.json` связываются с каноническими манифестами через двухключевой индекс бэкенда.

---

## 4. Студия 1: Runtime & Forensics Workbench

Студия 1 активируется при решении задач микро-масштаба (L3/L4) либо при двойном клике на вычислительный узел в Студии 2:

1. **Forensic Code Editor (`ForensicCodeEditor.tsx`):**
   * Встроенный легковесный редактор на базе `@uiw/react-codemirror` с поддержкой подсветки Java, SQL и Nginx.
   * Для сценариев `FADED_COMPLETION`: строка с дефектом (`faded_bug.line_number`) подсвечивается янтарным ореолом с пояснением антипаттерна. Студент вносит исправление, и клиентский AST-валидатор мгновенно проверяет соответствие правилу.
2. **HikariPool Visualizer (`HikariPoolVisualizer.tsx`):**
   * Интерактивный калькулятор по закону Литтла ($L = \lambda W$) и формуле sizing'а HikariCP:
     $$\text{PoolSize} = T_n \times (\text{CoreCount} - 1) + \text{SpindleCount}$$
   * Студент наглядно видит, как рост пула с 10 до 200 потоков вызывает деградацию TPS на 70% из-за context-switch thrashing.
3. **Virtual Thread Pinning Lab (`VirtualThreadPinningLab.tsx`):**
   * Индикатор несущих потоков `ForkJoinPool-worker-*`.
   * Переключение кода между `synchronized` и `ReentrantLock`: при `synchronized` полосы несущих потоков окрашиваются в красный цвет (Pinned), а очередь запросов растет лавинообразно.
4. **PagedAttention Block Table (`PagedAttentionVisualizer.tsx`):**
   * Визуализация таблицы физических блоков памяти HBM по 16 токенов.
   * Демонстрация выделения неконсистентных страниц и устранения внешней фрагментации с 60% до $<4\%$.

---

## 5. Студия 2: Интерактивный цикл Predict-Observe-Explain (POE)

Цикл POE интегрирован в панель управления холстом Студии 2:

```
[ Нажатие "Запустить симуляцию" ]
              │
              ▼
[ Шаг 1: PREDICT (PredictModal.tsx) ]
  • Студент фиксирует гипотезу до получения данных:
    "При всплеске нагрузки до 20 000 RPS узким местом станет:
     ( ) Пул соединений базы данных (исчерпание потоков)
     ( ) Память KV-кэша GPU (Preemption и остановка генерации)
     ( ) Сетевая полоса репликации между AZ"
              │
              ▼
[ Шаг 2: OBSERVE (LiveTelemetryBar.tsx & TopologyCanvas.tsx) ]
  • Запуск воркера DES. По ребрам запускаются анимированные частицы пакетов.
  • На узлах загораются динамические бейджи метрик ($W_q, \rho, \text{Hit Rate}$, HBM утилизация).
  • При сбоях Chaos Monkey график нижней панели фиксирует спайки $P99$.
              │
              ▼
[ Шаг 3: EXPLAIN (SocraticExplainModal.tsx) ]
  • Сравнение гипотезы с фактическими данными симуляции.
  • При расхождении AI-ассистент задает сократический вопрос:
    "Вы ожидали отказ по памяти KV-кэша, но система деградировала на узле Ingress Gateway из-за переполнения очередей syn-backlog. Какое архитектурное решение устранит эту проблему?"
```

---

## 6. Definition of Done (DoD) для Stage 3

1. [ ] **MultiScaleCanvasHub:** Полноэкранный контейнер Tri-Studio стабильно работает на `100dvh` с плавной сменой студий (Runtime, Topology, Defense).
2. [ ] **Zero Broken Academy Routes:** Все 49 шагов курсов в `json/guided_roadmaps.json` открывают сценарии без 404 ошибок и пустых экранов.
3. [ ] **Forensic Code Editor:** Редактор CodeMirror корректно отображает код Java 21, SQL и Nginx из секции `studio_1_runtime` манифеста и подсвечивает строки дефектов.
4. [ ] **New AI Nodes:** Узлы `GpuInferenceNode`, `VectorDatabaseNode`, `SemanticCacheNode`, `CellularClusterNode` корректно визуализируют свои физические метрики и порты.
5. [ ] **Full POE Flow:** Интерактивный цикл Predict-Observe-Explain проходит все три фазы с фиксацией гипотезы и сопоставлением результатов симуляции.
6. [ ] **Performance & Aesthetics:** Частота обновления анимаций холста сохраняется на уровне 60 FPS, применены пастельные градиенты `#FFF0F5` и размытия `backdrop-blur-md`.
