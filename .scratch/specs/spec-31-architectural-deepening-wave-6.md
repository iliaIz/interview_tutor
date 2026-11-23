# Spec 31: Architectural Deepening Wave 6 — Voice Coordinator, Roadmap Engine & System Design Catalog Decoupling

## 1. Intent & Workload Envelope
- **Context & Glossary**: Aligned with [GLOSSARY.md](../../GLOSSARY.md), [docs/adr/0001-sota-2026-design-patterns-practice.md](../../docs/adr/0001-sota-2026-design-patterns-practice.md), and [docs/architecture/specs/AUTO_VAD_LIVE_AUDIO_SPECIFICATION.md](../../docs/architecture/specs/AUTO_VAD_LIVE_AUDIO_SPECIFICATION.md).
- **Operating Envelope**:
  - Frontend Voice Modal FSM Transition Latency: <16ms (immediate UI responsiveness across lobby, active, verdict, and finale stages).
  - Backend Engine Query Latency: <5ms for roadmap progress resolution, cognitive next-best-step selection, and Senior Radar evaluation over SQLite.
  - Streaming Gateway SSE Latency: Zero buffering pass-through for LiteLLM streaming chunks.
  - Cognitive Bounding SLA: All new files $\le 350$ lines, all modified files $\le 400$ lines (Rule 8 strictly enforced).

---

## 2. Explicit Non-Goals (Blast-Radius Protection)
The implementation agent is **strictly forbidden from modifying**:
1. `backend/src/services/live/` (Gemini Live audio streaming router and DownstreamClientPipe are sealed).
2. `frontend/src/audio/NativeLiveVoiceEngine.ts` and `frontend/src/audio/LiveVoiceStateMachine.ts` (Auto-VAD and Dual-Sided Handshake remain immutable).
3. `backend/src/prompts/` (Prompt invariant and anti-sycophancy directives remain untouched).
4. `frontend/src/services/CompanyTrackContextAdapter.ts` and `frontend/src/components/companies/` (Spec 29 deliveries are frozen).
5. `json/coding_challenges.json` and SQLite database schemas (Database migrations must remain additive; table structures are frozen).

---

## 3. Pre-Agreed Verification Seams

| Subsystem | Primary Seam Path | Dependency Scope | Verification Target |
| :--- | :--- | :--- | :--- |
| **Voice Modal Coordinator** | `frontend/src/components/voice/useVoiceModalCoordinator.ts` & `frontend/src/components/VoiceModal.tsx` | Pure in-process React hook | 4-stage FSM progression, auto-start guards, batch question navigation, DOM workspace event listener |
| **System Design Catalog Studio** | `frontend/src/components/system_design/utils/scenarioLevel.ts` & `frontend/src/components/system_design/hooks/useScenarioCatalogFilters.ts` | In-process URL search params & filtering | Level badge mapping (L3-L7), query parameter two-way binding, scenario text/category filtering |
| **Roadmap Progression Engine** | `backend/src/services/RoadmapProgressionEngine.ts` & `backend/src/routes/roadmaps.ts` | Real SQLite `db` fixture | Step completion resolution, monotonic current_step advancement, next-best-step cognitive interleaving, Senior Radar 4-pillar scores |
| **System Design Catalog & Gateway** | `backend/src/services/SystemDesignCatalog.ts` & `backend/src/services/SystemDesignProbeGateway.ts` | SQLite manifest DAO & LiteLLM streaming mock | Manifest filtering (level/category/search), canonical scenario resolution, LiteLLM proxy failover & SSE streaming |

---

## 4. Formal Wire & Domain Contracts

### 4.1. Issue 01: Voice Modal Lifecycle Coordinator (`useVoiceModalCoordinator.ts`)
```typescript
// frontend/src/components/voice/useVoiceModalCoordinator.ts
export interface UseVoiceModalCoordinatorProps {
  isOpen: boolean;
  onClose: () => void;
  questionId?: string;
  topic?: string;
  currentQuestionText?: string;
  referenceAnswer?: string;
  questionsBatch?: QuestionItem[];
  initialQuestionIndex?: number;
  initialSessionType?: 'interview' | 'tutor';
  initialTutorMode?: 'socratic' | 'deep_dive' | 'interview_probe';
  customPromptOverride?: string;
  vadPauseMs?: number;
  onIndexChange?: (index: number) => void;
  onBatchComplete?: (results: Record<string, VoiceEvaluationResult>) => void;
  onEvaluationComplete?: (result: VoiceEvaluationResult) => void;
  onTutorComplete?: () => void;
}

export interface VoiceModalCoordinatorState {
  stage: 'lobby' | 'active' | 'verdict' | 'grand_finale';
  setStage: (stage: 'lobby' | 'active' | 'verdict' | 'grand_finale') => void;
  activeBatchIndex: number;
  batchResults: Record<string, VoiceEvaluationResult>;
  effectiveQuestionText: string;
  effectiveReferenceAnswer: string;
  effectiveTopic: string;
  effectiveQuestionId: string;
  isWhiteboardOpen: boolean;
  setIsWhiteboardOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  isCribSheetOpen: boolean;
  setIsCribSheetOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  handleSelectQuestion: (index: number) => void;
  handleEvaluationComplete: (res: VoiceEvaluationResult) => void;
  handleRetry: (mode?: 'socratic' | 'deep_dive' | 'interview_probe') => void;
  handleNextQuestion: () => void;
  handleFinishSession: () => void;
  handleLobbyStart: (sessionType: 'interview' | 'tutor', tutorMode?: 'socratic' | 'deep_dive' | 'interview_probe') => void;
  sessionProps: VoiceEngineConfig;
}

export function useVoiceModalCoordinator(props: UseVoiceModalCoordinatorProps): VoiceModalCoordinatorState;
```
UI decomposition:
- `VoiceModal.tsx` ($\le 160$ lines): Pure declarative wrapper binding `useVoiceModalCoordinator`, rendering `VoiceModalHeader`, views (`VoiceLobbyView`, `VoiceActiveView`, `VoiceVerdictView`, `VoiceGrandFinaleView`), and secondary drawers (`WhiteboardDrawer`, `VoiceCribSheetDrawer`).

