# Wave 14: Gemini 3.8 Live Native Architecture Evolution (Zero-Middleware)

> **Status:** Research & Inquiry Battery Phase (SOTA Late 2026)  
> **Methodology:** Multi-Faceted Research-Driven Architecture (MFRDA)  
> **Goal:** Eliminate custom middleware crutches, resolve WebSocket 1011 errors, and transition to canonical Google Gemini 3.8 Live native protocols.

---

## 1. Executive Summary & Problem Statement

Recent diagnostic testing in the platform's Practice Mode revealed that our application-level middleware layers (client-side Silero VAD, manual turn endpointing via `audioStreamEnd`, aggressive hot-reconnect loops, and brute-force turn replay) interfere with the native capabilities of **Gemini 3.8 Live** (`gemini-3.8-live`).

When tested in baseline isolation ("Step 0" out-of-the-box), Gemini 3.8 Live operates with pristine low-latency voice quality. However, when integrated with complex multi-file workspaces and platform middleware:
1. WebSocket sessions unexpectedly drop with `ConnectionClosedError: 1011 (internal error) You exceeded your current quota` despite active Pro subscriptions and low TPM usage.
2. Reconnect routines replay old dialogue turns mid-speech, causing the model to answer irrelevantly ("не впопад").
3. Rapid reconnection cascades exhaust gateway circuit breakers across the key pool.

Rather than introducing further band-aids or crutches, Wave 14 executes an unanchored Deep Research investigation to align our system directly with Google's canonical SOTA specifications.

---

## 2. Research Inquiry Battery (Inquiries Suite)

The research battery consists of 6 orthogonal, unconstrained inquiry specifications located in `inquiries/`:

| # | Inquiry Specification | Primary Investigation Plane |
|---|---|---|
| **01** | [`inquiries/01_NATIVE_CLOUD_VAD_AND_TURN_DETECTION.md`](inquiries/01_NATIVE_CLOUD_VAD_AND_TURN_DETECTION.md) | Native End-to-End Multimodal Cloud VAD vs Client Silero VAD & `audioStreamEnd` signaling |
| **02** | [`inquiries/02_WORKSPACE_GROUNDING_AND_CODE_CONTEXT.md`](inquiries/02_WORKSPACE_GROUNDING_AND_CODE_CONTEXT.md) | Multi-file project workspace injection: System Instruction vs Context Caching vs Dynamic Read Tools |
| **03** | [`inquiries/03_SESSION_RESUMPTION_AND_LIFECYCLE.md`](inquiries/03_SESSION_RESUMPTION_AND_LIFECYCLE.md) | Canonical `sessionResumptionUpdate` protocol, `newHandle`, and clean recovery without turn replay |
| **04** | [`inquiries/04_ASYNC_FUNCTION_CALLING_AND_WHITEBOARD.md`](inquiries/04_ASYNC_FUNCTION_CALLING_AND_WHITEBOARD.md) | Non-blocking tool execution (`behavior: NON_BLOCKING`), interactive whiteboard sync & Turn 0 gating |
| **05** | [`inquiries/05_WS_CLOSE_1011_ROOT_CAUSE_AND_RATE_LIMITS.md`](inquiries/05_WS_CLOSE_1011_ROOT_CAUSE_AND_RATE_LIMITS.md) | Root cause analysis of Close Code 1011: schema violations, concurrent session caps vs token quotas |
| **06** | [`inquiries/06_ZERO_MIDDLEWARE_NATIVE_VOICE_ARCHITECTURE.md`](inquiries/06_ZERO_MIDDLEWARE_NATIVE_VOICE_ARCHITECTURE.md) | Minimalist Zero-Middleware voice agent blueprint (AudioWorklet + raw proxy + Google native standard) |

---

## 3. Workflow & Dispatch Instructions

1. **Human Dispatch:** Copy the prompt text from each inquiry file into advanced Deep Research tools (Gemini Deep Research, OpenAI Deep Research, Perplexity Pro).
2. **Report Ingestion:** Save the resulting synthesis reports into `docs/roadmap/reports/` with naming format:  
   `REPORT_W14_XX_<TOPIC>.md`.
3. **Master RFC Synthesis:** Once reports are ingested, an architectural RFC will be synthesized to strip unnecessary code and refactor the voice subsystem to native perfection.
