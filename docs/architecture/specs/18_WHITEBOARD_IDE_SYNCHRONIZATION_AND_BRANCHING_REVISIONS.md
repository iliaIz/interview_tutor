# Spec 18: Whiteboard IDE Synchronization & Branching Revisions

> **Parent Specification:** [`docs/architecture/specs/01_ORAL_MOCK_INTERVIEW_AND_AUTO_VAD.md`](01_ORAL_MOCK_INTERVIEW_AND_AUTO_VAD.md), [`14_GEMINI_LIVE_CANONICAL_PROTOCOL_AND_VOICE_MODAL_STABILIZATION.md`](14_GEMINI_LIVE_CANONICAL_PROTOCOL_AND_VOICE_MODAL_STABILIZATION.md), [`16_LIVE_VOICE_MODALITY_SEPARATION_AND_KEEPALIVE_RESILIENCE.md`](16_LIVE_VOICE_MODALITY_SEPARATION_AND_KEEPALIVE_RESILIENCE.md)  
> **Status:** Approved for Implementation (SOTA Late 2026)  
> **Traceability:** Aligned with Git-Branching / Event-Sourced Workspace Paradigm & Local Zero-Dependency Loopback Bridge  

---

## 1. Intent & Workload Envelope

- **Context & Glossary:**  
  Governed by `GLOSSARY.md` (Companion Bridge, Whiteboard Artifact, Non-Eviction GC, Inviolability of Developer Buffer, Controlled Checkout). Solves the limitation where the Code Whiteboard is predominantly read-only for developers and provides no bridge to local IDEs (IntelliJ IDEA). Eliminates the race condition where concurrent AI whiteboard output overwrites local disk files, replacing naive bidirectional sync with an explicit, event-sourced branching model.
- **Operating Envelope:**  
  - Target Synchronization Latency: $\le 60$ ms from physical file save (`Ctrl+S`) in IntelliJ to Web Whiteboard canvas.
  - Dedicated Loopback Bridge Port: `ws://127.0.0.1:41790` (strictly separated from Task Code Bridge on `:41789`).
  - Concurrent Process Safety: 100% independent; developer can run Task Bridge alone, Whiteboard Bridge alone, or both simultaneously without `EADDRINUSE` collision.
  - Cross-Arena Availability: Available across `PracticeArena`, `TransactionLabArena`, and `VoiceModal` (architectural and behavioral mock interviews without coding challenges).
  - Revision Memory Bounds: Fixed sliding window of maximum 10 historical AI revisions + ALL pinned/IDE-tracked developer working revisions.
  - Tenancy & Data Classification: Local developer loopback (`127.0.0.1`) + ephemeral in-memory session manifest.

---

## 2. Explicit Non-Goals (Blast-Radius Protection)

The implementation agent is **strictly forbidden from modifying**:
1. Task Code Companion Bridge port (`41789`) in `backend/src/services/bridgeMjsTemplate.ts` and `frontend/src/components/practice/useIdeBridge.ts`.
2. Existing SQLite database schema, migrations, or challenge seed catalogs (`coding_challenges`, `bug_challenges`).
3. Audio DSP worklets (`public/worklets/gemini-audio-processor.js`) and audio playout pipelines (`AudioPlayoutManager.ts`).
4. Other studio canvases (PGlite SQL Arena, Cytoscape System Design Canvas, Incident Triage SCC Graph).
5. Unsolicited disk overwriting: AI tools (`update_whiteboard`) MUST NEVER trigger automatic file writes to local disk; disk writes occur exclusively via user-initiated checkout.

---

## 3. Pre-Agreed Verification Seams

- **Loopback WebSocket Transport Seam:** `ws://127.0.0.1:41790` implemented via zero-dependency Node.js companion script (`whiteboardBridge.mjs`).
- **Headless Client Bridge Seam:** `frontend/src/hooks/useWhiteboardIdeBridge.ts` managing connection, debounced ingestion, and store dispatching.
- **State & Revision Store Seam:** `frontend/src/store/useAppStore.ts` (`codeRevisions`, `activeIdeRevisionId`, `pinRevision`, non-eviction GC).
- **UI & Presentation Seam:** `frontend/src/components/CodeArtifactTimeline.tsx`, `frontend/src/components/WhiteboardDrawer.tsx`, and `frontend/src/components/WhiteboardIdeModal.tsx`.
- **Live AI Perception Seam:** `frontend/src/components/VoiceModal.tsx` (event forwarding) and `backend/src/services/live/liveWorkspaceHandlers.ts` (`read_file('Whiteboard.java')`).
- **Automated Verification Seam:** `frontend/tests/whiteboardRevisionStore.test.ts` verifying non-eviction GC, 3-state visual classification, and checkout mutation.

