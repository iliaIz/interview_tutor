# Этап 4: Рефакторинг Бэкенда и Вынос Сид-Каталогов

> **Цель:** Декомпозировать тяжелые бэкенд-сервисы `geminiLiveProxy.ts` (998 строк) и `db.ts` (880 строк) до компактных модулей по 150–250 строк, а также вынести статические каталоги мутаций и задач из TypeScript-кода в структурированный JSON.

---

## 1. Декомпозиция `backend/src/services/geminiLiveProxy.ts` (998 строк)

Файл отвечает сразу за четыре разнородные задачи:
1. HTTP Upgrade и валидация токенов/тикетов.
2. Маршрутизация сырого бинарного аудиопотока (PCM Little-Endian 16/24kHz).
3. Инъекция векторной памяти кандидата и системных директив.
4. Парсинг и обработка вызовов инструментов (Tool Calling).

### Целевая структура:

```
backend/src/services/live/
├── liveWsConnectionHandler.ts  (~240 строк) --> Upgrade HTTP-запроса, валидация тикетов, handshake
├── liveAudioStreamRouter.ts    (~210 строк) --> Двунаправленный PCM стриминг браузер <-> LiteLLM Proxy
├── liveContextInjector.ts      (~170 строк) --> Извлечение векторных гэпов и генерация промпта
├── liveToolDeclarations.ts     (уже существует, ~180 строк) --> JSON-схемы тулов
├── liveToolDispatcher.ts       (уже существует, ~570 строк) --> Исполнение тулов (eval, whiteboard)
└── liveSessionRegistry.ts      (уже существует, ~220 строк) --> Память активных сессий

backend/src/services/
└── geminiLiveProxy.ts          (~160 строк) --> Точка входа: setupLiveWebSocketProxy(server)
```

---

## 2. Декомпозиция `backend/src/services/db.ts` (880 строк)

Сейчас файл смешивает подключение к SQLite, создание DDL всех таблиц и захардкоженный сидинг начальных данных.

### Целевая структура:

```
backend/src/services/db/
├── index.ts                    (~60 строк)  --> Экспорт синглтона `db` и фасада методов
├── connection.ts               (~80 строк)  --> Инициализация `better-sqlite3`, WAL-режим, прагмы
├── schema.ts                   (~240 строк) --> DDL таблиц (users, topics, questions, progress, sessions)
└── seeders/
    ├── seedProfiles.ts         (~110 строк) --> Начальные системные профили (L4, L5, L6)
    ├── seedMasterCodes.ts      (~80 строк)  --> Мастер-инвайты и владелец системы
    ├── seedQuestions.ts        (~120 строк) --> Индексация 27 вопросов Spring Framework
    └── seedTxScenarios.ts      (~130 строк) --> Каталог сценариев Spring Transactions
```

---

## 3. Вынос статических данных из кода в JSON

Файлы мутационных задач:
- `backend/src/services/mutationChallenges/legacyChallenges.ts` (1677 строк)
- `backend/src/services/mutationChallenges/archUnitChallenges.ts` (1663 строки)
- `backend/src/services/mutationChallenges/junit5Challenges.ts` (1466 строк)
- `backend/src/services/mutationChallenges/fsmChallenges.ts` (1462 строки)
- `backend/src/services/mutationChallenges/concurrencyChallenges.ts` (1188 строк)
- `backend/src/services/mutationChallenges/primitivesChallenges.ts` (1170 строк)
- `backend/src/services/mutationChallenges/mockitoChallenges.ts` (1169 строк)

Это чистые массивы объектов `{ id, title, description, buggyCode, testCode }`.

**Трансформация:**
- Данные переносятся в директорию `backend/src/data/mutation_challenges/*.json`.
- В коде остается компактный загрузчик:
  ```typescript
  import junit5Data from '../../data/mutation_challenges/junit5.json' with { type: 'json' };
  ```
- **Эффект:** Экономия более 10 000 строк кода в TypeScript-базе! Языковой сервер tsc перестает зависать, а ИИ-ассистент мгновенно находит нужную логику.

---

## 4. Definition of Done (DoD) для Этапа 4

- [ ] Ни один файл логики бэкенда не превышает 350 строк.
- [ ] Данные мутационных задач вынесены в валидные `.json` файлы.
- [ ] Бэкенд стартует штатно, все таблицы в SQLite создаются, сидеры успешно отрабатывают.
- [ ] WebSocket-прокси `/ws/live` транслирует аудио без задержек и разрывов.
- [ ] `npm run build` в `backend/` завершается с кодом 0.
