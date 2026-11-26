/**
 * livePromptBuilder.ts
 * Slim legacy compatibility facade delegating to LivePromptComposer and liveRubricBuilder (Spec 55).
 * Preserved for external legacy tests/scripts importing buildSystemPrompt without PreResolvedHrContext.
 * Cognitive Bounding Limit: <= 55 lines.
 */

import { isHrSessionType } from '@interview-prep/shared';
import {
  composeLiveSystemPrompt,
  LIVE_TOOL_CAPABILITY_DIRECTIVES,
  ZERO_UNPROBED_DEDUCTIONS_INVARIANT,
  buildLiveToolCapabilityDirectives,
  PreResolvedHrContext,
  LivePromptInput
} from './LivePromptComposer';
import { extractDefaultAnchors, buildWeightedRubric, WeightedAnchor } from './liveRubricBuilder';
import { resolvePreResolvedHrContext } from './hrContextResolver';
import { LiveSessionResolvedConfig } from './liveSessionConfigTypes';

export {
  composeLiveSystemPrompt,
  LIVE_TOOL_CAPABILITY_DIRECTIVES,
  ZERO_UNPROBED_DEDUCTIONS_INVARIANT,
  buildLiveToolCapabilityDirectives,
  extractDefaultAnchors,
  buildWeightedRubric,
  WeightedAnchor,
  PreResolvedHrContext,
  LivePromptInput
};

export function buildSystemPrompt(
  params: LiveSessionResolvedConfig | Partial<LivePromptInput>,
  preResolvedHrContext?: PreResolvedHrContext
): string {
  const input = params as LivePromptInput;
  const hrContext = preResolvedHrContext ?? (isHrSessionType(input.sessionType)
    ? resolvePreResolvedHrContext({
        dossierId: input.dossierId,
        jobId: input.jobId,
        questionId: input.questionId,
        chunkId: input.chunkId,
        questionMatrixId: input.questionMatrixId
      })
    : undefined);
  return composeLiveSystemPrompt(params, hrContext);
}
