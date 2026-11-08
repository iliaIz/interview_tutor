# Функциональная Карта и Навигационный Навигатор Проекта (SSOT)

> **Документ:** `docs/architecture/FUNCTIONAL_MAP.md`  
> **Статус:** Единый источник истины (SSOT) по функциональности и навигации платформы  
> **Назначение:** Быстрый онбординг инженеров и агентов: какой раздел UI за что отвечает, какие функции содержит и где находится их код.

---

## 1. Сводная Матрица Разделов и Функционала

Платформа организована по принципу **Studio Hub**: верхний хедер переключает 6 основных студийных пространств, а сквозные сервисы (голос, память, подкасты, здоровье) доступны из любого места как глобальные оверлеи.

| Раздел UI (Вкладка / Оверлей) | StudioTab / Route | Ключевой функционал | Основные компоненты (Frontend) | Бэкенд роуты & Сервисы | Хранилище (SQLite / JSON) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Академия** | `academy`, `roadmaps` | 8 программ треков (L3–L7), 177 шагов, граф дорожных карт, модалка сдачи шага, breadcrumb-мост | `AcademyStudio.tsx`, `StepCompletionModal.tsx`, `RoadmapGraphView.tsx` | `/api/roadmaps`, `roadmapProgressResolver.ts` | `guided_roadmaps.json`, `user_entity_progress` |
| **2. База Знаний (Теория)** | `theory` (`topics`, `questions`, `study`, `quiz`) | 816 вопросов, 24 темы, поиск/фильтры по грейдам, интервальное повторение FSRS-5, блиц-квизы | `TopicSelector.tsx`, `QuestionExplorer.tsx`, `StudyDeck.tsx`, `ExamQuiz.tsx` | `/api/topics`, `/api/eval`, `fsrsEngine.ts` | `all_interview_questions.json`, `fsrs_cards` |
| **3. Machine Coding (LLD)** | `practice` | 93 задачи (35 BigTech LLD), Java 21 CodeMirror, JVM Sandbox, 8 AST-правил, Spring Transaction Lab | `PracticeArena.tsx`, `WorkspaceEditor.tsx`, `TransactionLabArena.tsx` | `/api/practice`, `/api/sandbox`, `astAuditService.ts` | `machine_coding_challenges.json`, `submissions` |
| **4. Баг-Хант & Forensics** | `incidents` | 70 инженерных кат, поиск багов (Loom, Concurrency, Metaspace), Mutation Radar, TaskRecoveryCard | `BugHuntCatalog.tsx`, `BugHuntArena.tsx`, `MutationRadarWidget.tsx` | `/api/practice/verify-mutation`, `codeEvaluator.ts` | `production_triage_challenges.json`, `submissions` |
| **5. System Design (HLD)** | `system_design` | 31 сценарий (L3–L7), Cytoscape/React Flow холст, DES-симулятор очередей, Chaos Monkey, L1 калькулятор | `SystemDesignCatalog.tsx`, `MultiScaleCanvasHub.tsx`, `SystemDesignArena.tsx` | `/api/system-design`, `systemDesignEvaluator.ts` | `scenarios/manifests/`, `question_evaluations` |
| **6. Триаж Аварий (SRE)** | `triage` | 22 продакшн-аварии, Prometheus графики, парсер thread dumps, Tarjan SCC дедлок-детектор, терминал | `IncidentTriageCatalog.tsx`, `IncidentTriageStudio.tsx`, `ThreadDumpModal.tsx` | `/api/triage`, `threadDumpParser.ts` | `production_triage_challenges.json`, `question_evaluations` |
| **7. Целевая Подготовка & SQL** | `companies` | Хаб подготовки к компаниям (Райффайзен DGTL): Product Engineer досье, 4-мин ранбук, CRI индекс, PGlite WASM SQL | `CompanyPrepStudio.tsx`, `CompanyPipelineTab.tsx`, `SqlArena.tsx` | `/api/companies`, `/api/sql-challenges` | `company_profiles.json`, `sql_challenges.json` |
| **🎙️ Голосовой ИИ-Тьютор** | Глобальный оверлей | Gemini Live 24kHz HD Voice, Сократический опрос, авто-VAD, тактильный barge-in, STAR/PREP скоринг | `VoiceModal.tsx`, `LiveVoiceEngine.ts`, `AudioPlayoutManager.ts` | `/ws/live`, `liveAudioStreamRouter.ts` | `question_evaluations`, LiteLLM Gateway |
| **🧠 Радар Памяти FSRS-5** | Выдвижной Drawer | Очередь повторений FSRS-5, радар пробелов знаний, подтвержденные навыки, профиль кандидата | `MemoryRadarDrawer.tsx`, `FsrsQueueTab.tsx`, `GapsListTab.tsx` | `/api/memory`, `fsrsEngine.ts` | `fsrs_cards`, `user_gaps` |
| **🎧 Аудио-Подкасты** | Глобальная модалка | Генерация 2-голосных технических подкастов на Gemini TTS, плеер, фоновое MediaSession API | `AudioRecapModal.tsx`, `AudioPlayerBar.tsx` | `/api/podcast`, `podcast.ts` | `data/podcasts/`, `db.ts` |
| **🛡️ Профиль и Безопасность** | Хедер оверлеи | RBAC инвайты (`SENIOR-JAVA-2026-VIP`), сессии JWT, WS-тикеты, живой статус `/api/health` | `AdminInvitesModal.tsx`, `HealthStatusBadge.tsx`, `ProfileEditModal.tsx` | `/api/auth`, `health.ts` | `users`, `invites` |

