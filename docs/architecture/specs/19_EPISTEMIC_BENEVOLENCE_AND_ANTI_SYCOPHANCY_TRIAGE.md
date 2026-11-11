# Spec 19: Epistemic Benevolence Axiom & Anti-Sycophancy Triage Architecture (Part 1: Core Foundation & Tutoring Subsystems)

## 1. Intent & Workload Envelope
- **Context & Glossary**: Governing [GLOSSARY.md](../../../GLOSSARY.md), [PROMPTS_SYCOPHANCY_AND_EPISTEMIC_AUDIT.md](../../reports/PROMPTS_SYCOPHANCY_AND_EPISTEMIC_AUDIT.md), and Architectural Decision Record in `.ai/handoff/architect_response.md`.
- **Domain Intent**: Eradicate AI sycophancy (поддакивание, false affirmation, conversational flattery) across all tutoring, pair-programming, and copilot interfaces. Enforce the **Epistemic Benevolence Axiom** (true care = accurate truth; nodding along harms the candidate) and the **Tri-State Epistemic Classification Protocol** (`[ВЕРНО]` / `[ЧАСТИЧНО ВЕРНО — СЫРАЯ ИДЕЯ]` / `[ОШИБОЧНО]`).
- **Operating Envelope**:
  - Live Voice WebSocket audio streaming (Gemini Live API via LiteLLM Proxy): Response latency $\le 800$ ms, spoken length bounds 2–3 sentences (up to 30–35 words per turn), zero character-by-character code recitations.
  - Web & IDE Tutor Copilot (SSE & REST streaming): Response length 2–4 concise paragraphs, markdown formatting with code blocks, zero sycophantic openers.
  - File Length Invariants (Rule 8): Newly created files $\le 350$ lines, modified files $\le 400$ lines.

---

## 2. Explicit Non-Goals (Blast-Radius Protection)
The implementation agent is **strictly forbidden from modifying**:
1. `backend/src/services/live/LiveVoiceSession.ts`, `liveWsConnectionHandler.ts`, and `sessionFsm.ts` (WebSocket transport and FSM protocol are immutable).
2. Existing AST analysis rules, sandboxing containers, and PostgreSQL/SQLite database schemas.
3. Live Audio Worklet DSP pipelines and Web Audio gain structures (`AudioPlayoutManager.ts`, `LiveVoiceFrameParser.ts`).
4. Evaluator schemas in `shared/src/schemas/tutorContext.ts` (API interfaces must retain 100% backward compatibility).

---

## 3. Pre-Agreed Verification Seams
- **Primary Seam 1 (Core & Tutor System Prompts)**:  
  `backend/src/prompts/core/antiSycophancy.ts` & `backend/src/prompts/practiceTutorPrompts.ts`
- **Primary Seam 2 (Voice Pair Programming Engine)**:  
  `backend/src/prompts/live/livePairPrompts.ts` & `backend/src/prompts/live/livePairPersonaInstructions.ts`
- **Primary Seam 3 (Polymorphic Cross-Arena Socratic Copilot)**:  
  `backend/src/prompts/tutor/polymorphicPromptBuilder.ts`
- **Automated Verification Command**:  
  `remote-verify` (Cloud verification via GitHub Actions runner to preserve the 1.8 GB VPS memory boundary) and static line count validation (`wc -l`).

---

## 4. Formal Wire & Messaging Contracts

### 4.1. Core SSOT Directives Export Contract (`antiSycophancy.ts`)
```typescript
// Preserved contracts (100% backward compatibility):
export type StrictnessLevel = 'learning' | 'standard' | 'hardcore';
export const TRIVIA_IMMUNITY_INVARIANT: string;
export const CONVERSATIONAL_ANTI_SYCOPHANCY_DIRECTIVES: string;
export const CHAIN_OF_VERIFICATION_THOUGHT_DIRECTIVE: string;
export function getStrictnessDirectives(strictness?: StrictnessLevel): string;
export const ANTI_SYCOPHANCY_DIRECTIVES: string;
export const VOICE_ANTI_SYCOPHANCY_DIRECTIVES: string;
export const EXAM_ANTI_SYCOPHANCY_DIRECTIVES: string;
export const SOCRATIC_FORWARD_PROBING_DIRECTIVES: string;

// Newly added canonical SSOT exports:
export const EPISTEMIC_BENEVOLENCE_AXIOM: string;
export const EPISTEMIC_TRIAGE_DIRECTIVE: string;
```

