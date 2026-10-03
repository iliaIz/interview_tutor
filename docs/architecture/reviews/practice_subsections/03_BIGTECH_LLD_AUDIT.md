# Глубокий Аудит Подраздела: BigTech LLD (Machine Coding Arena)

> **Подраздел:** `lld_bigtech` / [PracticeArena.tsx](file:///home/djelu/spring/frontend/src/components/practice/PracticeArena.tsx)  
> **Объем каталога:** 35 enterprise-задач (Яндекс, Ozon, Авито, Wildberries)  
> **Ключевые темы:** Rate Limiter, In-Memory TTL Cache, Sliding Window, Parking Lot, Ride Sharing, Logging Framework  
> **Инварианты:** Инжекция `java.time.Clock`, `BigDecimal HALF_EVEN`, упорядоченный захват блокировок `min(id1, id2)`

---

## 1. Архитектурный профиль задач BigTech LLD

Задачи Machine Coding ориентированы на проектирование модульной, расширяемой и потокобезопасной архитектуры на Java 21 за ограниченное время (45–60 минут):
- **Детерминизм времени:** Полный запрет `System.currentTimeMillis()` и `Thread.sleep()`. Обязательная инжекция `java.time.Clock`.
- **Чистые контракты:** Использование паттернов GoF (Стратегия, Фабрика, Декоратор, Цепочка обязанностей) и Java 21 Records для неизменяемых событий.
- **Многопоточность:** Безопасная работа с `ConcurrentHashMap.compute()`, `AtomicLong`, `StampedLock` и предотвращение циклических взаимных блокировок.

---

## 2. Проверка соответствия AI-Напарника (Voice & Text)

### 2.1. Переиспользование кода голосового движка
- **Состояние:** Запускается через [PracticeVoiceContext.tsx:103-114](file:///home/djelu/spring/frontend/src/components/practice/tutor/PracticeVoiceContext.tsx#L103-L114) с `domain = 'lld'`, `topic = 'LLD архитектура и чистое проектирование на Java 21'`.
- **Проблема интеграции:**
  - В разделе «Теория Собеседование» при обсуждении архитектуры доска кандидата обновляется мгновенно.
  - В Практике LLD голосовой движок изолирован внутри контекста без связи с Zustand-хранилищем доски.

---

### 2.2. Точность системного промпта
- **Бэкенд-билдер:** [buildLivePairPrompt(domain='lld')](file:///home/djelu/spring/backend/src/prompts/live/livePairPrompts.ts#L45-L69):
  - **Роль:** `=== 1. РОЛЬ: SENIOR LLD ARCHITECT & MULTIMODAL PAIR-PROGRAMMER ===`
  - **Персоны:**
    - `junior_explainer`: помощь с проектированием классов, интерфейсов и рекордов по шагам.
    - `senior_socratic`: строгий запрет готового кода, вопросы по SRP и расширяемости.
    - `faang_interviewer`: ConcurrentHashMap, StampedLock, дедлоки, zero-alloc.
    - `middle_scaffold`: инварианты Clock, BigDecimal, GoF-паттерны.
  - **Вердикт:** Один из самых сильных промптов платформы. Полностью соответствует требованиям Senior/Staff интервью.

---

### 2.3. Интерактивная доска (Whiteboard): Критический разрыв ожиданий

В промпте для LLD зафиксирована директива симбиоза речи и экрана:
> *«КОД НА ДОСКЕ/ЭКРАНЕ: Если нужно показать конкретную структуру классов, сигнатуры методов, рекорды или паттерны, вызови `update_whiteboard` с кодом, а голосом скажи: «Я вывела нужную конструкцию на доску».*

**Что происходит в реальности:**
1. Кандидат голосом просит: *«Покажи интерфейс для стратегии ограничения запросов в Rate Limiter»*.
2. Gemini Live корректно вызывает tool `update_whiteboard(action='write', title='RateLimiterStrategy', code='public interface RateLimiterStrategy...')`.
3. Gemini Live голосом радостно произносит: *«Я вывела нужную конструкцию на доску»*.
4. **Крах UX:** Из-за отсутствия `onWhiteboardUpdate` в [PracticeVoiceContext.tsx:43-57](file:///home/djelu/spring/frontend/src/components/practice/tutor/PracticeVoiceContext.tsx#L43-L57), фронтенд игнорирует событие. Доска кандидата остается пустой! Пользователь ищет код, ничего не видит и теряет доверие к платформе.

---

### 2.4. Полнота контекста: Отсутствие синхронизации кода из Monaco

При решении LLD-задач кандидат непрерывно пишет код в редакторе (создает новые методы, структуры, классы):
- В [WorkspaceEditor.tsx:128](file:///home/djelu/spring/frontend/src/components/practice/WorkspaceEditor.tsx#L128) при каждом изменении вызывается:
  ```ts
  syncEditorCode(value, currentFile.path.split('/').pop() || currentFile.path, 'java', false);
  ```
- Но в `PracticeVoiceContext` метод `syncEditorCode` **не реализован**.
- **Следствие:** Голосовой напарник не видит ни одной свежей строки, написанной кандидатом. Если кандидат говорит: *«Я добавил проверку в методе acquire(), посмотри, пожалуйста»*, ИИ отвечает вслепую по старому коду, который был при старте сессии.

---

### 2.5. Контекстный Компас (Ctrl + /)
- **Компонент:** [LldCompassSheet.tsx](file:///home/djelu/spring/frontend/src/components/practice/compass/LldCompassSheet.tsx).
- **Содержимое:** 5 Золотых Заповедей Архитектуры:
  1. Инжекция Виртуального Времени (`java.time.Clock`).
  2. Финансовая Точность (`BigDecimal` и `HALF_EVEN`).
  3. Иерархический Захват Блокировок (`min(id1, id2)`).
  4. Чистые Границы SOLID и GoF Паттерны.
  5. Потокобезопасность и Видимость Памяти (JMM, Happens-Before).
- **Маршрутизация:** В [PracticeCompassSheet.tsx:25-37](file:///home/djelu/spring/frontend/src/components/practice/compass/PracticeCompassSheet.tsx#L25-L37) фильтр `isLld` безошибочно определяет задачи LLD и отображает `LldCompassSheet`.

---

## 3. Рекомендации по устранению дефектов

1. **Немедленно замкнуть вызов Whiteboard:**
   ```ts
   // PracticeVoiceContext.tsx
   const session = useLiveAudioSession({
     ...
     onWhiteboardUpdate: (payload) => {
       useAppStore.getState().setWhiteboardState(payload);
     }
   });
   ```
2. **Реализовать `syncEditorCode` через деиктический протокол:**
   Внедрить отправку фреймов с дебаунсом 1.5 секунды:
   ```ts
   const syncEditorCode = useCallback((code: string, fileName?: string) => {
     sendCustomFrame({
       type: 'screen_context_sync',
       clientContent: {
         turns: [{
           role: 'user',
           parts: [{ text: `📝 [АКТУАЛЬНЫЙ КОД В РЕДАКТОРЕ (${fileName || 'Solution.java'})]:\n\`\`\`java\n${code}\n\`\`\`` }]
         }],
         turnComplete: false
       }
     });
   }, [sendCustomFrame]);
   ```
3. **Оповещать голосовой сеанс о запуске тестов:** При нажатии «Запустить решение» отправлять статус компиляции и тестов прямо в сокет.
