# 04: [Tracer-Bullet] LiveSessionAggregate and Anemic Data Bag Retirement

**Archetype:** Tracer-Bullet
**Blocked by:** None (can start immediately)
**Status:** closed-verified
**Verification Run:** GitHub Actions Run ID 45160011852 (100% Green)

## What to Build
Deepen real-time multimodal session state management in `backend/src/services/live/`:
1. `backend/src/services/live/LiveSessionAggregate.ts`: Create a genuine aggregate root encapsulating:
   - Session lifecycle (`start`, `terminate`, `recordActivity`)
   - Turn state transitions (`beginAiTurn`, `endAiTurn`, `markCandidateResponded`)
   - Turn 0 lockdown validation (`canExecuteGradingTools()`, `validateToolExecution()`)
   - Turn telemetry accumulation (`recordAudioBytes`, `recordTextChars`, `getMetrics`)
   - Watchdog and dead-air timer synchronization
2. `backend/src/services/live/LiveVoiceSession.ts`: Refactor to delegate domain invariant enforcement to `LiveSessionAggregate`.
3. Provide a backwards-compatible getter/adapter bridge for existing components while deprecating direct property mutations on the legacy `ProxySession` data bag.

## Pre-Agreed Verification Seam & Command
- **Testing Seam**: `backend/src/services/live/LiveSessionAggregate.ts` and `backend/src/services/live/LiveVoiceSession.ts`.
- **Dependencies**: WebSocket, SessionFsm, WatchdogManager.
- **Verification Command**: `remote-verify`

## Embedded Contract Slice & Invariants
- **Contract Fragment**:
```typescript
export class LiveSessionAggregate {
  public beginAiTurn(): void;
  public endAiTurn(): void;
  public markCandidateResponded(): void;
  public canExecuteTool(toolName: string): { allowed: boolean; reason?: string };
  public recordAudioBytes(bytes: number): void;
  public recordActivity(): void;
  public isTerminated(): boolean;
}
```
- **Invariants**: All modified files &le; 400 lines, all new files &le; 350 lines.

## Explicit Non-Goals
- Do not alter the wire protocol of client or Gemini WebSockets.
- Do not change existing client message schemas.

## Acceptance Criteria
- [ ] `LiveSessionAggregate.ts` created with &le; 350 lines.
- [ ] Invariant 2.1 (Turn 0 Tool Lockdown) enforced internally by the aggregate.
- [ ] `LiveVoiceSession.ts` simplified and adheres to Rule 8 (&le; 300 lines).
