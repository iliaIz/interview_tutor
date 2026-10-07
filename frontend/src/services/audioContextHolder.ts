/**
 * audioContextHolder.ts
 * Manages shared browser AudioContext lifecycle
 */

let sharedContext: AudioContext | null = null;

export function getOrCreateSharedAudioContext(): AudioContext {
  if (typeof window === 'undefined') {
    throw new Error('AudioContext unavailable outside browser environment');
  }
  if (!sharedContext || sharedContext.state === 'closed') {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    sharedContext = new AudioCtx({ latencyHint: 'interactive' });
  }
  if (sharedContext.state === 'suspended') {
    void sharedContext.resume().catch(() => {});
  }
  return sharedContext;
}

export function warmupSharedAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    return getOrCreateSharedAudioContext();
  } catch (e) {
    console.warn('warmupSharedAudioContext notice:', e);
    return null;
  }
}

export function clearSharedAudioContext(ctx: AudioContext): void {
  if (sharedContext === ctx) {
    sharedContext = null;
  }
}
