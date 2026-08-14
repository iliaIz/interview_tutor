# ⚙️ База Вопросов и Ответов в формате JSON

В этой директории находятся структурированные JSON-датасеты из репозитория [enhorse/java-interview](https://github.com/enhorse/java-interview), предназначенные для интеграции в веб-приложения, Telegram-боты, системы интервального повторения (Anki) или локальной работы через Python.

## 🗂 Файлы датасетов:

* [`all_interview_questions.json`](./all_interview_questions.json) — Единый мастер-датасет со всеми **694 вопросами**
* [`topics_metadata.json`](./topics_metadata.json) — Реестр метаданных 22 тем (категории, иконки, цвета, описания)
* 22 отдельных JSON файла по темам (`core_questions.json`, `concurrency_questions.json`, `kafka_questions.json`, `sql_questions.json`, и т.д.)

## 📋 Схема объекта вопроса:
```json
{
  "id": "CORE-001",
  "global_id": 1,
  "num": 1,
  "topic": "Java Core",
  "question": "Чем различаются JRE, JVM и JDK?",
  "answer": "__JVM__, Java Virtual Machine...",
  "source_pages": ["enhorse/java-interview:core.md"]
}
```
