# Phase 11: Question Matrix Catalog Navigation

> **Gate 11 File:** `docs/hr_screening_engine/phases/phase_11_hr_question_matrix_selector_sidebar.md`  
> **Status:** Execution Ready  

## Objective
Create `frontend/src/components/practice/hr/HrQuestionSelector.tsx` to browse, filter, and select from all 12 questions of `canonicalQuestionMatrix.json`.

## Tasks
1. Group questions by thematic blocks:
   - Self-Presentation (Pitch)
   - Career History & Reasons for Leaving
   - 14-month Gap, R&D & NPD (422-FZ)
   - Compensation & Legal Compliance
   - Technical Blitz & STAR Behavioral Cases
2. Display duration SLA, number of anchors, and active selection state.
3. Support responsive drawer or sidebar view.

## Verification Gate
- File length $\le 300$ lines.
- Clicking any question updates `selectedQuestionId` in the store immediately.
