# SPEC-13: Gemini 3.8 Live Fast-Handoff Protocol & Omnipresent Copilot Cross-Arena Context

> **Status:** APPROVED  
> **Author:** Antigravity AI (Pair Programming)  
> **Governing Standards:** [GLOSSARY.md](../../../GLOSSARY.md), [ADR-0003](../../adr/0003-omnipresent-ai-copilot-and-company-track-enrichment.md), [ADR-0004](../../adr/0004-voice-dialogue-fast-handoff-and-cross-arena-copilot.md), [SPEC-10](10_COMPANY_TARGETED_PREPARATION_AND_SQL_ARENA.md), [SPEC-11](11_OMNIPRESENT_AI_COPILOT_ARCHITECTURE.md), [SPEC-12](12_COMPANY_PREP_STUDIO_DEEPENING_AND_ARENA_NAVIGATOR.md)  
> **Target Subsystems:** Live WebSocket Transport, Polymorphic AI Copilot, ArenaNavigator, Company Track Dossier, System Design Runtime Forensics  

---

## 1. Intent & Workload Envelope

### 1.1. Context & Business Intent
During technical assessment in the Raiffeisen DGTL Product Engineer track, 6 critical failure points were identified across multimodal voice and multi-arena execution:
1. **Live Audio Hang & 1007 WebSocket Crash (Stage 1 & 6):** Google Gemini 3.8 Live API abruptly terminated WebSocket connections with error 1007 on candidate barge-in due to illegal payload injection (`realtimeInput.interruption: true`), while candidate speech cessation hung indefinitely because `audioStreamEnd` was suppressed at the backend router.
2. **Missing Stage 1 Candidate Grounding (Stage 1):** Candidates entered the live voice interview cold with zero structured briefing, cheat sheets, or key fin-tech invariant references (TTM, Pain Index, zero-floating-point, DB deadlocks), and the AI lacked explicit grounding on these pre-agreed topics.
3. **Blank Workspace on Live Coding Navigation (Stage 2):** Navigating to `iban-validator` displayed a blank workspace because `arenaNavigator.ts` passed the raw API envelope `{ challenge: manifest, savedDraft }` directly to `openPracticeChallenge` instead of unwrapping the inner challenge manifest.
4. **Missing Refactoring Kata Ingestion & Uncurated Practice Catalog (Stage 3):** Navigating to `case_transfer_service` fell back to an uncurated "All Tasks" catalog with 404 because `json/refactoring_challenges.json` was never seeded into the SQLite database.
5. **Voice Provider Isolation & Drawer Close Truncation (Stage 4 & 6):** Switching Copilot to voice outside `PracticeArena.tsx` crashed with "Голосовой режим временно недоступен" because `PracticeVoiceProvider` was only wrapped inside `PracticeArena`, and the drawer close button `<X />` was pushed out of the viewport on 420px mobile drawers due to missing `min-w-0` and `shrink-0` flex styling.
6. **Isolated System Design Copilot & Runtime Studio False-Positive (Stage 5):** System Design lacked dynamic context streaming into the omnipresent Copilot; Studio 1 Runtime falsely claimed "Дефект устранён" immediately upon mount because `checkIsFixed` tested `!currentCode.includes(fadedBug.bug_pattern)` against a symbolic enum key.

This specification provides the contract-first, artifact-driven architecture to resolve all 6 root causes without technical debt, crutches, or context window overflow.

### 1.2. Operating Envelope
- **Voice Response Latency (TTFA):** $\le 1200$ms time-to-first-audio chunk from upstream Gemini Live.
- **WebSocket Protocol Fidelity:** 100% adherence to Google Gemini Live bidirectional WebSocket spec; 0 occurrences of code 1007.
- **Dynamic Context Budget:** Token-budgeted CDATA manifest capped at $\le 15,000$ tokens per context sync.
- **Navigation Hydration Latency:** Client-side store hydration $\le 30$ms (p99).
- **Host Resource Footprint:** 0 MB additional RAM overhead on VPS (all audio and LLM routing through `LiteLLM_Proxy`).
- **Data Sensitivity:** Internal technical assessment; 0 PII / 0 PCI persisted.

---

## 2. Explicit Non-Goals (Blast-Radius Protection)

