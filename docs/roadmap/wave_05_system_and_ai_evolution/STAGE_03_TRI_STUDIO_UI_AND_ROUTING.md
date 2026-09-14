# 🛠️ Stage 3 Specification: Tri-Studio UI & Academy Routing Synchronization

> **Статус:** `SPECIFICATION_LOCKED`  
> **Версия:** `1.0.0`  
> **Дата:** 14 сентября 2026 г.  
> **Программа:** Wave 05 — System & AI Evolution  
> **Родительский RFC:** [`04_MASTER_SYSTEM_DESIGN_RFC.md`](04_MASTER_SYSTEM_DESIGN_RFC.md)  
> **Инварианты:** `INV-01` (SSOT), `INV-02` (Decoupled Presentation & Transport), `INV-05` (Zero-Broken-Routes Invariant).

---

## 1. Executive Summary & UI/UX Standards

### 1.1. Назначение этапа
Синхронизировать интерфейсный слой платформы с каноническими манифестами TypeBox (Stage 1) и симулятором Web Worker (Stage 2):
1. Ликвидировать рассинхронизацию маршрутов в Академии (`guided_roadmaps.json`).
2. Объединить разрозненные экраны в единый **Multi-Scale Canvas Hub** на базе `@xyflow/react`.
3. Внедрить интерактивный цикл **Predict-Observe-Explain (POE)**.
4. Добавить модуль **Runtime & Forensics Workbench** (микро-масштаб: пулы HikariCP, виртуальные потоки Java 21, PagedAttention).
5. Реализовать специализированные узлы AI-инфраструктуры (GPU Cluster, Vector DB, Semantic Cache).

### 1.2. Стандарты UI/UX (Soft Luxury Pastel Aesthetics)
* В соответствии с разделом 3 `AGENTS.md`, сохраняется премиальная мягкая пастельная эстетика: мягкие градиенты, полупрозрачные карточки с `backdrop-blur-md`, тонкие обводки `#FFF0F5`, акценты лаванды и розы.
* **100dvh Viewport Standard:** Все полноэкранные холсты и панели используют `100dvh` (`h-[calc(100dvh-4rem)]`), исключая прыжки интерфейса при активации мобильных клавиатур.
* **Reference-Counted Scroll Lock:** Модальные окна и шторки POE управляются через хук `useBodyScrollLock`.

---

## 2. Архитектура компонентов интерфейса

```
frontend/src/components/system_design/
├── MultiScaleCanvasHub.tsx          # Главный контейнер (переключатель студий)
├── canvas/
│   ├── TopologyCanvas.tsx           # React Flow полотно с поддержкой 60 FPS
│   ├── hooks/
│   │   ├── useSimulationWorker.ts   # Интеграция с Web Worker (Stage 2)
│   │   └── useTopologyValidation.ts # Клиентский изоморфный валидатор (Stage 1)
│   ├── nodes/                       # Семантические React Flow узлы
│   │   ├── BaseSystemNode.tsx       # Базовый узел с бейджами метрик и очередей
│   │   ├── GpuInferenceNode.tsx     # Узел LLM с индикатором HBM и KV-кэша
│   │   ├── VectorDatabaseNode.tsx   # Узел HNSW с индикатором Recall/efSearch
│   │   ├── SemanticCacheNode.tsx    # Узел кэша со статусом XFetch и Hit Rate
│   │   └── StorageNode.tsx          # Базы данных (Primary, Replica, Shard)
│   └── edges/
│       └── ProtocolEdge.tsx         # Ребро с анимацией потока пакетов и задержкой
├── poe/                             # Цикл Predict-Observe-Explain
│   ├── PredictModal.tsx             # Шаг 1: Формулирование гипотезы до запуска
│   ├── LiveObserveTelemetry.tsx     # Шаг 2: Тепловая карта узлов и график всплесков
│   └── ExplainSocraticDrawer.tsx    # Шаг 3: Сократический разбор расхождений
└── workbench/                       # Студия 1: Runtime & Forensics Workbench
    ├── RuntimeForensicsDrawer.tsx   # Шторка детального анализа узла
    ├── HikariPoolVisualizer.tsx     # Sizing пула соединений БД (Little's Law)
    ├── VirtualThreadPinningLab.tsx  # JFR-детекция пиннинга carrier-потоков
    └── PagedAttentionVisualizer.tsx # Таблица блоков страниц KV-кэша
```

---

## 3. Ликвидация рассинхронизации маршрутов Академии

### 3.1. Дефект As-Is
В файле `json/guided_roadmaps.json` шаги практических курсов (например, курс `highload-system-design-15`) содержали прямые жестко зашитые переходы на полноразмерный `SystemDesignArena`, хотя тема шага («Паттерн Consistent Hashing») требовала решения микро-каты.

