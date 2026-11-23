# Spec 29: Architectural Deepening Wave 4 (Company Multimodal Prep, Topic Progression Engine, Dual-Mode Quiz Session, Executive Report Studio)

## 1. Intent & Workload Envelope
- **Context & Glossary**:
  - `GLOSSARY.md` (Dual-Sided Handshake, Tactile Barge-In, Non-Speech Sanitization, Anti-Lapping Ring Buffer).
  - `docs/adr/0003-omnipresent-ai-copilot-and-company-track-enrichment.md` (Hub-and-spoke polymorphic copilot context).
  - `docs/adr/0004-voice-dialogue-fast-handoff-and-cross-arena-copilot.md` (Bidirectional Gemini Live modal integration).
  - `docs/architecture/specs/AUTO_VAD_LIVE_AUDIO_SPECIFICATION.md` (Turn 0 tool lockdown, Zero-Auto-Send Invariant).
- **Operating Envelope**:
  - Target UI latency: 60 FPS transitions (<16ms frame budget), 0ms state recalculation for filters/slices.
  - Voice handoff latency: <150ms connection handshake with LiteLLM proxy.
  - Tenancy Isolation: Single-user interactive browser context backed by SQLite persistence.
  - Data Classification: Local study metrics and interview evaluation logs (Tier: Internal / Practice).

## 2. Explicit Non-Goals (Blast-Radius Protection)
The implementation agent is **strictly forbidden from modifying**:
- Database schema and migrations (`backend/src/services/dbSchema.ts`, `backend/migrations/`).
- Upstream LiteLLM Proxy contracts (`ws://host.docker.internal:4000/ws/live`, REST endpoints).
- AudioWorklet audio processing ring buffers (`frontend/public/audio/live-audio-processor.js`).
- AST verification analyzers (`backend/src/services/astAnalyzer.ts`).
- Backend DownstreamClientPipe and LivePromptDirector (`backend/src/services/live/DownstreamClientPipe.ts`, `backend/src/services/live/LivePromptDirector.ts`).

## 3. Pre-Agreed Verification Seams
- **Seam 1 (Company Prep Slice)**: `frontend/src/services/companies/CompanyTrackContextAdapter.ts` and `frontend/src/components/companies/CompanyTheoryDeckTab.tsx`.
- **Seam 2 (Topic Progression Slice)**: `frontend/src/services/topics/TopicCatalogEngine.ts` and `frontend/src/components/TopicSelector.tsx`.
- **Seam 3 (Quiz Session Slice)**: `frontend/src/services/quiz/QuizSessionEngine.ts` and `frontend/src/components/ExamQuiz.tsx`.
- **Seam 4 (Executive Report Slice)**: `frontend/src/services/reports/ExecutiveReportPresenter.ts` and `frontend/src/components/InterviewReportModal.tsx`.
- **Cloud Verification**: Remote CI pipeline via `remote-verify` (Quality Gate & Invariant Tests).

## 4. Formal Wire & Messaging Contracts

### 4.1. CompanyTrackContextAdapter Contract
```typescript
export interface CompanyTrackContextAdapter {
  createCopilotContext(
    company: CompanyProfile,
    question?: CompanyQuestion,
    stageTitle?: string
  ): TutorActiveContext;

  createVoiceSessionProps(
    company: CompanyProfile,
    question: CompanyQuestion,
    mode: 'tutor' | 'interview'
  ): {
    topic: string;
    currentQuestionText: string;
    referenceAnswer: string;
    initialSessionType: 'tutor' | 'interview';
    initialTutorMode?: TutorMode;
    customPromptOverride: string;
  };
}
```

### 4.2. TopicCatalogEngine Contract
```typescript
export interface TopicCatalogEngine {
  prepareBlitzBatch(
    questions: Question[],
    completedIds: Set<string>,
    options?: { shuffle?: boolean; resetProgress?: boolean }
  ): Question[];

  computeDomainSummaries(
    topics: Topic[],
    progressMap: Record<string, { completedCount: number; totalCount: number }>
  ): DomainGroupSummary[];
}
```

