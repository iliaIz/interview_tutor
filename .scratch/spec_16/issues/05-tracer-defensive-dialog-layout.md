# 05: [Tracer-Bullet] Defensive Modal Layout, High-Contrast Close Button & Overflow Scroll

**Archetype:** Tracer-Bullet  
**Blocked by:** #03, #04  
**Parent:** #81  
**Status:** ready-for-agent  

## What to Build
Eliminate UI shifting, layout overflow, and low-contrast close button in `VoiceModal`:
1. In `frontend/src/components/voice/VoiceModalHeader.tsx`:
   - Style close button with high contrast and explicit border: `text-slate-700 bg-white/90 border border-slate-200/90 hover:bg-rose-50 hover:text-rose-600 shadow-xs`.
   - Constrain topic header with `max-w-[40%] sm:max-w-[50%] truncate` so long titles do not wrap or push the buttons and close 'X' off-screen.
2. In `frontend/src/components/VoiceModal.tsx`:
   - Ensure outer container uses `max-h-[90dvh] flex flex-col overflow-hidden`.
   - Make header and footer controls `shrink-0`.
3. In `frontend/src/components/voice/VoiceActiveView.tsx`:
   - Wrap the dialogue turn stream and scroll container with `flex-1 min-h-0 overflow-y-auto`.
   - Ensure on standard viewports (768p/900p) the content never pushes outside the dialog boundary or clips buttons.

## Pre-Agreed Verification Seam & Command
- **Testing Seam:** `frontend/src/components/VoiceModal.tsx`, `frontend/src/components/voice/VoiceModalHeader.tsx`, and `frontend/src/components/voice/VoiceActiveView.tsx`.
- **Verification Command:** `remote-verify`

## Embedded Contract Slice & Invariants
- Visual contract: Close button ('X') MUST be immediately recognizable and visible with $\ge 4.5:1$ contrast ratio against the background.
- Responsive contract: No vertical content clipping or loss of header/footer on screens down to $640 \times 700$ px.

## Explicit Non-Goals
- Altering the soft luxury pastel design theme (`#FFF0F5`, rose, emerald accents).
- Modifying WhiteboardDrawer or CribSheet internal layout.

## Acceptance Criteria
- [ ] Close button ('X') has high contrast and is clearly visible on all viewports.
- [ ] Long topic titles truncate cleanly without shifting action buttons.
- [ ] Content inside `VoiceActiveView` scrolls smoothly without overflowing modal boundaries.
- [ ] All tests pass via `remote-verify`.
