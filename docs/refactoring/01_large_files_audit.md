# Отчёт глубокого аудита файлов неидеального размера (> 500 строк)

> **Дата аудита:** Сентябрь 2026  
> **Целевой диапазон для ИИ-ассистента и команды:** 150–350 строк (жёсткий потолок: 500 строк)  
> **Методология:** Выявление Single Responsibility Principle (SRP) нарушений, скрытых зависимостей и архитектурных дублей.

---

## 1. Сводная классификация кодовой базы

Все выявленные файлы > 500 строк делятся на две принципиальные категории:

| Категория | Количество | Характер содержимого | Стратегия рефакторинга |
| :--- | :--- | :--- | :--- |
| **А. Статические каталоги данных (Static Catalogs / Seed Data)** | 10 файлов | JSON/TS структуры задач, мутаций, каталогов ката. Нет логики, нет сайд-эффектов. | Вынос данных в `.json` файлы или партиционирование по темам. Низкий приоритет, так как логических багов они не вызывают. |
| **Б. Активная бизнес-логика и Год-компоненты (Active Logic & God-Components)** | 14 файлов | Смешение UI, сетевых протоколов, стейта, таймеров и аналитики в одном файле. | **Высочайший приоритет.** Именно эти файлы перегружают контекст ИИ, приводят к регрессиям, дублированию и багам. |

---

## 2. Глубокий аудит Год-компонентов активной логики

### 2.1. `frontend/src/components/VoiceModal.tsx` (3 770 строк) — 🚨 АБСОЛЮТНЫЙ МОНОЛИТ

* **Что содержит сейчас:**
  1. Полный сетевой WebSocket-клиент `/ws/live` с авторизационными тикетами и реконнектом.
  2. Низкоуровневый аудио-конвейер: `AudioContext`, `AudioWorklet`, `AudioPlayoutManager`, конвертация PCM16, замер RMS.
  3. Машину состояний речевого диалога: Auto-VAD, тактильный Barge-In, Dual-sided Handshake.
  4. Deictic Grounding: отслеживание текущей ревизии кода в IDE и текста выделения на экране.
  5. Мобильную телеметрию: Screen WakeLock API, обработчик VisibilityChange.
  6. Логику пакетного интервью: итератор по 27 вопросам Spring, сохранение чекпоинтов, таймер обратного отсчета 5 сек.
  7. Оценку и коучинг: телеметрия STAR/PREP, эвристики пауз, Web Speech API fallback.
  8. Огромный объём верстки: экран диалога, центральный пульсирующий круг, шторка транскрипта, шторка настроек, экран перехода, итоговые карточки.
* **На какие части разбивается:**
  1. `frontend/src/hooks/useLiveAudioSession.ts` (~380 строк) — чистый аудио/WebSocket движок.
  2. `frontend/src/hooks/useBatchSession.ts` (~160 строк) — логика цепочки вопросов (1..27), таймеры автоперехода, чекпоинты.
  3. `frontend/src/hooks/useSpeechCoachingTelemetry.ts` (~150 строк) — темп речи, паузы, Web Speech API.
  4. `frontend/src/components/voice/VoiceActiveInterviewView.tsx` (~320 строк) — экран активного диалога (пульсирующий шар, таймлайн, кнопка Barge-In).
  5. `frontend/src/components/voice/VoiceTransitionView.tsx` (~200 строк) — экран 5-секундного отсчета перед следующим вопросом.
  6. `frontend/src/components/VoiceModal.tsx` (~240 строк) — **чистый оркестратор**, только переключение `stage` и модальная обвязка.

---

### 2.2. `frontend/src/store/useAppStore.ts` (1 036 строк) — 🚨 МОНОЛИТНЫЙ ZUSTAND STORE

* **Что содержит сейчас:**
  В одном объекте собрано всё состояние приложения:
  - Авторизация и текущий профиль пользователя.
  - Список тем и активный вопрос.
  - Настройки интервью (голос, сложность, персона).
  - Стейт аудио-плеера подкастов (AudioPlayerBar).
  - Стейт интерактивной доски кода (Whiteboard).
  - Чекпоинты пакетного интервью (Batch Session).
  - История ревизий кода в IDE-песочнице.
  - Глобальные всплывающие тосты (Toasts).
