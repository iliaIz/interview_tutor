# Spec 34: Architectural Deepening Wave 9 — System Design Topology Linter, Audio Recap, Admin Invites & Practice Arena Decoupling

## 1. Intent & Workload Envelope
- **Context & Glossary**: Aligned with [GLOSSARY.md](../../GLOSSARY.md), [docs/adr/0001-sota-2026-design-patterns-practice.md](../../docs/adr/0001-sota-2026-design-patterns-practice.md), and [docs/architecture/specs/AUTO_VAD_LIVE_AUDIO_SPECIFICATION.md](../../docs/architecture/specs/AUTO_VAD_LIVE_AUDIO_SPECIFICATION.md).
- **Operating Envelope**:
  - Topology Linting Execution: <2ms synchronous graph analysis for topologies with up to 100 nodes/edges.
  - CSV Export: Sub-10ms browser download trigger for up to 5,000 invitation records.
  - Cognitive Bounding SLA: All new files $\le 350$ lines, all modified files $\le 400$ lines (Rule 8 strictly enforced).
  - Clean Test Seams: Pure mathematical models, value objects, and headless React hooks.

---

## 2. Explicit Non-Goals (Blast-Radius Protection)
The implementation agent is **strictly forbidden from modifying**:
1. `backend/src/services/live/` (Gemini Live audio streaming router and DownstreamClientPipe are sealed).
2. `frontend/src/audio/NativeLiveVoiceEngine.ts` and `frontend/src/audio/LiveVoiceStateMachine.ts` (Auto-VAD and Dual-Sided Handshake remain immutable).
3. `backend/src/prompts/` (Prompt invariant and anti-sycophancy directives remain untouched).
4. Database schemas and SQLite migration files (All database structures are frozen).

---

## 3. Pre-Agreed Verification Seams

| Subsystem | Primary Seam Path | Dependency Scope | Verification Target |
| :--- | :--- | :--- | :--- |
| **System Design AST Linter** | `frontend/src/components/system_design/simulation/linter/ArchitectureTopologyGraph.ts` & `TopologyRuleRegistry.ts` | Pure graph model & rule registry | Tarjan articulation point & bridge calculation, 3-color synchronous RPC cycle detection, SPOF / Direct DB ingress rules |
| **Audio Recap Settings Form** | `frontend/src/components/audio/recap/recapConfigTypes.ts` & `RecapSettingsForm.tsx` | Pure Value Object & form components | 17-prop to 5-prop reduction, solo/duo voice switching, duration/tone pills, prompt template overrides |
| **Admin Invites Management** | `frontend/src/components/auth/invites/useAdminInvitesManager.ts` & `adminInvitesUtils.ts` | Headless hook & CSV serializer | RFC 4180 UTF-8 BOM CSV export, clipboard 2000ms timer, invite creation & revocation |
| **Practice Arena Router & Workspace** | `frontend/src/components/practice/arena/PracticeArenaHeader.tsx` & `usePracticeFindingBridge.ts` | Header component & workspace router | Spec/Editor mobile tabs, focus mode toggle, finding regex file switching, multi-arena dispatch |

---

## 4. Formal Wire & Domain Contracts

### 4.1. Issue 01: System Design AST Topology Linter Decoupling
```typescript
// frontend/src/components/system_design/simulation/linter/ArchitectureTopologyGraph.ts
export class ArchitectureTopologyGraph {
  constructor(nodes: LinterNode[], edges: LinterEdge[]);
  getArticulationPoints(): Set<string>;
  getBridges(): Array<{ u: string; v: string; edgeId: string }>;
  getCycles(isEdgeEligible?: (e: LinterEdge) => boolean): string[][];
  getNode(id: string): LinterNode | undefined;
  getNodeType(id: string): string;
  getNodeInstances(id: string): number;
  isEdgeSync(edge: LinterEdge): boolean;
}

// frontend/src/components/system_design/simulation/linter/TopologyRule.ts
export interface TopologyRule {
  readonly id: LintDiagnostic['ruleId'];
  evaluate(graph: ArchitectureTopologyGraph): LintDiagnostic[];
}
```
- `ArchitectureTopologyLinter.ts`: Collapses from 374 lines to $\le 60$ lines (pure facade maintaining 100% backwards compatibility).
- `ArchitectureTopologyGraph.ts`: Pure graph traversal and cut/cycle calculation ($\le 180$ lines).
- `builtInRules.ts`: Standard perimeter rules (SPOF, cycles, unbuffered write, direct DB ingress, circuit breaker) ($\le 180$ lines).

