# 01: [Tracer-Bullet] Unify LLM Client & Prompt Execution Engine (LlmExecutionEngine)

**Archetype:** Tracer-Bullet
**Blocked by:** None (can start immediately)
**Status:** ready-for-agent

## What to Build
Implement the deep `LlmExecutionEngine` module that encapsulates all LiteLLM proxy communication, network failover (`host.docker.internal` -> `localhost`), Invariant 5 Full-Jitter Exponential Backoff on 429/503 errors, markdown fence stripping, and JSON regex repair. Migrate `backend/src/services/geminiText.ts` and `backend/src/services/BugChallengeGeneratorService.ts` to call `LlmExecutionEngine.executeJson<T>()` and `executeText()`.

## Pre-Agreed Verification Seam & Command
- **Testing Seam**: `backend/src/services/LlmExecutionEngine.ts`
- **Verification Command**: `remote-verify` (running prompt invariant and unit test suites in cloud runner)

## Embedded Contract Slice & Invariants
- Enforce Invariant 1: Proxy routing strictly via `envConfig.proxy.chatUrl` with Bearer auth.
- Enforce Invariant 5: Two retries with Full-Jitter Exponential Backoff ($T = \text{random}(0, \min(2500, 800 \times 1.8^{\text{attempt}}))$) on HTTP 429 and 503.
- Robust JSON Extraction: Strip ```json fences, repair unescaped control chars, and map unrecoverable errors to `LlmGatewayUnavailableError`.

## Explicit Non-Goals
- Do not modify voice multimodal streaming routes (`backend/src/routes/voice.ts`).
- Do not alter system prompt texts in `backend/src/prompts/core/antiSycophancy.ts`.

## Acceptance Criteria
- [ ] `LlmExecutionEngine.ts` exists with `executeJson<T>` and `executeText` methods ($\le 350$ lines).
- [ ] `BugChallengeGeneratorService.ts` and `geminiText.ts` use `LlmExecutionEngine` instead of raw ad-hoc `fetch`.
- [ ] Unit tests for prompt invariants remain 100% green.
