export interface CandidateGap {
  id: string;
  questionId?: string;
  topic: string;
  subtopic?: string;
  errorConcept: string;
  deficitWeight: number;
  status: 'ACTIVE_DEFICIT' | 'VERIFYING' | 'MASTERED';
  soloStreak: number;
  similarity?: number;
}

export interface KnowledgeDecayParams {
  gapId?: string;
  questionId?: string;
  topic: string;
  errorConcept?: string;
  assistanceLevel: 'solo' | 'guided' | 'assisted' | 'relapse';
  score?: number;
  feedback?: string;
}

export interface KnowledgeDecayEventParams {
  userId?: string;
  questionId?: string;
  topic: string;
  assistanceLevel: 'solo' | 'guided' | 'assisted' | 'relapse';
  resolvedGapIds?: string[];
}

export interface UserProfileData {
  id: string;
  candidateName: string;
  targetSeniority: 'junior' | 'middle' | 'senior' | 'lead';
  primaryStack: string;
  preferredTone: 'rigorous' | 'supportive' | 'academic';
  focusAreas: string[];
}
