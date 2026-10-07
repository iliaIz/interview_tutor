/**
 * audioChimes.ts
 * Procedural voice hold & resume audio chimes for Web Audio
 */

export interface ChimeHandle {
  osc: OscillatorNode;
  gain: GainNode;
}

export function playHoldChimeHelper(
  context: AudioContext,
  masterGain: GainNode,
  isHold: boolean,
  activeChimes: Set<ChimeHandle>
): void {
  if (context.state !== 'running') return;
  try {
    const osc = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;
    osc.type = 'sine';

    if (isHold) {
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.15);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.07, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    } else {
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(660, now + 0.12);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.08, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    }

    osc.connect(gain);
    gain.connect(masterGain);

    const chimeHandle: ChimeHandle = { osc, gain };
    activeChimes.add(chimeHandle);

    osc.start(now);
    osc.stop(now + 0.20);
    osc.onended = () => {
      try {
        osc.disconnect();
        gain.disconnect();
      } catch {}
      activeChimes.delete(chimeHandle);
    };
  } catch {}
}
