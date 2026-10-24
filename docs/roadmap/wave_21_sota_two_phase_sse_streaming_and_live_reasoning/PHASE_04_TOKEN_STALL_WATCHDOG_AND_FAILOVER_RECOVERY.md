# Phase 4: Token Stall Watchdog, Keepalive Pings & Stream Failover
## Anti-Stall Guard & Resilient Reconnection Architecture

> **Phase:** 4 of 5  
> **Status:** Draft / Specification  
> **Target Subsystem:** `backend/src/services/bugChallengeStreamService.ts`, `frontend/src/hooks/useBugChallengeStream.ts`  
> **Dependencies:** Phase 2, Phase 3  

---

## 1. Context & Objective

Streaming through proxy and cellular networks introduces two catastrophic failure modes if left unmitigated:
1. **Silent Upstream Freeze (Vocoder/Inference Deadlock):** Gemini stops emitting chunks, but keeps the TCP socket open. Without a watchdog, the candidate waits forever.
2. **Intermediate TCP Reset:** NAT gateways close idle TCP sockets after 60s if no bytes flow.

---

## 2. Technical Specification

### 2.1. Inter-Chunk Watchdog Contract
- The backend `bugChallengeStreamService` maintains a sliding `lastTokenTimestamp`.
- If no token arrives from LiteLLM Proxy within **12.0 seconds**:
  - The backend logs: `[TokenWatchdog] Upstream inference stalled for >12s. Triggering emergency fast cascade...`
  - The backend aborts the current upstream fetch request via `AbortController`.
  - The backend automatically initiates a fallback attempt to `gemini-3.6-flash`.
  - The backend emits an SSE event to the client:
    ```
    event: cascade_fallback
    data: {"reason": "Upstream thinking delay, accelerating with fast model..."}
    ```
  - The candidate sees a smooth badge transition (*«Переключаюсь на ускоренную модель...»*) instead of a broken error card.

### 2.2. Keepalive Heartbeats
Every 15 seconds, if no thoughts have been sent, the backend sends a comment line:
```
: keepalive ping
```
This guarantees that intermediate reverse proxies (Caddy, Cloudflare, AWS ALB) never close the connection.

---

## 3. Verification Gate (Gate 4)

1. Automated test simulating a mock upstream stall at second 12.
2. Assert that watchdog triggers fallback without crashing the SSE response.
3. Assert that client hook receives `cascade_fallback` and seamlessly transitions to the fallback stream.
