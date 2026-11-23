# Spec 32: Architectural Deepening Wave 7 — Bug Hunt Session, Triage Compass Knowledge & Multi-Arena Decoupling

## 1. Intent & Workload Envelope
- **Context & Glossary**: Aligned with [GLOSSARY.md](../../GLOSSARY.md), [docs/adr/0001-sota-2026-design-patterns-practice.md](../../docs/adr/0001-sota-2026-design-patterns-practice.md), and [docs/architecture/specs/AUTO_VAD_LIVE_AUDIO_SPECIFICATION.md](../../docs/architecture/specs/AUTO_VAD_LIVE_AUDIO_SPECIFICATION.md).
- **Operating Envelope**:
  - UI State Transitions: <16ms (60 FPS rendering) across Bug Hunt history navigation, incident investigation tabs, and architecture canvas node dragging.
  - PGlite WASM Execution: Sub-50ms query evaluation in client worker sandbox.
  - Cognitive Bounding SLA: All new files $\le 350$ lines, all modified files $\le 400$ lines (Rule 8 strictly enforced).

---

## 2. Explicit Non-Goals (Blast-Radius Protection)
The implementation agent is **strictly forbidden from modifying**:
1. `backend/src/services/live/` (Gemini Live audio streaming router and DownstreamClientPipe are sealed).
2. `frontend/src/audio/NativeLiveVoiceEngine.ts` and `frontend/src/audio/LiveVoiceStateMachine.ts` (Auto-VAD and Dual-Sided Handshake remain immutable).
3. `backend/src/prompts/` (Prompt invariant and anti-sycophancy directives remain untouched).
4. `frontend/src/services/CompanyTrackContextAdapter.ts` and `frontend/src/components/companies/` (Spec 29 deliveries are frozen).
5. `backend/src/services/practice/PracticeChallengeCatalog.ts` and SQLite database schemas (Database migrations must remain additive; table structures are frozen).

---

## 3. Pre-Agreed Verification Seams

| Subsystem | Primary Seam Path | Dependency Scope | Verification Target |
| :--- | :--- | :--- | :--- |
| **Bug Hunt Session & Voice Bridge** | `frontend/src/components/incidents/bughunt/useBugHuntSession.ts` & `useBugHuntVoiceBridge.ts` | Pure in-process React hook | Kata history navigation, variation generation, solved progress sync, mentor controller interface |
| **Triage Forensic Knowledge & Investigation** | `frontend/src/components/triage/compass/triageRules.ts` & `frontend/src/components/triage/hooks/useIncidentInvestigation.ts` | Pure domain manifest & debounced autosave | Static SRE rule classification, MTTM/MTTR stopwatch, Tarjan SCC thread digest |
| **System Design Arena & Canvas Engine** | `frontend/src/components/system_design/hooks/useSystemDesignStaffChat.ts` & `canvas/useArchitectureCanvasState.ts` | ReactFlow node/edge state | Staff probe conversation history, DES simulation telemetry mapping, HTML5 DND screen coordinate math |
| **SQL Arena Sandbox & Workbench** | `frontend/src/components/sql/hooks/useSqlArena.ts` | PGlite execution engine & CodeMirror buffer | Query execution lifecycle, tab auto-routing (`diff`/`result`), Copilot synchronization |

---

## 4. Formal Wire & Domain Contracts

### 4.1. Issue 01: Bug Hunt Session & Voice Bridge Controller
```typescript
// frontend/src/components/incidents/bughunt/useBugHuntSession.ts
export interface UseBugHuntSessionReturn {
  challenge: BugChallenge | null;
  history: BugChallenge[];
  currentIndex: number;
  isLoadingChallenge: boolean;
  isLoadingVariation: boolean;
  generationError: string | null;
  isSolved: boolean;
  sessionSolvedCount: number;
  elapsedSeconds: number;
  fetchChallenge: () => Promise<void>;
  generateVariation: (subtopicOverride?: string) => Promise<void>;
  goToPrevious: () => void;
  goToNext: () => void;
  markSolved: () => void;
}

// frontend/src/components/incidents/bughunt/useBugHuntVoiceBridge.ts
export interface BugHuntVoiceMentorController {
  state: any;
  metrics: any;
  statusMessage: string;
  dialogueTurns: any[];
  isVoiceActive: boolean;
  isMuted: boolean;
  onToggleVoice: () => void;
  onToggleMute: () => void;
  onCentralClick: () => void;
  onTextSubmit: (text: string) => void;
}
```
- `BugHuntArena.tsx`: Collapses from 399 lines to $\le 130$ lines.
- `BugHuntLoaderCard.tsx` ($\le 80$ lines): Owns the 3 interval loops (step index, trivia, elapsed seconds).
- `BugHuntVoiceMentor.tsx`: Replaces 15 drilled props with unified `controller: BugHuntVoiceMentorController`.