* **На какие части разбивается (Slices Pattern):**
  1. `store/slices/authSlice.ts` (~80 строк) — юзер, роли, права.
  2. `store/slices/interviewConfigSlice.ts` (~140 строк) — персона, модель, настройки звука.
  3. `store/slices/batchSessionSlice.ts` (~120 строк) — прогресс квиза, чекпоинты, результаты.
  4. `store/slices/whiteboardSlice.ts` (~150 строк) — код на интерактивной доске, ревизии.
  5. `store/slices/audioPlayerSlice.ts` (~110 строк) — глобальный подкаст-бар.
  6. `store/useAppStore.ts` (~90 строк) — композиция слайсов через `create<AppState>()((...a) => ({ ...createAuthSlice(...a), ... }))`.

---

### 2.3. `frontend/src/components/AudioRecapModal.tsx` (1 012 строк)

* **Что содержит сейчас:**
  - Генерация и предзагрузка аудио-рекапа урока/темы (TTS).
  - Управление воспроизведением и перемоткой.
  - Синхронизированный караоке-текст с подсветкой активного предложения.
  - Рендеринг слайдов конспекта и интерактивных квиз-вопросов внутри аудио.
* **На какие части разбивается:**
  1. `hooks/useAudioRecapPlayback.ts` (~180 строк) — аудиоплеер, буферизация, синхронизация таймкодов.
  2. `components/recap/RecapKaraokeViewer.tsx` (~220 строк) — автоскролл и подсветка текущего предложения.
  3. `components/recap/RecapQuizOverlay.tsx` (~210 строк) — мини-квиз по ходу прослушивания.
  4. `components/AudioRecapModal.tsx` (~250 строк) — оркестратор диалогового окна.

---

### 2.4. `frontend/src/components/triage/IncidentTriageStudio.tsx` (1 012 строк)

* **Что содержит сейчас:**
  - Симуляция production-инцидента (Grafana метрики, логи ELK, трейсы Jaeger).
  - Терминал расследования и окно ввода команд/гипотез.
  - Таймер деградации SLA и штрафные очки за простой сервиса.
  - AI-интервьюер инцидента и итоговый постмортем.
* **На какие части разбивается:**
  1. `components/triage/TelemetryDashboard.tsx` (~280 строк) — графики метрик и логов.
  2. `components/triage/IncidentTerminal.tsx` (~240 строк) — командная строка расследования.
  3. `components/triage/PostMortemReport.tsx` (~220 строк) — финальный отчет по инциденту.
  4. `hooks/useIncidentSimulation.ts` (~200 строк) — состояние таймеров и деградации SLA.
  5. `components/triage/IncidentTriageStudio.tsx` (~250 строк) — лэйаут студии.

---

### 2.5. `backend/src/services/geminiLiveProxy.ts` (998 строк)

* **Что содержит сейчас:**
  - HTTP-серверный апгрейд на `/ws/live`.
  - Валидация сессионных кук и одноразовых тикетов (`/api/auth/ws-ticket`).
  - Управление жизненным циклом апстрим-сокета к `LiteLLM_Proxy`.
  - Трансляция входящих/исходящих PCM-аудио кадров.
  - Реестр памяти сессии и инъекция векторных гэпов кандидата.
  - Диспетчеризация инструментов: `submit_interview_evaluation`, `update_whiteboard`, `record_candidate_observation`, `solve_incident_bug`.
* **На какие части разбивается:**
  1. `services/live/liveWsConnectionHandler.ts` (~260 строк) — handshake, ticket auth, lifecycle.
  2. `services/live/liveAudioStreamRouter.ts` (~220 строк) — двунаправленная маршрутизация PCM-пакетов между браузером и LiteLLM.
  3. `services/live/liveContextInjector.ts` (~180 строк) — сборка векторной памяти и системного промпта.
  4. `services/geminiLiveProxy.ts` (~200 строк) — точка входа и конфигурация WebSocketServer.

---

