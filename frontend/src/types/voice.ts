import { AcousticMetrics, SpeechClarityMetrics } from '../services/AcousticTelemetryService';
import { FaangScorecardData } from './personas';

export interface VoiceEvaluationResult {
  id?: string;
  questionId?: string;
  score?: number;
  isPassed?: boolean;
  positivePoints?: string[];
  missingPoints?: string[];
  feedback?: string;
  spokenFeedback?: string;
  audioMetrics?: AcousticMetrics;
  clarityMetrics?: SpeechClarityMetrics;
  questionType?: 'definitional' | 'tradeoff' | 'behavioral';
  speechCoaching?: {
    structureType?: 'STAR' | 'PREP' | 'RULE_OF_3' | 'UNSTRUCTURED';
    rephrasedExample?: string;
  };
  faangScorecard?: FaangScorecardData;
  userAnswer?: string;
  transcript?: string;
}

export type EvaluationResult = VoiceEvaluationResult;
