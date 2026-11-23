# Spec 27: Architectural Deepening Wave 2 (Turn Engine, Audio DSP, Company Slice & Live Aggregate)

## 1. Intent & Workload Envelope
- **Context & Glossary**: Conforms strictly to [GLOSSARY.md](file:///home/djelu/projects/interview_tutor/GLOSSARY.md), [0003-omnipresent-ai-copilot-and-company-track-enrichment.md](file:///home/djelu/projects/interview_tutor/docs/adr/0003-omnipresent-ai-copilot-and-company-track-enrichment.md), and [0004-voice-dialogue-fast-handoff-and-cross-arena-copilot.md](file:///home/djelu/projects/interview_tutor/docs/adr/0004-voice-dialogue-fast-handoff-and-cross-arena-copilot.md).
- **Target Subsystems**:
  1. Cascaded Turn-based Audio/Text Evaluation (`backend/src/routes/interviewTurn.ts`).
  2. Podcast Generation & Audio DSP Pipeline (`backend/src/services/podcast.ts`).
  3. Company Prep State & Pipeline Telemetry (`frontend/src/components/companies/CompanyPrepStudio.tsx`, `frontend/src/store/slices/companySlice.ts`, `backend/src/routes/companies.ts`).
  4. Real-Time Voice Session Encapsulation (`backend/src/services/live/LiveSessionAggregate.ts`, `backend/src/services/live/liveSessionTypes.ts`).
- **Operating Envelope**:
  - P95 latency for greeting synthesis: < 1500ms.
  - P95 latency for cascaded turn evaluation: < 2200ms.
  - In-browser WAV stitching / Opus streaming: 0 dropped frames, memory bounded to active job buffer.
  - Tenancy: single-tenant user sessions with authenticated SQLite session persistence.
  - Cognitive Bounding SLA (Rule 8): All new files &le; 350 lines, all modified files &le; 400 lines.

---

## 2. Explicit Non-Goals (Blast-Radius Protection)
The implementation agent is **physically forbidden** from:
1. Modifying the WebSocket binary frame wire format between client AudioWorklet and backend router (`16kHz Mono PCM`).
2. Altering the database schema for `candidate_error_vectors`, `fsrs_card_states`, or `coding_submissions`.
3. Breaking backwards compatibility of existing HTTP endpoints:
   - `POST /api/interview/greeting`
   - `POST /api/interview/turn`
   - `GET /api/podcast/:jobId`
   - `POST /api/podcast/generate`
   - `GET /api/companies`
   - `GET /api/companies/:id/readiness`
4. Deleting any user-facing UI elements, accessibility labels, or ARIA tags in `CompanyPrepStudio.tsx` (UI Deletion Test Exception).

---

## 3. Pre-Agreed Verification Seams
- **Seam 1 (Turn Evaluation)**: `backend/src/services/interview/CascadedTurnEngine.ts` calling `LlmExecutionEngine.executeJson`, `CandidateMemoryAggregate`, and `DeepgramSTT`.
- **Seam 2 (Podcast Audio DSP)**: `backend/src/services/podcast/PodcastAudioPipeline.ts` (WAV stitching and Opus encoding) and `backend/src/services/podcast/PodcastJobManager.ts`.
- **Seam 3 (Company Prep State)**: `frontend/src/store/slices/companySlice.ts` via composite `useAppStore` and `backend/src/services/companies/CompanyReadinessRepository.ts`.
- **Seam 4 (Live Session Aggregate)**: `backend/src/services/live/LiveSessionAggregate.ts` encapsulating state transitions, watchdog resets, turn telemetry, and tool authorization.
- **Verification Protocol**: Strictly remote execution via `remote-verify` (GitHub Actions cloud runner). Zero heavy local builds on VPS.

---

## 4. Formal Wire & Messaging Contracts

### 4.1. Cascaded Turn Contract
```typescript
export interface TurnExecutionInput {
  sessionId?: string;
  questionId?: string;
  topic: string;
  questionText: string;
  referenceAnswer?: string;
  userTranscript?: string;
  audioBuffer?: Buffer;
  audioMimeType?: string;
  history?: Array<{ speaker: 'interviewer' | 'candidate'; text: string }>;
  voice?: string;
  userGender?: 'female' | 'male' | 'neutral';
  strategy?: 'socratic_tutoring' | 'adaptive_probing';
  persona?: string;
  targetGrade?: string;
  strictness?: 'standard' | 'lenient' | 'strict';
  userId?: string;
  abortSignal?: AbortSignal;
}

export interface TurnExecutionResult {
  action: 'probe' | 'evaluate';
  replyText: string;
  spokenText: string;
  audioBase64?: string;
  score?: number;
  isPassed?: boolean;
  feedback?: string;
  positivePoints?: string[];
  missingPoints?: string[];
  deductions?: Array<{ criterionId?: string; reason: string; penalty: number }>;
  faangScorecard?: any;
}
```

### 4.2. Podcast Job Wire Contract
```typescript
export interface PodcastJobState {
  id: string;
  status: 'pending' | 'scripting' | 'synthesizing' | 'stitching' | 'transcoding' | 'ready' | 'error';
  progressPct: number;
  currentStepMessage: string;
  audioUrl?: string;
  durationSeconds?: number;
  dialogue?: Array<{ speaker: 'Host' | 'Guest'; text: string }>;
  error?: string;
  createdAt: number;
  updatedAt: number;
}
```

### 4.3. Company Readiness Wire Contract
```typescript
export interface CompanyReadinessSummary {
  companyId: string;
  userId: string;
  totalScore: number; // 0..100
  breakdown: {
    theory: { completed: number; total: number; scorePct: number };
    codeReview: { completed: number; total: number; scorePct: number };
    machineCoding: { completed: number; total: number; scorePct: number };
    systemDesign: { completed: number; total: number; scorePct: number };
    sql: { completed: number; total: number; scorePct: number };
  };
  unlockedStages: string[];
}
```

---

## 5. Storage & Zero-Downtime Migration Contract
- **Strategy**: Additive-Only. No destructive migrations.
- **SQLite Tables**:
  - `podcast_jobs`: Additive schema check on initialization if not exists.
  - `company_question_mastery`: Read by `CompanyReadinessRepository`.
  - `coding_submissions`: Read by `CompanyReadinessRepository`.
- **Zustand Slices**:
  - `companySlice` added to `useAppStore` alongside existing slices (`academySlice`, `practiceSlice`, `questionsSlice`, `uiSlice`, `whiteboardSlice`).

---

## 6. Hoare-Logic Behavioral Contracts ({P} C {Q})

### 6.1. Cascaded Turn Evaluation
- **{P} (Pre-Condition)**: `questionText` is non-empty. Caller provides either text transcript or audio buffer.
- **C (Computation)**:
  1. If `audioBuffer` provided without transcript, decode via Deepgram STT.
  2. Assemble system prompt incorporating persona directives, anti-sycophancy, and Epistemic Triage.
  3. Execute JSON reasoning via `LlmExecutionEngine.executeJson`.
  4. If evaluation completed: record progress in `progressService` and update deficit vectors via `CandidateMemoryAggregate`.
  5. Synthesize spoken response via TTS with `getSafeSpokenText` word clamp (&le; 40 words).
- **{Q} (Post-Condition)**: Persisted progress record, valid audio base64, structured feedback returned without prompt injection leakage.

### 6.2. Live Session Turn 0 Lockdown
- **{P} (Pre-Condition)**: `LiveSessionAggregate.hasCandidateResponded === false`.
- **C (Computation)**: Tool execution requested for grading/evaluation (`submit_interview_evaluation`).
- **{Q} (Post-Condition)**: Aggregate rejects call with `ToolExecutionForbiddenError` ("Candidate has not spoken yet"). Turn state remains intact.

### 6.3. Company Readiness Calculation
- **{P} (Pre-Condition)**: Valid `companyId` and `userId`.
- **C (Computation)**:
  1. Aggregate completed theory questions from `company_question_mastery`.
  2. Aggregate passed submissions from `coding_submissions` matching company challenge slugs.
  3. Compute weighted readiness index $CRI = \sum w_i \times \min(1.0, \frac{\text{completed}_i}{\text{target}_i})$.
- **{Q} (Post-Condition)**: Deterministic score $CRI \in [0, 100]$ returned with category breakdown.