---

## 2. Подробная Структура Каждого Раздела

### 2.1. Академия (`currentStudioTab === 'academy'`)
- **Где находится:** `frontend/src/components/academy/`
- **Функции:**
  - Навигация по 8 карьерным программам (Junior, Middle, Senior, Lead, Architect, Concurrency Specialist, FinTech, SRE).
  - Интерактивный ступенчатый граф дорожной карты (`RoadmapAccordionSyllabus.tsx`, `RoadmapGraphView.tsx`).
  - Прохождение шагов теории/практики с модальным подтверждением (`StepCompletionModal.tsx`).
  - Breadcrumb Bridge: возвращение в активный шаг Академии из любой внешней арены (`StudioHeader.tsx`).

### 2.2. База Знаний и Теория (`currentStudioTab === 'theory'`)
- **Где находится:** `frontend/src/components/` (`TopicSelector.tsx`, `QuestionExplorer.tsx`, `StudyDeck.tsx`, `ExamQuiz.tsx`)
- **Функции:**
  - **Темы (`topics`):** 24 домена (Core Java, Spring, Multithreading, JVM, DB, Kafka, etc.) с прогрессом и индикатором пробелов.
  - **Вопросы (`questions`):** Полнотекстовый поиск по 816 вопросам, фильтрация по грейдам (Junior/Middle/Senior), просмотр ответов, запуск голосового интервью.
  - **Флеш-карточки (`study`):** Интервальное повторение FSRS-5 (`StudyFlashcard.tsx`), самооценка с интервалами (Again/Hard/Good/Easy), кнопка быстрого перехода в `TransactionLabArena`.
  - **Квиз (`quiz`):** Тестовый тренажер самопроверки с вариантами ответов и подсветкой ошибок.

### 2.3. Machine Coding & LLD Arena (`currentStudioTab === 'practice'`)
- **Где находится:** `frontend/src/components/practice/`
- **Функции:**
  - Каталог 93 задач Machine Coding с фильтрами по трекам (BigTech Core, FinTech Ledger, Concurrency).
  - Полноэкранный многофайловый редактор кода CodeMirror (`WorkspaceEditor.tsx`, `MultiFileEditor.tsx`).
  - Изолированная компиляция и выполнение тестов JUnit 5 в контейнере `interview-sandbox` (`/api/sandbox/run`).
  - AST-статический анализ (8 правил: запрет `System.currentTimeMillis()`, принудительный `Clock`, запрет `double` в деньгах, проверка блокировок `min -> max`).
  - **Spring Transactions Lab (`TransactionLabArena.tsx`):** Симулятор AOP-прокси, механики распространения транзакций (`REQUIRES_NEW`), визуализатор пула HikariCP (`HikariPoolSlotMeter.tsx`) и флейм-график выполнения (`ExecutionFlameChart.tsx`).
  - **Practice Tutor Drawer (`PracticeTutorDrawer.tsx`):** Парный AI-собеседник в режиме Live-Coding с поддержкой голоса.

