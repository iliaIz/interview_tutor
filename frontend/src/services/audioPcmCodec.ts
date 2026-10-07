/**
 * audioPcmCodec.ts
 * High-performance PCM decoding utilities for Web Audio streaming
 */

export function decodeBase64Fallback(base64: string): Uint8Array {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function decodeBase64ToUint8(base64: string): Uint8Array {
  if (typeof (Uint8Array as any).fromBase64 === 'function') {
    try {
      return (Uint8Array as any).fromBase64(base64);
    } catch {
      return decodeBase64Fallback(base64);
    }
  }
  return decodeBase64Fallback(base64);
}

/**
 * Converts Base64 Int16 Little-Endian PCM chunk to normalized Float32 [-1.0, 1.0].
 * Discards dummy packets (<= 1 sample) emitted during Gemini Live text generation.
 */
export function decodeBase64PcmToFloat32(base64Payload: string): Float32Array | null {
  if (!base64Payload || base64Payload.length === 0) return null;
  const sanitized = base64Payload.replace(/\s+/g, '');
  if (!sanitized) return null;

  const uint8 = decodeBase64ToUint8(sanitized);
  const sampleCount = Math.floor(uint8.byteLength / 2);
  if (sampleCount <= 1) return null;

  const dataView = new DataView(uint8.buffer, uint8.byteOffset, sampleCount * 2);
  const float32Samples = new Float32Array(sampleCount);

  for (let i = 0; i < sampleCount; i++) {
    const int16 = dataView.getInt16(i * 2, true);
    float32Samples[i] = int16 < 0 ? int16 / 32768.0 : int16 / 32767.0;
  }

  return float32Samples;
}
