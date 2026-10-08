# Deep Research Inquiry 03: Session Resumption & Lifecycle Management in Gemini Live

> **Inquiry ID:** `W14-INQ-03`  
> **Topic:** Canonical Session Resumption (`sessionResumptionUpdate`) & Reconnection Contracts  
> **Target Models:** `gemini-3.8-live`, `gemini-3.8-live-extended-thinking`  
> **Standard:** Google GenAI SDK (`@google/genai` >= 2.3.0) & Bidi WebSocket Protocol  

---

## 1. Deep Research Prompt (Copy & Paste)

```text
Conduct a comprehensive technical inquiry into the official Session Resumption and Reconnection protocols for Google Gemini 3.8 Live Multimodal WebSocket API (generativelanguage.googleapis.com / BidiGenerateContent).

Investigate how production systems must handle transient network disconnects, server-initiated GoAway signals, and connection lifetime limits (~10 minutes) without losing conversation state or causing conversational anomalies.

Investigate the following architectural mechanisms:
1. sessionResumptionUpdate Specification: What is the formal protobuf and JSON definition of sessionResumptionUpdate emitted by the upstream Gemini server? What do the fields newHandle (or resumptionHandle) and resumable signify? How frequently does the server refresh this handle?
2. Resumption Setup Handshake: When reconnecting after a dropped WebSocket, what is the exact JSON structure of the initial setup frame required to resume the previous session? Where is the resumption handle passed (e.g. setup.sessionResumption.handle)?
3. Contrast with Brute-Force Turn Replay: Why is manually replaying previous conversation turns (via clientContent.turns) considered an anti-pattern upon reconnect? What happens when a client injects historical text turns into a fresh session while the user is actively speaking into the microphone? How does this cause out-of-context answers ("ответил не в попад")?
4. Server GoAway and Graceful Migration: Does Gemini 3.8 Live send a GoAway frame or pre-close signal before terminating long-running connections (e.g., at the 10-minute boundary)? What is the canonical pattern for seamless session migration without audio dropout?
5. Reference Implementations: Provide TypeScript and Python code examples demonstrating robust session resumption using the official @google/genai SDK and raw WebSockets.
```

---

## 2. Technical Focus Areas & Specific Verification Targets

- **Handle Expiration:** What is the TTL (time-to-live) of a `resumptionHandle` after a WebSocket connection drops (e.g. 60 seconds, 5 minutes)?
- **State Restored vs Not Restored:** When a session is resumed via `resumptionHandle`, does Gemini retain:
  - System instructions and tool declarations?
  - Audio history / speech context?
  - Pending asynchronous function calls?
  - Ephemeral token context?
- **Handling Resumption Failures:** What error code does Gemini emit if a `resumptionHandle` is invalid or expired (e.g., code 1008, 1011, or 400)? How should the client gracefully degrade?

---

## 3. Expected Deliverables in Research Report

1. Complete sequence diagram showing clean Session Resumption vs failed/corrupted manual replay.
2. Verified TypeScript interface for the `sessionResumption` configuration in `setupMessage`.
3. Concrete blueprint for replacing our application's `LiveGreetingReplay.ts` reconnect logic with native Google session resumption.
