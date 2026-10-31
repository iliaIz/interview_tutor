# Phase 9: Zustand Store Catalog & Multi-Mode State Management

> **Gate 9 File:** `docs/hr_screening_engine/phases/phase_09_zustand_store_catalog_and_selection.md`  
> **Status:** Execution Ready  

## Objective
Extend `useHrSimulatorStore.ts` to manage the question catalog, selection, loading status, and active mode tab (`'study' | 'voice'`) adhering strictly to the $<350$ lines Rule 8.

## Tasks
1. Add state fields: `questionsList: HrQuestionRubricItem[]`, `selectedQuestionId: string | null`, `isLoadingQuestions: boolean`, `activeTab: 'study' | 'voice'`.
2. Add actions: `fetchQuestions()`, `selectQuestion(id: string)`, `setActiveTab(tab: 'study' | 'voice')`.
3. Ensure backward compatibility with existing Voice HUD actions.

## Verification Gate
- Store compiles with strict TypeScript typing.
- State transitions correctly initialize active questions and anchor cards.
