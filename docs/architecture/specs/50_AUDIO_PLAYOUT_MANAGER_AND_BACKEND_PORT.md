# Spec 50: Deep `AudioPlayoutManager` & Injectable `AudioBackendPort`

> **Governing Glossary:** `AudioBackendPort`, `Dual-Sided Handshake`, `Tactile Barge-In` ([GLOSSARY.md](../../../GLOSSARY.md))  
> **Governing ADRs:** [ADR 0004](../../adr/0004-voice-dialogue-fast-handoff-and-cross-arena-copilot.md), [ADR 0005](../../adr/0005-unified-ai-gateway-and-slim-live-handshake.md)  
> **Domain Classification:** `Client-Single-Session` · `Internal` · 24kHz PCM Web Audio ring playout (`<10ms` jitter)

---

## 1. Intent & Workload Envelope
Collapse the 8-file / 771L playout cluster (`AudioPlayoutManager.ts` 397L + `audioContextHolder.ts` 36L + `audioWorkletFactory.ts` 36L + `audioSinkRouting.ts` 53L + `audioPcmCodec.ts` 49L + dead `audioChimes.ts` 65L, `audioBufferPlayback.ts` 60L, `audioDuckingController.ts` 75L) into one deep `AudioPlayoutManager(backendPort?)` module (`<= 250L`), deleting the 3 dead modules, all 11 unused public methods, and unused output `setMuted`, while eliminating all 7 `(playout as any)` internal casts in `audioPlayoutContracts.test.ts`.

---

## 2. Explicit Non-Goals (Blast-Radius Protection)
- Do NOT alter `frontend/public/worklets/gemini-audio-processor.js` PCM DSP math or ring-buffer capacity ($\ge 2^{22}$ samples).
- Do NOT wire microphone mute (`MicrophoneCapture.setMuted`) into speaker playout gain; mic mute remains independent so candidate keeps hearing AI instructions.
- Do NOT weaken Dual-Sided Handshake (`notifyTurnComplete` + physical DAC worklet `drained` message), nominal `masterGain = 1.5`, or mobile `<audio>` single-sink routing (`AGENTS.md` §2.2, §2.5).

---

## 3. Pre-Agreed Verification Seams
- **Primary Seam:** `AudioPlayoutManager` behind an injectable `AudioBackendPort` interface (`ports & adapters`).
- **Adapters:** `BrowserAudioBackendPort` (wrapping Web Audio `AudioContext`, `AudioWorkletNode`, `GainNode`, and mobile `MediaStreamAudioDestinationNode` + `<audio>`); `FakeAudioBackendPort` in `frontend/tests/audioPlayoutContracts.test.ts` recording gain changes, worklet messages (`pcm`, `flush`), and triggering `drained` without `(playout as any)` property casts.
- **Verification Commands (CI):** `npm run test:audio-contracts && npm run build`.

---

## 4. Formal Wire & Messaging Contracts

```ts
export interface AudioBackendPort {
  readonly isMobile: boolean;
  ensureGraph(): { sampleRate: number; state: 'suspended' | 'running' | 'closed' };
  resumeContext(): Promise<void>;
  getRawContext(): AudioContext;
  setNominalGain(value: number): void;
  getGainValue(): number;
  postWorkletSamples(samples: Float32Array): boolean;
  flushWorklet(): void;
  onWorkletDrained(listener: () => void): void;
  close(): Promise<void>;
}

export class AudioPlayoutManager {
  public onPlaybackFinished?: () => void;
  public onFirstAudioPlayout?: (playoutEpochMs: number) => void;
  public static getOrCreateContext(): AudioContext;
  public static warmup(): AudioContext | null;
  constructor(existingContext?: AudioContext | AudioBackendPort);
  public getContext(): AudioContext;
  public resume(): Promise<void>;
  public enqueuePcmChunk(base64Pcm: string): void;
  public notifyTurnComplete(): void;
  public handleInterruption(): void;
  public clearQueue(): void;
  public isPlaying(): boolean;
  public teardown(): Promise<void>;
}
```
- **Deleted Public Methods & Modules:** Delete `audioChimes.ts`, `audioBufferPlayback.ts`, `audioDuckingController.ts`, fold `audioContextHolder`, `audioWorkletFactory`, `audioSinkRouting`, `audioPcmCodec` internally (or private helpers inside `AudioPlayoutManager.ts`), and delete `setMuted`, `isMuted`, `playThinkingAuraTone`, `playHoldChime`, `playBase64Audio`, `playDecodedAudioBuffer`, `speculativeDuck`, `rollbackDucking`, `commitBargeIn`, `startNewTurn`, `resetTurnPlayoutState`, `suspend`, `isSuspended`.

---

## 5. Storage & Zero-Downtime Migration Contract
- Stateless browser audio subsystem; zero persistence changes. `createBrowserAudioIOPort()` (`browserVoicePorts.ts`) and all 7 `AudioPlayoutManager.warmup()` UI callers require zero behavioral changes.

---

## 6. Hoare-Logic Behavioral Contracts ({P} C {Q})
- `{P}` Valid base64 24kHz 16-bit signed LE PCM chunk (even byte length `> 0`) OR turn-control transitions (`notifyTurnComplete`, `handleInterruption`, `clearQueue`).
- `{C}` Decode base64 PCM to Float32 [-1, 1] -> enforce nominal gain `1.5` -> push samples via `AudioBackendPort.postWorkletSamples` (queuing if worklet still initializing) -> unblock turn strictly on `turnComplete && workletDrained` conjunction.
- `{Q}` `isPlaying()` toggles deterministically across enqueue, tactile interruption (`flushWorklet()` + `onPlaybackFinished` suppression/drain), and turn drain; `getGainValue()` remains strictly `1.5` after any barge-in sequence; zero `(playout as any)` casts exist in `audioPlayoutContracts.test.ts`.
