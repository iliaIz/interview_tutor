# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primary Users:** Russian-speaking Middle, Senior, Lead, and Staff Java & Spring backend engineers preparing for technical interviews, architecture rounds, and live coding assessments at Russian BigTech and FinTech companies (including Райффайзенбанк, Альфа Digital, Яндекс, and Т-Банк).
- **Usage Scene:** Primary deep-work sessions run on desktop/laptop browsers (Chrome, Edge, Firefox, Safari) alongside optional local IntelliJ IDEA integration; secondary review, flashcard, audio recap, and spec-reading sessions run on mobile browsers (iOS Safari, Android Chrome).
- **Access Model:** Invite-only authenticated web studio (`SENIOR-JAVA-2026-VIP` / owner-issued invite tokens).

## Product Purpose

InterviewPrep AI helps Java & Spring backend engineers build verifiable interview readiness across theory, live coding, legacy refactoring, mutation testing, Spring transactions, high-load system design, and production incident triage — combining real deterministic verification with live Socratic voice and text coaching. Success means a candidate passes technical screening, coding, and architectural defense rounds by mastering invariant-driven engineering rather than memorizing surface trivia.

## Positioning

Unlike generic LeetCode clones or sycophantic chat tutors, InterviewPrep AI enforces real JVM and distributed-systems engineering invariants deterministically:
- In-memory Java 21 / JUnit 5 sandbox compilation and stress execution (`100` concurrent virtual threads).
- Bytecode mutation testing (PITest / defect injection) catching tautological tests.
- Static AST enforcement (`java.time.Clock` time virtualization, `BigDecimal` `HALF_EVEN` financial precision, deadlock-free lock ordering, zero Loom carrier-thread pinning).
- Local zero-dependency IntelliJ IDEA loopback bridges (`:41789` task workspace, `:41790` whiteboard revisions).
- In-browser WebAssembly PostgreSQL 16 (`PGlite`) SQL arena and 24kHz Gemini Live bidirectional voice pairing with anti-sycophancy evaluation gates.

## Operating Context

- **Studio Arenas:** Guided Academy (`177` steps across `8` tracks), Theory Knowledge Base (`816+` questions with FSRS-5 spaced repetition), Machine Coding & Refactoring & Mutation Practice (`142` catalog challenges + Spring Transactions Lab), Bug Hunt & Forensics, System Design (`HLD` with DES simulator), SRE Incident Triage, Company Targeted Prep (`Райффайзенбанк`, `Альфа Digital`), and HR Voice Screening.
- **Practice Coding Flow:** Multi-file CodeMirror 6 workspace (`readOnly` contracts vs editable implementations and JUnit 5 / AssertJ tests), phased Open-Closed Principle (`OCP`) requirements, Golden Master characterization diffs, Code Smells oral/manual audit, fast sandbox test/mutation runs, 5-gate SSE Senior AI Review, Domain Compasses (`Ctrl + /`), and paired AI-Напарник (text streaming + Gemini Live voice + AI Whiteboard).
- **Language Convention:** Russian-first UI copy and coaching paired with authentic English Java/Spring technical identifiers (`Clock`, `BigDecimal`, `Virtual Threads`, `AssertJ`, `Golden Master`).

## Capabilities and Constraints

- **Deployment & Node Constraints:** Deployed via GitHub Actions to a `1.8 GB` RAM VPS running Docker containers (`LiteLLM_Proxy` gateway, Express + SQLite WAL backend, Nginx frontend). Local builds/typechecks on the VPS node are prohibited; verification runs in CI (`remote-verify`).
- **Modular Code Hygiene:** New source files must stay `<= 350` lines; modified source files must stay `<= 400` lines (`scripts/verify_file_hygiene.ts`), decoupling headless state/ports from presentation.
- **Singletons & Ports:** Voice sessions run through `PracticeVoiceProvider` and `LiveVoiceEngine`; AI Copilot routes through `TutorActiveContext` and `TutorTransportPort`; IntelliJ loopback bridges occupy `:41789` and `:41790`.
- **IDE Workspace Focus Mode & Stealth Co-Pilot:** When entering an active Practice coding challenge, global platform navigation (`StudioHeader`) collapses/hides into a single `48px` workspace header. `AI-Напарник` and `Доска ИИ` unify into a non-overlapping docked panel that can be visually collapsed (`Stealth Co-Pilot`) once the session is configured and active, leaving only a silent status/restore control in the `48px` header with zero floating pills over code or action buttons.
- **Truth in Telemetry:** Never display fabricated benchmark figures as live user metrics, never trigger pass badges or celebratory feedback when test or concurrency gates fail, and never fabricate fallback tasks when AI gateways fail.

## Brand Commitments

- **Product Name:** `InterviewPrep AI`.
- **Visual Direction (Existing System):** Soft luxury pastel workspace surfaces (`#FAF8F5`, `#FFF0F5`, `#FFF4F2`, lavender/rose accents) paired with `#121622` velvet-dark code surfaces.
- **Voice & Tone:** Direct, technically rigorous, non-sycophantic, mentor-like Russian engineering copy.

## Evidence on Hand

- Canonical JSON challenge, question, company, and scenario catalogs in `json/` (`142` coding/refactoring/mutation tasks, `821+` theory items, `company_profiles.json`, `sql_challenges.json`).
- Automated verification suites in `backend/tests/` and `frontend/tests/`.
- Baseline UX/UI visual & WCAG audit snapshot in `.impeccable/critique/2026-11-27T04-19-17Z__mponents-practice-arena-practicearenaworkspace-tsx.md`.

## Product Principles

1. **Tool Disappears Into Engineering Flow:** Active coding arenas reclaim viewport space, eliminate duplicate chrome, and keep focus on code and specifications.
2. **Truth in Telemetry:** Every badge, score, progress bar, diff, and AST status reflects verified runtime state — never hardcoded mock numbers or misleading green passes.
3. **Stealth-Capable Co-Pilot:** AI coaching and voice pairing assist on demand and vanish cleanly once active so engineers code without visual clutter.
4. **Deterministic Invariants First:** Real compiler, AST, and mutation checks ground all AI feedback.
5. **Native Accessibility Across Form Factors:** Every tab, dialog, shortcut, and action works cleanly across keyboard, screen readers, desktop viewports, and mobile touchscreens.

## Accessibility & Inclusion

- **Standard:** WCAG 2.1 Level AA across desktop (Chrome, Edge, Firefox, Safari) and mobile (iOS Safari, Android Chrome).
- **Requirements:** `>= 4.5:1` contrast for all text/labels (`>= 3:1` for UI controls/focus rings), native `<dialog>` and WAI-ARIA `tablist`/`tab` keyboard semantics (`Esc`, `Tab`, `Ctrl+/`, `Ctrl+Enter`, `Ctrl+S`), `>= 44×44px` touch targets on coarse pointers (`>= 24×24px` fine desktop targets), and `prefers-reduced-motion` alternatives preserving state visibility.