### 4.3. QuizSessionEngine Contract
```typescript
export interface QuizSessionEngineState {
  currentQuestion: Question;
  currentIndex: number;
  totalQuestions: number;
  resultsHistory: Record<string, EvalRecord>;
  isCompleted: boolean;
  scorecard: QuizScorecardData | null;
}

export interface QuizSessionEngine {
  reconcileTextEvaluation(
    state: QuizSessionEngineState,
    question: Question,
    userAnswer: string,
    evalResult: any
  ): { nextState: QuizSessionEngineState; isPassed: boolean };

  reconcileVoiceEvaluation(
    state: QuizSessionEngineState,
    question: Question,
    voiceEvalData: any
  ): { nextState: QuizSessionEngineState; isPassed: boolean };
}
```

### 4.4. ExecutiveReportPresenter Contract
```typescript
export interface ExecutiveReportViewModel {
  header: { topic: string; mode: 'voice' | 'text'; formattedDate: string };
  scoreBadge: { score: number; isPassed: boolean; label: string; dashOffset: number };
  acousticProfile: HumanizedAcousticProfile | null;
  dialogueHistory: DialogueTurnDTO[];
  deepgramTranscript?: string;
  feedbackSections: { mentorPraise: string; positivePoints: string[]; missingPoints: string[] };
}

export interface ExecutiveReportPresenter {
  createViewModel(reportData: InterviewReportData): ExecutiveReportViewModel;
}
```

## 5. Storage & Zero-Downtime Migration Contract
- **Additive In-Memory Adapters**: All proposed changes operate at the TypeScript domain and presentation seams in the frontend workspace.
- **Storage Compatibility**: Uses existing REST endpoints (`/api/companies/:id/questions/:qid/mastery`, `/api/topics/:id/progress`) and localStorage keys with 100% backward compatibility.
- **Rule 8 File Hygiene**: All new files $\le 350$ lines, all modified files $\le 400$ lines.

## 6. Hoare-Logic Behavioral Contracts ({P} C {Q})

### 6.1. Zero-Auto-Send Invariant for Company Copilot
- **Pre-Conditions {P}**: User clicks "Спросить Тьютора" on question $Q$ in `CompanyTheoryDeckTab`.
- **Algorithm C**:
  1. Call `CompanyTrackContextAdapter.createCopilotContext(company, Q)`.
  2. Set active context in `usePracticeTutorStore.setActiveContext(context)`.
  3. Open drawer via `usePracticeTutorStore.toggleOpen(true)`.
  4. DO NOT call `store.sendMessage(...)`.
- **Post-Conditions {Q}**:
  - Drawer is open with question context chip visible.
  - Active input field is ready for user input without auto-streaming text tokens.
  - Zero unwanted network requests dispatched to LLM.

### 6.2. Multimodal Voice Tutor on Company Questions
- **Pre-Conditions {P}**: User clicks "Тьютор" or "Скрининг" on question $Q$ in `CompanyTheoryDeckTab`.
- **Algorithm C**:
  1. Call `CompanyTrackContextAdapter.createVoiceSessionProps(company, Q, mode)`.
  2. Warm up Web Audio via `AudioPlayoutManager.warmup()`.
  3. Mount `VoiceModal` with exact question, reference answer, `initialSessionType: mode`, and grounded custom prompt.
- **Post-Conditions {Q}**:
  - Gemini Live voice session establishes with targeted grounding on question $Q$.
  - In `'tutor'` mode: Gemini Live acts as Socratic mentor with canvas capability without evaluation pressure.
  - In `'interview'` mode: Gemini Live evaluates answer with strict rubrics and emits scored report.

### 6.3. Topic Progression & FSRS Batch Slicing
- **Pre-Conditions {P}**: User clicks "Начать блиц" for topic $T$.
- **Algorithm C**:
  1. Filter unmastered questions in $T$. If empty, fallback to all questions.
  2. If `shuffle === true`, apply Fisher-Yates random permutation.
  3. Slice first 10 items.
  4. Set batch in store and transition `currentView: 'study'`.
- **Post-Conditions {Q}**:
  - Study batch contains $\le 10$ items strictly belonging to topic $T$.

### 6.4. Dual-Mode Quiz Evaluation Reconciliation
- **Pre-Conditions {P}**: Candidate finishes answering question in Quiz mode (either text submit or voice verdict).
- **Algorithm C**:
  1. Reconcile evaluation payload into standard `EvalRecord`.
  2. Update `resultsHistory[q.id]`.
  3. Persist progress via `/api/topics/:id/progress`.
  4. If last question, calculate `QuizScorecardData` and transition to `isCompleted: true`.
- **Post-Conditions {Q}**:
  - Text and voice evaluations update identical progress indices and results history.
