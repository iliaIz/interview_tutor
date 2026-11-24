/**
 * liveVoiceDomainEvents.ts
 * Dispatches domain-specific payloads (whiteboard, chaos, HR scorecard, code smells) to callbacks.
 */

import { VoiceEngineCallbacks } from './types';
import { ParsedLiveFrameResult } from './LiveVoiceFrameParser';

export function dispatchDomainEvents(callbacks: VoiceEngineCallbacks, parsed: ParsedLiveFrameResult): void {
  if (parsed.whiteboardPayload) callbacks.onWhiteboardUpdate?.(parsed.whiteboardPayload);
  if (parsed.chaosPayload) callbacks.onChaosInjected?.(parsed.chaosPayload);
  if (parsed.verdictPayload) callbacks.onHiringCommitteeVerdict?.(parsed.verdictPayload);
  if (parsed.bugSolvedPayload) callbacks.onBugSolved?.(parsed.bugSolvedPayload);
  if (parsed.candidateObservationPayload) callbacks.onCandidateObservationRecorded?.(parsed.candidateObservationPayload);
  if (parsed.smellDiscoveredPayload) {
    callbacks.onSmellDiscovered?.(parsed.smellDiscoveredPayload);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('smell_discovered', { detail: parsed.smellDiscoveredPayload }));
    }
  }
  if (parsed.toolCallPayload) callbacks.onToolCall?.(parsed.toolCallPayload);
  if (parsed.hrPhaseTransitionPayload) callbacks.onHrPhaseTransition?.(parsed.hrPhaseTransitionPayload);
  if (parsed.hrScorecardPayload) callbacks.onHrScorecardReady?.(parsed.hrScorecardPayload);
  if (parsed.hrTranscriptDelta) callbacks.onHrTranscriptDelta?.(parsed.hrTranscriptDelta);
  if (parsed.hrStepStatePayload) callbacks.onHrStepState?.(parsed.hrStepStatePayload);
}
