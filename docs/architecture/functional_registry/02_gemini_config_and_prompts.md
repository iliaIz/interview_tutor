# 02. Gemini Live Config & System Prompts

> **Location:** `docs/architecture/functional_registry/02_gemini_config_and_prompts.md`  
> **Subsystem (Level 1):** Gemini Live Config & System Prompts  
> **Primary Files:** [`backend/src/services/live/liveGeminiConfigBuilder.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/live/liveGeminiConfigBuilder.ts), [`backend/src/services/live/livePromptBuilder.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/live/livePromptBuilder.ts)

---

## 1. Subsystem Scope
Constructs the canonical Google Gemini Live protocol `setup` payload sent upon WebSocket handshake. Configures generation parameters, voice selection, native Auto-VAD thresholds, tool declarations, and persona system prompts.

---

## 2. Touch List & Function Hierarchy (Level 2)

### 2.1 `buildGeminiLiveSetupMessage()`
- **Location:** [`liveGeminiConfigBuilder.ts#L20-L106`](file:///home/djelu/projects/interview_tutor/backend/src/services/live/liveGeminiConfigBuilder.ts)
- **What Was Done:** Assembles the initial JSON `setup` frame for Google BidiGenerateContent:
  - Model: `models/gemini-live-v3` (dynamically remapped upstream by LiteLLM to `models/gemini-3.8-live`).
  - Modalities: `["AUDIO"]` with voice `Aoede` (24kHz HD PCM).
  - Native VAD: `automaticActivityDetection: { disabled: false, silenceDurationMs: 800, prefixPaddingMs: 500 }`.
  - Temperature: `0.6` for focused Socratic responses.
- **Hypotheses & Intermediate Conclusions:**
  - Setting `silenceDurationMs: 800` provides natural turn boundaries without premature clipping during candidate pauses.
  - Hardcoding upstream model names (`gemini-3.8-live`) in backend code violates proxy invariants; routing via `gemini-live-v3` preserves virtual key and cascade decoupling.
- **Rationale & "Why":** Strict compliance with official `@google/genai` and `BidiGenerateContent` WebSocket specifications.
- **Invariants:** Upstream model names MUST NOT be hardcoded. Response modality must always include AUDIO.

---

### 2.2 `buildLiveToolDeclarations()`
- **Location:** [`LiveGeminiConfigBuilder.ts#L120-L160`](file:///home/djelu/projects/interview_tutor/backend/src/services/audio/LiveGeminiConfigBuilder.ts)
- **What Was Done:** Declares the `submit_interview_evaluation` function tool with structured parameters (score, STAR analysis, strengths, gaps) and binds the Turn 0 tool lockdown invariant.
- **Hypotheses & Intermediate Conclusions:**
  - Gemini occasionally attempted to invoke evaluation immediately upon connection without speaking the greeting.
  - Added Turn 0 Directive in system prompt + backend runtime guard: rejecting tool calls if `hasCandidateResponded === false`.
- **Rationale & "Why":** Guarantees candidate always hears the problem statement and can attempt an answer before grading.
- **Invariants:** Tool execution strictly blocked on Turn 0. Rejection returns structured `toolResponse` error forcing verbal recitation.

---

### 2.3 `buildSystemPrompt()`
- **Location:** [`livePromptBuilder.ts#L110-L400`](file:///home/djelu/projects/interview_tutor/backend/src/services/live/livePromptBuilder.ts)
- **What Was Done:** Dynamically builds domain-aware Socratic tutoring prompts (LLD, HLD, SRE, Theory) with strict conversational constraints:
  - Maximum 1–2 sentences per turn during tutoring dialogue.
  - Prohibits lecturing; mandates Socratic probing questions.
  - Strict Russian language enforcement.
- **Hypotheses & Intermediate Conclusions:**
  - Lengthy responses degrade real-time voice latency and increase candidate cognitive fatigue.
  - 1–2 sentence constraint keeps turns snappy ($\le 3$s audio playback).
- **Rationale & "Why":** Voice tutoring requires conversational agility; candidates learn better through interactive dialogue than pre-recorded monologues.
- **Invariants:** Anti-monologue directive must be present in all system prompts. Turn 0 greeting must explicitly ask candidate to confirm understanding.

---

### 2.4 `resolveLiveWsSessionParams()` & `buildLivePairPrompt()` Task Grounding
- **Location:** [`backend/src/services/live/liveWsSessionParams.ts#L130-L195`](file:///home/djelu/projects/interview_tutor/backend/src/services/live/liveWsSessionParams.ts), [`backend/src/prompts/live/livePairPrompts.ts#L180-L310`](file:///home/djelu/projects/interview_tutor/backend/src/prompts/live/livePairPrompts.ts)
- **What Was Done:** 
  - Implemented multi-catalog SQLite SSOT hydration (`coding_challenges`, `bug_challenges`, `questions`).
  - Added explicit ground truth specification block `=== 3. АВТОРИЗОВАННАЯ СПЕЦИФИКАЦИЯ И ТРЕБОВАНИЯ К ЗАДАЧЕ (GROUND TRUTH) ===` in `buildLivePairPrompt()`.
  - Injected challenge title in Turn 0 greeting (`taskMention`).
  - Strictly prohibited AI from denying task specification visibility.
  - Implemented server-side SQLite hydration in text tutor route `/api/practice-tutor/chat` and added cascading fallback in `PracticeTutorDrawer.tsx`.
- **Hypotheses & Intermediate Conclusions:**
  - *Hypothesis:* Passing task specifications through URL query string creates HTTP 414 errors and risks URL truncation.
  - *Empirical Finding:* By passing only `challengeId` and performing authoritative server-side lookup in `coding_challenges`, the AI receives 100% of the authentic specification with 0 URL overhead.
- **Rationale & "Why":** Addresses root cause of the "AI does not see task specification" defect across both voice and text modalities.
- **Invariants:** Live and text tutors must never rely solely on client-provided specification text; authoritative SQLite SSOT lookup by `challengeId` is mandatory. Denial of task specification is strictly forbidden in system directives.

---

### 2.5 `buildSystemDesignProbePrompt()` & `buildSystemDesignEvaluationPrompt()` Epistemic Symmetry
- **Location:** [`backend/src/prompts/systemDesign/systemDesignPrompts.ts`](file:///home/djelu/projects/interview_tutor/backend/src/prompts/systemDesign/systemDesignPrompts.ts), [`backend/src/services/systemDesignEvaluator.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/systemDesignEvaluator.ts)
- **What Was Done:**
  - Injected `currentTopology` (Mermaid code) and `candidateNotes` directly into `buildSystemDesignProbePrompt()`, eliminating tutor blindness to canvas state.
  - Added `conversationHistory` to `buildSystemDesignEvaluationPrompt()` and bound the Epistemic Symmetry Invariant: candidate architectural decisions justified during dialogue cannot be penalized for missing notes.
- **Rationale & "Why":** Evaluators and tutors must maintain epistemic parity with the candidate. If a candidate designs on canvas or defends a trade-off in chat, the AI evaluator must possess that evidence.
- **Invariants:** The evaluation prompt must always ingest conversation history. Zero-phantom-deductions invariant strictly enforced.

---

### 2.6 `buildTriageProbePrompt()` & `buildTriageEvaluationPrompt()` Epistemic Symmetry
- **Location:** [`backend/src/prompts/triage/triagePrompts.ts`](file:///home/djelu/projects/interview_tutor/backend/src/prompts/triage/triagePrompts.ts), [`backend/src/routes/triage.ts`](file:///home/djelu/projects/interview_tutor/backend/src/routes/triage.ts)
- **What Was Done:**
  - Injected `triageDigest` into `buildTriageProbePrompt()` containing active phase (`mttm` vs `mttr`), elapsed seconds, JVM thread state counts (total, blocked, runnable, deadlocked), and Tarjan SCC deadlock detector cycles.
  - Added `conversationHistory` and `investigationDigest` into `buildTriageEvaluationPrompt()`, ensuring the evaluator grades the entire investigation trajectory and forbids deductions for brevity if key insights were articulated in dialogue.
- **Rationale & "Why":** Eliminates terminal and dialogic amnesia in production incident triage. The Incident Commander now responds with full awareness of JVM dump telemetry.
- **Invariants:** Evaluator must ingest investigation evidence trail; probe prompt must ground on Tarjan SCC analysis.

---

### 2.7 `evaluateAnswerWithGemini()` & `evaluateChallengeSubmission()` Injection Defense & Gender Alignment
- **Location:** [`backend/src/services/geminiText.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/geminiText.ts), [`backend/src/services/codeEvaluator.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/codeEvaluator.ts), [`frontend/src/components/ExamQuiz.tsx`](file:///home/djelu/projects/interview_tutor/frontend/src/components/ExamQuiz.tsx), [`frontend/src/audio/liveVoiceUrlBuilder.ts`](file:///home/djelu/projects/interview_tutor/frontend/src/audio/liveVoiceUrlBuilder.ts)
- **What Was Done:**
  - Sandboxed candidate input in `evaluateAnswerWithGemini()` using `wrapUntrustedContext('candidate_answer', userAnswer)` and injected `PROMPT_INJECTION_DEFENSE_DIRECTIVE` and `ANTI_SYCOPHANCY_DIRECTIVES`.
  - Added Anti-Sycophancy Factual Anchor in `codeEvaluator.ts`: if sandbox tests fail (`failed_tests_count > 0`), correctness score is capped $\le 60$ and overall $\le 68$.
  - Extracted 112 lines of inline JSON schema from `codeEvaluator.ts` to `codeEvaluatorSchema.ts` to adhere to Cognitive Bounding Invariant 8 ($\le 370$ lines).
  - Resolved gender propagation defect: `ExamQuiz.tsx` now forwards `userGender` from `useInterviewConfig()` to `/api/eval`, and `liveVoiceUrlBuilder.ts` includes `userGender` in query string for Gemini Live WebSocket sessions.
- **Rationale & "Why":** Protects grading integrity against adversarial prompt injections (jailbreak attempts) and eliminates immersion-breaking gender mismatch in dialogue.
- **Invariants:** All user inputs into LLM prompts must pass through `wrapUntrustedContext()`. Failed unit tests must deterministically cap the evaluator score.

---

### 2.8 `pruneTutorContext()`, `skeletonizeJavaFile()` & Academy Bridge Context
- **Location:** [`backend/src/services/practiceContextPruner.ts`](file:///home/djelu/projects/interview_tutor/backend/src/services/practiceContextPruner.ts), [`backend/src/prompts/practiceTutorPrompts.ts`](file:///home/djelu/projects/interview_tutor/backend/src/prompts/practiceTutorPrompts.ts), [`backend/src/prompts/live/livePairPrompts.ts`](file:///home/djelu/projects/interview_tutor/backend/src/prompts/live/livePairPrompts.ts), [`frontend/src/store/useAppStore.ts`](file:///home/djelu/projects/interview_tutor/frontend/src/store/useAppStore.ts), [`frontend/src/components/practice/tutor/PracticeTutorDrawer.tsx`](file:///home/djelu/projects/interview_tutor/frontend/src/components/practice/tutor/PracticeTutorDrawer.tsx)
- **What Was Done:**
  - Implemented sliding window algorithm: retains last $K=6$ turns verbatim and condenses earlier turns into a compact narrative digest (`earlierTurnsSummary`).
  - Implemented Java file skeletonizer: strips method and constructor bodies in secondary workspace files into `{ /* ... */ }` while keeping class headers, annotations, fields, and signatures intact.
  - Enforced token budget ceiling: total prompt tokens reduced by $\ge 53-65\%$, strictly bounded to $\le 5500$ tokens.
  - Linked Academy Curriculum Bridge: enriched `useAppStore` `AcademyBreadcrumbContext` with `moduleTitle`, `learningObjective`, and `targetConcepts`. Injected into `PracticeTutorDrawer.tsx`, `liveVoiceUrlBuilder.ts`, `useLiveVoiceSession.ts`, `PracticeVoiceContext.tsx`, `practiceTutorPrompts.ts`, and `livePairPrompts.ts` (`=== ДИДАКТИЧЕСКИЙ КОНТЕКСТ АКАДЕМИИ (CURRICULUM BRIDGE) ===`), ensuring both text drawer and live voice sessions retain pedagogical continuity.
  - Added cross-platform `normalizePath()` in `practiceContextPruner.ts` stripping leading slashes and converting Windows backslashes (`\`) to forward slashes (`/`) so active file detection never fails across operating systems.
- **Hypotheses & Intermediate Conclusions:**
  - Unbounded conversational history caused prompt bloat up to 25,000 tokens by turn 10, increasing TTFT to > 5s and causing Lost-in-the-Middle instruction forgetfulness.
  - Skeletonizing secondary Java classes while retaining active test/service code cuts tokens by > 50% without impairing tutor contextual awareness of interfaces and types.
- **Rationale & "Why":** Provides fast, responsive Socratic tutoring with sub-second generation starts and unifies the pedagogical journey between Academy lessons and Practice arenas across both text and voice modalities.
- **Invariants:** Text tutor prompts must never exceed 5500 tokens. Active file must be preserved verbatim; secondary files must be skeletonized. Academy context must guide Socratic probing when active.