### 4.2. Issue 02: System Design Catalog Studio & Level Inference
```typescript
// frontend/src/components/system_design/utils/scenarioLevel.ts
export type ScenarioRung = 'L3' | 'L4' | 'L5_L7';
export type LevelFilter = 'all' | ScenarioRung;

export function getScenarioRung(s: any): ScenarioRung;
export function getLevelBadge(s: any): { label: string; bg: string };

// frontend/src/components/system_design/hooks/useScenarioCatalogFilters.ts
export interface ScenarioCatalogFilters {
  levelFilter: LevelFilter;
  setLevelFilter: (level: LevelFilter) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  categoryFilter: string;
  setCategoryFilter: (category: string) => void;
  filteredScenarios: SystemDesignScenario[];
  selectedScenario: SystemDesignScenario | null;
  setSelectedScenario: (scenario: SystemDesignScenario | null) => void;
}

export function useScenarioCatalogFilters(scenarios: SystemDesignScenario[]): ScenarioCatalogFilters;

// frontend/src/components/system_design/components/SystemDesignScenarioCard.tsx
export interface SystemDesignScenarioCardProps {
  scenario: SystemDesignScenario;
  onOpenArena: (scenario: SystemDesignScenario) => void;
  onOpenMathCoach: (scenario: SystemDesignScenario) => void;
  onStartScreening: (scenario: SystemDesignScenario) => void;
}
export const SystemDesignScenarioCard: React.FC<SystemDesignScenarioCardProps>;
```
- `SystemDesignCatalog.tsx`: Reduced from 707 lines to $\le 180$ lines.

### 4.3. Issue 03: Backend Guided Roadmap Progression Engine
```typescript
// backend/src/services/RoadmapProgressionEngine.ts
export interface IRoadmapProgressionEngine {
  getAllRoadmaps(userId: string): RoadmapSummary[];
  getRoadmapById(roadmapId: string, userId: string): ResolvedRoadmapDetails | null;
  getNextBestStep(userId: string, requestedCourseId?: string): NextBestStepResult;
  updateStepProgress(userId: string, roadmapId: string, completedStep: number, isCompleted: boolean): { currentStep: number; completedSteps: number[] };
  recordTransactionSubmission(userId: string, scenarioId: string, passed: boolean, score?: number, userConfigs?: any): void;
  getTransactionSubmissions(userId: string): TransactionSubmissionRecord[];
}
```
- `backend/src/routes/roadmaps.ts`: Reduced from 339 lines to $\le 80$ lines.

### 4.4. Issue 04: Backend System Design Catalog & AI Probe Gateway
```typescript
// backend/src/services/SystemDesignCatalog.ts
export interface ISystemDesignCatalog {
  listScenarios(query: { category?: string; search?: string; level?: string }): any[];
  getScenarioManifest(idOrSlug: string): any | null;
}

// backend/src/services/SystemDesignProbeGateway.ts
export interface ISystemDesignProbeGateway {
  streamProbe(
    params: {
      canonicalId: string;
      level?: string;
      userResponse?: string;
      conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
      tutorMode?: SystemDesignTutorMode;
    },
    res: Response
  ): Promise<void>;
}
```
- `backend/src/routes/systemDesign.ts`: Reduced from 333 lines to $\le 80$ lines.

---

## 5. Storage & Zero-Downtime Migration Contract
- **Schema Impact**: Zero table alterations or DDL migrations.
- **Persistence Compatibility**: All SQLite queries against `guided_roadmaps`, `roadmap_progress`, `spring_transaction_submissions`, and `system_design_manifests` preserve exact existing column mappings and constraints.

---

## 6. Hoare-Logic Behavioral Contracts ({P} C {Q})

### 6.1. Roadmap Progress Monotonicity
- **Pre-Conditions {P}**: User marks step $K$ complete or unchecks step $K$ in roadmap $R$. Existing `current_step` in `roadmap_progress` is $C$.
- **Algorithm C**:
  ```sql
  INSERT INTO roadmap_progress (user_id, roadmap_id, completed_steps_json, current_step, updated_at)
  VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
  ON CONFLICT(user_id, roadmap_id) DO UPDATE SET
    completed_steps_json = excluded.completed_steps_json,
    current_step = CASE
      WHEN excluded.current_step > roadmap_progress.current_step THEN excluded.current_step
      ELSE roadmap_progress.current_step
    END,
    updated_at = CURRENT_TIMESTAMP
  ```
- **Post-Conditions {Q}**: If unchecking ($K < C$), `current_step` remains $C$ (strictly monotonic). If advancing ($K > C$), `current_step` advances to $K$.

### 6.2. Cognitive Interleaving Next-Best-Step Selection
- **Pre-Conditions {P}**: User requests next best step for course $C$. Step set has uncompleted steps $U_1, U_2, \dots$. Last completed step was in arena $A$.
- **Algorithm C**: Filter $U_i$ where arena $\neq A$. If found, select first interleaved step; otherwise fallback to first uncompleted step $U_1$.
- **Post-Conditions {Q}**: Consecutive practice recommendations interleave cognitive arenas (e.g. theory $\rightarrow$ coding $\rightarrow$ triage).
