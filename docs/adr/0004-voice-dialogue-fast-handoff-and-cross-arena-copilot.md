---
status: accepted
verification: pending
date: 2026-11-09
---

# 0004. Gemini 3.8 Live Fast-Handoff Protocol & Omnipresent Copilot Cross-Arena Context

## Context & Problem Statement
During testing of the Raiffeisen Track and cross-arena voice interaction, 6 critical defects were surfaced:
1. **Stage 1 (Voice Fit):** Candidate speech cessation caused Gemini 3.8 Live to hang without responding; user barge-in triggered Google WebSocket closure with code `1007` (`Invalid JSON payload: Unknown name "interruption" at realtime_input`). Also, candidates lacked a structured briefing or crib-sheet before/during the voice interview.
2. **Stage 2 (Live Coding):** Navigating to `iban-validator` opened an empty workspace with only the left sidebar due to `arenaNavigator.ts` passing the raw API envelope `{ challenge, savedDraft }` directly into `openPracticeChallenge` instead of unwrapping the inner challenge manifest.
3. **Stage 3 (Code Review):** Navigating to `case_transfer_service` opened the generic Machine Coding catalog with "All Tasks" because `json/refactoring_challenges.json` was never seeded into SQLite, returning 404 and lacking a curated company filter.
4. **Stage 4 (SQL Arena):** Switching Copilot to voice triggered "Голосовой режим временно недоступен" because `PracticeVoiceProvider` was only mounted inside `PracticeArena.tsx` rather than globally at the application root; drawer close button `<X />` was pushed out of the viewport on 420px drawers due to missing `min-w-0` and `shrink-0` flex styling.
5. **Stage 5 (System Design):** System Design lacked an omnipresent Copilot with dynamic context management; Studio 1 Runtime falsely displayed "Дефект устранён. Архитектурный пенальти в симуляции деактивирован." immediately upon mount because `checkIsFixed` checked `!currentCode.includes(fadedBug.bug_pattern)` where `bug_pattern` was a symbolic enum key rather than Java source text.
6. **Stage 6 (Take-Home Lab):** Copilot voice also crashed due to missing global `PracticeVoiceProvider`.

## Decision
1. **Gemini 3.8 Live Protocol Compliance (Q1):**
   - Eliminate illegal `{ realtimeInput: { interruption: true } }` upstream dispatch in `liveWsClientFrameHandler.ts`. Gemini Live detects barge-in acoustically on Google's servers and sends `serverContent.interrupted` to the client.
   - Restore canonical `{ realtimeInput: { audioStreamEnd: true } }` forwarding to signal speech cessation without vocoder stalls.
   - Equip client `NativeLiveVoiceEngine` with automatic speech-pause turn commit (`commitSpeechTurn()`) alongside manual tactile button clicks.
2. **Pre-Flight Briefing & Candidate Grounding (Q2):**
   - Embed an introductory accordion ("Предстартовый бриф: Product Engineer DNA & STAR-кейсы") in `CompanyPipelineTab` with concise cheat-sheets (TTM, Pain Index, zero-floating-point, DB deadlocks).
   - Add a collapsible crib-sheet drawer in `VoiceModal` so candidates can inspect key banking invariants during live speech without tab switching.
   - Ground the AI voice interviewer with these topic keys to enable instant, zero-preamble topical discussions.
3. **Envelope Hydration & Curated Company Ingestion (Q3):**
   - In `arenaNavigator.ts`, unwrap `{ challenge: manifest, savedDraft }` to guarantee `canonicalFiles` are correctly populated.
   - In `dbSeedCatalogs.ts`, ingest `json/refactoring_challenges.json` into the `coding_challenges` SQLite table on startup.
   - In `PracticeCatalog.tsx`, introduce a persistent "🏦 Райффайзенбанк" filter chip isolating relevant live coding and code review katas (`iban-validator`, `sparse-vector`, `case_transfer_service`, `case_account_collections`).
4. **Root Voice Provider & Flex Hygiene (Q4):**
   - Lift `PracticeVoiceProvider` to the application root in `App.tsx` (wrapping `PracticeTutorDrawer`), making voice modality universally accessible across SQL Arena, System Design, Practice, and Take-Home.
   - Fix header flex layout in `PracticeTutorDrawer.tsx` (`min-w-0 truncate` on title, `shrink-0` on action buttons and `<X />`) ensuring the close button is 100% visible across all viewport widths.
5. **Dynamic HLD Copilot Context & Studio 1 Defect Verification (Q5):**
   - Implement `normalizeSystemDesignContext(...)` in `@interview-prep/shared`, streaming dynamically updated editor code, active studio tab, topology canvas summaries, and faded bug info into `usePracticeTutorStore` using token-bounded CDATA formatting (`<= 15000` tokens).
   - In `ForensicCodeEditor.tsx`, enforce that initial unmodified code (`currentCode === defaultFile.content`) strictly evaluates to `isBugFixed: false`. Validate fixes against AST invariants and structural diffs rather than string absence.
6. **Testing Seam & Pre-Flight Verification (Q6):**
   - Implement headless unit tests for `liveGeminiConfigBuilder`, `arenaNavigator`, `liveWsClientFrameHandler`, and `ForensicCodeEditor` (0 MB RAM overhead).
   - Execute verification through cloud runner via `remote-verify`.

## Verification & Guardrail
- **Unit Test Seam:** `tests/arenaNavigator.test.ts`, `tests/forensicCodeEditor.test.ts`, `backend/src/scripts/testGeminiConfigBuilder.ts`.
- **Protocol Guardrail:** Assert zero 1007 WebSocket close codes in `litellm-gateway` telemetry logs during barge-in.
- **AST Seam:** Enforce non-zero `droppedEchoChunksCount` suppression in `LiveClientGuardService` without corrupting `audioStreamEnd`.

## Consequences
- **Positive:**
  - 100% robust two-way voice dialogue with zero silence stalls or 1007 disconnect crashes.
  - Zero empty workspaces when navigating from Company Studio to Practice or System Design.
  - Omnipresent Copilot with dynamic context synchronization across all 6 stages of the company pipeline.
  - Clean, unclipped UI drawers on mobile and desktop.
- **Trade-offs / Negatives:**
  - Dynamic context synchronization incurs lightweight serializations on tab/editor switches. Token budgeting (`<= 15000` tokens) mitigates upstream inference costs.

## Considered & Rejected Alternatives
- **Push-to-Talk only (`turnMode: 'manual'`):** Rejected because SOTA fin-tech candidate preparation requires natural, hands-free conversational dialogue.
- **Fragmented Copilot Drawers per Arena:** Rejected (violates ADR 0003 and Rule 8 invariant against duplicate components).
- **Direct string matching on `bug_pattern`:** Rejected because `bug_pattern` in scenario manifests is a symbolic enum identifier, not a Java code snippet.
