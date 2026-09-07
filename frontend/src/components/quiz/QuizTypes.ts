import { Question } from '../../store/useAppStore';

export interface EvalRecord {
  question: Question;
  userAnswer: string;
  score: number;
  isPassed: boolean;
  feedback: string;
  positivePoints?: string[];
  missingPoints?: string[];
}
