export type TaskDomain = 'streams' | 'concurrency' | 'testing' | 'spring';
export type TaskDifficulty = 'middle' | 'senior' | 'lead';
export type TaskArchetype = 
  | 'CarrierThreadPinning'
  | 'StreamsBottleneck'
  | 'LegacySeamRefactoring'
  | 'SliceTestCreation'
  | 'LockFreeOptimization'
  | 'CustomGathererCollector'
  | 'PitestMutationChallenge';

export interface DynamicTaskRequest {
  domain: TaskDomain;
  difficulty?: TaskDifficulty;
  archetype?: TaskArchetype;
  scenarioTheme?: string;
}

export interface DynamicTaskResult {
  id: string;
  title: string;
  domain: TaskDomain;
  difficulty: TaskDifficulty;
  archetype: string;
  scenario: string;
  naiveCode: string;
  goldenMaster: string;
  testSuite: string;
  astRules: string[];
  evaluationCriteria: string[];
}

export interface FileNode {
  path: string;
  content: string;
  readOnly: boolean;
  hidden: boolean;
  isMainEntryPoint?: boolean;
}

export interface TestCase {
  id: string;
  name: string;
  phase: number;
  weight: number;
  timeoutMs: number;
  input?: string;
  expectedOutput?: string;
  assertionScript?: string;
  isHidden: boolean;
}
