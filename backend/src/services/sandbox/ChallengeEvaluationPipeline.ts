/**
 * ChallengeEvaluationPipeline.ts
 * Deep Facade delegating to ChallengeEvaluationSession (SPEC-25).
 * Decoupled from transport (SSE / WebSocket).
 * Cognitive Bounding Limit: <= 50 lines (Rule 8).
 */

import { ChallengeEvaluationSession } from './ChallengeEvaluationSession';
import {
  ChallengeEvaluationInput,
  EvaluationPipelineEvent
} from './evaluationPipelineTypes';

export class ChallengeEvaluationPipeline {
  public static async *evaluate(
    input: ChallengeEvaluationInput
  ): AsyncIterable<EvaluationPipelineEvent> {
    const session = new ChallengeEvaluationSession();
    yield* session.runGates(input);
  }
}

export default ChallengeEvaluationPipeline;
