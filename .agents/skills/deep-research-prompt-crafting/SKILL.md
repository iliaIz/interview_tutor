---
name: deep-research-prompt-crafting
description: SOTA Late-2026 protocol for crafting unanchored, bias-free, first-principles Deep Research inquiries and system prompts. Prevents the Obsolete Version Trap, enforces zero-anchoring discovery, and bounds inquiries by physical and protocol invariants.
---

# Deep Research Prompt Crafting & Inquiry Architecture (Late 2026 SOTA)

> **Subsystem:** Research-Driven Architecture, Autonomous Discovery & Prompt Engineering  
> **Target Standard:** SOTA Late 2026 (Unanchored Inquiry, First-Principles Framing, Anti-Bias)  
> **Scope:** Deep Research batteries, architectural discovery, and advanced LLM system prompts.

---

## 1. Executive Charter & Core Problem

When formulating prompts for Deep Research engines (Gemini Deep Research, Perplexity, Claude Research, OpenAI Deep Research), AI assistants frequently fall into the **Obsolete Knowledge & Anchoring Trap**:
1. **The Version-Anchoring Trap:** The author names specific historical libraries, tools, or versions (e.g. "RNNoise", "Silero v5", "DeepFilterNet v2"). Search and research models anchor on those exact tokens, searching historical literature from 2022–2024 and completely missing modern 2025–2026 breakthroughs (e.g. State-Space Models for audio DSP, WebGPU streaming neural filters, or new foundation models).
2. **The Symptom-Patching Trap:** Prompts ask how to fix a surface symptom (e.g. "how to turn down mic volume on cough") instead of digging into the root cause via physical acoustics and protocol state machines.
3. **The Unbounded Protocol Trap:** Prompts fail to state hard upstream invariants, leading the research engine to recommend solutions that violate protocol contracts (e.g. sending `audioStreamEnd` during dialogue, causing WebSocket Close 1011).

---

## 2. Fundamental Invariants of Prompt Crafting

### Invariant 1: Capability & Constraint Over Brand Names (First Principles)
Never ask: *"Should we use Library A or Library B?"*  
Always ask: *"What models or algorithms achieve [Latency SLA $\le 10$ms, Zero-Allocation Memory, Objective Metric PESQ $> 3.2$] under [Hardware / Protocol Constraints] as of late 2026?"*

### Invariant 2: Explicit Anchoring Isolation
- **Fixed System Ground Truth:** Anchor *only* what is immutable in the current system (e.g., upstream engine is Google Gemini 3.8 Live over WebSocket `BidiGenerateContent` with 16kHz Mono PCM).
- **Unanchored Frontier Discovery:** All client-side tools, edge neural runtimes, DSP libraries, and VAD algorithms must be explicitly declared as *unanchored targets of discovery*.

### Invariant 3: Mandatory Anti-Anchoring Clause
Every Deep Research prompt MUST contain an explicit `RESEARCH METHODOLOGY MANDATE (ZERO-ANCHORING)` instructing the model to reject historical bias and survey the frontier current to late 2026.

### Invariant 4: Protocol & Physical Fencing
Every prompt MUST explicitly enumerate known protocol failure modes (e.g. WebSocket 1011 on stream termination, 1008 on tool audio leaks, KV-cache truncation on false barge-in) so the research engine does not propose illegal mechanisms.

---

## 3. Canonical 6-Section Deep Research Prompt Structure

When authoring prompts for Deep Research, adhere strictly to this canonical layout:

```markdown
Role: [Specific Principal / Staff Specialist Title] (State-of-the-Art Late 2026).

Context:
[Concrete description of the As-Is production environment, active workloads, 
hardware constraints, and the verified empirical root-cause defect.]

PROVEN PROTOCOL INVARIANTS & HARD BOUNDARIES:
[Explicit enumeration of what MUST NOT be broken: forbidden API signals,
hardware limits, sample rate invariants, memory constraints.]

RESEARCH METHODOLOGY MANDATE (ZERO-ANCHORING):
Do NOT restrict your inquiry to historical or legacy 2022–2024 models, tools, 
or algorithms. You are tasked with discovering and surveying the true State of the Art 
as of late 2026. If newer architectures or paradigms have emerged as the industry 
standard, you must identify, benchmark, and evaluate them.

Inquiry & Technical Scope:
1. [Dimension 1: SOTA Frontier Discovery & Landscape Survey]
2. [Dimension 2: Mathematical / Algorithmic Formulation & Feature Extraction]
3. [Dimension 3: Memory, Concurrency & Execution Contracts (e.g. Zero-Allocation)]
4. [Dimension 4: Failure Modes, Edge Cases & Empirical Benchmarks]

Deliverable Requirements:
[Exhaustive report requirements: exact mathematical equations, state machine tables,
TypeScript/WASM code, latency budgets, and architecture diagrams.]
```

---

## 4. Multi-Plane Battery Decomposition (MFRDA)

Never combine unrelated architectural concerns into a single monolithic prompt. Decompose the challenge into orthogonal planes:

```
┌────────────────────────────────────────────────────────┐
│             ARCHITECTURAL CHALLENGE                     │
└──────────────────────────┬─────────────────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         ▼                 ▼                 ▼
   [Plane 1: DSP]   [Plane 2: Model]  [Plane 3: Protocol]
   Edge Audio DSP    Neural Phonetic   Cloud WebSocket
   & WASM Execution     Activity VAD    State Handshake
```

1. **Plane 1 (Infrastructure & DSP):** Compute runtimes, WASM SIMD / WebGPU, audio graph topologies, zero-copy buffer management.
2. **Plane 2 (Machine Learning & Mathematics):** Feature extraction, ROC trade-offs (FPR vs FNR), neural model architectures, temporal hysteresis math.
3. **Plane 3 (Protocol & Session Arbitration):** WebSocket frame contracts, buffer flushing, Cloud VAD synergy, session resumption, tool execution mutexes.
4. **Plane 4 (HCI & Domain UX):** Cognitive load dynamics, visual feedback, backchanneling vs turn seizure, psychological safety.

---

## 5. Pre-Flight Prompt Quality Checklist

Before committing or dispatching any research prompt, verify:

- [ ] **No Obsolete Versions:** Are all references to historical versions (e.g. "v2", "v3", "2023") removed or labeled strictly as baselines?
- [ ] **Zero-Anchoring Clause Present:** Is the explicit late-2026 discovery mandate included?
- [ ] **First-Principles Constraints:** Are hardware budgets (CPU, memory, latency) and mathematical requirements clearly stated?
- [ ] **Protocol Invariants Guarded:** Are known fatal errors (e.g. WebSocket 1011, 1008, KV corruption) explicitly documented?
- [ ] **Orthogonal Separation:** Does this prompt focus on a single plane without blurring into others?
- [ ] **Actionable Deliverable:** Does it demand concrete formulas, state machines, and code rather than generic high-level prose?
