/**
 * audioWorkletFactory.ts
 * Factory to load and instantiate the Gemini audio processor worklet
 */

export async function createGeminiAudioWorklet(
  context: AudioContext,
  masterGain: GainNode | null,
  onDrained: () => void
): Promise<AudioWorkletNode | null> {
  try {
    await context.audioWorklet.addModule('/worklets/gemini-audio-processor.js');
    if (context.state === 'closed') return null;

    const node = new AudioWorkletNode(context, 'gemini-audio-processor', {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [1]
    });

    if (masterGain) {
      node.connect(masterGain);
    }

    node.port.onmessage = (event) => {
      if (event.data?.type === 'drained') {
        onDrained();
      }
    };

    return node;
  } catch (err) {
    console.error('Failed to register gemini-audio-processor worklet:', err);
    return null;
  }
}
