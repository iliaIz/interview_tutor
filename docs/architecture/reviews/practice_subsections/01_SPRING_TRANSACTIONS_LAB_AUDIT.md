# Глубокий Аудит Подраздела: Spring Transactions Lab (@Transactional Arena)

> **Подраздел:** `spring_transactions` / [TransactionLabArena.tsx](file:///home/djelu/spring/frontend/src/components/practice/TransactionLabArena.tsx)  
> **Объем каталога:** 16 канонических сценариев (уровни сложности L0–L3)  
> **Интерактивные элементы:** Two-Tier Flame Chart (AOP vs JDBC), обойма слотов HikariCP, AST-инспектор, Сократическая защита

---

## 1. Архитектурный профиль и сценарии подраздела

Подраздел моделирует поведение декларативных транзакций Spring Framework (`@Transactional`), прокси-механизмы Spring AOP (CGLIB vs Dynamic Proxies), уровни изоляции ANSI SQL и пулы соединений HikariCP:
- **L0 (Основы AOP & Self-Invocation):** Вызовы методов внутри одного бина в обход прокси, несовпадение `checked` vs `unchecked` исключений в `rollbackFor`.
- **L1 (Распространение Propagation):** Вложенные транзакции `REQUIRES_NEW`, зависание пула соединений HikariCP (Connection Pool Starvation).
- **L2 (Аномалии изоляции и блокировки):** Потерянные обновления (Lost Update), неповторяющееся чтение, фантомы, пессимистические блокировки `PESSIMISTIC_WRITE`.
- **L3 (Распределенные паттерны & Дедлоки):** Дедлоки при встречных переводах, идемпотентный Transactional Outbox с CDC.

---

## 2. Проверка соответствия AI-Напарника (Voice & Text)

### 2.1. Переиспользование кода голосового движка
- **Текущее состояние:** Сессия стартует через [PracticeVoiceContext.tsx:85-98](file:///home/djelu/spring/frontend/src/components/practice/tutor/PracticeVoiceContext.tsx#L85-L98) с параметрами:
  - `domain: 'transactions'`
  - `topic: 'Транзакции Spring Boot, распространение и аномалии БД'`
  - `challengeCategory: 'Spring Transactions'`
  - `challengeTrack: 'spring_transactions'`
- **Разница с разделом «Теория Собеседование»:**
  1. В Теории используется [VoiceModal.tsx](file:///home/djelu/spring/frontend/src/components/VoiceModal.tsx), где реализован полноценный жизненный цикл (Lobby $\rightarrow$ Active $\rightarrow$ Grand Finale / Verdict) и вызов [VoiceSubtitles.tsx](file:///home/djelu/spring/frontend/src/components/voice/VoiceSubtitles.tsx).
  2. В Transactions Lab рендер идет через плавающий [AmbientVoicePill.tsx](file:///home/djelu/spring/frontend/src/components/practice/tutor/AmbientVoicePill.tsx) и [PracticeVoiceHUD.tsx](file:///home/djelu/spring/frontend/src/components/practice/tutor/PracticeVoiceHUD.tsx) внутри бокового дровера [PracticeTutorDrawer.tsx](file:///home/djelu/spring/frontend/src/components/practice/tutor/PracticeTutorDrawer.tsx).
  3. **Критический дефект кнопки «Защитить у AI»:** В карточке вердикта [TransactionVerdictCard.tsx:43-51](file:///home/djelu/spring/frontend/src/components/practice/TransactionVerdictCard.tsx#L43-L51) прописана кнопка:
     ```tsx
     {onStartVoiceDefense && (
       <button onClick={() => onStartVoiceDefense(scenario, scenario.probingQuestions?.[0]?.question || '')}>
         Защитить у AI
       </button>
     )}
     ```
     Однако в [PracticeArena.tsx:40-44](file:///home/djelu/spring/frontend/src/components/practice/PracticeArena.tsx#L40-L44) проп `onStartVoiceDefense` **вообще не передается**! Кнопка устной защиты с ИИ физически никогда не отображается пользователю.

---

### 2.2. Точность системного промпта
- **Бэкенд-билдер:** [buildLivePairPrompt(domain='transactions')](file:///home/djelu/spring/backend/src/prompts/live/livePairPrompts.ts#L70-L89):
  - **Роль:** `=== 1. РОЛЬ: SPRING TRANSACTIONS & DATABASE SPECIALIST ===`
  - **Когнитивные персоны:**
    - `junior_explainer`: понятные аналогии ACID, пошаговый разбор аномалий.
    - `senior_socratic`: наводящие вопросы по блокировкам строк и одновременным коммитам.
    - `faang_interviewer`: Outbox, CDC, 2PC, гарантии персистентности.
    - `middle_scaffold`: Self-Invocation, пессимистические блокировки.
  - **Вердикт по промпту:** Системный промпт составлен высокопрофессионально и полностью релевантен домену транзакций.

---

### 2.3. Полнота контекста задачи (Что видит юзер vs что получает ИИ)

| Элемент контекста | Видит пользователь | Получает Текстовый AI | Получает Голосовой AI (Live WebSocket) | Оценка паритета |
| :--- | :--- | :--- | :--- | :--- |
| **Условие сценария** | Да (`problemStatement`) | Да (`kataInstructions`) | Да (`bugExplanation`) | ✅ Полный |
| **Код всех сервисов** | Да (Monaco Editor) | Да (`activeFileContent`) | Да (`codeSnippet` склеен из всех сервисов) | ✅ Полный при старте |
| **Динамические правки кода** | Да (в реальном времени) | Да (при каждой отправке) | ❌ **НЕТ** (`syncEditorCode` не реализован) | 🔴 **Разрыв контекста** |
| **Результаты симуляции AOP/JDBC** | Да (Flame Chart & Slots) | ❌ Нет доступа к FlameChart | ❌ Нет доступа к FlameChart | 🟡 Желательно обогатить |
| **Архитектурные нарушения вердикта** | Да (`violations` и `summary`) | Да (`latestTxEvaluation`) | ❌ **НЕТ** (в промпт Live не передается) | 🔴 **Разрыв контекста** |

---

### 2.4. Интерактивная доска (Whiteboard)
- **Бэкенд:** Инструмент `update_whiteboard` активирован для сессий транзакций.
- **Фронтенд:** В [PracticeVoiceContext.tsx:43-57](file:///home/djelu/spring/frontend/src/components/practice/tutor/PracticeVoiceContext.tsx#L43-L57) коллбек `onWhiteboardUpdate` **не передан**.
- **Результат:** Если напарник в ходе диалога о транзакциях пытается показать на доске правильную конфигурацию бина или вызов через self-injected прокси, вызов инструмента проглатывается, и доска на экране пользователя остается пустой.

---

### 2.5. Контекстный Компас (Ctrl + /)
- **Компонент:** [TransactionCompassSheet.tsx](file:///home/djelu/spring/frontend/src/components/practice/compass/TransactionCompassSheet.tsx).
- **Маршрутизация:** В [PracticeCompassSheet.tsx:12-18](file:///home/djelu/spring/frontend/src/components/practice/compass/PracticeCompassSheet.tsx#L12-L18) проверка `activeTransactionLabScenarioId` корректно активирует `TransactionCompassSheet`.
- **Содержимое:** 5 золотых правил транзакций:
  1. `SELF_INVOCATION`: Вызовы мимо прокси Spring.
  2. `PROPAGATION_PITFALLS`: `REQUIRES_NEW` и исчерпание пула HikariCP.
  3. `ISOLATION_AND_LOCKING`: Уровни изоляции и `PESSIMISTIC_WRITE`.
  4. `TRANSFER_DEADLOCKS`: Иерархический захват блокировок `min(id1, id2)`.
  5. `OUTBOX_PATTERN`: Идемпотентный Transactional Outbox.
- **Дефект взаимодействия:** В `TransactionLabArena.tsx` функция `handleAskTutorAboutRule` отправляет сообщение тьютору через `sendMessage`, но **не открывает `PracticeTutorDrawer`** (`toggleOpen(true)` не вызывается), из-за чего пользователь не замечает, что ответ сгенерирован.

---

## 3. Рекомендации по устранению дефектов

1. **Восстановить кнопку устной защиты:** В `PracticeArena.tsx` реализовать `handleStartTransactionVoiceDefense` с вызовом `VoiceModal` (по образцу `SystemDesignArena.tsx`), передавая `initialSessionType="tutor"`, `initialTutorMode="practice_defense"`, и кастомный промпт защиты транзакций.
2. **Подключить Whiteboard:** В `PracticeVoiceContext.tsx` добавить `onWhiteboardUpdate: (payload) => useAppStore.getState().setWhiteboardState(payload)`.
3. **Автооткрытие дровера при клике в Компасе:** В `TransactionLabArena.tsx` при клике «Обсудить с тьютором» вызывать `toggleOpen(true)`.
4. **Обогатить Live WebSocket контекстом нарушений:** При отправке кода или запуске симуляции транзакций передавать в сокет деиктический фрейм с `latestTxEvaluation`.