### 2.6. `backend/src/services/db.ts` (880 строк)

* **Что содержит сейчас:**
  - Инициализация SQLite базы данных `better-sqlite3`.
  - Создание десятков таблиц и миграций (`CREATE TABLE IF NOT EXISTS`).
  - Тяжеловесный начальный сидинг: вопросы, системные профайлы, мастер-инвайт токены, транзакционные сценарии.
* **На какие части разбивается:**
  1. `services/db/connection.ts` (~90 строк) — подключение, прагмы (`journal_mode = WAL`), singleton instance.
  2. `services/db/migrations.ts` (~250 строк) — DDL-схемы таблиц и индексов.
  3. `services/db/seeders/` (~150-200 строк каждый):
     - `seedProfiles.ts`
     - `seedQuestions.ts`
     - `seedMasterCodes.ts`
     - `seedScenarios.ts`
  4. `services/db.ts` (~80 строк) — фасадный экспорт для обратной совместимости.

---

### 2.7. `frontend/src/components/QuestionExplorer.tsx` (868 строк)

* **Что содержит сейчас:**
  - Поиск, многофакторная фильтрация по 27 темам и тегам.
  - Каталог карточек с виртуализацией.
  - Вкладка детального ответа с кодом и диаграммами.
  - Кнопки быстрого запуска аудио-интервью и текстового режима.
* **На какие части разбивается:**
  1. `components/questions/QuestionFiltersBar.tsx` (~180 строк) — панель фильтров и поиска.
  2. `components/questions/QuestionDetailDrawer.tsx` (~260 строк) — просмотр эталонного ответа и архитектурных схем.
  3. `hooks/useQuestionSearchFilter.ts` (~160 строк) — мемоизированная фильтрация и сортировка.
  4. `components/QuestionExplorer.tsx` (~260 строк) — мастер-каталог.

---

### 2.8. `frontend/src/components/VoiceSettingsDrawer.tsx` (795 строк)

* **Что содержит сейчас:**
  - Выбор голоса Gemini (Puck, Charon, Kore, Fenrir, Aoede).
  - Тест воспроизведения аудио (audio preview).
  - Настройка таймингов VAD, авто-паузы, громкости.
  - Выбор персоны интервьюера и целевого грейда (L4, L5, L6).
* **На какие части разбивается:**
  1. `components/voice/settings/VoiceVoiceSelector.tsx` (~220 строк) — список голосов и плеер превью.
  2. `components/voice/settings/VoiceTimingControls.tsx` (~180 строк) — ползунки VAD, паузы, порог чувствительности.
  3. `components/voice/settings/VoicePersonaSettings.tsx` (~180 строк) — выбор стиля общения и грейда.
  4. `components/VoiceSettingsDrawer.tsx` (~210 строк) — родительский Drawer.

---

### 2.9. `frontend/src/components/system_design/SystemDesignArena.tsx` (789 строк)

* **Что содержит сейчас:**
  - Интерактивный канвас архитектуры (компоненты, базы данных, очереди).
  - Аудио-диалог с Staff-архитектором.
  - Панель симуляции нагрузки (RPS, задержки, отказы узлов).
  - Калькулятор емкостей (Capacity Math Coach).
* **На какие части разбивается:**
  1. `components/system_design/SystemDesignVoiceHUD.tsx` (~180 строк) — плавающий аудио-интерфейс (уже на базе единого хука).
  2. `components/system_design/SystemDesignToolbar.tsx` (~160 строк) — палитра сервисов и инструментов канваса.
  3. `components/system_design/SystemDesignArena.tsx` (~320 строк) — мастер-компоновка студии.

---

### 2.10. `frontend/src/components/ExamQuiz.tsx` (763 строки)

* **Что содержит сейчас:**
  - Сессионный таймер экзамена.
  - Навигатор вопросов с номерами и статусами (отвечен/пропущен/сомневаюсь).
  - Рендеринг вариантов ответов и поля свободного ответа.
  - Подсчет итогового балла и генерация сертификата.
