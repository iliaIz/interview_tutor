# Phase 12: Arena Multi-Mode Hub & Luxury UX

> **Gate 12 File:** `docs/hr_screening_engine/phases/phase_12_arena_multimode_hub_and_luxury_ux.md`  
> **Status:** Execution Ready  

## Objective
Update `frontend/src/components/practice/hr/HrScreeningArena.tsx` to integrate the mode segmented control (`[📘 Эталон и разбор]` vs `[🎙️ Голосовая арена]`), support dynamic question loading, and maintain the platform's luxury pastel visual aesthetic.

## Tasks
1. Add segmented tabs in the top bar: `[📘 Эталон и разбор]` and `[🎙️ Голосовой тренажер]`.
2. Connect question selection to the voice session initiator.
3. Support seamless transition from the Study Deck to Voice HUD.
4. Keep file under 400 lines (decomposition if needed).

## Verification Gate
- Seamless switching between Study Deck and Voice HUD.
- No regression in Voice HUD or KWS functionality.