### 4.2. Issue 02: Triage Forensic Knowledge & Investigation Engine
```typescript
// frontend/src/components/triage/compass/triageRules.ts
export interface CompassSection {
  id: string;
  number: string;
  title: string;
  badge: string;
  badgeColor: string;
  summary: string;
  detailsTable?: Array<{ metric: string; value: string; note: string }>;
  formulaOrCode?: string;
  checklist: string[];
}
export const TRIAGE_RULES: CompassSection[];

// frontend/src/components/triage/hooks/useIncidentInvestigation.ts
export interface UseIncidentInvestigationReturn {
  activeTab: 'summary' | 'telemetry' | 'threads' | 'rca' | 'commander';
  setActiveTab: (tab: any) => void;
  triageDigest: any;
  elapsedSeconds: number;
  rcaHypothesis: string;
  setRcaHypothesis: (val: string) => void;
  isSubmittingRca: boolean;
  handleSaveSubmission: (forceComplete?: boolean) => Promise<void>;
}
```
- `TriageCompassSheet.tsx`: Collapses from 396 lines to $\le 130$ lines.
- `IncidentTriageStudio.tsx`: Collapses from 360 lines to $\le 140$ lines.

### 4.3. Issue 03: System Design Arena Churn Decoupling & Canvas Engine
```typescript
// frontend/src/components/system_design/hooks/useSystemDesignStaffChat.ts
export interface UseSystemDesignStaffChatReturn {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  isStreaming: boolean;
  sendUserMessage: (msg: string) => Promise<void>;
  resetChat: () => void;
}

// frontend/src/components/system_design/canvas/useArchitectureCanvasState.ts
export interface UseArchitectureCanvasStateReturn {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  onDrop: (event: React.DragEvent) => void;
  onDragOver: (event: React.DragEvent) => void;
}
```
- `SystemDesignArena.tsx`: Collapses from 391 lines to $\le 140$ lines.
- `ArchitectureCanvas.tsx`: Collapses from 391 lines to $\le 150$ lines.

### 4.4. Issue 04: SQL Arena Headless Engine & Modular Workbench
```typescript
// frontend/src/components/sql/hooks/useSqlArena.ts
export interface UseSqlArenaReturn {
  challenges: SqlChallenge[];
  activeChallenge: SqlChallenge | null;
  loading: boolean;
  loadError: string | null;
  editorSql: string;
  setEditorSql: (sql: string) => void;
  isExecuting: boolean;
  result: SqlExecutionResult | null;
  activeTab: 'result' | 'diff' | 'schema' | 'explanation';
  setActiveTab: (tab: any) => void;
  solvedIds: Set<string>;
  selectChallenge: (id: string) => void;
  runQuery: () => Promise<void>;
  resetQuery: () => void;
}
```
- `SqlArena.tsx`: Collapses from 379 lines to $\le 120$ lines.

---

## 5. Storage & Zero-Downtime Migration Contract
- Zero DDL changes or database schema modifications.
- Local storage and SQLite submission payloads maintain exact existing JSON contracts.

---

## 6. Hoare-Logic Behavioral Contracts ({P} C {Q})

### 6.1. Bug Hunt Academy Progress Sync
- **Pre-Conditions {P}**: User solves bug challenge $K$ in topic $T$. Breadcrumb academy context active with step index $S$.
- **Algorithm C**: Trigger confetti, record solved ID in history, update `sessionSolvedCount`, and toggle academy step progress $S$ if context exists.
- **Post-Conditions {Q}**: Challenge marked solved in session; Academy roadmap progress reflects completion monotonically.
