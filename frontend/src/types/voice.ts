import { AcousticMetrics, SpeechClarityMetrics } from '../services/AcousticTelemetryService';
import { FaangScorecardData } from './personas';

export interface RubricCriterionResult {
  id: string;
  title: string;
  maxPoints: number;
  earnedPoints: number;
  status: 'covered' | 'partial' | 'missed';
  probeAssisted?: boolean;
  evidence?: string;
  gap?: string;
}

export interface ScoreDeduction {
  penalty: number;
  criteria: string;
  reason: string;
}

export interface VoiceEvaluationResult {
  id?: string;
  questionId?: string;
  score?: number;
  isPassed?: boolean;
  positivePoints?: string[];
  missingPoints?: string[];
  criteriaBreakdown?: RubricCriterionResult[];
  deductions?: ScoreDeduction[];
  upgradeSnippet?: string;
  feedback?: string;
  spokenFeedback?: string;
  audioMetrics?: AcousticMetrics;
  clarityMetrics?: SpeechClarityMetrics;
  questionType?: 'definitional' | 'tradeoff' | 'behavioral';
  speechCoaching?: {
    structureType?: 'STAR' | 'PREP' | 'RULE_OF_3' | 'UNSTRUCTURED';
    rephrasedExample?: string;
    criteriaBreakdown?: RubricCriterionResult[];
    deductions?: ScoreDeduction[];
    upgradeSnippet?: string;
  };
  faangScorecard?: FaangScorecardData;
  userAnswer?: string;
  transcript?: string;
}

export type EvaluationResult = VoiceEvaluationResult;
