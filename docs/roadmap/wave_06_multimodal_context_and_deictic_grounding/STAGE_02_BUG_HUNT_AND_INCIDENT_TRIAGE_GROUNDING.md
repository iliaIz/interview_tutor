# Stage 02: Bug Hunt & Incident Triage Grounding

> **Статус:** ✅ ЗАВЕРШЕНО  
> **Ответственные файлы:**
> - [BugHuntArena.tsx](file:///c:/projects/interview_tutor/frontend/src/components/incidents/BugHuntArena.tsx)
> - [BugChallengeCard.tsx](file:///c:/projects/interview_tutor/frontend/src/components/BugChallengeCard.tsx)
> - [livePromptBuilder.ts](file:///c:/projects/interview_tutor/backend/src/services/live/livePromptBuilder.ts)
> - [liveSessionRegistry.ts](file:///c:/projects/interview_tutor/backend/src/services/live/liveSessionRegistry.ts)
> - [liveWsConnectionHandler.ts](file:///c:/projects/interview_tutor/backend/src/services/live/liveWsConnectionHandler.ts)

---

## 1. Проблема и выявленные дефекты (As-Is)

1. **Слепота к контексту инцидента:**
   В карточке [BugChallengeCard.tsx](file:///c:/projects/interview_tutor/frontend/src/components/BugChallengeCard.tsx) есть аккордеон с продакшен-алертом, симптомами, воздействием на пользователей и стек-трейсом (`incidentContext`). В [livePromptBuilder.ts](file:///c:/projects/interview_tutor/backend/src/services/live/livePromptBuilder.ts) это поле **вообще не попадает**! Если кандидат ссылается на строку в стек-трейсе или сообщение алерта, ИИ слеп.
2. **Слепота к эталонному решению и тесту:**
   Поля `challenge.fixedCode` и `challenge.unitTest` (воспроизводящий JUnit 5 тест) не передаются в Live сессию. ИИ не может подсказать архитектуру воспроизводящего теста или прокомментировать эталонный фикс.
3. **Рассинхронизация при генерации вариации:**
   В `handleGenerateVariation()` (строки 265–295) `BugHuntArena.tsx` меняет задачу в `history`, но **не переподключает сокет**. На экране новый код, а ИИ продолжает обсуждать старый баг!
4. **Амнезия в режиме Free Chat:**
   В `livePromptBuilder.ts` ветка `tutorMode === 'free_chat'` вырезает `hints` и `bugExplanation`.
5. **Отсутствие событий взаимодействия кандидата:**
   Когда кандидат раскрывает Подсказку №1 или включает просмотр Diff, ИИ не знает об этом.
6. **Потеря контекста при переходе «Предыдущий / Следующий»:**
   При клике «Предыдущий» сессия либо обрывается, либо начинается с чистого листа без памяти о ранее высказанных гипотезах.

---

## 2. Архитектура целевого решения (To-Be)

### 2.1. Обогащение системного промпта Bug Hunt (`livePromptBuilder.ts`)
В промпт добавляются секции:
```text
=== КОНТЕКСТ ПРОДАКШЕН-ИНЦИДЕНТА ===
СИМПТОМЫ И АЛЕРТ: ${incidentContext?.symptom || 'Не указано'}
СТЕК-ТРЕЙС / ЛОГ:
${incidentContext?.stackTrace || 'Лог отсутствует'}

=== ЭТАЛОННОЕ ИСПРАВЛЕНИЕ (ДЛЯ ТВОЕГО ЗНАНИЯ) ===
```java
${fixedCode}
```

=== ВОСПРОИЗВОДЯЩИЙ UNIT-ТЕСТ ===
```java
${unitTest}
```
```

### 2.2. Событийные фреймы действий кандидата (Action Event Frames)
При взаимодействии с карточкой в сокет отправляются легковесные мета-сообщения:
- При клике «Показать подсказку №X»:  
  `ws.send({ clientContent: { turns: [{ role: 'user', parts: [{ text: '💡 [ДЕЙСТВИЕ: Кандидат раскрыл на экране подсказку №' + index + ']: "' + hintText + '"' }] }], turnComplete: false } })`
- При переключении режима решения на Diff / Fixed Code / Test:  
  `ws.send({ clientContent: { turns: [{ role: 'user', parts: [{ text: '🔍 [ДЕЙСТВИЕ: Кандидат просматривает вкладку ' + mode + ' решения]' }] }], turnComplete: false } })`

### 2.3. Мостовая память при возврате к кейсу (Episodic Bridge Navigation)
Каждому кейсу присваивается ключ `sessionId = session_bughunt_${challenge.id}`.
- При генерации вариации или клике «Следующий» текущая сессия уходит в сон в `liveSessionRegistry`.
- Для новой задачи инициируется свежий чистый сокет.
- При клике «Предыдущий» сокет подключается к сохранённому `sessionId` с директивой:
  ```text
  📌 [ВОЗВРАТ К ПРЕДЫДУЩЕМУ КЕЙСУ «${challenge.title}»]: 
  Кандидат вернулся назад к этой задаче. 
  Кратко (1 предложение в доброжелательной манере напарника) напомни, какую гипотезу мы обсуждали, и спроси, готов ли он продолжить.
  ```

---

## 3. Чек-лист реализации

- [x] **2.1.** Добавить `incidentContext`, `fixedCode`, `unitTest` в параметры `startBugVoiceSession` в [BugHuntArena.tsx](file:///c:/projects/interview_tutor/frontend/src/components/incidents/BugHuntArena.tsx).
- [x] **2.2.** Интегрировать эти поля в генератор промпта [livePromptBuilder.ts](file:///c:/projects/interview_tutor/backend/src/services/live/livePromptBuilder.ts) для режимов `bug_hunt` и `free_chat`.
- [x] **2.3.** Добавить отправку событий раскрытия подсказок и переключения вкладок решения (Diff/Fixed/Test) в [BugChallengeCard.tsx](file:///c:/projects/interview_tutor/frontend/src/components/BugChallengeCard.tsx).
- [x] **2.4.** Исправить десинхронизацию в `handleGenerateVariation`: плавно завершать текущую сессию и стартовать новую под свежую вариацию.
- [x] **2.5.** Реализовать `Episodic Bridge Navigation` при переходах «Предыдущий» / «Следующий» с сохранением истории диалога по ID кейса.
- [x] **2.6.** Подключить зоны выделения `[data-selection-zone="incident"]` и `[data-selection-zone="hint"]` в `BugChallengeCard` к `useSelectionFocusStore`.
