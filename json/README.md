# ⚙️ База Вопросов и Ответов в формате JSON

В этой директории находятся структурированные JSON-датасеты из репозитория [enhorse/java-interview](https://github.com/enhorse/java-interview), [Baeldung](https://www.baeldung.com) и [InterviewBit](https://www.interviewbit.com), предназначенные для интеграции в веб-приложения, Telegram-боты, системы интервального повторения (Anki) или локальной работы через Python.

## 🗂 Файлы датасетов:

* [`all_interview_questions.json`](./all_interview_questions.json) — Единый мастер-датасет со всеми **727 вопросами**
* [`topics_metadata.json`](./topics_metadata.json) — Реестр метаданных **24 тем** (категории, иконки, цвета, описания)
* 24 отдельных JSON файла по темам (`spring_questions.json`, `spring-boot_questions.json`, `core_questions.json`, `concurrency_questions.json`, `kafka_questions.json`, `sql_questions.json`, и т.д.)

## 📋 Схема объекта вопроса:
```json
{
  "id": "SPRING-001",
  "global_id": 185,
  "num": 1,
  "topic": "Spring Framework",
  "question": "Что такое Spring Framework и каковы его ключевые преимущества?",
  "answer": "**Spring Framework** — это наиболее популярный в корпоративной Java-разработке легковесный фреймворк...",
  "source_pages": ["Baeldung / InterviewBit (Curated)"]
}
```
