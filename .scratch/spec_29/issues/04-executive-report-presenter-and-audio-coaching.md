# 04: [Tracer-Bullet] Executive Report Presenter & Audio Coaching Studio

**Archetype:** Tracer-Bullet
**Blocked by:** None (can start immediately)
**Status:** ready-for-agent

## What to Build
Eliminate inlined JSX IIFEs and anemic data bags from `InterviewReportModal.tsx`:
1. Create `ExecutiveReportPresenter` transforming `InterviewReportData` into a typed `ExecutiveReportViewModel`.
2. Extract JSON transcript parser supporting plain text, structured turns, and Deepgram Nova-3 prefixes.
3. Decompose `InterviewReportModal.tsx` (633 lines -> <= 160 lines) into:
   - `AcousticCoachingStudio.tsx` (speech clarity, pace/pause metrics)
   - `InterviewTranscriptViewer.tsx` (collapsible dialogue history)

## Pre-Agreed Verification Seam & Command
- **Testing Seam**: `frontend/src/services/reports/ExecutiveReportPresenter.ts` and `frontend/src/components/InterviewReportModal.tsx`.
- **Verification Command**: `remote-verify`

## Embedded Contract Slice & Invariants
- Rule 6: Respect reference-counted body scroll lock (no modal-over-modal race).
- Rule 8: All files <= 350 lines.

## Explicit Non-Goals
- Do not modify AcousticTelemetryService math.
