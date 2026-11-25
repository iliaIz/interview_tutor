# Spec 45: Unified Backend Live Blueprint Builder (`LiveSessionBlueprintBuilder`)

> **Governing Glossary:** `Turn 0 Lockdown`, `LiveSessionBlueprint` ([GLOSSARY.md](../../../GLOSSARY.md))  
> **Governing ADRs:** [ADR 0002](../../adr/0002-pglite-wasm-sql-sandbox-and-curated-company-tracks.md), [ADR 0003](../../adr/0003-omnipresent-ai-copilot-and-company-track-enrichment.md)  
> **Domain Classification:** `Shared-Multi-Tenant` · `Internal` · `< 50ms` handshake resolution

---

## 1. Intent & Workload Envelope
Collapse the shallow configuration & setup chain (`SessionConfigurationResolver.ts`, `sessionInitFrameMerger.ts`, dead `liveWsSessionParams.ts`, `sessionConfigAuth.ts`, `LivePromptDirector.ts`) plus duplicated Turn 0 greeting / config resolution in `livekitAuthService.ts` and `LiveGreetingReplay.ts` into one deep `LiveSessionBlueprintBuilder`. Ensure `earlyQueue` `session_init` frames hydrate the blueprint *before* upstream Gemini setup is generated.

---

## 2. Explicit Non-Goals (Blast-Radius Protection)
- Do NOT alter upstream WebSocket reconnection state machine (`UpstreamGeminiPipe.ts`) or `LiveHotHandoffCoordinator.ts` contracts beyond consuming `blueprint.buildUpstreamSetup(handle)`.
- Do NOT change `liveDefaults.ts` public constants (`DEFAULT_VOICE_NAME`, `MIN_VAD_SILENCE_MS`, `MAX_VAD_SILENCE_MS`, `DEFAULT_VAD_PAUSE_MS`).
- Preserve `livePromptBuilder.ts` exported rubric/anchor helpers used by `verifyPrompts.ts`.

---

## 3. Pre-Agreed Verification Seams
- **Primary Seam:** `LiveSessionBlueprintBuilder.resolveFromRequest(req, rawInitFrame?, deps?)` and `LiveSessionBlueprintBuilder.resolveFromParams(params, deps?)` in `backend/src/services/live/LiveSessionBlueprintBuilder.ts`.
- **Dependencies:** `local-substitutable` (injectable optional challenge resolver, auth verifier, gap lookup) + `in-process` prompt, tool schema, and Gemini setup builder.
- **Verification Commands (CI):** `npm run test:prompts && npm run test:vad:unit && npm run test:telemetry:router`.

---

## 4. Formal Wire & Messaging Contracts

```ts
export interface LiveSessionBlueprint {
  readonly config: LiveSessionResolvedConfig;
  readonly systemPromptText: string;
  readonly toolDeclarations: any[];
  buildUpstreamSetup(resumptionHandle?: string): Record<string, unknown>;
  buildTurn0Greeting(runtime?: {
    seniorReview?: any;
    hrGuidedState?: HrGuidedSessionState | null;
    replayOverride?: string;
  }): string;
}

export interface BlueprintDependencies {
  authenticate?: (req: http.IncomingMessage, query: Record<string, unknown>) => AuthenticatedWsUser | null;
  findGaps?: typeof findRelevantCandidateGaps;
  getUserProfile?: typeof getUserProfile;
  resolveChallenge?: typeof resolveLiveChallengeContext;
}
```
- Deleted shallow modules (`SessionConfigurationResolver.ts`, `sessionInitFrameMerger.ts`, `liveWsSessionParams.ts`, `sessionConfigAuth.ts`, `LivePromptDirector.ts`) must leave zero dangling imports in `backend/src/`.

---

## 5. Storage & Zero-Downtime Migration Contract
- Pure `in-process` resolution + read-only SQLite/JSON manifest lookups; zero SQL schema changes and 100% wire compatibility with Gemini 3.8 Live `setup` frames (`contextWindowCompression.slidingWindow` & canonical `sessionResumption`).

---

## 6. Hoare-Logic Behavioral Contracts ({P} C {Q})
- `{P}` Valid `http.IncomingMessage` (with auth token/ticket) + optional early `session_init` payload.
- `{C}` Authenticate once, resolve base challenge/question + merge `rawInitFrame` completely (both metadata/workspace fields and `voice`/`turnMode`/`vadPauseMs`/`hrMode`/`startBeatId`/`beatScope`/`academyBridgeContext`/`seniorReview`), assemble prompt, tools, and setup builder.
- `{Q}` `blueprint.buildUpstreamSetup(handle)` carries every field from both HTTP query and `session_init` on first upstream open; `livekitAuthService` and `LiveGreetingReplay` emit identical Turn 0 greetings for equivalent `sessionType`/`tutorMode`/`questionIndex`.
