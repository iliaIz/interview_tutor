# Глубокий Аудит Подраздела: Concurrency Lab (Loom, Threads & Races Arena)

> **Подраздел:** `lld_concurrency` / [PracticeArena.tsx](file:///home/djelu/spring/frontend/src/components/practice/PracticeArena.tsx)  
> **Специализация:** Virtual Threads (Project Loom), Carrier Pinning, LMAX Disruptor, StampedLock, детекция гонок данных  
> **Инструментарий:** Concurrency Test Harness, ThreadMXBean, детектор дедлоков, стресс-тесты гонок

---

## 1. Архитектурный профиль задач Concurrency Lab

Данный трек проверяет навыки написания высоконагруженных многопоточных систем на современной платформе Java 21 LTS:
- **Project Loom & Carrier Thread Pinning:** Использование `ReentrantLock` вместо блоков `synchronized`, чтобы не привязывать виртуальный поток к ОС-потоку-носителю (Carrier Thread).
- **Lock-Free алгоритмы:** Кольцевые буферы (LMAX Disruptor), атомарные счетчики без блокировок, CAS-циклы (`compareAndSet`).
- **Модели памяти JMM:** Барьеры памяти, Happens-Before, видимость через `volatile`, предотвращение False Sharing через `@Contended`.
- **Стресс-тестирование:** Проверка через `ThreadMXBean.findDeadlockedThreads()`, Awaitility и обнаружение неатомарных обновлений под сотнями параллельных потоков.

---

## 2. Проверка соответствия AI-Напарника (Voice & Text)

### 2.1. Критический дефект: Сваливание Concurrency в промпт юнит-тестов!

В ходе статического анализа бэкенда обнаружен **грубейший смысловой баг** в обработке домена `concurrency`.

#### Шаг 1: `challengeDomain.ts` возвращает домен `'concurrency'`
В файле [backend/src/utils/challengeDomain.ts:41-50](file:///home/djelu/spring/backend/src/utils/challengeDomain.ts#L41-L50):
```ts
if (
  combined.includes('concurrency') ||
  combined.includes('deadlock') ||
  combined.includes('race_condition') ||
  combined.includes('thread') ||
  combined.includes('atomic') ||
  combined.includes('lock')
) {
  return 'concurrency';
}
```
Функция корректно классифицирует задачу как `'concurrency'`.

#### Шаг 2: `livePairPrompts.ts` игнорирует домен `'concurrency'`!
Смотрим реализацию [backend/src/prompts/live/livePairPrompts.ts:41-92](file:///home/djelu/spring/backend/src/prompts/live/livePairPrompts.ts#L41-L92):
```ts
const isLld = domain === 'lld';
const isTx = domain === 'transactions';

let personaInstruction = '';
if (isLld) {
  // LLD инструкции...
} else if (isTx) {
  // Transactions инструкции...
} else {
  // ВНИМАНИЕ: СЮДА СВАЛИВАЕТСЯ ВСЁ ОСТАЛЬНОЕ, ВКЛЮЧАЯ CONCURRENCY!
  personaInstruction = `=== СТИЛЬ НАСТАВНИЧЕСТВА: ПОДДЕРЖИВАЮЩИЙ JUNIOR EXPLAINER (TESTING) ===
- Объясняй концепции юнит-тестирования простыми жизненными аналогиями.`;
}
```
И далее в приветствии ([строка 134](file:///home/djelu/spring/backend/src/prompts/live/livePairPrompts.ts#L134)):
```ts
greeting = 'Здравствуйте! Я Ваша напарница по тестированию. Внимательно смотрю на код и готова обсуждать граничные случаи. С чего начнем?';
```
И в роли ([строка 143](file:///home/djelu/spring/backend/src/prompts/live/livePairPrompts.ts#L143)):
```ts
roleHeader = `=== 1. РОЛЬ: MULTIMODAL AI PAIR-PROGRAMMER & TESTING COACH ===
Ты помогаешь кандидату решать практические задачи по написанию юнит-тестов (JUnit 5, AssertJ, Mockito, мутационное тестирование).`;
```

#### Итог для пользователя:
Кандидат решает сложнейшую задачу на устранение пиннинга виртуальных потоков в Project Loom или пишет Lock-Free кольцевой буфер Disruptor.
Подключается голосовой напарник и говорит:
> *«Привет! Я твой напарник по тестированию. Помогаю писать юнит-тесты на JUnit 5 и Mockito. С каких граничных условий начнем?»*

Это катастрофическое нарушение контекста задачи и контекстной релевантности.

---

### 2.2. Текстовый AI-тьютор: Аналогичный дефект
В [backend/src/prompts/practiceTutorPrompts.ts:74-84](file:///home/djelu/spring/backend/src/prompts/practiceTutorPrompts.ts#L74-L84) проверяются только `isLld` и `isTx`. Домен `concurrency` не выделен в отдельную категорию и в текстовом чате также сваливается в директивы юнит-тестов.

---

### 2.3. Полнота контекста: Потеря телеметрии Concurrency Harness
В платформе есть специализированный раннер проверки многопоточности `concurrencyHarness`:
- Детектор дедлоков: `concurrencyHarness.deadlockDetected`.
- Детектор гонок данных: `concurrencyHarness.raceConditionDetected`.

В текстовый чат дровера [PracticeTutorDrawer.tsx:138-144](file:///home/djelu/spring/frontend/src/components/practice/tutor/PracticeTutorDrawer.tsx#L138-L144) эти предупреждения подмешиваются:
- *«⚠️ КРИТИЧЕСКАЯ ОШИБКА: Обнаружен взаимный дедлок потоков (Deadlock Detected)»*.
- *«⚠️ ВНИМАНИЕ: Обнаружено состояние гонки данных (Race Condition Detected)»*.

**В голосовую сессию эти сигналы НЕ ПОСТУПАЮТ.** Голосовой ИИ не знает, что запущенный код привел к дедлоку или гонке данных.

---

### 2.4. Контекстный Компас (Ctrl + /)
- Если задача открыта из трека `lld_concurrency`, [PracticeCompassSheet.tsx](file:///home/djelu/spring/frontend/src/components/practice/compass/PracticeCompassSheet.tsx) показывает `LldCompassSheet`. В нем есть общее правило №5 («Потокобезопасность и Видимость Памяти»).
- Но если задача открыта из каталога архетипов Testing (`virtual-thread-pinning`, `lockfree-ringbuffer`), Компас показывает `TestingCompassSheet` (модель RIPR и Закон моков Фаулера), что полностью дезориентирует кандидата при решении многопоточной задачи.

---

## 3. Рекомендации по устранению дефектов

1. **Добавить полноценную ветку `concurrency` в `livePairPrompts.ts`:**
   - Выделить `const isConcurrency = domain === 'concurrency'`.
   - Задать аутентичную роль: `=== 1. РОЛЬ: HIGH-LOAD & CONCURRENCY SPECIALIST (JAVA 21 LOOM) ===`.
   - Настроить приветствие: *«Привет! Я твой напарник по многопоточности. Разбираем виртуальные потоки Loom, гонки данных или блокировки?»*.
   - Заложить персоны: фокусировка на JMM, Happens-Before, CAS, `StampedLock`, пиннинге виртуальных потоков (`synchronized` vs `ReentrantLock`), дедлоках.
2. **Добавить ветку `concurrency` в `practiceTutorPrompts.ts`** для текстового чата.
3. **Исправить маршрутизацию Компаса в `PracticeCompassSheet.tsx`:** Задачи с тегами `concurrency`, `loom`, `thread`, `lockfree` должны отображать правила многопоточности, а не мутационные тесты.
4. **Транслировать сигналы `deadlockDetected` и `raceConditionDetected` в голосовой WebSocket.**
