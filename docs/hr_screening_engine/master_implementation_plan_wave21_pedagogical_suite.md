# SOTA Late 2026 Architectural Specification: HR Screening Pedagogical Suite & Worked Examples (Wave 21)

> **Document:** `docs/hr_screening_engine/master_implementation_plan_wave21_pedagogical_suite.md`  
> **Status:** Canonical Architecture Specification & Implementation Blueprint  
> **Role:** Principal Software Architect & Cognitive Systems Engineer  
> **Target Branch:** `feat/wave-20-hr-voice-screening-engine`  
> **Standard:** SOTA Late October 2026 (Zero-Flattery, Worked-Example Pedagogical Scaffolding, Strict Engine-Payload Isolation)

---

## 1. Executive Summary & Cognitive Rationale

### 1.1. The Root Cause of Live Performance Failure
The current implementation of the HR Screening Engine provides a high-fidelity real-time voice assessor (`Assessment Engine`). However, without prior declarative modeling, users thrown into voice drills suffer from **Cognitive Overload (Sweller's Cognitive Load Theory)**:
- Users cannot simultaneously compose coherent syntax, recall specific legal citations (Articles 2 & 14 of Federal Law No. 422-FZ, STD-SFR from Gosuslugi), monitor speech rate (WPM), and navigate stress.
- Without an authoritative visual worked example, candidates default to conversational crutches (*«сидел дома»*, *«делал пет-проект»*), triggering severe anti-sycophancy penalties.

### 1.2. The SOTA Pedagogical Model (Worked Example & Progressive Fading)
Wave 21 bridges this gap by introducing a **Pedagogical Suite** directly inside the UI:
1. **Worked-Example Study Deck (`HrQuestionStudyDeck`):**
   - Displays the question's full canonical answer rendered in luxury typography (Markdown, GFM).
   - Deconstructs the answer into the structural triad: **Anchor (Foundation)** $\to$ **Build (R&D & Tech Upgrade)** $\to$ **Bridge (Return to Enterprise Product)**.
   - Highlights required anchors with explicit rationale: *Why does the recruiter ask this? What is the legal risk?*
   - Features an **Anti-Pattern vs. Senior Formula** callout table contrasting common fatal errors with high-scoring phrases.
2. **Question Matrix Catalog (`HrQuestionSelector`):**
   - Exposes all 12 questions from `canonicalQuestionMatrix.json`, categorized across 5 interview themes:
     - Theme 1: Self-Presentation & Elevator Pitch (60–80s)
     - Theme 2: Career History & Transition Rationale
     - Theme 3: Sabbatical/R&D Gap & NPD (422-FZ) Legal Justification
     - Theme 4: Financial Expectations (310k–330k net) & Compliance (Military category 'V', Remote)
     - Theme 5: Technical Blitz & Behavioral Conflict Resolution (STAR)
3. **1-Click Bridge to Motor Drill:**
   - From any question in the Study Deck, clicking *«Отработать вслух»* instantly loads the question into the voice engine and switches to the voice HUD with pre-calibrated KWS anchors and SLA timers.

---

## 2. API Contract & Architectural Decomposition

### 2.1. REST Endpoints (`backend/src/routes/hr.ts`)
- `GET /api/hr/questions`: Returns array of `HrQuestionRubricItem[]` loaded from `canonicalQuestionMatrix.json`.
- `GET /api/hr/dossier`: Returns the canonical `CandidateDossier` for inspection.

### 2.2. Frontend State Machine (`frontend/src/store/useHrSimulatorStore.ts`)
- `questionsList: HrQuestionRubricItem[]`
- `activeTab: 'study' | 'voice'`
- `selectedQuestionId: string`
- `fetchQuestions(): Promise<void>`
- `selectQuestion(id: string): void`
- `setActiveTab(tab: 'study' | 'voice'): void`

### 2.3. Component Architecture
- `HrQuestionStudyDeck.tsx` ($\le 350$ lines, SRP: visual deconstruction, markdown rendering, anchor exploration, traps comparison).
- `HrQuestionSelector.tsx` ($\le 300$ lines, SRP: filterable/categorized list of 12 questions with status badges).
- `HrScreeningArena.tsx` (Top-level container coordinating mode switcher and voice HUD).

---

## 3. Strict Compliance Invariants

1. **Rule 0 (VPS Invariant):** Zero local Docker builds. Cloud GitHub Actions runner builds images.
2. **Rule 8 (File Hygiene):** Source files $\le 350$ lines.
3. **Rule 10 (Functional Registry):** Record rationale and changes in `docs/architecture/functional_registry/`.