* **На какие части разбивается:**
  1. `components/exam/ExamHeaderNav.tsx` (~190 строк) — сетка номеров вопросов и таймер обратного отсчета.
  2. `components/exam/ExamQuestionCard.tsx` (~240 строк) — карточка текущего вопроса с кодом.
  3. `components/exam/ExamResultSummary.tsx` (~220 строк) — вердикт, статистика по темам.
  4. `components/ExamQuiz.tsx` (~210 строк) — оркестратор экзамена.

---

### 2.11. `frontend/src/components/voice/VoiceTutorView.tsx` (699 строк)

* **Что содержит сейчас:**
  - Отображение диалога в режиме обучения («Deep Dive», «Socratic», «ELI5»).
  - Сплит-экран: левая колонка — чат и подсказки, правая — интерактивная доска кода.
  - Инъекция подсказок модели RIPR (Reachability -> Infection -> Propagation).
* **На какие части разбивается:**
  1. `components/voice/tutor/TutorDialogueFeed.tsx` (~220 строк) — поток реплик и промежуточных транскриптов.
  2. `components/voice/tutor/TutorWhiteboardSplit.tsx` (~230 строк) — правая панель с кодом и синхронизацией строк.
  3. `components/voice/VoiceTutorView.tsx` (~250 строк) — родительский контейнер режима тьютора.

---

### 2.12. `frontend/src/components/practice/PracticeCatalog.tsx` (674 строки)

* **Что содержит сейчас:**
  - Фильтры по паттернам (JUnit 5, Mockito, AssertJ, Мутационное тестирование, Spring TX).
  - Карточки практических задач со статусами прохождения.
  - Запуск в песочницу или в режим напарника.
* **На какие части разбивается:**
  1. `components/practice/PracticeFilters.tsx` (~170 строк) — фильтры по технологиям и сложности.
  2. `components/practice/PracticeCard.tsx` (~190 строк) — карточка практической задачи с бейджами.
  3. `components/practice/PracticeCatalog.tsx` (~250 строк) — сетка каталога.

---

### 2.13. `frontend/src/components/incidents/BugHuntArena.tsx` (636 строк)

* **На какие части разбивается:**
  1. `components/incidents/BugHuntEditor.tsx` (~220 строк) — редактор дефектного кода с подсветкой подозрительных строк.
  2. `components/incidents/BugHuntVoiceHUD.tsx` (~160 строк) — голосовой напарник-дебаггер.
  3. `components/incidents/BugHuntArena.tsx` (~250 строк) — компоновщик арены.

---

### 2.14. `frontend/src/components/StudyDeck.tsx` (626 строк)

* **На какие части разбивается:**
  1. `components/deck/DeckCardFlipper.tsx` (~210 строк) — 3D флип-карточка вопроса/ответа с анимацией жестов.
  2. `components/deck/DeckControlsBar.tsx` (~180 строк) — кнопки интервального повторения FSRS (Снова, Трудно, Хорошо, Легко).
  3. `components/StudyDeck.tsx` (~230 строк) — родительский экран колоды.

---

## 3. Статические файлы данных (Каталоги задач и мутаций)

Файлы вроде `backend/src/services/mutationChallenges/*.ts` (1100–1700 строк каждый) и `system_design/katas/MicroKatasCatalog.ts` (1004 строки) представляют собой декларативные массивы данных.

**Рекомендация по ним:**
Они не содержат логики и не приводят к багам рассинхронизации. Их целесообразно перевести в чистые JSON-файлы в каталоге `data/`, импортируя их через `import scenarios from './scenarios.json' with { type: 'json' }`. Это полностью разгрузит языковой сервер TypeScript и память IDE.

---

## 4. Сводный вердикт аудита

- **Фронтенд-ядро:** `VoiceModal.tsx` (3 770 строк) и `useAppStore.ts` (1 036 строк) — главные очаги архитектурного риска. Их декомпозиция дает мгновенный прирост стабильности и уменьшает задержки работы AI в разы.
- **Аудио-сеть:** Ликвидация дублирования между `VoiceModal` и `useLegacyLiveAudioSession` в пользу единого `useLiveAudioSession` (~380 строк) — шаг №1 всей миграции.