### 3.2. Стандарт To-Be: Deep-Linking через `canonical_id`
Маршрутизатор `App.tsx` и `useAppStore.ts` переходят на универсальный резолвер:
```typescript
// URL-схема: /system-design?scenario=<canonical_id>&mode=<WORKED_EXAMPLE|FADED_COMPLETION|INDEPENDENT>
const openScenario = (canonicalId: string, initialMode?: string) => {
  const manifest = useAppStore.getState().getManifestById(canonicalId);
  if (!manifest) {
    console.error(`Scenario not found: ${canonicalId}`);
    return;
  }
  // Автоматический роутинг в нужный режим на базе педагогического типа
  useAppStore.getState().setActiveScenario(manifest, initialMode);
};
```

Все шаги в `json/guided_roadmaps.json` обновляются для использования стабильных `canonical_id` из `scenarios/manifests/`.

---

## 4. Интерактивный цикл Predict-Observe-Explain (POE)

Цикл POE встраивается непосредственно в панель управления холстом:

```
[ Кнопка "Запустить симуляцию" ]
              │
              ▼
[ Шаг 1: PREDICT (Модальное окно) ]
  • Кандидат выбирает прогноз: 
    "При нагрузке 5000 RPS P99 задержка составит: [ <50ms | 50-200ms | >200ms (OOM) ]"
  • Фиксация гипотезы в локальном стейте попытки.
              │
              ▼
[ Шаг 2: OBSERVE (Живая симуляция в Web Worker) ]
  • По узлам холста пробегают импульсы (particle flow).
  • На перегруженных узлах загорается янтарный/красный ореол (Heatmap).
  • Бейджи на узлах отображают реальные $W_q, \rho, \text{Hit Rate}$.
  • График в нижней панели выводит задержку во времени с отметками Chaos Monkey.
              │
              ▼
[ Шаг 3: EXPLAIN (Сократическая панель) ]
  • Если прогноз совпал: подтверждение физической причины и начисление баллов.
  • Если прогноз разошёлся: вопрос от AI-ассистента:
    "Вы ожидали задержку <50мс, но реальный P99 достиг 4.2с из-за эффекта Head-of-Line Blocking в очереди базы данных. Какое архитектурное изменение устранит этот затор?"
  • Предложение 1-клик перехода в режим Faded Completion для исправления.
```

---

## 5. Студия 1: Runtime & Forensics Workbench (Микро-масштаб)

При двойном клике на вычислительный узел (`app_service`, `worker_pool`, `gpu_inference_node`) открывается боковая шторка **Runtime Forensics**:

### 5.1. Лаборатория виртуальных потоков Java 21/24 (`VirtualThreadPinningLab`)
* **Визуализатор пула:** Отображение пула Carrier-потоков ForkJoinPool (`ForkJoinPool.commonPool-worker-*`).
* **Симуляция пиннинга:** Запуск бенчмарка с переключением:
  * `synchronized (lock) { httpCall(); }` $\rightarrow$ Carrier поток блокируется, задержка остальных 1000 virtual threads растет скачкообразно.
  * `ReentrantLock` / Java 24 (JEP 491) $\rightarrow$ Carrier поток отпускается (unmount), throughput утилизирует 100% CPU.
* **JFR Flame Graph:** Интерактивный мини-граф событий `jdk.VirtualThreadPinned`.

### 5.2. Лаборатория Sizing пулов БД (`HikariPoolVisualizer`)
* Интерактивный калькулятор по формуле Литтла:
  $$\text{PoolSize} = T_n \times (\text{CoreCount} - 1) + \text{SpindleCount}$$
* Демонстрация того, как увеличение размера пула соединений с 20 до 200 убивает Postgres из-за переключения контекста ядер CPU (CPU context-switch thrashing).

### 5.3. Лаборатория памяти PagedAttention (`PagedAttentionVisualizer`)
* Демонстрация физической карты памяти GPU (HBM blocks по 16 токенов).
* Студент наглядно видит, как PagedAttention устраняет внешнюю фрагментацию памяти с 60% до $<4\%$.

---

## 6. Definition of Done (DoD) для Stage 3

1. [ ] **Multi-Scale Canvas Hub:** Полноэкранный холст на `@xyflow/react` стабильно работает на `100dvh` без артефактов скролла.
2. [ ] **Zero Broken Academy Routes:** 100% шагов в `json/guided_roadmaps.json` открывают соответствующие канонические сценарии без ошибок 404 или белых экранов.
3. [ ] **New AI Custom Nodes:** Узлы `GpuInferenceNode`, `VectorDatabaseNode`, `SemanticCacheNode` корректно отображают входные порты, параметры и динамические бейджи телеметрии.
4. [ ] **POE Loop Integration:** Цикл Predict-Observe-Explain успешно проходит полный круг (выбор гипотезы $\rightarrow$ запуск воркера $\rightarrow$ подсветка расхождений $\rightarrow$ объяснение).
5. [ ] **Runtime Workbench Drawer:** Шторка микро-рантайма открывается по узлам сервисов и интерактивно иллюстрирует пиннинг виртуальных потоков и sizing пула БД.
6. [ ] **60 FPS & Responsive:** Изменение параметров ползунков на холсте обновляет метрики без зависания анимаций.
