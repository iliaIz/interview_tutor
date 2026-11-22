/**
 * evaluationPipelinePersistence.ts
 * Backward-compatibility delegating facade to ChallengeEvaluationSession (SPEC-25).
 * Rule 8 compliant: <= 30 lines.
 */

import { ChallengeEvaluationSession } from './ChallengeEvaluationSession';

export { ChallengeEvaluationSession };
export const EvaluationPipelinePersistence = ChallengeEvaluationSession;
export default ChallengeEvaluationSession;
