# Spec 49: Unified `LlmGatewayClient` & Streaming Transport Consolidation

> **Governing Glossary:** `LlmGatewayClient`, `Evaluation Gate` ([GLOSSARY.md](../../../GLOSSARY.md))  
> **Governing ADRs:** [ADR 0003](../../adr/0003-omnipresent-ai-copilot-and-company-track-enrichment.md), [ADR 0005](../../adr/0005-unified-ai-gateway-and-slim-live-handshake.md)  
> **Domain Classification:** `Shared-Multi-Tenant` · `Internal` · Outbound HTTP/SSE/Binary proxy transport (`<60s` timeout)

---

## 1. Intent & Workload Envelope
Collapse `LlmExecutionEngine.ts` (231L), `httpRetry.ts` (83L), `practiceTutorStreaming.ts:callLiteLlm`, and the 7 bypassing raw `fetch` blocks across `SystemDesignProbeGateway.ts`, `systemDesignEvaluator.ts`, `dynamicTaskGenerator.ts`, `routes/practiceTutor.ts`, `routes/triage.ts`, `PodcastAudioPipeline.ts`, and `VectorEmbeddingRepository.ts` behind one deep instantiable module: `LlmGatewayClient(HttpTransportPort)`. Every backend AI modality (chat text, structured JSON, SSE streaming, TTS speech bytes, embeddings) inherits uniform Bearer auth, `host.docker.internal -> localhost` failover, Full-Jitter retries, structured `LlmGatewayUnavailableError` mapping, and `AbortSignal` cancellation.

---

## 2. Explicit Non-Goals (Blast-Radius Protection)
- Do NOT modify `LiteLLM_Proxy` container configuration or external OpenAI-compatible HTTP endpoints (`/v1/chat/completions`, `/v1/audio/speech`, `/v1/embeddings`).
- Do NOT rewrite downstream domain prompts (`systemDesignPrompts.ts`, `triagePrompts.ts`, `BugChallengeGeneratorService.ts` prompt builders).
- Preserve deterministic hash fallback in `VectorEmbeddingRepository.embedText` (by calling `embed` with `maxRetries: 0, timeoutMs: 4000` inside `try/catch`).
- Preserve `LlmGatewayUnavailableError` export from `dynamicTaskGenerator.ts` (re-exported) so `test_tutor_zero_phantom_fallback.js` stays intact.
- Keep all source files `<= 350` lines (new) / `<= 400` lines (modified).

---

## 3. Pre-Agreed Verification Seams
- **Primary Seam:** `LlmGatewayClient` constructed with an injectable `HttpTransportPort` (`completeText`, `completeJson`, `streamChat`, `requestBinary`, `embed`).
- **Real / Substitutable Dependencies (`ports & adapters`):** Production `FetchTransportAdapter` delegating to `globalThis.fetch`; in-memory `InMemoryTransportAdapter` simulating `429`, `502/503`, `ECONNREFUSED host.docker.internal -> localhost`, pre-stream vs mid-stream SSE aborts, binary audio chunks, and embedding responses without mutating `envConfig.proxy.chatUrl`.
- **Verification Commands (CI):** `npm run build && npm run test:practice:resilience && node tests/test_tutor_zero_phantom_fallback.js && node tests/test_llm_gateway_client.js && node tests/test_phase02_epistemic_symmetry.js`.

---

## 4. Formal Wire & Messaging Contracts

```ts
export interface HttpTransportRequest {
  url: string;
  headers: Record<string, string>;
  body: string;
  signal?: AbortSignal;
}

export interface HttpTransportPort {
  postJson(req: HttpTransportRequest): Promise<globalThis.Response>;
}

export interface LlmGatewayClient {
  completeText(options: LlmExecutionOptions): Promise<string>;
  completeJson<T = unknown>(options: LlmExecutionOptions): Promise<T>;
  streamChat(options: LlmExecutionOptions): AsyncIterable<string>;
  synthesizeSpeech(input: { text: string; voice: string; model?: string; responseFormat?: 'mp3' | 'pcm'; speed?: number; abortSignal?: AbortSignal; maxRetries?: number }): Promise<Buffer>;
  embed(input: { model?: string; input: string; timeoutMs?: number; maxRetries?: number; abortSignal?: AbortSignal }): Promise<Float32Array>;
}
```
- **SSE Route Retry Contract:** `streamChat` applies Full-Jitter retry + `localhost` failover **strictly before** opening/reading the response stream; mid-stream disconnects throw cleanly so `streamTutorSse` emits `{ error }` without replaying already-flushed tokens.
- **Cancellation Contract:** `routes/practiceTutor.ts` (`/chat`, `/hint`, `/rule-grounding`) and `routes/triage.ts` (`/evaluate`, `/probe`) bind request `close` `AbortController` to `LlmGatewayClient`.

---

## 5. Storage & Zero-Downtime Migration Contract
- Stateless transport client over `envConfig.proxy.*`; zero SQLite DDL or stored schema changes. Export backwards-compatible singleton `llmGateway` alongside `LlmExecutionEngine` façade during Expand -> Migrate -> Contract deletion of `httpRetry.ts`.

---

## 6. Hoare-Logic Behavioral Contracts ({P} C {Q})
- `{P}` Valid `LlmExecutionOptions` + active `HttpTransportPort` + optional `abortSignal`.
- `{C}` Resolve endpoint & Bearer header -> execute `HttpTransportPort.postJson` with composed `(timeoutMs, abortSignal)` and Full-Jitter backoff on `[429, 500, 502, 503, 504]` -> fail over `host.docker.internal -> localhost` once per network failure unless aborted -> parse/repair JSON or stream UTF-8 SSE `choices[0].delta.content`.
- `{Q}` Returns trimmed text / repaired JSON / `Buffer` / `Float32Array` / async token delta stream; aborts immediately on `abortSignal` without sleeping; throws typed `LlmGatewayUnavailableError` (`rate_limit_exceeded`, `proxy_unreachable`, `upstream_timeout`, `schema_parse_error`) on exhausted transient failures.
- **Orthogonal Invariant:** `test_phase02_epistemic_symmetry.js` check on `systemDesignEvaluator.ts` (`conversationHistory` forwarded to prompt builder) and `TreeEditDistanceGuard` post-stream check in `streamTutorSse` remain preserved verbatim.
