# DEEP RESEARCH PROMPT1: Gemini 3.8 Live Extended Thinking WebSocket Protocol Specification — State Machines, interaction_status, Audio Fillers, and Client Invariants (September 2026 Benchmark)

### Context & Problem Statement
We run a real-time voice AI interview and tutoring platform. Our audio engine communicates with Google Gemini Live API over bidirectional WebSockets (via our custom internal gateway).

In standard Live models (gemini-3.8-live), the turn lifecycle is simple:
1. When the model finishes speaking, the server emits `serverContent.turnComplete: true`.
2. The client plays out PCM audio chunks through Web Audio API.
3. The microphone unlocks when BOTH the audio playout queue has finished draining AND `turnComplete: true` is received.

Google has released `gemini-3.8-live-extended-thinking`, which introduces background reasoning, asynchronous tool calls, and parallel conversational audio fillers. In this model, `turnComplete: true` only indicates the end of a specific speech fragment, while the interaction lifecycle is governed by `interaction_status` (`IN_PROGRESS` vs `IDLE`).

---

### Research Mandate:

#### 1. Exact Upstream Protocol Specification
- What is the complete JSON schema of messages exchanged with `gemini-3.8-live-extended-thinking` over the Live WebSocket connection?
- How are reasoning traces (`thought` chunks) formatted in `serverContent`? (Are they text parts with a `thought` boolean flag, separate payload frames, or metadata?)
- How are conversational filler audio chunks distinguished from the final core response audio in the stream?

#### 2. The `turnComplete` vs `interaction_status` Lifecycle
- What are the exact state transition rules from connection setup to turn completion?
- Under what circumstances is `turnComplete: true` emitted while `interaction_status` remains `IN_PROGRESS`?
- What happens if the candidate speaks or sends `clientContent` while `interaction_status` is `IN_PROGRESS`? Does it cause an immediate barge-in interruption of the thinking process, or is it queued?

#### 3. Client-Side State Machine & Audio Synchronization
- How should client audio engines handle the sequence: `[Filler Audio]` -> `[Thinking Pause]` -> `[Core Answer Audio]` without prematurely unlocking the user microphone or timing out on silence?
- What invariant or state machine guarantees zero audio collisions and eliminates race conditions between candidate audio recording and model multi-step generation?

#### 4. Setup & Thinking Configuration (`BidiGenerateContentSetup`)
- What exact fields are supported in `BidiGenerateContentSetup` for `gemini-3.8-live-extended-thinking`?
- How do `thinkingLevel` (`minimal`, `low`, `medium`, `high`), `thinkingBudget`, and `includeThoughts` interact? Which ones are valid vs deprecated in Gemini 3.8?

---

### Deliverables:
1. **Mermaid State Machine diagram** for the Extended Thinking turn lifecycle.
2. **Protocol Sequence Diagram**: client audio in -> model filler -> background thinking/tools -> core answer -> `interaction_status: IDLE`.
3. **Summary checklist** of client-side state machine invariants for zero-race audio playout.
