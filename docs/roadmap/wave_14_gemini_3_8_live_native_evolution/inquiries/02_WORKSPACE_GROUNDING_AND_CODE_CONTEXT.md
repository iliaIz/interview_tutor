# Deep Research Inquiry 02: Large Workspace Grounding & Code Context in Gemini Live

> **Inquiry ID:** `W14-INQ-02`  
> **Topic:** Repository Structure & Multi-File Code Grounding in Multimodal Live Audio  
> **Target Models:** `gemini-3.8-live`, `gemini-3.8-live-extended-thinking`  
> **Standard:** Google GenAI SDK (`@google/genai` >= 2.3.0) & Bidi WebSocket Protocol  

---

## 1. Deep Research Prompt (Copy & Paste)

```text
Investigate state-of-the-art patterns in late 2026 for feeding large multi-file codebases and technical project workspaces into a Google Gemini 3.8 Live bidirectional audio session (generativelanguage.googleapis.com / BidiGenerateContent).

Consider a scenario where an AI coding partner or technical interviewer must examine 3 to 10 source files (e.g. Java classes, unit tests, configuration files totaling 3,000 to 15,000 tokens) alongside the candidate's live voice.

Perform an architectural evaluation of the following four approaches:
1. Static System Instruction Injection: Embedding project files and XML manifests directly into setup.systemInstruction.parts during session setup. What are the context size limits, latency overheads on Time-to-First-Audio (TTFA), and audio quality implications?
2. Turn 0 Client Content Seeding: Sending repository files in the initial clientContent.turns payload immediately following setupComplete. Does having multiple user turns or a large initial turn cause WebSocket timeouts, rate limit spikes (TPM), or 1011 Internal Errors?
3. Gemini Context Caching (cachedContent): Can a Live WebSocket session reference a pre-cached context (cachedContent) containing the repository files? Is Context Caching officially supported for Gemini 3.8 Live BidiGenerateContent WebSockets in late 2026, and what is the exact setup syntax?
4. Dynamic Non-Blocking Tool Retrieval: Keeping initial prompt context minimal and equipping the model with asynchronous read tools (e.g., read_file(path), list_workspace_files(), get_code_outline(path)) with behavior: NON_BLOCKING. Does Gemini 3.8 Live reliably invoke read tools on demand during conversation without halting speech?

Which of these four architectures (or hybrid combination) is considered authoritative for production AI pair-programming and voice-based code review? Provide code examples, benchmark trade-offs, and token consumption analysis.
```

---

## 2. Technical Focus Areas & Specific Verification Targets

- **Token Budget & TTFA:** How does prompt size in `systemInstruction` (500 tokens vs 5,000 tokens) impact initial response latency (Time to First Audio).
- **ClientContent Multi-Turn Quirks:** What happens if `clientContent.turns` contains two consecutive `role: 'user'` turns (e.g., grounding turn followed by user prompt)? Does Gemini Live reject or merge consecutive identical roles?
- **Context Caching Feasibility:** Verify if `setup.cachedContent` or `setup.cache` is accepted in the Live WebSocket handshake protocol.
- **Dynamic Tool Overhead:** When the model calls a tool like `read_file` during live audio, what conversational filler is spoken, and how fast is round-trip tool execution?

---

## 3. Expected Deliverables in Research Report

1. Comparative evaluation matrix (TTFA, memory usage, token efficiency, developer ergonomics) across the 4 grounding strategies.
2. Verified schema for the optimal grounding mechanism in `@google/genai` TypeScript.
3. Concrete recommendation on whether the platform should migrate from Turn 0 XML manifests to `systemInstruction` or dynamic tool retrieval.
