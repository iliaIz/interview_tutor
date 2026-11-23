# 02: [Tracer-Bullet] PodcastOrchestrator and Audio DSP Pipeline

**Archetype:** Tracer-Bullet
**Blocked by:** None (can start immediately)
**Status:** ready-for-agent

## What to Build
Decompose the 839-line monolithic `backend/src/services/podcast.ts` into single-responsibility, bounded modules:
1. `backend/src/services/podcast/PodcastAudioPipeline.ts`: Pure binary WAV RIFF stitching and ffmpeg Opus transcoding (&le; 250 lines).
2. `backend/src/services/podcast/PodcastJobManager.ts`: Concurrency queue, job state persistence in SQLite, and SSE events (&le; 250 lines).
3. `backend/src/services/podcast/PodcastScriptGenerator.ts`: LLM dialogue prompt construction and parsing via `LlmExecutionEngine` (&le; 200 lines).
4. `backend/src/services/podcast.ts`: Thin delegating facade (&le; 90 lines) preserving full backwards compatibility for all existing callers.

## Pre-Agreed Verification Seam & Command
- **Testing Seam**: `backend/src/services/podcast/PodcastAudioPipeline.ts` and `backend/src/services/podcast.ts`.
- **Dependencies**: SQLite, child_process (ffmpeg).
- **Verification Command**: `remote-verify`

## Embedded Contract Slice & Invariants
- **Contract Fragment**:
```typescript
export interface GeneratePodcastOptions {
  questionIds?: string[];
  topicId?: string;
  topicName?: string;
  tone?: string;
  length?: string;
  language?: string;
  mode?: 'solo' | 'duo';
  voice1?: string;
  voice2?: string;
}
```
- **Invariants**: All modified files &le; 400 lines, all new files &le; 350 lines. Preserves `getJob`, `saveJob`, `synthesizeTTSBuffer`, `synthesizeTTSWithRetry`, `globalJobEmitter` exports.

## Explicit Non-Goals
- Do not alter audio format (WAV 24kHz / Opus 48kbps).
- Do not change API contract of `GET /api/podcast/:jobId` or `POST /api/podcast/generate`.

## Acceptance Criteria
- [ ] `podcast.ts` reduced from 839 lines to &le; 100 lines.
- [ ] `PodcastAudioPipeline` handles WAV stitching and Opus encoding.
- [ ] `PodcastJobManager` manages concurrency and state.
- [ ] Existing endpoints and scripts continue to function without changes.
