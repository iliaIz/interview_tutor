# Functional Registry & Decision Log (SSOT)

> **Location:** `docs/architecture/functional_registry/INDEX.md`  
> **Status:** Authoritative Navigation Hub (Max Depth: 2)  
> **SOTA Standard:** Late 2026 Modular Agent Memory & Decision Traceability

---

## 1. Architectural Purpose & Invariant

This registry maintains an explicit, traceable, and empirically verified record of all subsystems and functions modified during the platform's voice and real-time AI development.

### The Immutable Agent Rule
> **MANDATORY PRE-MODIFICATION CONSULTATION:**  
> Before altering or proposing changes to ANY function in the listed subsystems, every agent MUST:
> 1. Consult the corresponding subsystem file in this registry.
> 2. Verify the historical rationale, hypotheses tested, and verified failure modes.
> 3. After implementation, append the new modification, empirical findings, and rationale to the registry.
> 4. NEVER treat downstream symptoms without confirming root cause via server and proxy telemetry.

---

## 2. Subsystem Hierarchy (Depth = 1)

| ID | Subsystem | Domain / Layer | Primary Files | Registry Document |
| :--- | :--- | :--- | :--- | :--- |
| **01** | **Backend Live Audio Stream Router** | Node.js / WebSocket Gateway | `backend/src/services/audio/` | [`01_backend_live_audio_router.md`](./01_backend_live_audio_router.md) |
| **02** | **Gemini Live Config & System Prompts** | Protocol & Persona Spec | `backend/src/services/audio/` | [`02_gemini_config_and_prompts.md`](./02_gemini_config_and_prompts.md) |
| **03** | **LiteLLM Proxy & Upstream Bidi Gateway** | Python FastAPI / Proxy Layer | `LiteLLM_Proxy/gateway/` | [`03_litellm_proxy_gateway.md`](./03_litellm_proxy_gateway.md) |
| **04** | **Client Voice Engine & Audio DSP** | Frontend Web Audio / Worklet | `frontend/src/utils/audio/` | [`04_client_voice_engine_dsp.md`](./04_client_voice_engine_dsp.md) |
| **05** | **Verification Harness & Acoustic Canary** | CI/CD & Headless Replay | `backend/tests/audio/` | [`05_verification_and_canary_pipeline.md`](./05_verification_and_canary_pipeline.md) |
| **06** | **Practice Evaluation & Review Console** | Backend SSE / Frontend Console | `backend/src/services/` & `frontend/` | [`06_practice_evaluation_and_sandbox_pipeline.md`](./06_practice_evaluation_and_sandbox_pipeline.md) |
| **07** | **Refactoring Arena & Voice Code Review** | Practice / AST Sandbox / Voice Review | `backend/src/services/sandbox/` & `backend/src/services/live/` | [`07_refactoring_arena_subsystem.md`](./07_refactoring_arena_subsystem.md) |
| **08** | **Generic HR Voice Simulator Engine** | Voice HR Screening & Micro-Drill | `backend/src/services/live/` & `frontend/src/` | [`08_hr_voice_simulator_engine.md`](./08_hr_voice_simulator_engine.md) |

---

## 3. Scope Boundary & File Length Policy
- Each subsystem document strictly maintains a **Depth $\le 2$** listing (Subsystem $\rightarrow$ Functions touched).
- Documentation files adhere to the **$\le 350$ lines limit**.
- Only functions actively touched and refactored are cataloged (no speculative or legacy dormant code).