### 2.4. Баг-Хант & Forensics (`currentStudioTab === 'incidents'`)
- **Где находится:** `frontend/src/components/incidents/`
- **Функции:**
  - Каталог 70 инженерных кат на выявление антипаттернов (Loom carrier pinning, race conditions, утечки памяти).
  - Среда исправления дефекта с мгновенным прогоном мутационного тестирования (`BugHuntArena.tsx`).
  - Мутационный радар (`MutationRadarWidget.tsx`) — анализ выживших мутантов bytecode-уровня.
  - TaskRecoveryCard при сетевых сбоях и ошибках песочницы.

### 2.5. System Design Studio — HLD (`currentStudioTab === 'system_design'`)
- **Где находится:** `frontend/src/components/system_design/`
- **Функции:**
  - Каталог 31 сценария System Design от L3 до L7 (`SystemDesignCatalog.tsx`).
  - Интерактивный архитектурный холст (`MultiScaleCanvasHub.tsx`, `InteractiveCanvas.tsx`).
  - Дискретно-событийный симулятор очередей в Web Worker (`workers/desSimulator.worker.ts`, формулы Erlang-B, Allen-Cunneen G/G/c).
  - Chaos Monkey инъектор сетевых задержек, сбоев репликации и падений узлов (`ChaosMonkeyPanel.tsx`).
  - L1 Capacity Math калькулятор RPS, трафика, памяти и диска (`utils/capacityMath.ts`).
  - Heuristic Compass (`SystemDesignCompassSheet.tsx`, шорткат `Ctrl + /`).

### 2.6. Триаж Продакшн-Аварий SRE (`currentStudioTab === 'triage'`)
- **Где находится:** `frontend/src/components/triage/`
- **Функции:**
  - Каталог 22 инцидентов (`IncidentTriageCatalog.tsx`) с уровнями критичности P1–P4.
  - Рабочее место дежурного инженера (`IncidentTriageStudio.tsx`): временная шкала инцидента, метрики Prometheus, логи.
  - Парсер Thread Dump (`utils/threadDumpParser.ts`) и поиск циклов взаимных блокировок алгоритмом Тарьяна (Tarjan SCC).
  - Linux-терминал для симуляции команд диагностики (`curl`, `jstack`, `top`, `grep`).
  - Оформление постмортема с оценкой времени локализации (MTTM) и устранения (MTTR).
  - Triage Heuristic Compass (`TriageCompassSheet.tsx`, шорткат `Ctrl + /`).

### 2.7. Сквозные Глобальные Сервисы
- **Голосовой AI-Интервьюер (`VoiceModal.tsx`):**
  - Подключение по WebSocket к `/ws/live` $\rightarrow$ `litellm-gateway:4000`.
  - Канонический протокол Gemini Live (двусторонний PCM, Auto-VAD, тактильный barge-in).
  - Синхронизированные субтитры с постраничным раскрытием слов (`VoiceSubtitles.tsx`).
  - STAR/PREP скоринг и отчет по завершении (`InterviewReportModal.tsx`).
- **Радар Памяти FSRS-5 (`MemoryRadarDrawer.tsx`):**
  - Вкладка очереди карточек на повторение (`FsrsQueueTab.tsx`).
  - Вкладка активных и закрытых пробелов знаний (`GapsListTab.tsx`).
  - Профиль готовности кандидата с графиком забывания (`CandidateProfileTab.tsx`).
- **Подкаст-Студия (`AudioRecapModal.tsx`, `AudioPlayerBar.tsx`):**
  - Генерация диалога двух ведущих на Gemini TTS.
  - Фоновый аудиоплеер с сохранением позиции и поддержкой мобильного экрана блокировки (MediaSession).

---

## 3. Быстрая Шпаргалка для Разработчика (Шорткаты и Инварианты)

- **`Ctrl + /` (или `Cmd + /`):** Открытие контекстного инженерного компаса (в System Design, Triage, Transactions, Testing).
- **Клик по центральному кругу в голосе:** Мгновенный тактильный barge-in (де-клик рампа 5 мс, прерывание речи ИИ).
- **Проверка здоровья платформы:** `GET /api/health` (возвращает статус всех 5 моделей ИИ, SQLite и песочницы).
- **Лимиты файлов (Инвариант 8):** Новые файлы $\le 350$ строк; изменяемые файлы $\le 400$ строк.
