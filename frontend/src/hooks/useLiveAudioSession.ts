/**
 * Live Audio Session Hook (WebRTC Engine via LiveKit & LiteLLM Proxy)
 * 
 * Replaces legacy custom Web Audio API with industrial WebRTC,
 * featuring native OS Acoustic Echo Cancellation (AEC),
 * sub-300ms latency, and centralized LiteLLM proxy failover.
 */

export * from './useLiveKitAudioSession';
export { useLiveKitAudioSession as useLiveAudioSession } from './useLiveKitAudioSession';
