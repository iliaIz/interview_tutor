# Spec 28: Architectural Deepening Wave 3 (Voice Tutor Session, Question Catalog Engine, Downstream Client Pipe & Prompt Director)

## 1. Intent & Workload Envelope
- **Context & Glossary**: Conforms strictly to [GLOSSARY.md](file:///home/djelu/projects/interview_tutor/GLOSSARY.md), [0003-omnipresent-ai-copilot-and-company-track-enrichment.md](file:///home/djelu/projects/interview_tutor/docs/adr/0003-omnipresent-ai-copilot-and-company-track-enrichment.md), and [0004-voice-dialogue-fast-handoff-and-cross-arena-copilot.md](file:///home/djelu/projects/interview_tutor/docs/adr/0004-voice-dialogue-fast-handoff-and-cross-arena-copilot.md).
- **Target Subsystems**:
  1. Voice Tutor Presentation & Headless State (`frontend/src/components/voice/VoiceTutorView.tsx`, `frontend/src/components/VoiceModal.tsx`, `frontend/src/audio/useVoiceTutorSession.ts`).
  2. Question Catalog Engine & Filter Pipeline (`frontend/src/components/QuestionExplorer.tsx`, `frontend/src/components/TopicSelector.tsx`, `frontend/src/services/QuestionCatalogEngine.ts`).
  3. Downstream Client WebSocket Pipe & Invariant Router (`backend/src/services/live/DownstreamClientPipe.ts`, `backend/src/services/live/liveWsClientFrameHandler.ts`, `backend/src/services/live/liveAudioStreamRouter.ts`).
  4. Live Prompt Director & Tool Declarations (`backend/src/services/live/LivePromptDirector.ts`, `backend/src/services/live/livePromptBuilder.ts`, `backend/src/services/live/liveToolDeclarations.ts`).
- **Operating Envelope**:
  - Live Audio Streaming latency: < 50ms per PCM chunk dispatch.
  - Question search & multi-select filtering: < 5ms for 800+ items in memory.
  - Cognitive Bounding SLA (Rule 8): All newly created files &le; 350 lines; all modified files &le; 400 lines.
  - Memory: Zero heap allocation regressions; AudioWorklet ring buffer capacity preserved.

---

## 2. Explicit Non-Goals (Blast-Radius Protection)
The implementation agent is **physically forbidden** from:
1. Modifying the WebSocket binary frame wire format between client AudioWorklet and backend router (`16kHz Mono PCM`).
2. Altering SQLite database schemas (`coding_challenges`, `fsrs_card_states`, `candidate_error_vectors`).
3. Deleting any user-facing UI elements, accessibility labels, or ARIA attributes in `VoiceTutorView.tsx` or `QuestionExplorer.tsx` (UI Deletion Test Exception).
4. Breaking backwards compatibility of existing HTTP endpoints:
   - `GET /api/topics/:id/questions`
   - `POST /api/topics/:id/questions`
   - `POST /api/interview/greeting`
   - `POST /api/interview/turn`
5. Disabling or bypassing Turn 0 Tool Lockdown or Google Live VAD Fast-Handoff invariants defined in `docs/architecture/specs/AUTO_VAD_LIVE_AUDIO_SPECIFICATION.md` and ADR 0004.

---

## 3. Pre-Agreed Verification Seams
- **Seam 1 (Voice Tutor Session)**: `frontend/src/audio/useVoiceTutorSession.ts` exposing `VoiceTutorSessionState` and actions (`switchQuestion`, `sendCustomText`, `toggleSessionPause`, `toggleMic`, `handleHotkeys`) to `VoiceTutorView.tsx`.
- **Seam 2 (Question Catalog Engine)**: `frontend/src/services/QuestionCatalogEngine.ts` exposing deterministic query and selection math (`filterQuestions`, `computeRangeSelection`, `buildVoiceBatch`) testable headlessly in 0ms.
- **Seam 3 (Downstream Client Pipe)**: `backend/src/services/live/DownstreamClientPipe.ts` encapsulating client frame validation, ping/pong heartbeats, barge-in parsing, EchoGuard audio slicing, and dispatching to `LiveSessionAggregate`.
- **Seam 4 (Live Prompt Director)**: `backend/src/services/live/LivePromptDirector.ts` assembling system directives, persona framing, and tool declarations with Turn 0 lockouts via `buildDirectives(config)`.
- **Verification Protocol**: Strictly remote execution via `remote-verify` (GitHub Actions cloud runner). Zero heavy local builds on VPS.

---

## 4. Formal Wire & Messaging Contracts

### 4.1. Voice Tutor Session Contract
```typescript
export interface VoiceTutorSessionConfig {
  activeTopic: string;
  activeQuestionNum: number;
  activeBatchIndex: number;
  totalQuestions: number;
  isBatchMode: boolean;
  activeQuestionText: string;
  activeReferenceAnswer?: string;
  onSwitchQuestion?: (newIndex: number) => void;
  onSwitchToInterview: () => void;
  onClose: () => void;
}

export interface VoiceTutorSessionState {
  tutorMode: 'deep_dive' | 'socratic' | 'eli5' | 'free_chat';
  setTutorMode: (mode: 'deep_dive' | 'socratic' | 'eli5' | 'free_chat') => void;
  inputText: string;
  setInputText: (text: string) => void;
  isSessionPaused: boolean;
  toggleSessionPause: () => void;
  handleSendCustomText: (text?: string) => void;
  handleInputKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  retryCurrentQuestionCleanly: () => void;
  textInputRef: React.RefObject<HTMLInputElement>;
}
```

### 4.2. Question Catalog Engine Contract
```typescript
export interface CatalogFilterOptions {
  searchQuery: string;
  statusFilter: 'all' | 'uncompleted' | 'completed' | 'mastered';
  evaluationsMap?: Record<string, { isMastered?: boolean; score?: number }>;
}

export interface QuestionCatalogEngine {
  filterQuestions<T extends { id: string; question: string; isCompleted?: boolean; isMastered?: boolean }>(
    questions: T[],
    options: CatalogFilterOptions
  ): T[];

  computeRangeSelection<T extends { id: string }>(
    filteredQuestions: T[],
    lastSelectedId: string | null,
    targetId: string,
    currentSelectedIds: Set<string>
  ): Set<string>;

  buildVoiceBatch<T extends { id: string }>(
    questions: T[],
    selectedIds: Set<string>
  ): { batch: T[]; startIndex: number };
}
```

### 4.3. Downstream Client Pipe Contract
```typescript
export interface DownstreamClientPipeOptions {
  session: ProxySession;
  clientSocket: WebSocket;
  turnMode: 'manual' | 'auto';
  onTerminate: (source: string, code?: number, reason?: Buffer) => void;
}

export interface DownstreamClientPipe {
  handleFrame(data: RawData): void;
  dispose(): void;
}
```

### 4.4. Live Prompt Director Contract
```typescript
export interface LivePromptDirectives {
  systemInstruction: string;
  tools: any[];
  generationConfig?: Record<string, any>;
}

export interface LivePromptDirector {
  buildDirectives(config: LiveSessionConfig): LivePromptDirectives;
}
```

---

## 5. Storage & Zero-Downtime Migration Contract
- **Database Schema**: No DDL changes required. Existing tables (`coding_challenges`, `fsrs_card_states`, `candidate_error_vectors`) remain immutable.
- **Rollout Strategy**: Additive-Only & In-Place Refactoring with full backwards compatibility for all existing WebSocket frames and HTTP endpoints.

---

## 6. Hoare-Logic Behavioral Contracts ({P} C {Q})

### 6.1. Voice Tutor Alt+Arrow Navigation
- **Pre-Condition {P}**: `isBatchMode === true` AND `0 <= activeBatchIndex < totalQuestions`.
- **Algorithm C**: User presses `Alt+ArrowRight` (or `Alt+ArrowLeft`). If `newIndex >= 0 && newIndex < totalQuestions`, `onSwitchQuestion(newIndex)` is called; speech session is cleanly reset without leaking orphaned audio worklets.
- **Post-Condition {Q}**: Active question index advances to `newIndex`; input buffer is cleared; focus is reset to current topic context.

### 6.2. Catalog Range Selection (Shift-Click)
- **Pre-Condition {P}**: User clicks question card with `e.shiftKey === true`, with a recorded `lastSelectedIndex`.
- **Algorithm C**: Identify slice indices between `lastSelectedIndex` and clicked item index in `filteredQuestions`. Add all question IDs in slice to `selectedIds`.
- **Post-Condition {Q}**: All questions in range are added to selection without mutating external question array; selection count matches slice length.

### 6.3. Downstream Client Barge-In Invariant
- **Pre-Condition {P}**: Client sends `{ type: 'barge_in' }` or `{ clientContent: { interrupted: true } }` during `AI_SPEAKING` or `AI_THINKING`.
- **Algorithm C**: `DownstreamClientPipe` dispatches barge-in to `LiveClientGuardService`, disarms watchdogs, transitions FSM to `CANDIDATE_LISTENING`, and drops downstream audio synthesis queues.
- **Post-Condition {Q}**: Downstream audio playout queue silenced in &le; 5ms; microphone input unblocked for candidate.
