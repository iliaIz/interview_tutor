# Stage 01: Oral Mock Interview & Voice Studio Actualization

> **Document:** `STAGE_01_ORAL_VOICE_AND_AUTO_VAD.md`  
> **Parent Roadmap:** [00_MASTER_IMPLEMENTATION_PLAN.md](00_MASTER_IMPLEMENTATION_PLAN.md)  
> **Authoritative Domain SSOT:** [`docs/architecture/specs/01_ORAL_MOCK_INTERVIEW_AND_AUTO_VAD.md`](../../architecture/specs/01_ORAL_MOCK_INTERVIEW_AND_AUTO_VAD.md)  
> **Low-Level Protocol SSOT:** [`docs/architecture/specs/AUTO_VAD_LIVE_AUDIO_SPECIFICATION.md`](../../architecture/specs/AUTO_VAD_LIVE_AUDIO_SPECIFICATION.md)

---

## 1. Scope & Target Files

- **Backend Services:** `backend/src/services/live/liveAudioStreamRouter.ts`, `backend/src/services/live/liveWsConnectionHandler.ts`.
- **Frontend Core:** [`frontend/src/audio/LiveVoiceEngine.ts`](file:///d:/projects/interview_projects/spring/frontend/src/audio/LiveVoiceEngine.ts), `MicrophoneCapture.ts`, `useLiveVoiceSession.ts`.
- **Frontend UI/UX:** [`frontend/src/components/VoiceModal.tsx`](file:///d:/projects/interview_projects/spring/frontend/src/components/VoiceModal.tsx), `VoiceMicButton.tsx`, `VoiceSubtitles.tsx`, `VoiceVisualizer.tsx`, `CandidatePersonaHUD.tsx`, `VoiceSettingsDrawer.tsx`.

---

## 2. Root Causes & Technical Debt to Eliminate

1. **Parallel Re-Implementation in Practice Arena:** `PracticeVoiceContext.tsx` still links against the deprecated monolith `useLegacyLiveAudioSession.ts` (1,258 lines). Both must be replaced by the headless `LiveVoiceEngine`.
2. **Backend Router Monolith:** `liveAudioStreamRouter.ts` (855 lines) exceeds the 400-line ceiling under Invariant 8 and needs modular decomposition (routing, telemetry, echo filtering).
3. **Mobile Screen Sleep during Oral Practice:** Mobile devices dim and sleep during long candidate answers, dropping WebSockets.

---

## 3. Implementation Checklist

### Backend & Protocol Actualization
- [ ] Decompose `liveAudioStreamRouter.ts` into single-responsibility submodules ($\le 350$ lines each).
- [ ] Ensure all router paths enforce the `generationComplete` $\leftrightarrow$ `turnComplete` equivalence invariant.
- [ ] Verify EchoGuard +450ms reverb suppression across all session modes (`interview`, `tutor`, `practice_pair`).

### Frontend UI/UX Actualization
- [ ] **Unified Consumer Migration:** Completely decommission `useLegacyLiveAudioSession.ts` and rewire `PracticeVoiceContext.tsx` to `LiveVoiceEngine`.
- [ ] **Screen WakeLock Integration:** Synchronously acquire `navigator.wakeLock.request('screen')` on session start to prevent mobile sleep.
- [ ] **Soft-Luxury Voice Aesthetics:** Refine central orb visuals:
  - **AI Speaking:** Soft pink aura with delicate breathing ripple animation.
  - **Candidate Turn:** Vibrant mint green halo with fluid acoustic reactive expansion.
  - **Thinking / CoT:** Warm amber rotational spinner indicating active reasoning.
- [ ] **Dual-Sided Handshake Visualizer:** Provide a subtle, elegant indicator when audio is draining in headphones so the candidate knows exactly when the microphone opens.

---

## 4. Verification & Acceptance Criteria

```bash
# 1. Verify Web Audio & live session protocol contracts
npm --prefix frontend run test:audio-contracts

# 2. Run backend router telemetry mock
npm --prefix backend run test:telemetry:router

# 3. Verify file hygiene standards
npm run verify-hygiene
```
