# Stage 03: Machine Coding & Mutation Kata Arena Grounding

> **Статус:** ✅ ЗАВЕРШЕНО  
> **Ответственные файлы:**
> - [WorkspaceEditor.tsx](file:///c:/projects/interview_tutor/frontend/src/components/practice/WorkspaceEditor.tsx)
> - [PracticeVoiceContext.tsx](file:///c:/projects/interview_tutor/frontend/src/components/practice/tutor/PracticeVoiceContext.tsx)
> - [TransactionLabArena.tsx](file:///c:/projects/interview_tutor/frontend/src/components/practice/TransactionLabArena.tsx)
> - [livePromptBuilder.ts](file:///c:/projects/interview_tutor/backend/src/services/live/livePromptBuilder.ts)
> - [livePairPrompts.ts](file:///c:/projects/interview_tutor/backend/src/prompts/live/livePairPrompts.ts)

---

## 1. Проблема и выявленные дефекты (As-Is)

1. **Устаревший сниппет кода в процессе набора (In-Flight Blindness):**
   При старте сессии в [PracticeVoiceContext.tsx](file:///c:/projects/interview_tutor/frontend/src/components/practice/tutor/PracticeVoiceContext.tsx) передаётся сниппет файла на момент нажатия кнопки. Если кандидат пишет код 10 минут, добавляет методы и тесты, а затем спрашивает голосом: *«Посмотри на метод acquireToken, почему в строке 28 NPE?»*, модель видит исходный пустой шаблон!
2. **Слепота к переключению вкладок файлов:**
   Воркспейс содержит несколько файлов (`OrderService.java`, `OrderServiceTest.java`, `InMemoryRepository.java`). Переключение вкладок происходит молча — ИИ не знает, какой файл открыт перед глазами кандидата.
3. **Слепота к нарушениям AST-правил (AST Invariants):**
   В [WorkspaceEditor.tsx](file:///c:/projects/interview_tutor/frontend/src/components/practice/WorkspaceEditor.tsx) работает AST-линтер (`enforce-clock-injection`, `no-double-in-money`, `deadlock-free-transfer`). Список `liveAstViolations` виден кандидату в тулбаре, но не передаётся модели.
4. **Искусственное обрезание ТЗ (800 символов):**
   В `PracticeVoiceContext.tsx` строка 67 содержит `instructionsMarkdown?.slice(0, 800)`. ТЗ для сложных задач LLD (Rate Limiter, Matching Engine, Parking Lot) обрезаются на полуслове, лишая модель критериев приёмки.
5. **Отсутствие дейктического фокуса из Monaco:**
   Выделение строк кода или курсор кандидата в Monaco Editor не передаются в дейктический стор.

---

## 2. Архитектура целевого решения (To-Be)

### 2.1. Синхронизация активной вкладки и имени файла
При переключении файла в `WorkspaceEditor`:
```typescript
const handleSelectFile = (index: number) => {
  setActiveWorkspaceFileIndex(index);
  const file = practiceWorkspaceFiles[index];
  if (file && isVoiceConnected) {
    sendTextMessage(
      `📂 [СМЕНА АКТИВНОГО ФАЙЛА В РЕДАКТОРЕ]: Открыт файл "${file.name}" (${file.path || file.name}).\n\`\`\`java\n${file.content}\n\`\`\``,
      undefined // Без дублирования в пользовательский чат
    );
  }
};
```

### 2.2. Двухуровневый In-Flight Code Handover (Debounce + Turn Flush)
- **Уровень 1 (Debounced Idle Sync):** При паузе в наборе текста на 1.2 секунды — фоновый фрейм с `turnComplete: false`.
- **Уровень 2 (Turn Handover Flush):** При вызове `triggerEndTurn()` (окончание речи по VAD или кнопке) — гарантированная отправка свежего снимка кода перед `turnComplete: true`.

### 2.3. Интеграция нарушений AST в контекст
Перед отправкой хода или при запуске тестов передаётся список активных нарушений:
```text
⚠️ [АКТИВНЫЕ НАРУШЕНИЯ АРХИТЕКТУРНЫХ ИНВАРИАНТОВ В РЕДАКТОРЕ]:
- Строка 42: прямой вызов System.currentTimeMillis() (нарушение enforce-clock-injection, требуется Clock)
- Строка 58: использование double для денежного баланса (нарушение no-double-in-money, требуется BigDecimal)
```

### 2.4. Снятие лимита в 800 символов на ТЗ
В `PracticeVoiceContext.tsx` передавать полное ТЗ (до 4000–6000 символов) с разметкой критериев и функциональных требований.

---

## 3. Чек-лист реализации

- [x] **3.1.** Подключить слушатель выделения редактора кода (`onUpdate` в CodeMirror 6) в `WorkspaceEditor` к дейктическому стору фокуса.
- [x] **3.2.** Реализовать синхронизацию смены вкладок файлов (`📂 [СМЕНА АКТИВНОГО ФАЙЛА]`) в `WorkspaceEditor`.
- [x] **3.3.** Реализовать Turn Handover Flush кода редактора в `PracticeVoiceContext`.
- [x] **3.4.** Добавить отправку `liveAstViolations` при прогоне тестов и дейктический захват терминала (`data-selection-zone="terminal"`).
- [x] **3.5.** Убрать ограничение `slice(0, 800)` на `instructionsMarkdown` в `PracticeVoiceContext`.
- [x] **3.6.** В [TransactionLabArena.tsx](file:///c:/projects/interview_tutor/frontend/src/components/practice/TransactionLabArena.tsx) добавить синхронизацию настроек аннотаций `@Transactional` и дефектов/опасностей дедлока.
