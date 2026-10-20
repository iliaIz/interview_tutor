# Phase 4: State Reset, Repeat Attempts & Hands-Free UX
## SOTA Late-2026 Batch UX & Continuous Navigation Flow

> **Document:** `docs/roadmap/wave_20_hands_free_voice_batch_navigation_and_continuity/PHASE_04_STATE_RESET_REPEAT_ATTEMPTS_AND_HANDS_FREE_UX.md`  
> **Status:** Draft / Pending User Approval  
> **Target Subsystem:** `frontend/src/components/VoiceModal.tsx`, `frontend/src/components/voice/`  

---

## 1. Clean-Slate Repeat Attempts Architecture

When a candidate skips a question during an interview, it is recorded with 0 points:
```typescript
batchResults[questionId] = {
  score: 0,
  isPassed: false,
  missingPoints: ['Вопрос пропущен кандидатом без ответа'],
  spokenFeedback: 'Вопрос пропущен.'
};
```

If the candidate later returns to this question (*«Вернись к вопросу 1»*):
1. **Pristine Turn Memory:** The session memory for `(sessionId, questionId)` is re-initialized with `isRetry: true`. Gemini does not lecture the candidate on their previous skip or carry over past dialogue turns.
2. **Fresh Rubric Assessment:** The candidate answers the question from scratch.
3. **Idempotent Score Overwrite:** Upon completion, `batchResults[questionId]` updates seamlessly with the newly earned score (e.g. 85), restoring candidate progress fairly.

---

## 2. Hands-Free Post-Verdict Continuity UX

To achieve 100% click-free interaction:

```
[Candidate Answers] 
         │
         ▼
[AI Delivers Verdict & Verbal Scorecard]
         │
         ▼
[AI asks: "Готов перейти к следующему вопросу?"]
         │
    ┌────┴─────────────────────────────┐
    │                                  │
[Candidate: "Да / Погнали"]    [Candidate: "Подожди / Пауза"]
    │                                  │
    ▼                                  ▼
[navigate_question(next)]      [Stays on Verdict Screen]
```

- In `VoiceModal.tsx`, the verdict screen maintains an active speech listener or a configurable 6-second auto-advance progress ring with a tactile "Отмена" button for candidates who want to pause.
- When the candidate speaks *"Дальше / Следующий"*, navigation triggers instantly without touching the screen.

---

## 3. Visual Navigation HUD & Indicators

- In `VoiceModalHeader.tsx` and `VoiceActiveView.tsx`:
  - When `isNavigating` is active, a sleek pastel lilac navigation pill appears:
    *"Переход: Вопрос 3 из 10..."*
  - The Question Explorer / StudyDeck in the background scrolls and highlights the active card in sync with voice navigation.

---

## 4. Gate 4 Verification Criteria

- [ ] Returning to a previously skipped question overrides the 0-score in `batchResults` upon new evaluation completion.
- [ ] Post-verdict verbal continuity allows advancing to next question via speech without mouse clicks.
- [ ] Visual navigation indicator renders smoothly during `STAGE_NAVIGATING`.
- [ ] Modified UI components remain strictly under 400 lines (Rule 8).
