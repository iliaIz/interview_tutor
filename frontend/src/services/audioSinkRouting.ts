/**
 * audioSinkRouting.ts
 * Single-Sink audio routing helper: Mobile loudspeaker (STREAM_MUSIC) vs Desktop DAC
 */

export interface MobileSpeakerphoneBridge {
  mediaStreamDest: MediaStreamAudioDestinationNode;
  speakerphoneElement: HTMLAudioElement;
}

export function setupMobileSpeakerphoneBridge(
  context: AudioContext,
  masterGain: GainNode
): MobileSpeakerphoneBridge | null {
  try {
    const mediaStreamDest = context.createMediaStreamDestination();
    masterGain.connect(mediaStreamDest);

    const audio = document.createElement('audio');
    audio.setAttribute('playsinline', 'true');
    audio.setAttribute('webkit-playsinline', 'true');
    audio.autoplay = true;
    audio.muted = false;
    audio.volume = 1.0;
    audio.srcObject = mediaStreamDest.stream;
    audio.play().catch(() => {});

    return { mediaStreamDest, speakerphoneElement: audio };
  } catch (e) {
    console.warn('Mobile speakerphone routing fallback:', e);
    masterGain.connect(context.destination);
    return null;
  }
}
