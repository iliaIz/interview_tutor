/**
 * voiceModalTypes.ts
 * Types and interfaces for VoiceModal orchestrator.
 * Cognitive bounding limit: <= 40 lines.
 */

import { VoiceEvaluationResult } from '../../types/voice';

export interface QuestionItem {
  id: string;
  topic?: string;
  question: string;
  answer?: string;
  num?: number;
}

export interface VoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  questionId?: string;
  topic?: string;
  currentQuestionText?: string;
  referenceAnswer?: string;
  questionsBatch?: QuestionItem[];
  initialQuestionIndex?: number;
  initialSessionType?: 'interview' | 'tutor';
  initialTutorMode?: string;
  customPromptOverride?: string;
  onIndexChange?: (newIndex: number) => void;
  onBatchComplete?: (batchResults: Record<string, VoiceEvaluationResult>) => void;
  onEvaluationComplete?: (evaluation: VoiceEvaluationResult) => void;
  onTutorComplete?: (topic: string, questionId: string) => void;
}
