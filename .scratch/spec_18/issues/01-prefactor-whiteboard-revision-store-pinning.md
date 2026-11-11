# 01: [Prefactor] Whiteboard Revision Store Pinning & Non-Eviction GC

**Archetype:** Prefactor  
**Blocked by:** None (can start immediately)  
**Status:** ready-for-agent  

## What to Build
Extend the Zustand store (`frontend/src/store/useAppStore.ts`) to support pinned revisions and non-eviction garbage collection. When new AI revisions arrive, unpinned revisions are capped to the most recent 10 entries, while any pinned revision (`isPinned: true`) or IDE-tracked revision (`isIdeTracked: true` / `activeIdeRevisionId`) is strictly preserved from pruning. Add store actions for managing active IDE revision tracking and content mutation.

## Pre-Agreed Verification Seam & Command
- **Testing Seam**: `frontend/src/store/useAppStore.ts`
- **Dependencies**: In-memory Zustand state slice (zero external mocks)
- **Verification Command**: `remote-verify` (GitHub Actions runner)

## Embedded Contract Slice & Invariants
- **Non-Eviction Formula**: $Revs_{final} = Revs_{pinned} \cup \text{tail}_{10}(Revs_{unpinned})$
- **Types**:
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
    isPinned?: boolean;
    isIdeTracked?: boolean;
  }
  ```
- **Actions**:
  - `activeIdeRevisionId: string | null`
  - `setActiveIdeRevisionId(id: string | null): void`
  - `updateIdeTrackedContent(content: string): void`

## Explicit Non-Goals
- Do NOT touch `bridgeMjsTemplate.ts` or task bridge port `41789`.
- Do NOT alter SQLite database schemas.

## Acceptance Criteria
- [ ] `CodeArtifactRevision` schema extended with `isPinned` and `isIdeTracked`
- [ ] `setWhiteboardState` and `addCodeRevision` never evict pinned or tracked revisions
- [ ] `updateIdeTrackedContent` mutates active tracked revision without spawning duplicate revisions
- [ ] 100% of existing store tests remain green
