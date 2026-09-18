# Stage 02: Live Prompt Engine & Thought CoVe Protocol

> **Статус:** ⚪ К ВЫПОЛНЕНИЮ  
> **Файлы спецификации:** `backend/src/services/live/livePromptBuilder.ts`, `backend/src/services/live/liveWsConnectionHandler.ts`  
> **Инварианты:** Инвариант 2 (Zero False Affirmation), Инвариант 3 (Strictness Spectrum), Инвариант 5 (No Flattery Priming)

---

## 1. Архитектурная цель

Интегрировать параметры строгости (`strictness: 'learning' | 'standard' | 'hardcore'`) и канонические анти-сикофантические директивы во все ветки генерации системного промпта живого WebSocket-сокета Gemini Live.

---

## 2. Ключевые изменения

1. **Режим `tutorMode === 'deep_dive'`:**
   - Подключить `TRIVIA_IMMUNITY_INVARIANT`.
   - Подключить `CONVERSATIONAL_ANTI_SYCOPHANCY_DIRECTIVES` для режима наставника:
     - Запрет фальшивых кивков.
     - Обязательное мгновенное раскрытие физики ошибки без снижения самооценки кандидата.
2. **Режим `sessionType === 'interview'`:**
   - Искоренить подталкивания к лести:
     - Заменить строку: *«поблагодари за отличный ответ и сразу переходи к финалу»* на: *«зафиксируй раскрытие критерия и переходи к следующему шагу»*.
     - Заменить строку: *«ОБЯЗАТЕЛЬНО сначала произнеси вслух теплое устное резюме: похвали за верные мысли...»* на: *«произнеси сбалансированное устное резюме: перечисли подтвержденные факты и зафиксируй неточности...»*.
   - Подключить `TRIVIA_IMMUNITY_INVARIANT` и соответствующий блок строгости (`standard` vs `hardcore`).
3. **Режим Live Extended Thinking (`gemini-live-thinking-v3`):**
   - Внедрить скрытый протокол `CHAIN_OF_VERIFICATION_THOUGHT_DIRECTIVE` в системные инструкции.
4. **WebSocket Connection Handler:**
   - В [liveWsConnectionHandler.ts](file:///c:/projects/interview_tutor/backend/src/services/live/liveWsConnectionHandler.ts) считывать `strictness` из URL и прокидывать в `buildSystemPrompt`.

---

## 3. Критерии готовности (Acceptance Criteria)
- [ ] При подключении к Live WebSocket параметр `strictness` валидируется и влияет на системный промпт.
- [ ] В режимах `deep_dive`, `socratic` и `interview` наличествуют `TRIVIA_IMMUNITY_INVARIANT` и правила реакции на неточности.
- [ ] Из промпта полностью удалены лексические паттерны принудительной похвалы.
