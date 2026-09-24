# Stage 08: StudyDeck & Audio Podcasts Actualization

> **Document:** `STAGE_08_STUDYDECK_AND_PODCASTS.md`  
> **Parent Roadmap:** [00_MASTER_IMPLEMENTATION_PLAN.md](00_MASTER_IMPLEMENTATION_PLAN.md)  
> **Authoritative Domain SSOT:** [`docs/architecture/specs/08_STUDYDECK_AND_AUDIO_PODCASTS.md`](../../architecture/specs/08_STUDYDECK_AND_AUDIO_PODCASTS.md)

---

## 1. Scope & Target Files

- **Backend Services & Routes:** `backend/src/services/podcast.ts`, `backend/src/routes/podcast.ts`.
- **Frontend Components:** `frontend/src/components/AudioPlayerBar.tsx`, `frontend/src/components/StudyDeck.tsx`, `frontend/src/components/AudioRecapModal.tsx`.
- **Storage Subsystems:** `/app/storage/podcasts/` (MP3/WAV cache).

---

## 2. Root Causes & Technical Debt to Eliminate

1. **Host Monologue Degradation:** AI script generators occasionally produce single-speaker monologues exceeding 60 seconds, destroying the dynamic two-host conversational feel.
2. **Loudness Inconsistency:** Varying audio volume levels between synthesized topics forcing candidates to adjust volume repeatedly.
3. **Mobile Lock-Screen Interruption:** Background playback stopping when mobile screens lock or when switching apps.

---

## 3. Implementation Checklist

### Backend & Audio Pipeline Actualization
- [ ] Enforce the Anti-Monologue Invariant in `podcast.ts`: neither Elena (Architect) nor Dmitry (Systems) may speak $>3$ sentences without an interjection.
- [ ] Implement EBU R128 loudness normalization ($-16\text{ LUFS}$) across synthesized MP3 files.
- [ ] Verify disk storage caching to prevent redundant upstream TTS generation calls.

### Frontend UI/UX Actualization
- [ ] **Persistent Mobile Audio Bar:** Slim bottom audio player bar (`AudioPlayerBar.tsx`) with wave visualizer, speed toggle ($0.75\times, 1.0\times, 1.25\times, 1.5\times, 2.0\times$), and chapter marks.
- [ ] **Mobile MediaSession Integration:** Synchronize lock-screen controls (iOS & Android) with playback state, chapter metadata, and seek $\pm 15$ seconds.
- [ ] **In-Audio FSRS-5 Rating:** Instant rating buttons (`Again`, `Hard`, `Good`, `Easy`) directly inside the player bar updating memory stability without interrupting audio.

---

## 4. Verification & Acceptance Criteria

```bash
# 1. Verify podcast routing and synthesis endpoints
npm --prefix backend run build

# 2. Verify file hygiene standards
npm run verify-hygiene
```
