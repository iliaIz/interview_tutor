import { LiveWorkspaceContext } from './LiveWorkspaceContext';

export interface ChallengeResolutionInput {
  challengeId: string;
  questionId: string;
  queryTopic?: string;
  queryBugTitle?: string;
  queryQuestionText?: string;
  queryReferenceAnswer?: string;
  queryBugExplanation?: string;
  queryFixedCode?: string;
  queryCodeSnippet?: string;
  queryChallengeCategory?: string;
  queryChallengeTrack?: string;
  queryActiveFilePath?: string;
}

export interface ResolvedChallengeContext {
  topic: string;
  bugTitle: string;
  questionText: string;
  referenceAnswer: string;
  bugExplanation: string;
  fixedCode: string;
  codeSnippet: string;
  challengeCategory: string;
  challengeTrack: string;
  workspaceManifest: any | null;
  activeFilePath: string;
}

/**
 * Backward-compatibility facade for challenge resolution across SQLite domains (Spec 24).
 * Delegates to encapsulated LiveWorkspaceContext aggregate.
 */
export function resolveLiveChallengeContext(input: ChallengeResolutionInput): ResolvedChallengeContext {
  return LiveWorkspaceContext.resolve(input).getResolved();
}
