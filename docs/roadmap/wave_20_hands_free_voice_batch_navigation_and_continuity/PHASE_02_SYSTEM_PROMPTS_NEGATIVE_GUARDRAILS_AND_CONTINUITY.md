# Phase 2: System Prompts Negative Guardrails & Dialogue Continuity
## SOTA Late-2026 Semantic Intent Disambiguation

> **Document:** `docs/roadmap/wave_20_hands_free_voice_batch_navigation_and_continuity/PHASE_02_SYSTEM_PROMPTS_NEGATIVE_GUARDRAILS_AND_CONTINUITY.md`  
> **Status:** Draft / Pending User Approval  
> **Target Subsystem:** `backend/src/services/live/livePromptBuilder.ts`, `backend/src/scripts/verifyPrompts.ts`  

---

## 1. Intent Collision Problem & First-Principles Solution

In verbal technical assessments, candidates constantly use navigation vocabulary when explaining algorithms:
- *"На **следующем** шаге мы берем элемент из очереди..."*
- *"Если валидация упала, мы **пропускаем** этот блок..."*
- *"Давай вернемся **назад** к тому, как работает CAS в AtomicInteger..."*

If Gemini Live triggers tools based solely on superficial semantic vector proximity, it commits an **accidental skip**, failing the candidate mid-sentence.

### The Negative Guardrail Directive
In `livePromptBuilder.ts`, all batch prompt builders (`buildInterviewSystemPrompt`, `buildTutorSystemPrompt`, `buildExplorerPrompt`) receive an immutable semantic contract:

```markdown
=== СТРОГИЕ ПРАВИЛА ВЫЗОВА ИНСТРУМЕНТА НАВИГАЦИИ (navigate_question) ===
1. Инструмент \`navigate_question\` вызывается ИСКЛЮЧИТЕЛЬНО тогда, когда кандидат обращается ПРЯМО К ТЕБЕ (как к экзаменатору/тьютору) с явным требованием переключить вопрос темы:
   - «Перейди к следующему вопросу» / «Давай дальше»
   - «Пропусти этот вопрос, я его не знаю» / «Скипни»
   - «Вернись на один назад» / «Перейди к вопросу номер 2»
2. КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО вызывать \`navigate_question\`, если слова «следующий», «пропустим», «назад», «дальше» звучат в контексте:
   - Шагов алгоритма или выполнения кода («на следующем шаге цикла...»);
   - Пропуска проверок или условий («пропустим null-check...»);
   - Возврата к техническому аргументу («вернемся назад к volatile...»).
3. При сомнении — продолжай слушать кандидата и НЕ прерывай его ответ вызовом инструмента навигации!
```

---

## 2. Verbal Transition Protocols by Mode

### A. Mock Interview Mode (`sessionType === 'interview'`)

1. **Mid-Question Skip:**
   - Candidate: *"Слушай, я не помню детали JMM, давай скипнем."*
   - AI Interviewer:
     1. Вызывает `navigate_question(direction: 'next', action: 'skip_unanswered', candidateReason: 'Не знает тему JMM')`.
     2. Озвучивает спокойную, естественную фразу перехода:
        *"Понял, фиксирую пропуск вопроса без ответа. Переходим к следующему вопросу темы."*
2. **Post-Verdict Hands-Free Continuity:**
   - После оглашения вердикта и баллов:
     - AI: *"Итоговый балл: 85 из 100. Ты отлично раскрыл synchronized, но упустил volatile. Готов идти к следующему вопросу?"*
     - Candidate: *"Да, давай."*
     - AI: Вызывает `navigate_question(direction: 'next', action: 'proceed_next')` и говорит: *"Отлично, следующий вопрос..."*.

### B. Socratic Tutor Mode (`sessionType === 'tutor'`)

- Candidate: *"Я всё понял про Spring Proxy, давай дальше."*
- AI Tutor:
  1. Вызывает `navigate_question(direction: 'next', action: 'proceed_next')`.
  2. Озвучивает: *"Супер, материал усвоен! Двигаемся к следующей концепции темы..."*.

---

## 3. Gate 2 Verification Criteria

- [ ] `verifyPrompts.ts` suite validates that `navigate_question` rules are present across all generated system prompts.
- [ ] Invariant test verifies negative algorithmic guardrail text exists in `livePromptBuilder.ts`.
- [ ] Semantic test asserts that simulated user prompt *"На следующем шаге мы вызываем notifyAll"* does not contain tool triggers in mocked evaluator.
- [ ] Line length of `livePromptBuilder.ts` decomposes sub-builders if exceeding 400 lines (Rule 8).
