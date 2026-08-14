# 📚 Java Interview Platform — Актуальная База Вопросов и Ответов (694+ вопросов, 22 темы)

Интерактивная платформа и база знаний для подготовки к техническим собеседованиям на позицию **Java Developer** (от Junior до Senior/Lead). 

База данных перенесена и синхронизируется с актуальным открытым репозиторием [enhorse/java-interview](https://github.com/enhorse/java-interview.git), содержит **694 детальных вопроса с ответами**, кодом и диаграммами по **22 ключевым направлениям**.

---

## 🗂 22 Раздела базы знаний

| Категория | Темы (Slug) | Иконка | Вопросов |
| :--- | :--- | :--- | :---: |
| **Core Java & JVM** | `core` (Java Core), `oop` (ООП), `jvm` (JVM & Память), `jcf` (Java Collections), `java8` (Java 8+ Features) | ☕ 📦 ⚡ 📚 ✨ | **276** |
| **Architecture & Concurrency** | `concurrency` (Многопоточность), `io` (I/O & NIO), `serialization` (Сериализация), `patterns` (Паттерны GoF) | ⚡ 🔄 📦 🔀 | **119** |
| **Data & Storage** | `db` (Базы данных & Транзакции), `sql` (SQL & Оконные функции), `jdbc` (JDBC) | 🗄️ 📊 🔗 | **69** |
| **Web & Enterprise** | `reactive` (WebFlux/Reactor), `servlets` (Servlets & JSP), `web` (HTTP/REST/Web), `kafka` (Apache Kafka) | 📈 🖥️ 🌐 📡 | **166** |
| **Engineering & Quality** | `test` (JUnit & Mockito), `log` (SLF4J/Logback), `xml` (XML/JSON), `uml` (UML) | ✅ 📝 📄 🕸️ | **35** |
| **Frontend Basics** | `html` (Основы HTML), `css` (Основы CSS) | 📑 🎨 | **29** |
| **ВСЕГО** | **22 темы** | — | **694 вопроса** |

---

## 🚀 Структура проекта

```
spring/
├── 🌐 frontend/                # React 19 + TypeScript + Vite + Tailwind + Framer Motion
├── 🖥️ backend/                 # Node.js + Express + Better-SQLite3 + Gemini TTS/Live API
├── 🚀 quiz.py                  # Консольный тренажер (python quiz.py)
├── 📄 markdown/                # 22 тематических Markdown-файла + master all_interview_questions.md
├── ⚙️ json/                    # 22 JSON датасета + topics_metadata.json + all_interview_questions.json
├── 🖼️ frontend/public/images/  # Диаграммы и схемы (SQL оконные функции и т.д.)
└── 🛠 scripts/
    └── migrate_enhorse.py      # Скрипт миграции и синхронизации с enhorse/java-interview
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
# Интерактивное меню по 22 темам
python quiz.py

# Выборка по теме (например, Collections или Kafka):
python quiz.py --topic jcf --limit 10
python quiz.py --topic kafka --limit 5

# Режим флешкарт:
python quiz.py --interactive
```

### 3. Повторная миграция / Обновление данных
```bash
python scripts/migrate_enhorse.py
```

---

## 🤖 ИИ-возможности платформы
- **AI Audio Recap**: генерация аудио-подкастов по любой из 22 тем с многоголосым синтезом речи Gemini TTS.
- **Voice Interview**: интерактивное голосовое Mock-интервью в реальном времени через Gemini Live WebSocket.
- **Exam Quiz**: оценка полноты ответов пользователя с обратной связью от ИИ.