### 4.2. Issue 02: Audio Recap Settings Value Object & Subcomponents
```typescript
// frontend/src/components/audio/recap/recapConfigTypes.ts
export interface AudioRecapConfig {
  mode: 'duo' | 'solo';
  voice1: string;
  voice2: string;
  length: string;
  tone: string;
  systemPrompt: string;
  userPrompt: string;
}
```
- `RecapSettingsForm.tsx`: Collapses from 370 lines to $\le 100$ lines.
- `VoiceSelectorGroup.tsx`: Encapsulates solo/duo voice selection & preview audio trigger ($\le 80$ lines).
- `AdvancedPromptsCollapsible.tsx`: Encapsulates prompt tuning accordion ($\le 70$ lines).

### 4.3. Issue 03: Admin Invites Headless Hook & CSV Exporter
```typescript
// frontend/src/components/auth/invites/adminInvitesUtils.ts
export function exportInvitesToCsv(invites: InviteItem[]): void;

// frontend/src/components/auth/invites/useAdminInvitesManager.ts
export interface UseAdminInvitesManagerReturn {
  invites: InviteItem[];
  isLoading: boolean;
  isCreating: boolean;
  error: string | null;
  newlyCreatedCode: string | null;
  isCopied: boolean;
  createInvite: (payload: CreateInvitePayload) => Promise<void>;
  revokeInvite: (id: string, label: string) => Promise<void>;
  copyCode: (code: string) => Promise<void>;
  exportCsv: () => void;
  fetchInvites: () => Promise<void>;
}
```
- `AdminInvitesModal.tsx`: Collapses from 358 lines to $\le 160$ lines.
- `useAdminInvitesManager.ts`: Manages network state, clipboard timer, and actions ($\le 120$ lines).
- `adminInvitesUtils.ts`: Pure CSV exporter ($\le 60$ lines).

### 4.4. Issue 04: Practice Arena Workspace & Header Toolbar Decoupling
```typescript
// frontend/src/components/practice/arena/PracticeArenaHeader.tsx
export interface PracticeArenaHeaderProps {
  challenge: CodingChallenge;
  mobileTab: 'spec' | 'editor';
  onMobileTabChange: (tab: 'spec' | 'editor') => void;
  isFocusMode: boolean;
  onToggleFocusMode: () => void;
}

// frontend/src/components/practice/arena/usePracticeFindingBridge.ts
export interface UsePracticeFindingBridgeReturn {
  handleStartVoiceDiscussion: (finding?: any) => void;
}
```
- `PracticeArena.tsx`: Collapses from 343 lines to $\le 90$ lines (strictly router).
- `PracticeArenaWorkspace.tsx`: Encapsulates workspace split-pane layout ($\le 130$ lines).
- `PracticeArenaHeader.tsx`: Owns toolbar buttons, breadcrumbs, and badges ($\le 120$ lines).
- `usePracticeFindingBridge.ts`: Regex location parser and file index switcher ($\le 50$ lines).

---

## 5. Hoare-Logic Behavioral Contracts ({P} C {Q})

### 5.1. Topology Linter Facade Invariance
- **Pre-Conditions {P}**: A set of `nodes: LinterNode[]` and `edges: LinterEdge[]` representing a distributed topology.
- **Algorithm C**: Instantiate `ArchitectureTopologyGraph(nodes, edges)`, run `builtInRules.flatMap(r => r.evaluate(graph))`.
- **Post-Conditions {Q}**: Identical list of `LintDiagnostic[]` returned with matching `ruleId`, `severity`, and `affectedNodeIds` as legacy monolithic linter.
