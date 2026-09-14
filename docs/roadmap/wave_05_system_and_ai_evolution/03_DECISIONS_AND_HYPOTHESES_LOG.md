# 📋 Wave 5 Decisions & Hypotheses Log (Living Progress Tracker)

> **Статус:** `RESEARCH_SYNTHESIZED_AND_LOCKED`  
> **Последнее обновление:** 14 сентября 2026 г.  
> **Методология:** Multi-Faceted Research-Driven Architecture (MFRDA)

---

## 1. 🔒 Зафиксированные решения (Locked Core Decisions)

Данные решения доказаны эмпирическим аудитом текущей системы (`01_BASELINE_DEFECT_AUDIT.md`) и синтезом 4 отчётов Deep Research (`docs/roadmap/reports/20260914/`):

| ID | Решение | Техническое обоснование | Первоисточник | Статус |
| :--- | :--- | :--- | :---: | :---: |
| **DEC-01** | **Zero-Anchoring Mandate** | Запрещено навязывать модели Deep Research закрытые варианты. Исследование проводится с открытым мандатом на поиск SOTA-парадигмы осени 2026 года. | Charter | 🔒 LOCKED |
| **DEC-02** | **Shared Core UI Invariant** | Запрещено создавать изолированные сайты для Classic vs AI System Design. Движок `@xyflow/react`, Web Worker симулятора дискретных событий (DES) и Gemini Live развиваются как единая модульная платформа. | Baseline Audit | 🔒 LOCKED |
| **DEC-03** | **Ликвидация Split-Brain каталогов** | Разделение на `system_design_scenarios.json` (в SQLite) и клиентские `MicroKatasCatalog.ts` / `FadedScaffoldingCatalog.ts` признано критическим дефектом. Утвержден переход на TypeBox Canonical Manifest SSOT. | Audit & Report 04 | 🔒 LOCKED |
| **DEC-04** | **Приоритет Junior 101 Onboarding** | Запрещено позиционировать распределенный консенсус, LSM-деревья и Raft как «Junior L0». Создается строгий Single-Box фундамент веб-инженерии (HTTP, DNS, Nginx, HikariCP sizing, B-Tree vs Hash). | Report 02 | 🔒 LOCKED |
| **DEC-05** | **Интеграция Data Modeling & API Contracts** | В холст и сценарии внедряются обязательные редакторы контрактов API (REST/gRPC) и схем данных (Entities, Types, Indexes) как базовый стандарт интервью 2026 года. | Baseline Audit | 🔒 LOCKED |
| **DEC-06** | **Адаптивные персоны голосового AI** | Голосовой агент поддерживает переключение между режимами: «Socratic Mentor» (L3–L4) и «Uncompromising Staff Bar-Raiser» (L5–L6+). | Baseline Audit | 🔒 LOCKED |
| **DEC-07** | **Макро-парадигма: Multi-Scale Capability Arena (MSCA)** | Отказ от искусственного деления по темам. Внедрение 3 специализированных студий по шкале физики масштаба: Runtime & Forensics Workbench (Micro/Meso) $\rightarrow$ DES Topology Canvas (Meso/Macro) $\rightarrow$ Multimodal Bar-Raiser Defense Arena (Apex). | Report 01 | 🔒 LOCKED |
| **DEC-08** | **Когнитивный фреймворк: Пирамида Миллера + Backward Fading + POE** | Обучение строится через затухающие леса (Worked Example $\rightarrow$ Faded Scaffolding $\rightarrow$ Independent Design) и цикл Predict-Observe-Explain (POE) с инъекциями нагрузки и сбоев. | Report 02 | 🔒 LOCKED |
| **DEC-09** | **Адаптивная психометрия (BKT + 3PL IRT)** | Динамическая калибровка сложности через Bayesian Knowledge Tracing (отслеживание латентного мастерства $L_t$) и 3-Parameter Logistic Item Response Theory ($\theta, a_i, b_i, c_i$). | Report 01 | 🔒 LOCKED |
| **DEC-10** | **Физический Roofline-движок инференса LLM** | Симуляция инференса строго разделяет фазы Prefill (Compute-Bound TTFT, $\Phi_{peak}$) и Autoregressive Decode (Memory-Bandwidth-Bound TPOT, $BW_{mem}$) с моделированием пагинации PagedAttention и непрерывного батчинга. | Report 03 | 🔒 LOCKED |
| **DEC-11** | **Аналитические солверы очередей в Web Worker** | Для поддержания latency симуляции $<0.5\text{ мс}$ применяются замкнутые формулы: Erlang-C ($M/M/c$), Pollaczek-Khinchine ($M/G/1$), Allen-Cunneen ($G/G/c$), аппроксимация Кимуры ($P99$) и разложение Корниша-Фишера ($P99.9$). | Report 03 | 🔒 LOCKED |
| **DEC-12** | **Векторная и кэш-математика (HNSW + XFetch)** | Векторные базы симулируются через $\mathcal{O}(\log N)$ HNSW с beam-width $efSearch$, компрессию IVF-PQ и Vamana DiskANN. Кэш-штампы купируются через Probabilistic Early Expiration (XFetch). | Report 03 | 🔒 LOCKED |
| **DEC-13** | **Стандарт манифестов TypeBox (Draft-07 + TS)** | Отказ от Zod в пользу `@sinclair/typebox`. Разделение Transport DAG (семантика) и Presentation Model (координаты сетки React Flow). Единый JSON Schema контракт для клиента и SQLite. | Report 04 | 🔒 LOCKED |
| **DEC-14** | **Изоморфная двухуровневая валидация (Graph + CEL)** | Проверка инвариантов студента выполняется идентично на клиенте и сервере: Уровень 1 — топологические алгоритмы (циклы, связность); Уровень 2 — песочница Common Expression Language (CEL). | Report 04 | 🔒 LOCKED |

