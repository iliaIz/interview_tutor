# Phase 4: Reassurance UX & Ergonomic Shortcuts

> **Document:** `docs/roadmap/wave_19_neural_audio_filtering_and_speculative_barge_in/PHASE_04_REASSURANCE_UX_AND_ERGONOMIC_SHORTCUTS.md`  
> **Status:** Draft / Pending Approval  
> **Target Standard:** Human Factors & Conversational UX Standard for AI Assessment (Deep Research Plane 4)  
> **Target Subsystems:** `frontend/src/components/VoiceModal.tsx`, `frontend/src/components/LiveVoiceOrb.tsx`  

---

## 1. Objectives & Rationale

When a candidate coughs, clears their throat, or taps a desk during an interview, they experience heightened cognitive anxiety ("Did I interrupt the AI? Is it evaluating my cough? Is it stuck?"). If the system suppresses the transient silently with zero feedback, the user remains unsure whether their microphone is working.

Phase 4 introduces:
1. A **5-State Visual Feedback Model** featuring an explicit, subtle **State B ("Transient Ignored")** micro-indicator that reassures the candidate that an acoustic impulse was safely filtered out.
2. Ergonomic candidate hotkeys: **Spacebar Push-to-Talk (PTT)** override and **`C` Cough-Mute** instant suppression.

---

## 2. Technical Specification & Implementation Details

### 2.1. The 5-State Visual Feedback Architecture

```
State A: LISTENING ───(Transient Suppressed)───► State B: TRANSIENT_IGNORED
  (Awaiting Speech)                                (Gentle Lilac Ripple / 1.2s)
         │                                                     │
         │ (Voice Verified >= 224ms)                          │ (Auto-decay)
         ▼                                                     ▼
State C: CANDIDATE_SPEAKING ◄──────────────────────────────────┘
  (Active Speech Aura)
         │
         │ (Trailing Silence 500ms -> Server ACTIVITY_END)
         ▼
State D: AI_THINKING (Orbiting Shimmer)
         │
         │ (First Audio Frame)
         ▼
State E: AI_SPEAKING (Pastel Mesh Waves)
```

- **State B Implementation:** When `NativeLiveVoiceEngine` detects a suppressed transient ($P < 0.20$ or TKEO clamp), it emits `onTransientFiltered`. The UI briefly displays a gentle lilac glow with a subtle micro-badge *"Звук отфильтрован"* fading smoothly over $1.2$ s without jarring the primary listening orb.

### 2.2. Ergonomic Hotkey Overrides
- **Spacebar (Push-to-Talk):**
  - Holding down `Spacebar` unconditionally locks the engine into `CANDIDATE_SPEAKING` mode, bypassing minimum voicing duration.
  - Releasing `Spacebar` resumes standard Auto-VAD continuous streaming.
- **`C` Key (Cough-Mute):**
  - Pressing `C` or clicking the microphone mute chip activates an instant 3-second acoustic mute window, zeroing all outgoing microphone samples and displaying a discrete *"Режим кашля"* chip.

---

## 3. Files Modified / Created

| File | Modification | Line Limit Target |
|---|---|---|
| `frontend/src/components/LiveVoiceOrb.tsx` | Add State B lilac ripple and micro-badge indicator. | $< 300$ lines |
| `frontend/src/components/VoiceModal.tsx` | Keyboard listener for Spacebar (PTT) and `C` (Cough-Mute). | $< 350$ lines |

---

## 4. Phase Gate 4 Verification & Acceptance Criteria

- [ ] **Gate 4.1 (State B Visual Feedback):** Simulating a cough during `LISTENING` or `AI_SPEAKING` renders the gentle State B lilac aura and micro-badge *"Звук отфильтрован"*, decaying after $1.2$ s.
- [ ] **Gate 4.2 (Push-to-Talk via Spacebar):** Holding Spacebar forces speech stream assertion; releasing permits natural silence endpointing.
- [ ] **Gate 4.3 (Cough-Mute via `C` Key):** Pressing `C` immediately attenuates microphone to zero for 3 seconds with a visual indicator.
- [ ] **Gate 4.4 (Accessibility & Typing Safety):** Shortcuts are disabled when any text input/textarea in the IDE has focus.
