# ⚙️ База Вопросов и Ответов в формате JSON

В этой директории находятся структурированные JSON-датасеты, предназначенные для автономной работы без ИИ, интеграции в веб-приложения, Telegram-боты или системы интервального повторения (Anki, Flashcards).

## 🗂 Файлы датасетов:

* [`java_core_questions.json`](./java_core_questions.json) — 240 объектов Java Core
* [`spring_questions.json`](./spring_questions.json) — 75 объектов Spring Framework
* [`hibernate_questions.json`](./hibernate_questions.json) — 60 объектов Hibernate ORM
* [`docker_questions.json`](./docker_questions.json) — 30 объектов Docker
* [`all_interview_questions.json`](./all_interview_questions.json) — Единый JSON датасет (405 вопросов)

## 📋 Схема объекта:
```json
{
  "id": "JAVA-001",
  "global_id": 1,
  "num": 1,
  "topic": "Java Core",
  "question": "Что такое статические блоки и статическая инициализация в Java?",
  "answer": "Статические блоки или статическая инициализация...",
  "source_pages": [2]
}
```

## 🐍 Пример чтения в Python:
```python
import json

with open("json/java_core_questions.json", encoding="utf-8") as f:
    questions = json.load(f)

# первые 20 вопросов:
first_20 = questions[:20]
```