---

## 4. Formal Wire & Messaging Contracts

### 4.1 Dedicated Loopback Port Isolation (`:41790`)
The Whiteboard Companion Bridge runs locally on `ws://127.0.0.1:41790`:
- **Handshake Init:** `{ type: 'HANDSHAKE_INIT', clientVersion: '1.0.0', channel: 'whiteboard', timestamp }`
- **Handshake Ack:** `{ type: 'HANDSHAKE_ACK', serverVersion: '1.0.0', workspaceDir, channel: 'whiteboard' }`
- **IDE $\rightarrow$ Web (Save):** `{ type: 'FILE_UPDATED', origin: 'ide', path: 'Whiteboard.java', content, contentHash, timestamp }`
- **Web $\rightarrow$ IDE (User Checkout Only):** `{ type: 'FILE_UPDATED', origin: 'web', path: 'Whiteboard.java', content }`
- **Ping / Pong:** `{ type: 'PING' }` $\leftrightarrow$ `{ type: 'PONG' }` every 15s.

### 4.2 Standalone Scaffold Package Contract (`/api/whiteboard/export-zip`)
GET `/api/whiteboard/export-zip` generates `tutor-whiteboard.zip` containing:
- `pom.xml`: Minimal Java 21 LTS Maven configuration for IDE syntax highlighting, auto-completion, and compiler checks.
- `src/main/java/Whiteboard.java`: Clean scratchpad class template.
- `bridge.mjs`: Node.js loopback server configured strictly to port `41790`, watching `src/main/java/Whiteboard.java`.
- `wsServer.mjs`: Zero-dependency WebSocket RFC 6455 server.
- `run-bridge.sh` / `run-bridge.cmd`: OS launchers.

### 4.3 Minimalist Version Naming & 3-State Visual Color Contract
To eliminate visual clutter while maintaining immediate cognitive orientation:
- **Title Conciseness:** Version pills MUST NOT display lengthy textual descriptions. Labels are strictly formatted as `v1`, `v2 💻`, `v3 ✨`.
- **3-State Color Hierarchy:**
  1. **Active Canvas Version (`activeRevisionId === rev.id`):** Primary gradient ring (`from-pastel-accentRose to-pastel-accentViolet`), bold white text, animated pulsing indicator dot.
  2. **User IDE-Synced Version (`activeIdeRevisionId === rev.id`):** Distinct Emerald/Cyan badge (`bg-emerald-500/10 text-emerald-400 border border-emerald-500/40`), laptop icon (`💻`). Maintains its distinct emerald border even when user is viewing another version.
  3. **Historical / AI Versions:** Subtle Slate/Lavender badge (`bg-slate-800/80 text-slate-300 border border-slate-700/60`), sparkle icon (`✨`).

```typescript
// Visual status classification formula
export type VersionVisualRole = 'active_and_synced' | 'active_only' | 'synced_background' | 'neutral';

export function getVersionVisualRole(revId: string, activeId: string | null, syncedId: string | null): VersionVisualRole {
  if (revId === activeId && revId === syncedId) return 'active_and_synced';
  if (revId === activeId) return 'active_only';
  if (revId === syncedId) return 'synced_background';
  return 'neutral';
}
```

### 4.4 Controlled Checkout Contract ("Загрузить в IDE")
When viewing an AI or historical revision (`rev.id !== activeIdeRevisionId`), the timeline header renders an explicit button:
- **Action:** «Загрузить в IDE» (`handleCheckoutToIde(rev)`).
- **Execution:** Pushes `{ type: 'FILE_UPDATED', origin: 'web', path: 'Whiteboard.java', content: rev.code }` via the active Whiteboard WebSocket connection.
- **State Transition:** Marks `activeIdeRevisionId = rev.id` and preserves `rev.isPinned = true`.

---

## 5. Storage & Data Model Migration Contract

