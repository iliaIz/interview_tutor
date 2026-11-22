# 06: [Tracer-Bullet] Alfa Digital Company Profile, HLD Projection & CRI Readiness Radar

**Parent:** Spec 22 (`22_ALFA_BANK_TARGETED_PREPARATION_AND_SOTA_VERIFICATION.md`)  
**Archetype:** Tracer-Bullet  
**Blocked by:** #02, #03, #04, #05  
**Status:** closed  

## What to Build
1. In `json/company_profiles.json`:
   - Add complete `alfa_digital` profile entry:
     - `id`: `"alfa_digital"`
     - `name`: `"АО «Альфа-Банк» (Alfa Digital & А-Токен)"`
     - `brandColor`: `"#EF3124"`
     - `logoBadge`: `"🅰️"`
     - `tagline`: `"Senior Java & HighLoad FinTech: ЦФА «А-Токен», Waves Enterprise, Kafka EOS & Zero-Downtime PostgreSQL"`
     - `culture`: engineeringParadigm, metricsFocus, redFlags, greenFlags
     - `expressRunbook`: 3-4h preparation checklist, pitch script, must-review task links
     - `stages`:
       - Stage 1: Технический скрининг (1 час) — Теория 27 вопросов, Code Review `cr-alfa-01..06`, Live Coding `lc-alfa-01..05`, SQL `sql-alfa-01..05`.
       - Stage 2: Глубокий тех и System Design (1.5 часа) — SD-01 (HikariCP / Little's Law), SD-02 (Kafka Consumer Groups), SD-03 (Fault Tolerance & Outbox), SD-04 (DB degradation triage), SD-05 (Double-Entry Banking Transfers), плюс специфический блок «А-Токен» (Waves Enterprise, СКЗИ ГОСТ, Misys Equation SOAP).
     - `competencies`: 9 Senior competencies (Core/JVM, Concurrency, Spring, DB/PG, Kafka, Distributed, K8s, A-Token, Mindset).
     - `specReviewChecklist`: 6 architectural review questions.
     - `starScenarios`: 4 behavioral STAR cases for Alfa Digital.
2. In `backend/src/routes/companies.ts`:
   - Implement `GET /api/companies/alfa_digital/readiness`:
     $$\text{CRI} = (0.25 \times \text{Theory}) + (0.20 \times \text{CR}) + (0.20 \times \text{LC}) + (0.15 \times \text{SQL}) + (0.20 \times \text{SD})$$
     Querying actual user completion counts across SQLite tables.
3. In `frontend/src/components/companies/CompanyPrepStudio.tsx`:
   - Support switching between `raiffeisen_dgtl` and `alfa_digital`.
   - Render the Alfa Digital brand theme (`#EF3124`), logo, and specific stage tabs.
   - Display the live CRI Readiness Radar widget.

## Pre-Agreed Verification Seam & Command
- **Testing Seam**: `GET /api/companies/alfa_digital` & `CompanyPrepStudio.tsx`
- **Dependencies**: Real SQLite database (`data/interview.db`).
- **Verification Command**: `remote-verify`

## Embedded Contract Slice & Invariants
- `CompanyProfileSchema` validation passes 100%.
- Zero-silo invariant: System Design stages reference canonical IDs (`L3-PERF-HIKARICP-STARVATION`, `L4-DIST-KAFKA-REBALANCE-LAG`, `L4-DIST-IDEMPOTENT-OUTBOX`, `triage-incident-04`).
- CRI score bounded in $[0, 100]$.

## Explicit Non-Goals
- Altering existing `raiffeisen_dgtl` profile data.
- Introducing parallel UI routing components.

## Acceptance Criteria
- [x] Profile `alfa_digital` loads via `GET /api/companies/alfa_digital` and validates against schema.
- [x] User can switch between Raiffeisen and Alfa Digital in `CompanyPrepStudio`.
- [x] CRI readiness calculation reflects completed tasks accurately.
- [x] All stages launch their target arenas with company context.
