# Stage 01: Unified Deictic Grounding Engine & Turn Handover Flush

> **Статус:** ✅ ЗАВЕРШЕНО  
> **Ответственные файлы:**
> - [useLegacyLiveAudioSession.ts](file:///c:/projects/interview_tutor/frontend/src/hooks/useLegacyLiveAudioSession.ts)
> - [VoiceModal.tsx](file:///c:/projects/interview_tutor/frontend/src/components/VoiceModal.tsx)
> - [liveWsConnectionHandler.ts](file:///c:/projects/interview_tutor/backend/src/services/live/liveWsConnectionHandler.ts)
> - [useSelectionFocusStore.ts](file:///c:/projects/interview_tutor/frontend/src/store/useSelectionFocusStore.ts)

---

## 1. Проблема и архитектурный дефект (As-Is)

1. **Split-Brain между модальным окном и практическими аренами:**
   - В [VoiceModal.tsx](file:///c:/projects/interview_tutor/frontend/src/components/VoiceModal.tsx) реализованы предречевой инжектор `injectActiveFocusGroundingFrame` и глобальный слушатель `mouseup` для зон `[data-selection-zone]`.
   - В хуке [useLegacyLiveAudioSession.ts](file:///c:/projects/interview_tutor/frontend/src/hooks/useLegacyLiveAudioSession.ts), который питает **все** практические арены (`BugHuntArena`, `PracticeVoiceContext`, `SystemDesignArena`), этой логики нет вовсе. Кандидат, выделяющий строки в коде на практических треках, остаётся невидим для ИИ.
2. **Отсутствие Handover Flush при наборе кода во время речи:**
   - Если кандидат говорит и одновременно правит код в Monaco, правка не попадает в контекст, так как фиксация происходила только на старте.

---

## 2. Архитектура целевого решения (To-Be)

```
        ┌─────────────────────────────────────────────────────────────┐
        │                 UI Actions & Events                         │
        │  • Выделение текста в DOM ([data-selection-zone])           │
        │  • Выделение строк в Monaco Editor                          │
        │  • Правка кода в Monaco / инпутах                           │
        └──────────────────────────────┬──────────────────────────────┘
                                       │
                                       ▼
        ┌─────────────────────────────────────────────────────────────┐
        │             Unified Deictic Grounding Engine                │
        │                                                             │
        │  1. Selection Tracker: setFocus(zone, text, startLine, ...) │
        │  2. Fast Hash Comparator: currentHash !== lastSyncedHash    │
        │  3. Debounced Idle Sync (1.2s):                             │
        │     send { clientContent: { ..., turnComplete: false } }    │
        │  4. Handover Flush (в triggerEndTurn):                      │
        │     send { clientContent: { ..., turnComplete: true } }     │
        └──────────────────────────────┬──────────────────────────────┘
                                       │ WebSocket
                                       ▼
        ┌─────────────────────────────────────────────────────────────┐
        │       Gemini Live Upstream (0 мс задержка, <400мс речь)     │
        └─────────────────────────────────────────────────────────────┘
```

### 2.1. Спецификация Turn Handover Flush в `triggerEndTurn`
Метод `triggerEndTurn()` вызывается в двух детерминированных точках:
1. По нажатию кнопки «Закончить ответ» в ручном режиме.
2. По таймеру тишины Auto-VAD (1.5–1.8 сек тишины после речи).

**Алгоритм Handover Flush:**
```typescript
const triggerEndTurn = useCallback(() => {
  // 1. Проверяем, менялся ли активный код или фокус внимания с момента последней отправки
  const currentCode = activeCodeGetterRef.current?.();
  if (currentCode && fastHash(currentCode) !== lastSyncedCodeHashRef.current) {
    lastSyncedCodeHashRef.current = fastHash(currentCode);
    // Отправляем фрейм актуального кода с turnComplete: false прямо перед коммитом
    wsRef.current?.send(JSON.stringify({
      clientContent: {
        turns: [{
          role: 'user',
          parts: [{ text: `📝 [АКТУАЛЬНЫЙ КОД В РЕДАКТОРЕ НА МОМЕНТ ЗАВЕРШЕНИЯ РЕЧИ]:\n\`\`\`${activeLanguageRef.current || 'java'}\n${currentCode}\n\`\`\`` }]
        }],
        turnComplete: false
      }
    }));
  }

  // 2. Отправляем терминальный turnComplete: true
  wsRef.current?.send(JSON.stringify({
    clientContent: { turnComplete: true }
  }));
}, []);
```

### 2.2. Monaco Editor Selection Hook
Подключение слушателя `onDidChangeCursorSelection` из инстанса Monaco в `useSelectionFocusStore`:
- Номер начальной строки `selection.startLineNumber`.
- Номер конечной строки `selection.endLineNumber`.
- Выделенный фрагмент кода.
- Имя активного файла вкладки.

---

## 3. Чек-лист реализации

- [x] **1.1.** Создать / расширить `useDeicticGrounding` внутри `useLegacyLiveAudioSession.ts` для поддержки всех арен.
- [x] **1.2.** Реализовать `fastHash` ($O(1)$ детерминированный хэш строки) для отслеживания изменений без оверхеда.
- [x] **1.3.** Внедрить **Turn Handover Flush** в `triggerEndTurn()` с гарантией отправки свежего кода перед `turnComplete: true`.
- [x] **1.4.** Внедрить фоновый **Debounced Idle Sync** (1.2с паузы в наборе текста) с флагом `turnComplete: false`.
- [x] **1.5.** Добавить слушатель выделения в редакторе кода (`onUpdate` в CodeMirror 6 / DOM listener) с пробросом в `useSelectionFocusStore`.
- [x] **1.6.** Убедиться на бэкенде в [liveWsConnectionHandler.ts](file:///c:/projects/interview_tutor/backend/src/services/live/liveWsConnectionHandler.ts), что дейктические фреймы (`screen_context_sync`, `canvas_delta`, action markers) не ломают стейт-машину `hasCandidateResponded`.