### 5.1 Zustand Schema Additions (`useAppStore.ts`)
```typescript
export interface CodeArtifactRevision {
  id: string;
  index: number;
  title: string;
  language: string;
  code: string;
  explanation?: string;
  highlightLines?: number[];
  timestamp: number;
  author: 'ai' | 'user';
  isPinned?: boolean;       // Protected from GC pruning
  isIdeTracked?: boolean;   // Active recipient of IDE saves
}

// Store state slice:
activeIdeRevisionId: string | null;
setActiveIdeRevisionId: (id: string | null) => void;
updateIdeTrackedContent: (content: string) => void;
checkoutRevisionToIde: (revisionId: string) => void;
```

### 5.2 Non-Eviction Garbage Collection Contract
When `setWhiteboardState` or `addCodeRevision` executes, revisions are pruned per the non-eviction formula:
$$Revs_{final} = Revs_{pinned} \cup \text{tail}_{10}(Revs_{unpinned})$$
- Pinned revisions (`isPinned === true` or `id === activeIdeRevisionId`) are NEVER dropped by the sliding window.
- Unpinned revisions are capped to the most recent 10 entries.

---

## 6. Hoare-Logic Behavioral Contracts ({P} C {Q})

### Contract 1: Unidirectional IDE-to-Whiteboard Mutation
- **Pre-Condition {P}:** Whiteboard bridge is connected (`status === 'connected'`), user saves `Whiteboard.java` in IDE, and `activeIdeRevisionId` points to revision $R_k$.
- **Algorithm C:** `useWhiteboardIdeBridge` intercepts `FILE_UPDATED`, finds $R_k$ in `codeRevisions`, mutates $R_k.code = \text{newContent}$, updates $R_k.timestamp = \text{now}$, and dispatches `workspace_file_updated`.
- **Post-Condition {Q}:** $R_k$ is updated in memory without spawning new revision entries; canvas reflects new code in $\le 60$ms; local disk file is NOT touched by response frames.

### Contract 2: Controlled Revision Checkout
- **Pre-Condition {P}:** User selects version $R_{target}$ ($R_{target} \ne R_{current\_ide}$) and clicks «Загрузить в IDE».
- **Algorithm C:** Web sends `{ type: 'FILE_UPDATED', origin: 'web', path: 'Whiteboard.java', content: R_{target}.code }`; bridge writes content to disk; store sets `activeIdeRevisionId = R_{target}.id` and sets $R_{target}.isPinned = true$.
- **Post-Condition {Q}:** Disk file matches $R_{target}.code$ byte-for-byte; IDE automatically reloads file; subsequent IDE saves target $R_{target}$.

### Contract 3: Pinned Revision Non-Eviction GC
- **Pre-Condition {P}:** `codeRevisions` contains $N \ge 10$ revisions, including pinned revision $R_{ide}$. AI produces revision $R_{ai\_new}$.
- **Algorithm C:** Non-eviction GC partitions revisions into pinned and unpinned, keeps last 10 unpinned, appends $R_{ai\_new}$, and merges with pinned.
- **Post-Condition {Q}:** $R_{ide} \in \text{store.codeRevisions}$; total unpinned count $\le 10$; zero data loss for developer draft.

### Contract 4: Multi-Arena Independent Transport Isolation
- **Pre-Condition {P}:** User launches task bridge (`ws://127.0.0.1:41789`) in terminal A, and whiteboard bridge (`ws://127.0.0.1:41790`) in terminal B.
- **Algorithm C:** Both Node.js processes bind to distinct loopback ports without collision.
- **Post-Condition {Q}:** Both bridges operate concurrently with zero cross-talk; saving `Solution.java` updates only task workspace; saving `Whiteboard.java` updates only whiteboard canvas.

### Contract 5: WYSIWYG AI Context Grounding via read_file
- **Pre-Condition {P}:** User has selected revision $R_{active}$ on the whiteboard canvas during an active Live Voice session.
- **Algorithm C:** Selection dispatches `workspace_file_update` with `path: 'Whiteboard.java', content: R_{active}.code`; Live Gateway records file in `session.workspaceManifest.files`.
- **Post-Condition {Q}:** When Gemini Live calls `read_file('Whiteboard.java')`, the tool result returns $R_{active}.code$ identically to what the user sees on screen.
