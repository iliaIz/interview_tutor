# Spec 47: Frontend Live Transport/Audio Ports, Narrow `useLiveVoiceSession` Bridge & Unified Practice Voice Provider

> **Governing Glossary:** `Dual-Sided Handshake`, `Tactile Barge-In`, `Omnipresent Arena Copilot Provider` ([GLOSSARY.md](../../../GLOSSARY.md))  
> **Governing ADRs:** [ADR 0003](../../adr/0003-omnipresent-ai-copilot-and-company-track-enrichment.md), [ADR 0004](../../adr/0004-voice-dialogue-fast-handoff-and-cross-arena-copilot.md)  
> **Domain Classification:** `Client Browser Runtime` · 30Hz DSP telemetry isolated from React render trees

---

## 1. Intent & Workload Envelope
Decouple `NativeLiveVoiceEngine` from globals via injectable `LiveTransportPort` & `LiveAudioIOPort` seams (removing all 19 `(engine as any)` white-box casts in `liveVoiceEngine.test.ts`), eliminate split turn state and leaky `rawParsed?: any` in `LiveVoiceFrameParser`, consolidate config serialization, narrow `useLiveVoiceSession` from 27 aliases/fields to a clean reactive interface with working `isMuted` state and off-tree RMS meter subscription (`subscribeAudioLevel`), and prevent duplicate `NativeLiveVoiceEngine` allocation when `PracticeArena` nests `PracticeVoiceProvider`.

---

## 2. Explicit Non-Goals (Blast-Radius Protection)
- **UI Deletion Test Exception:** Never remove or collapse conditional rendering, ARIA labels, keyboard listeners, or modals in `PracticeVoiceHUD.tsx`, `AmbientVoicePill.tsx`, `VoiceModal.tsx`, `BugHuntVoiceMentor.tsx`, `HrVoiceHUD.tsx`, or `SystemDesignArena.tsx`.
- Do NOT modify AudioWorklet DSP ring buffer math (`audio-capture-processor.js`) or `AudioPlayoutManager` core Web Audio graph nodes.

---

## 3. Pre-Agreed Verification Seams
- **Headless Engine Seam:** `NativeLiveVoiceEngine` constructed with `{ transport?: LiveTransportPort; audio?: LiveAudioIOPort }` tested solely via `connect`, `dispatch`, `disconnect`, `getSnapshot` in `frontend/tests/liveVoiceEngine.test.ts`.
- **Hook & Params Seam:** `buildPracticeSessionParams(input)` in `frontend/src/components/practice/tutor/practiceSessionParamsBuilder.ts` + `useLiveVoiceSession` with injectable `engineFactory` tested in `frontend/tests/liveAudioSessionContracts.test.ts`.
- **Verification Command (CI):** `npm run test:audio-contracts && npm run build`.

---

## 4. Formal Wire & Messaging Contracts

```ts
export interface LiveTransportConnection {
  send(payload: string): void;
  close(code?: number, reason?: string): void;
  isOpen(): boolean;
}

export interface LiveTransportPort {
  connect(
    url: string,
    handlers: {
      onOpen: () => void;
      onMessage: (data: unknown) => void;
      onClose: (code?: number) => void;
      onError: (err: unknown) => void;
    }
  ): LiveTransportConnection;
}

export interface LiveAudioIOPort {
  startCapture(onFrame: (pcm: string, metrics?: MicrophoneMetrics) => void, onLevel: (db: number) => void): Promise<void>;
  stopCapture(): void;
  setMuted(muted: boolean): void;
  enqueuePcm(pcm: string): void;
  interruptPlayout(): void;
  notifyTurnComplete(): void;
  handlePlayoutFinished(cb: () => void): void;
  isPlaying(): boolean;
  clearPlayout(): void;
}
```
- `LiveVoiceFrameParser` exposes a closed discriminated control union; `rawParsed?: any` is removed.
- `PracticeVoiceProvider` detects parent `PracticeVoiceContext` if already mounted at root (`App.tsx`) and passes through the active context cleanly instead of creating a duplicate `NativeLiveVoiceEngine`.

---

## 5. Storage & Zero-Downtime Migration Contract
- Client-side memory/hooks only; zero backend storage changes. Legacy caller fields (`startSession`, `disconnectSession`, `handleBargeIn`, `finishManualTurn`, `handleCentralButtonClick`) can be cleanly migrated in callers within the same ticket series (`Expand -> Migrate -> Contract`) so zero TS breakage ever occurs.

---

## 6. Hoare-Logic Behavioral Contracts ({P} C {Q})
- `{P}` Callers connect with `LiveAudioSessionParams`; audio frames stream at ~30Hz.
- `{C}` Engine routes audio/WS through injected ports and delivers `onAudioLevel` only to `subscribeAudioLevel` subscribers without triggering React `useState` updates at 30Hz; `toggleMic` flips reactive `isMuted` state.
- `{Q}` `liveVoiceEngine.test.ts` uses 0 `(engine as any)` internal property mutations; parent providers never suffer 30Hz full-tree re-renders; `isMuted` toggles re-render HUD mute badge consistently across all arenas.
