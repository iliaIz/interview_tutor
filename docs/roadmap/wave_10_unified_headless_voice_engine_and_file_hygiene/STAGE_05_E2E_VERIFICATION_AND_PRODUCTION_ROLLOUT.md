# Stage 5: End-to-End Verification & Production Zero-Downtime Rollout

> **Document:** `STAGE_05_E2E_VERIFICATION_AND_PRODUCTION_ROLLOUT.md`  
> **Parent Roadmap:** [00_WAVE_10_MASTER_ROADMAP.md](file:///d:/projects/interview_projects/spring/docs/roadmap/wave_10_unified_headless_voice_engine_and_file_hygiene/00_WAVE_10_MASTER_ROADMAP.md)  
> **Target Branch:** `refactor/wave-10-unified-voice-engine-and-file-hygiene`  
> **Production VPS Host:** `192.124.182.59` (`wss://java.djelu.site/ws/live`)  
> **Target Commit Message:** `release(wave-10): complete unified headless voice engine rollout and file-hygiene guards`

---

## 1. Multi-Tier Verification Matrix

Before any production deployment, Wave 10 changes must pass four rigorous gates:

```
[ Gate 1: Static Hygiene & Lints ]
       │  (File length <= 350 lines, TypeScript strict compilation)
       ▼
[ Gate 2: Headless Acoustic Matrix (Local) ]
       │  (replay_turn.ts: interview & tutor modes, 0 EchoGuard drops)
       ▼
[ Gate 3: Live VPS Canary Container ]
       │  (auto-vad-acoustic-canary on 192.124.182.59 via LiteLLM)
       ▼
[ Gate 4: Zero-Downtime Production Rolling Update ]
          (Build frontend & backend, reload systemd/docker services)
```

---

## 2. Gate Specifications & Test Scenarios

### Gate 1: Static Hygiene & Compilation
- Run `npm run verify-hygiene` (asserts no new file $> 350$ lines, no modified file $> 400$ lines).
- Run `npm run typecheck` across both backend and frontend.
- Run `npm run test` for all unit suites (`LiveVoiceEngine.test.ts`, `AudioPlayoutManager.test.ts`).

### Gate 2: Headless Acoustic Matrix (Dual-Scenario Replay)
Execute headless replay against the local backend for both operational modalities:
1. **Scenario A (Теория. Собеседование):**
   - Mode: `sessionType: 'interview'`, `turnMode: 'auto'`, `model: 'gemini-live-v3'`.
   - Verification: Turn 0 plays greeting + question; upon `generationComplete`, backend sets `isAiGenerating = false`; candidate simulated audio is accepted (0 EchoGuard drops).
2. **Scenario B (AI-Тьютор / "Спросить"):**
   - Mode: `sessionType: 'tutor'`, `turnMode: 'auto'`, `model: 'gemini-live-v3'`.
   - Verification: Identical transition verified through the same `LiveVoiceEngine`. Zero code divergences.

### Gate 3: VPS Live Canary Validation
- Connect to VPS `192.124.182.59` over SSH (`djelu`).
- Run the remote telemetry script `backend/scripts/collect_telemetry.py` targeting `wss://java.djelu.site/ws/live`.
- Assert that real production LiteLLM Gateway upstream emits `generationComplete` and turns transition in $< 150 \text{ ms}$ after audio drain.

### Gate 4: Zero-Downtime Production Rolling Update
1. Create Git merge commit from `refactor/wave-10-unified-voice-engine-and-file-hygiene` into `main` after all prior gates pass.
2. Push `main` to origin.
3. On VPS:
   - Pull latest `main`.
   - Build frontend production bundle (`npm run build`).
   - Rebuild backend container (`docker compose build backend-api`).
   - Perform rolling restart (`docker compose up -d --no-deps backend-api`).
   - Check container health (`curl -fsS http://localhost:3000/api/health`).

---

## 3. Post-Deployment Smoke Test Checklist

- [ ] Open production website `https://java.djelu.site`.
- [ ] Navigate to **Теория $\rightarrow$ Собеседование** (Auto-VAD mode):
  - AI speaks greeting and reads question smoothly without cutting off after 1 sentence.
  - Mic button turns from pink ("AI Speaking") to green ("Your Turn") immediately upon audio completion.
  - Candidate speech is recognized and responded to.
- [ ] Navigate to **AI-Тьютор $\rightarrow$ "Спросить"**:
  - Voice operates identically using shared `LiveVoiceEngine`.
- [ ] Inspect production Docker logs (`docker logs --tail 100 interview-backend-api`):
  - Confirm `[ECHO_GUARD]` shows 0 dropped chunks after AI turn completes.
  - Confirm `generationComplete` processed correctly.

---

## 4. Rollback Plan
If any canary failure occurs during Stage 5:
- Revert VPS git commit to `d27d8224c9296d39f49e063e0e8948ee82f37676`.
- Rebuild containers via `docker compose up -d --build`.
- Zero candidate data loss, as sessions are transient WebSockets.
