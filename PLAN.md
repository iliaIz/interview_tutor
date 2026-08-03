# 📋 План реализации: Полнофункциональная Сервис-Платформа Подготовки к Собеседованиям

Этот документ определяет детальную архитектуру, этапы реализации и техническую спецификацию интерактивной платформы для подготовки к техническим собеседованиям с поддержкой текстового и голосового ИИ на базе моделей **Gemini 3.5 Flash Lite** и **Gemini 3 Flash Live**.

---

## 🎨 Дизайн и Эстетика UI/UX ("Пастельный Премиум")

* **Цветовые токены (CSS Variables + Tailwind)**:
  * `--bg-app`: `#FAF8F5` (Warm Alabaster / Cream)
  * `--card-bg`: `#FFFFFF` (Pure Pearl)
  * `--card-subtle`: `#FFF6F4` (Soft Blush) / `#F2F6F3` (Soft Sage) / `#F4F1F9` (Soft Lavender)
  * `--text-main`: `#2C303E` (Deep Charcoal Slate)
  * `--accent-rose`: `#E08E89` (Muted Rose Gold)
  * `--accent-violet`: `#8B78E6` (Soft Lavender Violet)
* **Типографика**: `Plus Jakarta Sans` (Google Fonts)
* **Анимации**: `Framer Motion` (плавное появление карточек, свайпы, пульсирующие звуковые волны).

---

## 🏗 Архитектура и Проектные Компоненты

### 1. Бэкенд (`/backend`)
* **Технологии**: Node.js + Express + TypeScript + SQLite (`better-sqlite3`) + `ws` (WebSockets).
* **Порт**: `5000` в контейнере ➔ **`8091`** на хосте (`http://localhost:8091`).
* **Модули**:
  - `sqlite.ts`: База данных для сохранения прогресса по темам (`user_progress`, `topic_stats`, `question_history`).
  - `routes/topics.ts`: REST API для выдачи тем и порций из N карточек (`GET /api/topics`, `GET /api/topics/:id/batch?size=5&shuffle=true`).
  - `routes/eval.ts`: REST API для текстовой оценки ответов через **`Gemini 3.5 Flash Lite`**.
  - `websocket/liveProxy.ts`: WebSocket прокси-сервер для связи фронтенда с **`Gemini 3 Flash Live`** (двусторонний поток PCM-аудио и текста).

### 2. Фронтенд (`/frontend`)
* **Технологии**: React 18 + Vite + TypeScript + TailwindCSS + Zustand + Framer Motion + Lucide React.
* **Порт**: `80` в контейнере ➔ **`8090`** на хосте (`http://localhost:8090`).
* **Модули**:
  - `components/TopicSelector.tsx`: Карточки выбора тем с кольцевым прогрессом (Java Core 240, Spring 75, Hibernate 60, Docker 30), кнопками «Продолжить», «Сначала», тумблером «Шафл».
  - `components/StudyDeck.tsx`: Экран изучения порции из N карточек с подробным ответом и кодом.
  - `components/ExamQuiz.tsx`: Экран проверки знаний:
    - **Текстовый режим**: окно ввода ответа + мгновенный ИИ-фидбек от `Gemini 3.5 Flash Lite` (процент совпадения, что отвечено верно, что упущено).
    - **Голосовой режим**: анимированная звуковая волна + устное собеседование через `Gemini 3 Flash Live`.
  - `hooks/useAudioWorklet.ts`: Кастомный хук для захвата PCM 16kHz микрофона через Web Audio API.

### 3. Docker Infrastructure (`docker-compose.yml`)
* Поднятие двух сервисов (`backend` на 8091, `frontend` на 8090) одной командой `docker compose up -d --build`.

---

## 🛠 Поэтапный План Реализации

### Этап 1: Структура проекта и Бэкенд Сервис
1. Создание структуры директорий `/backend` и `/frontend`.
2. Инициализация Node.js TypeScript проекта в `/backend`.
3. Подключение базы данных SQLite и перенос вопросов из `json/` в базу данных или сервисный слой.
4. Написание REST API эндпоинтов для получения тем, вопросов и текстовой оценки `Gemini 3.5 Flash Lite`.
5. Написание WebSocket прокси для `Gemini 3 Flash Live`.
6. Фиксация коммитом: `feat(backend): init express, sqlite persistence and gemini services`.

### Этап 2: Фронтенд на React + Vite с Пастельным UI
1. Инициализация Vite React TypeScript проекта в `/frontend`.
2. Настройка TailwindCSS, пастельной дизайн-системы, шрифта `Plus Jakarta Sans`.
3. Создание Zustand-стора с синхронизацией сохраненного прогресса с бэкендом.
4. Реализация главного экрана с карточками тем, кольцевым прогресс-баром, кнопками «Продолжить», «Сначала», тумблером «Шафл».
5. Фиксация коммитом: `feat(frontend): pastel theme, topic selector and progress tracking UI`.

### Этап 3: Режим Изучения (Study Deck) и Режим Проверки (Quiz)
1. Реализация экрана изучений N карточек с пастельными анимациями `Framer Motion`.
2. Реализация текстового режима проверки знания с ИИ-оценкой от `Gemini 3.5 Flash Lite`.
3. Реализация голосового режима проверки с интеграцией Web Audio API PCM capture и WebSocket подключением к `Gemini 3 Flash Live`.
4. Фиксация коммитом: `feat(app): add study deck, text ai quiz and voice live interview mode`.

### Этап 4: Docker Compose и Интеграционное Тестирование
1. Создание `backend/Dockerfile` и `frontend/Dockerfile` (Nginx).
2. Создание `docker-compose.yml` с портами `8090` и `8091`.
3. Запуск контейнеров, проверка работы веб-интерфейса и голосового режима.
4. Фиксация коммитом: `feat(docker): add docker-compose configuration for port 8090 and 8091`.

---

## 🔍 План Проверки и Тестирования

### Автоматизированные и Ручные тесты:
1. **Проверка REST API**: `curl http://localhost:8091/api/topics` и `curl http://localhost:8091/api/topics/java/batch?size=5`.
2. **Проверка сохранения прогресса**: Продвинуться по теме Java ➔ перезагрузить страницу / перезапустить сервис ➔ убедиться, что % прогресса и позиция сохранились.
3. **Проверка «Сначала» и «Шафл»**: Нажать «Сначала» ➔ убедиться, что прогресс темы обнулился; включить «Шафл» ➔ проверить случайную выборку вопросов.
4. **Проверка Текстового ИИ**: Ввести ответ ➔ получить оценку и анализ от `Gemini 3.5 Flash Lite`.
5. **Проверка Голосового Live режима**: Включить голосовой режим ➔ сказать ответ в микрофон ➔ проверить аудио-ответ от `Gemini 3 Flash Live`.
6. **Проверка Docker**: Выполнить `docker compose up -d --build` ➔ открыть `http://localhost:8090`.