To preserve architectural boundaries and adhere to Rule 8 (Cognitive Bounding $\le 350$ lines), the implementation is **strictly forbidden** from touching:
1. **AudioWorklet DSP Core:** `frontend/src/audio/workletCode.ts`, `AudioPlayoutManager.ts`, or ring-buffer math (only `NativeLiveVoiceEngine` FSM hooks are touched).
2. **PGlite WASM Execution Engine:** `frontend/src/services/sql/pgliteExecutionEngine.ts` and `tableDiffEvaluator.ts`.
3. **Database Schema DDL:** Changing SQLite table structures in `backend/src/services/dbSchema.ts` (only additive data insertion in `dbSeedCatalogs.ts`).
4. **LiteLLM Proxy Core:** `LiteLLM_Proxy/` internal gateway python services (all protocol normalization is handled cleanly at the backend BFF router seam).
5. **Sandboxed JVM Runners:** `backend/src/services/sandbox/` Docker containers or mutation testing workers.

---

## 3. Pre-Agreed Verification Seams

### 3.1. Primary Verification Seams
1. **Live Protocol Seam (`backend/src/services/live/liveWsClientFrameHandler.ts`):**
   - Headless unit test verifying zero dispatch of `interruption: true` under `realtimeInput` and deterministic forwarding of `realtimeInput.audioStreamEnd`.
2. **Arena Navigation Hydration Seam (`frontend/src/services/arenaNavigator.ts`):**
   - Unit test verifying envelope unwrapping (`data.challenge || data`, `data.savedDraft`), asserting non-empty `canonicalFiles`.
3. **SQLite Seed Ingestion Seam (`backend/src/services/dbSeedCatalogs.ts`):**
   - In-memory SQLite test verifying that `refactoring_challenges.json` records (`case_transfer_service`, `case_account_collections`) are successfully upserted into `coding_challenges`.
4. **Runtime Forensics Seam (`frontend/src/components/system_design/studio_1_runtime/ForensicCodeEditor.tsx`):**
   - Unit test asserting that `isBugFixed` is strictly `false` on initial mount when code equals `defaultFile.content`, and becomes `true` only upon valid invariant resolution.
5. **Full Cloud Verification Seam:**
   - Command: `remote-verify` (GitHub Actions CI/CD runner executing `npx tsc --noEmit` and build verification).

---

## 4. Formal Wire & Messaging Contracts

### 4.1. Gemini Live Bidirectional WebSocket Contract

#### 4.1.1. Client -> Gateway Frame (Speech Cessation Fast-Handoff)
```json
{
  "realtimeInput": {
    "audioStreamEnd": true
  }
}
```

#### 4.1.2. Client -> Gateway Frame (Tactile / Acoustic Barge-In)
```json
{
  "type": "barge_in",
  "bargeIn": true,
  "bargeInType": "tactile",
  "source": "tactile",
  "epoch": 1794220061584
}
```
*Contract Rule:* Gateway MUST NOT send `{ realtimeInput: { interruption: true } }` upstream to Google. Upstream Gemini Live automatically detects barge-in acoustically from incoming audio chunks and emits `serverContent.interrupted: true` downstream.

#### 4.1.3. Setup Frame Invariant
```json
{
  "setup": {
    "model": "models/gemini-live-v3",
    "generationConfig": {
      "responseModalities": ["AUDIO"],
      "temperature": 1.0
    },
    "realtimeInputConfig": {
      "automaticActivityDetection": {
        "disabled": false,
        "silenceDurationMs": 500,
        "prefixPaddingMs": 200,
        "startOfSpeechSensitivity": "START_SENSITIVITY_LOW",
        "endOfSpeechSensitivity": "END_SENSITIVITY_LOW"
      },
      "activityHandling": "START_OF_ACTIVITY_INTERRUPTS"
    }
  }
}
```

---

### 4.2. Polymorphic Dynamic Context Ingestion Contract

