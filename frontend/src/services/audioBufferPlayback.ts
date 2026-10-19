/**
 * audioBufferPlayback.ts
 * Standalone AudioBuffer source playback for TTS and one-off audio
 */

import { decodeBase64ToUint8 } from './audioPcmCodec';

export function playDecodedBufferHelper(
  context: AudioContext,
  masterGain: GainNode,
  buffer: AudioBuffer,
  activeSources: Set<AudioBufferSourceNode>,
  onEndedCallback?: () => void
): void {
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(masterGain);
  source.start(0);
  activeSources.add(source);

  source.onended = () => {
    try {
      source.disconnect();
    } catch {}
    activeSources.delete(source);
    onEndedCallback?.();
  };
}

export async function playBase64AudioHelper(
  context: AudioContext,
  masterGain: GainNode,
  base64Audio: string,
  activeSources: Set<AudioBufferSourceNode>,
  onPcmFallback: (sanitized: string) => void,
  onEndedCallback?: () => void
): Promise<void> {
  if (!base64Audio) return;
  const sanitized = base64Audio.replace(/\s+/g, '');
  if (!sanitized) return;

  const bytes = decodeBase64ToUint8(sanitized);
  try {
    const arrayBuffer = bytes.buffer.slice(0) as ArrayBuffer;
    const audioBuffer = await context.decodeAudioData(arrayBuffer);
    playDecodedBufferHelper(context, masterGain, audioBuffer, activeSources, onEndedCallback);
  } catch {
    onPcmFallback(sanitized);
  }
}

export function stopAllActiveSources(activeSources: Set<AudioBufferSourceNode>): void {
  for (const source of activeSources) {
    try {
      source.stop();
      source.disconnect();
    } catch {}
  }
  activeSources.clear();
}
