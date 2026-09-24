# Stage 4: Agent Instructions, File-Hygiene Standards & Static Complexity Guards

> **Document:** `STAGE_04_AGENT_FILE_HYGIENE_AND_COMPLEXITY_GUARDS.md`  
> **Parent Roadmap:** [00_WAVE_10_MASTER_ROADMAP.md](file:///d:/projects/interview_projects/spring/docs/roadmap/wave_10_unified_headless_voice_engine_and_file_hygiene/00_WAVE_10_MASTER_ROADMAP.md)  
> **Target Branch:** `refactor/wave-10-unified-voice-engine-and-file-hygiene`  
> **Target Files:** `AGENTS.md`, `.agents/skills/auto-vad-diagnostics/SKILL.md`, `package.json`, ESLint / CI scripts  
> **Target Commit Message:** `chore(rules): enforce 350-line file ceiling, Auto-VAD SSOT binding, and anti-duplication guards`

---

## 1. Problem Statement: Why AI Agents Introduce Tech Debt

A systematic review of AI agent behavior across past development cycles revealed why architectural decay occurs:

1. **Monolith Avoidance Bias (Duplicate Rather Than Refactor):**
   When an agent is asked to implement a new feature (e.g. `ProjectDefenseStudio`) and encounters an existing 4,000-line monolith (`VoiceModal.tsx`), it avoids refactoring because touching a 4,000-line file carries high risk of regression and exceeds typical LLM token context focus. Consequently, the agent duplicates 500 lines of WebSocket and Web Audio boilerplate into a new file.
2. **Lack of Enforceable File Bounding:**
   Without static rules or lint checks, files grow incrementally (20 lines here, 50 lines there) until they become unmaintainable God Objects.
3. **Absence of Canonical SSOT Specification:**
   When an agent diagnoses an issue without a rigid specification, it guesses the protocol from snippets of surrounding code. If surrounding code has a bug (e.g., checking only `turnComplete`), the agent mimics the buggy pattern.

---

## 2. Invariants & Rules to Codify in `AGENTS.md`

We will add a dedicated section in [AGENTS.md](file:///d:/projects/interview_projects/spring/AGENTS.md):

### 2.1. File Length Ceiling & Proactive Refactoring Invariant
```markdown
### 8. File-Hygiene & Cognitive Bounding Invariant (SOTA Late 2026)
- **Strict File Length Limits:**
  - Newly created source files MUST NOT exceed **350 lines**.
  - Any file undergoing modification that exceeds **400 lines** MUST be proactively decomposed into single-responsibility subcomponents or modules before adding new logic.
- **Single Responsibility Principle (SRP):**
  - Presentation (React UI / JSX) must be strictly decoupled from low-level infrastructure (Web Audio DSP, WebSockets, REST APIs).
  - Business logic and state machines must reside in headless TypeScript classes or custom hooks, not inside component render functions.
- **Zero Parallel Reimplementation (Strict Reuse Invariant):**
  - Creating parallel implementations of existing subsystems (e.g. creating a secondary voice WebSocket handler instead of importing `LiveVoiceEngine`) is strictly forbidden.
  - If an existing subsystem does not support a desired use case, the agent MUST extend the core headless abstraction rather than cloning it.
```

### 2.2. Mandatory Auto-VAD SSOT Binding
```markdown
### 9. Auto-VAD & Gemini Live Multimodal Protocol SSOT
- Before proposing or writing any code related to Voice, AudioWorklet, VAD, or Gemini Live streaming, the agent MUST read and strictly adhere to:
  `docs/architecture/specs/AUTO_VAD_LIVE_AUDIO_SPECIFICATION.md`
- The Dual-Sided Handshake, EchoGuard drop conditions, and Turn 0 tool gating are immutable invariants defined in that document.
```

---

## 3. Automated Static Enforcement (Tooling & CI)

To ensure rules are enforced automatically without relying solely on agent memory:

### 3.1. ESLint `max-lines` Configuration
In frontend and backend `.eslintrc` / `eslint.config.js`:
```json
{
  "rules": {
    "max-lines": [
      "error",
      {
        "max": 350,
        "skipBlankLines": true,
        "skipComments": true
      }
    ]
  }
}
```

### 3.2. Pre-Commit / Pre-Push AST Scanner Script
Create `scripts/verify_file_hygiene.ts`:
- Scans `backend/src` and `frontend/src`.
- Fails with exit code 1 if any newly added or modified file exceeds 350 lines (excluding approved migration waivers).
- Integrated into `npm run lint` and CI pipeline.

---

## 4. Agent Skill Modernization
Update [.agents/skills/auto-vad-diagnostics/SKILL.md](file:///d:/projects/interview_projects/spring/.agents/skills/auto-vad-diagnostics/SKILL.md):
- Mandate reading `docs/architecture/specs/AUTO_VAD_LIVE_AUDIO_SPECIFICATION.md` as Step 0 before performing diagnostics or edits.
- Add an explicit validation step: check whether any newly created file violates the 350-line ceiling or duplicates audio graph setup.

---

## 5. Verification & Acceptance Criteria
- [ ] `AGENTS.md` updated and committed with Section 8 & 9.
- [ ] `.agents/skills/auto-vad-diagnostics/SKILL.md` updated with SSOT cross-reference.
- [ ] `scripts/verify_file_hygiene.ts` created and passing against clean codebase.
- [ ] Git commit:
  `git commit -m "chore(rules): enforce 350-line file ceiling, Auto-VAD SSOT binding, and anti-duplication guards"`
