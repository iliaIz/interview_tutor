# 05: [Tracer-Bullet] Code Viewer SRE Grammars & Theme Decoupling

**Archetype:** Tracer-Bullet
**Blocked by:** None (can start immediately)
**Status:** ready-for-agent

## What to Build
Decompose the 445-line `CodeViewer.tsx` component into focused modules:
1. `frontend/src/themes/velvetObsidianTheme.ts` ($\le 90$ lines): Isolated Prism theme object for `prism-react-renderer`.
2. `frontend/src/utils/prismLogGrammar.ts` ($\le 75$ lines): Standalone SRE deadlock and thread state regex grammar registration for Prism.
3. `frontend/src/hooks/useCodeViewerModel.ts` ($\le 150$ lines): Headless hook managing diff kind parsing, search match counting, and deictic focus store integration (`useSelectionFocusStore`).
4. `frontend/src/components/CodeViewer.tsx` ($\le 180$ lines): Lean pure rendering shell.

## Pre-Agreed Verification Seam & Command
- **Testing Seam**: `frontend/src/hooks/useCodeViewerModel.ts` and `frontend/src/components/CodeViewer.tsx`.
- **Dependencies**: In-process React DOM & Prism setup.
- **Verification Command**: `remote-verify` passes frontend production build.

## Embedded Contract Slice & Invariants
- Full Feature Parity: Retain SRE log/jstack highlighting, diff lines, line search, and deictic selection focus.
- Rule 8 Compliance: All files strictly $\le 350$ lines.

## Explicit Non-Goals
- Do NOT alter `useSelectionFocusStore.ts`.
- Do NOT alter `prismSetup.ts` base imports.
