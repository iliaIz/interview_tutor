# Phase 2: Ground Truth Fixtures & Context Resolver

> **Document:** `docs/hr_screening_engine/phases/phase_02_fixtures_and_ground_truth_seed.md`  
> **Status:** Phase 2 Specification & Execution Gate  
> **Quality Gate G2:** Automated JSON parsing and TypeBox schema validation of all fixtures.

---

## 1. Objectives & Scope
1. Create canonical JSON fixtures in `backend/src/data/hr/fixtures/`:
   - `canonicalCandidateDossier.json`: Full facts for Ilya Izhukov (ООО «БТЛаб», 7.4 years, STD-SFR, 15M docs, 2200 RPS, NPD 422-FZ, 310k-330k net).
   - `canonicalQuestionMatrix.json`: 12 questions, reference answers, required anchors with stems, forbidden euphemisms.
   - `defaultJobContexts.json`: Job context fixtures for fintech banking, bigtech ecommerce.
2. Implement `backend/src/services/live/hrContextResolver.ts`:
   - Loads fixtures, validates using `Value.Check(CandidateDossierSchema, data)`.
   - Caches parsed objects in memory.

---

## 2. Invariants & Guardrails
- Engine code does NOT contain hardcoded names.
- Fixtures are 100% compliant with Phase 1 TypeBox schemas.
- `hrContextResolver.ts` file length $\le 150$ lines.

---

## 3. Verification Commands
```bash
node -e "const fs = require('fs'); JSON.parse(fs.readFileSync('backend/src/data/hr/fixtures/canonicalCandidateDossier.json')); JSON.parse(fs.readFileSync('backend/src/data/hr/fixtures/canonicalQuestionMatrix.json')); console.log('✅ Fixtures are valid JSON');"
```