| **DEC-15** | **Декомпозиция контент-ресерча (Антипаттерн Single-Prompt)** | Запрещено объединять бенчмарк репозиториев, 30 сценариев L3–L6 с их точной физикой и CEL-правилами, и рубрики Bar-Raiser в один промпт Deep Research. Утверждена модульная батарея Phase B из 5 изолированных треков (B1–B5) для максимизации технической плотности. | Phase B Ingestion Plan | 🔒 LOCKED |

---

## 2. 🏁 Разрешенные гипотезы исследования (Resolved Hypotheses)

Все 4 трека Батареи Deep Research успешно завершены. Результаты переведены в статус архитектурных инвариантов:

### Track 1: Макро-таксономия и парадигма платформы
* **Гипотеза 1.1 (Continuum of Scale) — ПОДТВЕРЖДЕНА:** Системная инженерия 2026 года признана единым континуумом физических инвариантов (память $\rightarrow$ сеть $\rightarrow$ распределенный кластер $\rightarrow$ аппаратные ускорители).
* **Гипотеза 1.2 (Problem-First Arenas) — ПОДТВЕРЖДЕНА И РАСШИРЕНА:** Сформулирована модель MSCA, объединяющая Problem-First инциденты со сквозным переходом в Runtime Workbench и голосовую защиту.
* **Гипотеза 1.3 (SOTA Альтернатива) — РАЗРЕШЕНА:** Традиционное каталожное дробление («Java отдельно, Систем дизайн отдельно, AI отдельно») признано устаревшим антипаттерном.

### Track 2: Педагогика «Когнитивной лестницы» (Junior $\rightarrow$ Staff)
* **Гипотеза 2.1 (Junior Baseline) — ПОДТВЕРЖДЕНА:** Для L3/L4 Junior конструируется Single-Box фундамент без распределенных алгоритмов.
* **Гипотеза 2.2 (Backward Fading & POE) — ПОДТВЕРЖДЕНА:** Студент переходит от разобранных примеров к достраиванию дефектных схем с интерактивной верификацией гипотез (Predict-Observe-Explain) в симуляторе.

### Track 3: Математика симулятора AI в Web Worker
* **Гипотеза 3.1 (Roofline двухфазного инференса) — ПОДТВЕРЖДЕНА:** Выведены точные формулы $T_{prefill}$ и $T_{decode}$, связывающие параметры модели ($P, L, d_{model}$) с аппаратными характеристиками ($\Phi_{peak}, BW_{mem}$).
* **Гипотеза 3.2 (Векторный поиск и кэширование) — ПОДТВЕРЖДЕНА:** Формализованы алгоритмы HNSW ($M, efSearch$), RRF-слияние гибридного поиска (BM25 + Dense) и вероятностный алгоритм XFetch.
* **Гипотеза 3.3 (Субмиллисекундные очереди) — ПОДТВЕРЖДЕНА:** Доказана применимость аналитических формул Кимуры и Корниша-Фишера для мгновенного расчета квантилей $P99$ и $P99.9$ в Web Worker без эмпирической симуляции миллионов событий.

### Track 4: Единый источник истины (SSOT)
* **Гипотеза 4.1 (TypeBox Manifest & Portable CEL) — ПОДТВЕРЖДЕНА:** Полностью спроектирована схема канонического манифеста на TypeBox, исключающая Split-Brain и link rot в Академии за счет идемпотентного реестра `user_progress_ledger`.

---

## 3. 🎯 Следующие шаги программы Wave 5

1. [x] Проведение эмпирического аудита кодовой базы (`01_BASELINE_DEFECT_AUDIT.md`).
2. [x] Формирование и выполнение батареи Deep Research (`02_RESEARCH_INQUIRY_SUITE.md`).
3. [x] Фиксация журнала решений (`03_DECISIONS_AND_HYPOTHESES_LOG.md`).
4. [x] Разработка и утверждение генерального архитектурного документа **`04_MASTER_SYSTEM_DESIGN_RFC.md`**.
5. [x] Декомпозиция на этапы реализации со спецификациями Definition of Done (DoD) (`STAGE_01` $\rightarrow$ `STAGE_04`).
6. [ ] **Текущая цель (Phase B):** Запуск и синтез специализированной батареи ресерча контента и сценариев (`05_CONTENT_AND_SCENARIO_INQUIRY_SUITE.md`):
   - [x] **Track B1:** Open-Source Repositories, University Curricula & Production Outages Benchmark (`B1_Global-State-of-the-Art-...md` синтезирован: 9 академических микро-кат CMU/MIT/Stanford, 10 канонических аварий BigTech, 3-этапный Clean-Room IP протокол).
   - [x] **Track B2:** Junior (L3) & Middle (L4) Single-Box & Composed Scenario Manifests (`B2_Specification-Bank-...md` синтезирован: 10 полных спецификаций L3/L4 с математикой $M/M/c$, $M/G/1$, дефектами в коде Java/Nginx/SQL и CEL-инвариантами).
   - [ ] **Track B3:** Senior (L5) Partitioned Distributed & AI Serving Manifests.
   - [ ] **Track B4:** Staff (L6/L7) Planetary Cell-Based, FinOps & Multi-Cloud Disaster Recovery.
   - [ ] **Track B5:** Principal Bar-Raiser Socratic Trees, Chaos Fault Injections & Rubric Scoring.
7. [ ] Генерация канонических JSON-манифестов (`scenarios/manifests/*.json`) и запуск кодовой реализации Stage 1.
