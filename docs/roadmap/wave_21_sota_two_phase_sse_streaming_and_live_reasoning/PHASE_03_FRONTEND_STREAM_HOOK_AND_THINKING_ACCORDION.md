# Phase 3: Frontend Stream Hook, Thought Accordion & File Decomposition
## Headless Streaming State Machine & Cognitive UI Experience

> **Phase:** 3 of 5  
> **Status:** Draft / Specification  
> **Target Subsystem:** `frontend/src/hooks/useBugChallengeStream.ts`, `frontend/src/components/incidents/bughunt/BugHuntThoughtAccordion.tsx`, `frontend/src/components/incidents/BugHuntArena.tsx`  
> **Dependencies:** Phase 2 (Backend SSE Endpoint)  

---

## 1. Context & File Hygiene Mandate (Rule 8)

`frontend/src/components/incidents/BugHuntArena.tsx` is currently **398 lines**.
Under AGENTS.md Invariant 8:
> *"Any file undergoing modification that exceeds 400 lines MUST be proactively decomposed into single-responsibility subcomponents or modules before adding new logic."*

Therefore, we MUST extract:
1. Streaming state and fetch lifecycle into a headless hook: `frontend/src/hooks/useBugChallengeStream.ts` (< 200 lines).
2. The thought display into an isolated presentation component: `frontend/src/components/incidents/bughunt/BugHuntThoughtAccordion.tsx` (< 150 lines).
3. Keep `BugHuntArena.tsx` strictly focused on high-level orchestration, reducing its line count to ~300 lines.

---

## 2. Technical Specification

### 2.1. Headless Hook (`useBugChallengeStream.ts`)
State interface:
```typescript
interface BugStreamState {
  isStreaming: boolean;
  phase: 'idle' | 'reasoning' | 'assembling' | 'ready' | 'error';
  thoughts: string[];
  currentThoughtChunk: string;
  challenge: BugChallenge | null;
  error: string | null;
}
```

The hook uses the Fetch API with `ReadableStream` (`response.body.getReader()`) to parse incoming SSE events line-by-line using standard UTF-8 chunk decoding, with auto-reconnection and abort capability via `AbortController`.

### 2.2. Thought Accordion Component (`BugHuntThoughtAccordion.tsx`)
- Aesthetic: Soft luxury pastel glassmorphism with lavender/rose aura (`bg-white/70 dark:bg-slate-900/70 backdrop-blur-md`).
- Features:
  - Collapsible accordion with smooth height transition.
  - Live blinking indicator: `ИИ анализирует потенциальные дефекты...`
  - Auto-scrolling viewport following live thought tokens.
  - Auto-collapses or transitions to "Показать ход мыслей модели" once the challenge is loaded into Monaco editor.

---

## 3. Verification Gate (Gate 3)

1. React Vitest tests for `useBugChallengeStream` testing thought aggregation and `challenge_ready` transition.
2. File hygiene assertion: `wc -l` on `BugHuntArena.tsx` $\le 350$ lines.
3. Visual UI verification in browser.