### 4.2. Decomposed Tutor Persona Factory Contract (`practiceTutorPersonaDirectives.ts`)
```typescript
import type { TutorPersona } from '../practiceTutorPrompts';

export interface PracticeTutorDomainFlags {
  isLld: boolean;
  isTx: boolean;
  isConcurrency: boolean;
  isRefactoring: boolean;
  isJava21: boolean;
}

export function buildPracticeTutorPersonaDirectives(
  persona: TutorPersona,
  domainFlags: PracticeTutorDomainFlags
): string;
```

### 4.3. Recency Lock Contract in Prompt Finalizers
All system prompts must terminate their operational instructions with a non-overridable **Epistemic Recency Lock**:
```markdown
ОБЩИЕ ПРАВИЛА ОТВЕТА (ФИНАЛЬНЫЙ ЭПИСТЕМИЧЕСКИЙ ЗАМОК):
1. ЯЗЫК И СТИЛЬ: Отвечай на русском языке, уважительно, четко и структурировано.
2. ЛАКОНИЧНОСТЬ: Говори кратко и по существу (максимум 2-4 абзаца / 2-3 устных предложения).
3. ОБЯЗАТЕЛЬНОЕ РАЗГРАНИЧЕНИЕ ПРАВОТЫ (NO SYCOPHANCY):
   - Запрещено поддакивать из вежливости («Отличная мысль!», «В целом верно, но...»). Кандидату полезнее всего знать точную правду.
   - Если кандидат прав частично: в первом же предложении проведи четкую границу («В части [X] ты прав(а), но [Y] ошибочно: [почему]»).
   - Если утверждение ошибочно: начни с прямого несогласия («Нет, это не сработает: [почему и контрпример]»).
```

---

## 5. Storage & Zero-Downtime Migration Contract
- **Strategy**: `Additive-Only & In-Place Refactoring`.
- **Database Schema Impact**: None. Zero database migrations required.
- **Breaking API Changes**: None. All TypeScript interfaces (`PracticeTutorContext`, `LivePairPromptParams`, `StrictnessLevel`, `TutorPersona`) remain bitwise compatible.

---

## 6. Hoare-Logic Behavioral Contracts ({P} C {Q})

### 6.1. Turn Response Generation ({P} C {Q})
- **Pre-Conditions {P}**:  
  Candidate submits an input utterance, code snippet, or architectural proposal in any tutor or pair-programming session.
- **Algorithm C**:  
  1. The model applies `CHAIN_OF_VERIFICATION_THOUGHT_DIRECTIVE` in reasoning thoughts or in the pre-generation evaluation stage.
  2. The candidate's claims are filtered through `EPISTEMIC_TRIAGE_DIRECTIVE`.
  3. Banned openers (`BANNED_SYCOPHANTIC_OPENERS`) are suppressed.
  4. The first sentence directly declares: `[VALID]` confirmation, `[PARTIAL]` boundary demarcation, or `[INVALID]` denial with runtime counterexample.
- **Post-Conditions {Q}**:  
  - Zero sycophantic openers emitted (`«Да, вы правы, но...»`, `«Отличная идея, однако...»`).
  - No false praises on imperfect/buggy implementations.
  - Candidate is guided to root cause via physics of the runtime (JMM, ACID, IEEE-754, JLS).
- **Orthogonal Invariants**:  
  - Respectful, collegiate tone maintained at all times (Psychological Safety $\ne$ Epistemic Concession).
  - Trivia Immunity holds: zero deductions or nitpicks for paraphrasing properties or configuration keys своими словами.
