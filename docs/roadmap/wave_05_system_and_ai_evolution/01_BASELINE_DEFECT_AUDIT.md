# 🔍 Wave 5 Baseline Empirical Defect Audit (As-Is State Verification)

> **Дата аудита:** 14 сентября 2026 г.  
> **Методология:** Code-Level Fact Extraction & Runtime Trace Analysis  
> **Цель:** Зафиксировать реальные факты текущей кодовой базы, выявить скрытые технические долги и дефекты до начала проектирования новой архитектуры.

---

## 1. Доказанные архитектурные факты и аномалии

### 🚨 Аномалия 1: Рассинхронизация каталогов (Split-Brain Truth)
* **Факты в коде**:
  - **Бэкенд**: В [`backend/src/services/db.ts:L703-L733`](file:///c:/projects/interview_tutor/backend/src/services/db.ts#L703-L733) при старте сервера читается файл `json/system_design_scenarios.json` (31 сценарий: 8 L0, 3 L2, 20 L3) и выполняется `UPSERT` в SQLite таблицу `system_design_challenges`. Эндпоинт `/api/system-design/scenarios` отдает именно эти данные.
  - **Фронтенд**: Файлы [`frontend/src/components/system_design/katas/MicroKatasCatalog.ts`](file:///c:/projects/interview_tutor/frontend/src/components/system_design/katas/MicroKatasCatalog.ts) (8 кат с ID вроде `l0_consistent_hashing`) и [`frontend/src/components/system_design/scaffolding/FadedScaffoldingCatalog.ts`](file:///c:/projects/interview_tutor/frontend/src/components/system_design/scaffolding/FadedScaffoldingCatalog.ts) (5 архетипов с ID вроде `L2_ARCHETYPE_FLASH_SALE...`) статически скомпилированы в клиентский Vite-бандл.
* **Следствие в UI**:
  - При выборе вкладки «Все сценарии» карточки рендерятся из API (`hld-micro-01`) и клик открывает `SystemDesignArena` (большой холст с Mermaid и Staff AI).
  - При выборе вкладки «L0: Micro-Katas» карточки рендерятся из TS-файла и открывается совершенно другой компонент — `MicroKataArena` с интерактивными ползунками и симуляцией вариации.
  - Бэкенд и база данных SQLite не имеют представления о структуре, параметрах и результатах `MicroKatasCatalog.ts`.

---

### 🚨 Аномалия 2: Разрыв сквозного образовательного пути Академии (Broken User Journey)
* **Факты в коде**:
  - В [`frontend/src/store/useAppStore.ts:L464-L480`](file:///c:/projects/interview_tutor/frontend/src/store/useAppStore.ts#L464-L480) логика запуска шагов Академии для `targetArena === 'system_design'` делает запрос к `/api/system-design/scenarios` и вызывает `openSystemDesignScenario(found)`.
* **Следствие в UI**:
  - Шаг 1 Академии (`highload-system-design-15`) «Back-of-the-Envelope Capacity Planning» и Шаг 2 «Consistent Hashing» запускают HLD-арену со сложным холстом, а **не интерактивный тренажер `MicroKataArena`**.
  - Интерактивные микро-каты L0 с AssertJ-проверками физически недоступны через навигатор Академии и могут быть открыты только через ручной обход каталога.

---

### 🚨 Аномалия 3: Смещение идентификаторов в дорожной карте Академии (`guided_roadmaps.json`)
* **Факты в коде**:
  - Анализ трека `highload-system-design-15` в `json/guided_roadmaps.json`:
    * Шаг 1: «Back-of-the-Envelope Capacity Planning» $\rightarrow$ привязан к `hld-micro-01` (Consistent Hashing Ring).
    * Шаг 2: «Consistent Hashing & Dynamic Sharding» $\rightarrow$ привязан к `hld-micro-02` (Cache Stampede).
    * Шаг 3: «Write-Through, Write-Behind Caching» $\rightarrow$ привязан к `hld-micro-03` (Sharding Key Range vs Hash).
    * Шаг 10: «High-Frequency Trading Matching Engine (OrderBook)» $\rightarrow$ привязан к `hld-faded-02` (Celebrity Fanout 50M).
    * Шаг 13: «Global S3-Compatible Object Store» $\rightarrow$ привязан к `hld-scenario-05` (Distributed Lock Manager).
* **Следствие**: Кандидат открывает задачу по расчету емкости, а получает кейс с кольцом хеширования Murmur3.

---

### 🚨 Аномалия 4: Закрытая система типов холста (No AI Primitives)
* **Факты в коде**:
  - В [`frontend/src/types/systemDesignCanvas.ts:L1-L10`](file:///c:/projects/interview_tutor/frontend/src/types/systemDesignCanvas.ts#L1-L10):
    ```typescript
    export type ArchitectureNodeType = 
      | 'client' | 'gateway' | 'service' | 'database' | 'cache' | 'queue' | 'blob_storage' | 'circuit_breaker';
    ```
  - Симулятор дискретных событий [`LoadSimulationWorker.ts`](file:///c:/projects/interview_tutor/frontend/src/components/system_design/simulation/LoadSimulationWorker.ts) и линтер топологии жестко завязаны на этот enum.
* **Следствие**: На холсте физически невозможно разместить AI-компоненты (VectorDB, LLM Gateway, Semantic Cache, Embedding Worker) без расширения системы типов и математического ядра симулятора.

---

### 🚨 Аномалия 5: Полное отсутствие теоретической базы знаний по System Design
* **Факты в коде**:
  - В директории `markdown/` содержится 26 файлов по Core Java, Spring, SQL, Concurrency, JVM, Kafka и т.д.
  - По System Design в `markdown/` **нет ни одного теоретического конспекта**.
  - Единственная теория — это краткая шторка `SystemDesignCompassSheet.tsx` (`Ctrl + /`) на 8 правил. Новичку негде прочитать базовые концепции (DNS, балансировка, репликация, CAP) в развернутом виде.

---

## 2. Позитивные архитектурные активы (Existing Foundations)

Аудит также подтвердил наличие зрелых компонентов, которые должны быть сохранены и переиспользованы:

1. **Векторный движок в бэкенде**:
   - В [`backend/src/services/vectorMemoryService.ts`](file:///c:/projects/interview_tutor/backend/src/services/vectorMemoryService.ts) уже реализованы: хранение векторов в BLOB SQLite, векторные эмбеддинги, расчет косинусного сходства на `Float32Array` и LRU-кэш на 500 записей.
2. **Математический Web Worker симулятора очередей**:
   - В `LoadSimulationWorker.ts` корректно реализованы: численно стабильная формула Эрланга-B/C, формула Поллачека-Хинчина для дисков ($M/G/1$), аппроксимация Аллена-Куннина/Кингмана для очередей микросервисов и алгоритм Кана для детекции циклов.
3. **Голосовой контур Gemini Live & Bar-Raiser**:
   - Голосовой протокол `liveToolDispatcher.ts` поддерживает инструменты `inject_chaos_failure`, `record_candidate_observation` и `submit_hiring_committee_verdict`.
4. **Интерактивный калькулятор `CapacityMathCoach`**:
   - Работает валидация порядка величин ($\pm 25\%$), расчет QPS, хранилища, RAM и сетевой полосы.
