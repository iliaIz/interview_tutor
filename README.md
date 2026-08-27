# 📚 Java & Spring Interview Platform — Актуальная База Вопросов и Ответов (746+ вопросов, 24 темы)

Интерактивная платформа и база знаний для подготовки к техническим собеседованиям на позицию **Java / Spring Developer** (от Junior до Senior/Lead). 

База данных синхронизируется с [enhorse/java-interview](https://github.com/enhorse/java-interview.git), а также дополнена передовыми материалами по **Spring Framework и Spring Boot 3** из [Baeldung](https://www.baeldung.com), [InterviewBit](https://www.interviewbit.com) и [Medium 2026 Edition](https://medium.com/illumination/top-50-java-spring-boot-interview-questions-2026-edition-57ecfbdf3061). Содержит **746 детальных вопросов с ответами**, кодом и диаграммами по **24 ключевым направлениям**.

---

## 🗂 24 Раздела базы знаний

| Категория | Темы (Slug) | Иконка | Вопросов |
| :--- | :--- | :--- | :---: |
| **Core Java & JVM** | `core` (Java Core), `oop` (ООП), `jvm` (JVM & Память), `jcf` (Java Collections), `java8` (Java 8+ Features) | ☕ 📦 ⚡ 📚 ✨ | **276** |
| **Architecture & Concurrency** | `concurrency` (Многопоточность), `io` (I/O & NIO), `serialization` (Сериализация), `patterns` (Паттерны GoF) | ⚡ 🔄 📦 🔀 | **119** |
| **Data & Storage** | `db` (Базы данных & Транзакции), `sql` (SQL & Оконные функции), `jdbc` (JDBC) | 🗄️ 📊 🔗 | **69** |
| **Web & Enterprise** | `spring` (Spring Framework), `spring-boot` (Spring Boot 3), `reactive` (WebFlux/Reactor), `servlets` (Servlets & JSP), `web` (HTTP/REST/Web), `kafka` (Apache Kafka) | 🍃 ⚡ 📈 🖥️ 🌐 📡 | **218** |
| **Engineering & Quality** | `test` (JUnit & Mockito), `log` (SLF4J/Logback), `xml` (XML/JSON), `uml` (UML) | ✅ 📝 📄 🕸️ | **35** |
| **Frontend Basics** | `html` (Основы HTML), `css` (Основы CSS) | 📑 🎨 | **29** |
| **ВСЕГО** | **24 темы** | — | **746 вопросов** |

---

## 🚀 Структура проекта

```
spring/
├── 🌐 frontend/                # React 19 + TypeScript + Vite + Tailwind + Framer Motion
├── 🖥️ backend/                 # Node.js + Express + Better-SQLite3 + Gemini TTS/Live API
├── 🚀 quiz.py                  # Консольный тренажер (python quiz.py)
├── 📄 markdown/                # 24 тематических Markdown-файла + master all_interview_questions.md
│   └── sources/                # Исходные файлы Baeldung, InterviewBit, Medium 2026 (на англ. языке)
├── ⚙️ json/                    # 24 JSON датасета + topics_metadata.json + all_interview_questions.json
├── 🖼️ frontend/public/images/  # Диаграммы и схемы (SQL оконные функции и т.д.)
└── 🛠 scripts/
    ├── migrate_enhorse.py      # Мастер-скрипт миграции и компиляции базы знаний
    ├── build_spring_topics.py  # Генератор обогащенных вопросов Spring & Spring Boot
    └── fetch_and_merge_spring.py # Извлечение и форматирование исходников Baeldung / InterviewBit
```

---

## ⚡ Быстрый старт

### 1. Веб-платформа (Fullstack)
```bash
# Запуск бэкенда
cd backend
npm install
npm run dev

# Запуск фронтенда
cd ../frontend
npm install
npm run dev
```

### 2. Консольный тренажер (CLI)
```bash
# Интерактивное меню по 24 темам
python quiz.py

# Выборка по теме (например, Spring, Spring Boot, Collections или Kafka):
python quiz.py --topic spring --limit 10
python quiz.py --topic spring-boot --limit 10
python quiz.py --topic kafka --limit 5

# Режим флешкарт:
python quiz.py --interactive
```

### 3. Повторная миграция / Обновление данных
```bash
python scripts/migrate_enhorse.py
```

---

## 🤖 ИИ-возможности платформы (SOTA Август 2026)

- **Gemini Live Multimodal Interview**: интерактивное голосовое Mock-интервью в реальном времени через двунаправленный WebSocket с 24kHz HD PCM звуком.
  - **First-Turn Lockdown**: гарантированное устное приветствие и зачитывание вопроса без ложных преждевременных оценок.
  - **Dual-Sided Handshake**: симметричная синхронизация Web Audio API таймлайна с сетевым протоколом `turnComplete`.
  - **Manual & Auto-VAD Режимы**: комфортное размышление в тишине по кнопке «Передать ответ ➔» или живой диалог.
  - **Сократический тьютор & Deep Dive**: пошаговый разбор устройства технологий «под капотом» с наводящими вопросами.
- **AI Audio Recap**: генерация многоголосых аудио-подкастов по любой из 24 тем с синтезом речи Gemini TTS.
- **Bug Simulator & Code Review**: интерактивный тренажер поиска скрытых багов и уязвимостей в промышленном коде Spring & Java.
- **Exam Quiz & Active Recall**: многокритериальная оценка полноты ответов кандидата с сохранением истории в SQLite.
- **LiteLLM Gateway Security**: централизованное проксирование запросов, пулинг API-ключей и двухуровневый Circuit Breaker.

Подробные архитектурные спецификации и Mermaid-диаграммы см. в [docs/architecture.md](docs/architecture.md), а инварианты агента в [AGENTS.md](AGENTS.md).
