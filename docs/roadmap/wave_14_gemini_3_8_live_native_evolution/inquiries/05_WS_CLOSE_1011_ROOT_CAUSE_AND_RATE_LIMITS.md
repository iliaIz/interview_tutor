# Deep Research Inquiry 05: Root Causes of WebSocket Close Code 1011 & Quota Diagnostics

> **Inquiry ID:** `W14-INQ-05`  
> **Topic:** Dissecting WebSocket Close 1011 ("Internal Error / Quota Exceeded") on Paid Pro Accounts  
> **Target Models:** `gemini-3.8-live`, `gemini-3.1-flash-live-preview`, `gemini-2.5-flash`  
> **Standard:** Google Generative Language API WebSocket Gateway & Google Cloud Quotas  

---

## 1. Deep Research Prompt (Copy & Paste)

```text
Conduct an in-depth forensic investigation into WebSocket Close Code 1011 (Internal Error) returned by Google Generative Language API (wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent) during Gemini Live sessions.

Focus on accounts with active Google AI Studio Pro subscriptions or Google Cloud Pay-as-you-go billing, where the close reason explicitly states:
"ConnectionClosedError: received 1011 (internal error) You exceeded your current quota, please check your plan and billing details."
despite dashboard metrics showing usage far below token-per-minute (e.g. < 5,000 tokens consumed out of 65,000+ TPM limit).

Investigate the exact technical triggers for this error:
1. "Quota Exceeded" as a Gateway Catch-All: In Google's Generative Service infrastructure, when does the API gateway return close code 1011 with the "quota exceeded" text for reasons other than actual monthly/daily credit exhaustion? Does this occur on:
   - Exceeding the maximum allowed Concurrent Bidirectional Streaming Sessions (e.g. 1 concurrent connection cap on certain tiers)?
   - Rapid sequential connection attempts within a sliding window (soft throttling / connection rate limit)?
   - Slow TCP close / delayed session cleanup leaving "ghost" sessions active on Google's backend?
2. Protocol Schema Violations Triggering 1011: What specific client payload errors cause Google's WebSocket gateway to terminate with 1011 rather than sending a structured error frame or 1008 Policy Violation? (e.g., unexpected JSON attributes in realtimeInput, sending clientContent mid-audio, malformed automaticActivityDetection objects, or unsupported temperature values).
3. Session State Corruption: Does sending two consecutive user turns with role: "user" in clientContent.turns cause an internal model exception resulting in close code 1011?
4. Multi-Key Pooling & Proxy Behavior: When routing through a reverse proxy (such as LiteLLM Gateway), how do connection pooling, key rotation (round-robin), and close code masking (e.g. proxy closing downstream socket with 1000 instead of forwarding 1011) exacerbate reconnection storms?
5. Mitigation & Diagnostic Checklist: What authoritative tools, Google Cloud metrics (e.g. "Bidi generate content concurrent requests"), and client-side backoff algorithms are required to completely prevent 1011 disconnects?
```

---

## 2. Technical Focus Areas & Specific Verification Targets

- **Quota Taxonomy in Google Cloud:** Distinguish between `GenerateContentRequestsPerMinutePerProject`, `BidiGenerateContentConcurrentRequests`, and `TokensPerMinute`.
- **Close Reason Byte Truncation:** RFC 6455 limits WebSocket close reason strings to 123 bytes. Confirm the full un-truncated error message and URL referenced in `"For more information on this error, head to: h..."`.
- **Behavior of Pro vs Free API Keys:** Contrast exact concurrent session quotas and RPM limits between free AI Studio keys and projects with linked Google Cloud Billing.
- **Connection Storm Cascade:** Document how a client attempting 3 reconnects in < 5 seconds triggers IP-level or project-level circuit breakers at Google.

---

## 3. Expected Deliverables in Research Report

1. Definitive taxonomy of all root causes generating WebSocket 1011 errors on Google Gemini Live.
2. Step-by-step diagnostic verification guide using Google Cloud Console metrics.
3. Strict client-side gateway invariant specifications to prevent rapid reconnection loops and eliminate close code masking.
