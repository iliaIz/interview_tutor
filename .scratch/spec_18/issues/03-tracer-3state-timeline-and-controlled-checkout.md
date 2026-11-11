# 03: [Tracer-Bullet] 3-State Visual Timeline & Controlled Revision Checkout

**Archetype:** Tracer-Bullet  
**Blocked by:** #01, #02  
**Status:** ready-for-agent  

## What to Build
Update `CodeArtifactTimeline.tsx` and `WhiteboardDrawer.tsx` to implement the minimalist versioning UI, 3-state visual color hierarchy, and controlled revision checkout ("Загрузить в IDE"). Replace wordy revision titles with concise labels (`v1`, `v2 💻`, `v3 ✨`). Color-code the 3 states: Active Canvas View (gradient ring + pulsing dot), User's IDE-Synced Working Copy (emerald/cyan badge + laptop icon, preserved even when backgrounded), and Historical/AI versions (neutral slate). When viewing an AI/historical revision, render the «Загрузить в IDE» button to explicitly push that code to the developer's disk file without automatic clobbering.

## Pre-Agreed Verification Seam & Command
- **Testing Seam**: `frontend/src/components/CodeArtifactTimeline.tsx` and `frontend/src/components/WhiteboardDrawer.tsx`
- **Dependencies**: React component tree, Zustand store
- **Verification Command**: `remote-verify`

## Embedded Contract Slice & Invariants
- **Minimalist Naming**: Pills format strictly as `v1`, `v2 💻`, `v3 ✨` (zero verbose text labels).
- **3-State Color Hierarchy**:
  - `active_and_synced`: Gradient ring + emerald text + pulsing dot
  - `active_only`: Gradient ring + neutral text + pulsing dot
  - `synced_background`: Emerald border (`border-emerald-500/40 text-emerald-400 bg-emerald-500/10`) + laptop icon
  - `neutral`: Slate/lavender pill
- **Checkout Invariant**: Clicking «Загрузить в IDE» triggers `checkoutRevisionToIde(rev.id)` which writes code to disk via `useWhiteboardIdeBridge` and sets `activeIdeRevisionId = rev.id`. AI generations NEVER auto-write to disk.
- **Header Integration**: Whiteboard header renders `WhiteboardSyncButton` showing live IDE connection status.

## Explicit Non-Goals
- Do NOT exceed Rule 8 file size limits ($\le 350$ lines for new files, $\le 400$ for modified files).
- Do NOT alter Monaco editor in `WorkspaceEditor.tsx`.

## Acceptance Criteria
- [ ] Timeline pills display concise `v{N}` format with appropriate icons (`💻`, `✨`)
- [ ] 3-state visual color rules correctly highlight active vs synced vs neutral versions
- [ ] «Загрузить в IDE» button appears when viewing un-synced revisions and pushes code to disk
- [ ] Whiteboard header features IDE sync status pill opening `WhiteboardIdeModal`