#### 4.2.1. System Design Context Normalizer (`normalizeSystemDesignContext`)
```typescript
// shared/src/schemas/tutorNormalizer.ts

export interface SystemDesignSpokePayload {
  scenarioId: string;
  scenarioTitle: string;
  targetLevel: string;
  activeStudioTab: 'spec' | 'math_coach' | 'architecture' | 'staff_ai';
  activeCodeSnippet?: string;
  activeFilePath?: string;
  fadedBug?: {
    lineNumber: number;
    description: string;
    bugPattern: string;
  };
  topologySummary?: string;
  capacityMathSummary?: string;
  companyContextName?: string;
}

export function normalizeSystemDesignContext(payload: SystemDesignSpokePayload): TutorActiveContext {
  const quickActionChips: TutorQuickActionChip[] = [
    {
      id: 'hld_tradeoffs',
      label: '⚖️ Архитектурные компромиссы',
      promptMessage: 'Какие фундаментальные компромиссы (CAP, консистентность, задержка vs пропускная способность) критичны для этого сценария?'
    },
    {
      id: 'hld_bottlenecks',
      label: '🚨 Узкие места и точки отказа',
      promptMessage: 'Где в текущей архитектуре находятся потенциальные Single Point of Failure (SPOF) и ботлнеки масштабирования?'
    },
    {
      id: 'hld_runtime_bug',
      label: '🐛 Поиск рантайм-дефекта',
      promptMessage: 'Дай Socratic-подсказку на дефект в Студии 1 (Runtime), не раскрывая готовый код исправления.'
    },
    {
      id: 'hld_math_verify',
      label: '🔢 Верификация расчетов RPS/Storage',
      promptMessage: 'Помоги проверить порядок величин для объема хранилища и сетевой полосы (Capacity Planning).'
    }
  ];

  return {
    arena: 'system_design',
    entityId: payload.scenarioId,
    entityTitle: payload.scenarioTitle,
    domain: 'Distributed System Design & High-Load Architecture',
    persona: 'faang_interviewer',
    assistanceLevel: 3,
    activeFilePath: payload.activeFilePath || 'src/main/java/Service.java',
    activeCodeOrQuery: payload.activeCodeSnippet,
    instructions: `[АКТИВНАЯ ВКЛАДКА]: ${payload.activeStudioTab.toUpperCase()}\n` +
      (payload.fadedBug ? `[ДЕФЕКТ СТУДИИ 1]: Строка ${payload.fadedBug.lineNumber} — ${payload.fadedBug.description}\n` : '') +
      (payload.capacityMathSummary ? `[РАСЧЕТЫ CAPACITY]: ${payload.capacityMathSummary}\n` : '') +
      (payload.topologySummary ? `[ТОПОЛОГИЯ УЗЛОВ]: ${payload.topologySummary}\n` : ''),
    companyContext: payload.companyContextName
      ? {
          companyId: 'company_hld_context',
          companyName: payload.companyContextName,
          stageTitle: payload.scenarioTitle
        }
      : undefined,
    quickActionChips
  };
}
```

---

### 4.3. Stage 1 Pre-Flight Briefing & Cheat-Sheet Schema

```typescript
// shared/src/schemas/companyProfile.ts (Additive extension to Stage 1)

export interface StagePreFlightBriefing {
  roleTitle: string; // e.g. "Product Engineer (DGTL / FinTech)"
  coreCompetencies: string[]; // 9 Product Engineer competencies
  keyMetrics: {
    name: string; // e.g. "TTM (Time to Market)"
    targetValue: string; // e.g. "-35% through Shift-Left Testing"
    description: string;
  }[];
  starScenariosOutline: {
    caseTitle: string; // e.g. "Просадка конверсии на 12% при внедрении антифрода"
    situation: string;
    task: string;
    action: string;
    result: string;
  }[];
  bankingInvariantsCribSheet: string[];
}
```

---

## 5. Storage & Zero-Downtime Migration Contract

### 5.1. Refactoring Kata Catalog Ingestion (`backend/src/services/dbSeedCatalogs.ts`)
- **Strategy:** Additive upsert (`INSERT INTO coding_challenges ... ON CONFLICT(id) DO UPDATE`).
- **Data Source:** `json/refactoring_challenges.json` (24 enterprise katas).
- **Execution:** Runs deterministically during server startup in `seedNextGenCatalogs(db)`.
- **Target Ingested Records:**
  - `case_transfer_service`: TransferService 7 defects (Deadlock, Lost Update, Fail-Fast, Idempotency, rollbackFor, dirty checking, validation).
  - `case_account_collections`: Account.java (TreeMap Date millisecond collision, BigDecimal prohibition on double).
  - `case_spring_aop_postconstruct`: Spring AOP proxy self-invocation bypass.
  - `case_blocking_queue_leak`: Concurrency lock starvation and thread leak.

