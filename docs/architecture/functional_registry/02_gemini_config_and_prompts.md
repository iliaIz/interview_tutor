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
