# Deep Research Inquiry 04: Asynchronous Tool Calling & Interactive Whiteboard Synchronization

> **Inquiry ID:** `W14-INQ-04`  
> **Topic:** Non-Blocking Function Calling (`behavior: NON_BLOCKING`) & Multimodal UI Coordination  
> **Target Models:** `gemini-3.8-live`, `gemini-3.8-live-extended-thinking`  
> **Standard:** Google GenAI SDK (`@google/genai` >= 2.3.0) & Bidi WebSocket Protocol  

---

## 1. Deep Research Prompt (Copy & Paste)

```text
Analyze asynchronous function calling and tool coordination in Google's Gemini 3.8 Live Multimodal WebSocket API (generativelanguage.googleapis.com / BidiGenerateContent) as of late 2026.

Focus on the interaction between continuous conversational voice streaming and real-time interactive canvas manipulation (e.g. updating architectural diagrams, writing code snippets, highlighting lines via an update_whiteboard function).

Investigate the following protocol and architectural dimensions:
1. behavior: NON_BLOCKING vs BLOCKING: What is the formal specification of behavior: "NON_BLOCKING" on FunctionDeclaration objects? How does Gemini 3.8 Live maintain continuous spoken dialogue while simultaneously emitting and waiting for asynchronous tool responses?
2. Interaction Lifecycle & interactionStatus: How does message.interactionStatus ("IN_PROGRESS" vs "IDLE") interact with tool calls? Why is turnComplete: true insufficient on models using extended thinking or async tools, and what is the exact state machine required on the client?
3. Tool Scheduling (SILENT, WHEN_IDLE, INTERRUPTED): What are the supported function scheduling modes in Gemini 3.8 Live, and what behavior do they produce when a tool call finishes while the model is actively speaking?
4. toolResponse Framing & Cancellation: What is the exact schema for sending toolResponse frames? What happens if the candidate interrupts the AI (barge-in) while an async tool is running? How does toolCallCancellation operate?
5. Prevention of Turn 0 Tool Hallucinations: How should an application prevent the voice agent from prematurely invoking final verdict/evaluation tools (e.g. submit_interview_evaluation) during the initial greeting turn (Turn 0) without triggering schema errors or model confusion?
6. Reference Architecture: Provide end-to-end TypeScript examples demonstrating non-blocking whiteboard synchronization coordinated with spoken explanations.
```

---

## 2. Technical Focus Areas & Specific Verification Targets

- **Audio-Visual Symbiosis:** When the model calls `update_whiteboard({ action: 'highlight', line: 42 })`, what spoken feedback should be instructed, and does the audio stream pause or stutter?
- **Tool Response Latency SLA:** Does Gemini Live expect `toolResponse` within a specific timeout window before discarding the tool call?
- **Schema Validation Strictness:** What data types are strictly allowed in parameters (e.g. `OBJECT`, `ARRAY`, `STRING`, `INTEGER`, `BOOLEAN`)? Does Gemini Live reject `type: "number"` vs `type: "NUMBER"` or open-ended objects?
- **Dynamic Tool Activation:** Can tool sets be enabled/disabled mid-session without dropping the WebSocket connection?

---

## 3. Expected Deliverables in Research Report

1. Protocol flow diagram illustrating non-blocking tool execution alongside spoken audio output.
2. Production JSON schema for an `update_whiteboard` and code-inspection tool suite.
3. Best practice directive for Turn 0 tool lockdown that does not violate the Gemini Live WebSocket contract.
