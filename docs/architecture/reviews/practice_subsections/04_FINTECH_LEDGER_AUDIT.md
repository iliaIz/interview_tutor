# Глубокий Аудит Подраздела: FinTech & Ledger (Т-Банк / Stripe Arena)

> **Подраздел:** `lld_fintech` / [PracticeArena.tsx](file:///home/djelu/spring/frontend/src/components/practice/PracticeArena.tsx)  
> **Специализация:** Двусторонняя бухгалтерская запись (Double-Entry Ledger), финансовая точность, упорядоченные блокировки  
> **Жесткие инварианты:** `java.math.BigDecimal` (Banker's Rounding `HALF_EVEN`), сортировка ресурсов `min(id1, id2)`, AST-правило `no-double-in-money`

---

## 1. Архитектурный профиль задач FinTech & Ledger

Задачи данного трека моделируют финансовые ядра платежных систем, банковских транзакций и валютных бирж:
1. **Инвариант финансовой точности (No Double in Money):** Категорический запрет примитивов `double` и `float`. Все операции выполняются строго в `BigDecimal` с явным масштабом (scale) и округлением Гаусса/банкира (`RoundingMode.HALF_EVEN`).
2. **Инвариант встречных переводов (Deadlock-Free Transfers):** При переводе средств между аккаунтами $A$ и $B$ захват замков (ReentrantLock) выполняется строго в глобальном порядке идентификаторов: `lock(min(A.id, B.id)) -> lock(max(A.id, B.id))`.
3. **Идемпотентность и аудит:** Использование ключей идемпотентности (`idempotency_key`), транзакционный журнал (Audit Log) и предотвращение двойных списаний (Double Spending).

---

## 2. Проверка соответствия AI-Напарника (Voice & Text)

### 2.1. Переиспользование кода голосового движка
- **Состояние:** Запускается через [PracticeVoiceContext.tsx:103-114](file:///home/djelu/spring/frontend/src/components/practice/tutor/PracticeVoiceContext.tsx#L103-L114).
- **Разрешение домена:** Имя трека `lld_fintech` попадает под условие `track.includes('lld')` $\rightarrow$ устанавливается `domain = 'lld'`.
- **Проблема интеграции:** Дублирует проблемы трека BigTech LLD — отсутствие связи с интерактивной доской, отсутствие синхронизации правок кода и отсутствие бегущих субтитров.

---

### 2.2. Точность системного промпта
- **Бэкенд-билдер:** [buildLivePairPrompt](file:///home/djelu/spring/backend/src/prompts/live/livePairPrompts.ts):
  - В базовых платформенных директивах [JAVA21_PLATFORM_INVARIANTS](file:///home/djelu/spring/backend/src/prompts/core/platformInvariants.ts) и секции LLD жестко зафиксировано:
    > *- Финансовая точность: строгий BigDecimal с явным масштабом и RoundingMode.HALF_EVEN вместо double/float.*  
    > *- Потокобезопасность: упорядоченный захват блокировок lock(min, max) для исключения дедлоков.*
  - **Поведение персон:** В персоне `middle_scaffold` и `senior_socratic` заложена нулевая терпимость к ошибкам в деньгах. При первой же попытке кандидата написать `double balance` ИИ обязан жестко пресечь это голосом.
  - **Вердикт:** Промпт полностью релевантен финансовой специфике.

---

### 2.3. Полнота контекста: Слепота к AST-проверкам финансового линтера

В платформе реализован AST-анализатор ([backend/src/routes/practice.ts:233](file:///home/djelu/spring/backend/src/routes/practice.ts#L233)), который при валидации кода выявляет нарушения:
- `no-double-in-money`: нахождение типов `double` / `float` в финансовых классах.
- `enforce-clock-injection`: нахождение `System.currentTimeMillis()`.
- `enforce-lock-ordering`: отсутствие сортировки ID при взятии блокировок.

**Проблема:**
- Результаты AST-проверки отображаются кандидату в интерфейсе и передаются в текстовый чат (`compilerError` / `failureParts`).
- **Голосовой напарник не получает результатов AST-аудита.** Если кандидат объявил `double amount`, а линтер заблокировал билд, ИИ в наушниках молчит о причине сбоя, если кандидат не зачитает ошибку вслух.

---

### 2.4. Интерактивная доска (Whiteboard)
- В FinTech критически важно визуализировать проводки двойной записи (Debit/Credit таблица, инвариант $\sum \text{Debit} = \sum \text{Credit}$).
- Из-за дефекта `onWhiteboardUpdate` в [PracticeVoiceContext.tsx](file:///home/djelu/spring/frontend/src/components/practice/tutor/PracticeVoiceContext.tsx) вывод таблицы проводок на доску невозможен.

---

### 2.5. Контекстный Компас (Ctrl + /)
- **Компонент:** [LldCompassSheet.tsx](file:///home/djelu/spring/frontend/src/components/practice/compass/LldCompassSheet.tsx).
- Карточки №2 («Финансовая Точность BigDecimal») и №3 («Иерархический Захват Блокировок») являются идеальным ориентиром для данного подраздела.
- В чек-листе карточек присутствуют прямые указания: проверка отсутствия `float`/`double`, использование `.isEqualByComparingTo()`, обработка `id1 == id2`.

---

## 3. Рекомендации по устранению дефектов

1. **Трансляция AST-ошибок в Live-сессию:** При срабатывании правил `no-double-in-money` или `enforce-lock-ordering` немедленно слать в WebSocket фрейм:
   ```json
   {
     "type": "screen_context_sync",
     "clientContent": {
       "turns": [{
         "role": "user",
         "parts": [{ "text": "🚨 [AST ФИНАНСОВЫЙ ЛИНТЕР ЗАБЛОКИРОВАЛ КОД]: Обнаружен запрещенный примитив double для денежных сумм на строке 24. Обязателен BigDecimal с RoundingMode.HALF_EVEN." }]
       }],
       "turnComplete": false
     }
   }
   ```
2. **Включение Whiteboard:** Замкнуть вызов `setWhiteboardState` в `PracticeVoiceContext`.
3. **Реализация синхронизации кода:** Внедрить `syncEditorCode` для непрерывного отслеживания балансов и блокировок в редакторе.