```sql
-- Deterministic Additive Upsert in dbSeedCatalogs.ts
INSERT INTO coding_challenges (
  id, slug, title, category, track, badge, difficulty, target_stack,
  time_limit_minutes, short_description, instructions_markdown, manifest_json, updated_at
) VALUES (
  @id, @slug, @title, @category, @track, @badge, @difficulty, @target_stack,
  @time_limit_minutes, @short_description, @instructions_markdown, @manifest_json, CURRENT_TIMESTAMP
)
ON CONFLICT(id) DO UPDATE SET
  slug = excluded.slug,
  title = excluded.title,
  category = excluded.category,
  track = excluded.track,
  badge = excluded.badge,
  difficulty = excluded.difficulty,
  target_stack = excluded.target_stack,
  time_limit_minutes = excluded.time_limit_minutes,
  short_description = excluded.short_description,
  instructions_markdown = excluded.instructions_markdown,
  manifest_json = excluded.manifest_json,
  updated_at = CURRENT_TIMESTAMP;
```

---

## 6. Hoare-Logic Behavioral Contracts ({P} C {Q})

### 6.1. Turn Endpointing Fast-Handoff ({P} C {Q})
- **Pre-Conditions {P}:**
  - Session is in state `CANDIDATE_SPEAKING` or `CANDIDATE_LISTENING`.
  - Mic silence duration $\ge 400$ms detected by client VAD, or user triggered turn commit.
- **Algorithm C:**
  1. Client sends `{ realtimeInput: { audioStreamEnd: true } }`.
  2. Router receives frame, records `session.hasCandidateResponded = true`.
  3. Router forwards `{ realtimeInput: { audioStreamEnd: true } }` verbatim to `geminiSocket`.
  4. Router arms two-phase watchdog (nudge at 5.0s, recovery at 22.0s).
- **Post-Conditions {Q}:**
  - Upstream Gemini Live triggers vocoder generation immediately without infinite audio buffering.
  - Client transitions cleanly to `AI_THINKING` state.
- **Orthogonal Invariants:**
  - Zero `1007` frame payload errors.
  - Zero dropped frames while candidate is actively vocalizing.

---

### 6.2. ArenaNavigator Envelope Pre-Hydration ({P} C {Q})
- **Pre-Conditions {P}:**
  - Caller invokes `launchArenaTask({ arena: 'practice', entityId: 'iban-validator' })`.
- **Algorithm C:**
  1. `fetch('/api/practice/challenges/iban-validator')` returns JSON payload.
  2. Navigator normalizes envelope:
     ```typescript
     const manifest = data.challenge || data;
     const draft = data.savedDraft;
     ```
  3. Invokes `store.openPracticeChallenge(manifest, draft)`.
  4. Calls `store.setStudioTab('practice')`.
- **Post-Conditions {Q}:**
  - `activePracticeChallenge` is populated with `workspaceFiles` ($\ge 1$ files).
  - Practice code editor renders file tree and syntax-highlighted code; blank canvas is impossible.

---

### 6.3. Studio 1 Runtime Defect Verification Invariant ({P} C {Q})
- **Pre-Conditions {P}:**
  - `ForensicCodeEditor` mounts with `files` containing initial buggy code `defaultFile.content`.
  - Scenario manifest contains `faded_bug` with `bug_pattern: "GREEDY_FALLACY_AND_NON_ATOMIC_HARDWARE"`.
- **Algorithm C:**
  1. If `currentCode.trim() === defaultFile.content.trim()` $\rightarrow$ return `isBugFixed = false`.
  2. If candidate has not modified the code $\rightarrow$ return `isBugFixed = false`.
  3. If candidate modifies code, verify elimination of the targeted anti-pattern (e.g. absence of single-phase dispense or presence of compensating transaction logic) and compliance with `astRuleInvariants`.
- **Post-Conditions {Q}:**
  - Upon initial load, `isBugFixed` is strictly `false`.
  - Banner displays warning: `Дефект в строке 15 [GREEDY_FALLACY_AND_NON_ATOMIC_HARDWARE]`.
  - "Дефект устранён" banner renders ONLY after genuine candidate refactoring.

---

### 6.4. Drawer Header Flex Layout Invariant ({P} C {Q})
- **Pre-Conditions {P}:**
  - `PracticeTutorDrawer` renders inside viewport with width $\le 420$px.
  - `activeContext.entityTitle` contains a long string (e.g. 50+ chars).
- **Algorithm C:**
  1. Left title container applies `min-w-0 flex-1 truncate`.
  2. Right button container applies `shrink-0 flex items-center gap-1.5`.
  3. Close button `<button onClick={() => toggleOpen(false)}>` applies `shrink-0 w-7 h-7`.
- **Post-Conditions {Q}:**
  - Close button `<X />` is permanently visible and clickable at the right edge without horizontal scroll or clipping.
