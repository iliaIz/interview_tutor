/**
 * Live Audio Session Hook (WebSocket Engine via LiteLLM Proxy)
 * 
 * Routes through secure WebSocket (/ws/live) over HTTPS port 443,
 * providing zero-firewall traversal, hardware Acoustic Echo Cancellation (AEC),
 * sub-300ms latency, and centralized LiteLLM proxy failover.
 */

export * from './useLegacyLiveAudioSession';
export { useLiveAudioSession } from './useLegacyLiveAudioSession';

