export interface TrafficProfile {
  targetDAU: string;
  estimatedPeakRPS: string;
  dailyStorageGrowth: string;
  retentionPolicy: string;
  slaAvailability: string;
}

export interface TradeOffProbe {
  question: string;
  modelAnswer: string;
}

export interface SystemDesignScenario {
  id: string;
  scenarioNumber: number;
  slug: string;
  title: string;
  category: string;
  difficulty: 'junior' | 'middle' | 'senior' | 'lead';
  level?: 'L0' | 'L1' | 'L2' | 'L3';
  trafficProfile: TrafficProfile;
  contextMarkdown: string;
  calculationsMarkdown: string;
  topologyMarkdown: string;
  bottlenecksMarkdown: string;
  initialMermaid: string;
  tradeOffProbes: TradeOffProbe[];
}

export interface SystemDesignEvaluation {
  totalScore: number;
  verdict: 'STRONG_HIRE' | 'HIRE' | 'LEANING_HIRE' | 'NO_HIRE';
  radarMetrics: {
    scalability: number;
    faultTolerance: number;
    dataConsistency: number;
    tradeOffJustification: number;
    costEfficiency: number;
  };
  strengths: string[];
  vulnerabilities: string[];
  barRaiserFeedback: string;
}

export interface ProductionIncident {
  id: string;
  incidentNumber: number;
  slug: string;
  title: string;
  category: string;
  severity: 'CRITICAL' | 'HIGH';
  symptomsMarkdown: string;
  rawArtifactText: string;
  rootCauseAnalysis: string;
  remediationMarkdown: string;
  keyMetricTrigger: string;
}

export interface IncidentTriageEvaluation {
  score: number;
  isRootCauseCorrect: boolean;
  verdict: 'RESOLVED' | 'PARTIALLY_RESOLVED' | 'INCORRECT';
  rcaFeedback: string;
  remediationFeedback: string;
  missingNuances: string[];
  seniorBarRating: string;
}

export interface AcademyCoreRequirements {
  theoryTopic?: string;
  theoryTitle?: string;
  taskType?: 'lld' | 'hld' | 'triage' | 'sql' | 'config';
  taskDescription?: string;
  lldChallengeSlug?: string;
  hldScenarioId?: string;
  triageIncidentId?: string;
}

export interface AcademyBonusDeepDive {
  title: string;
  description: string;
}

export interface AcademyStep {
  stepNumber: number;
  title: string;
  milestoneId: string;
  seniorBarConcept: string;
  interviewTrap: string;
  estimatedMinutes: number;
  coreRequirements?: AcademyCoreRequirements;
  bonusDeepDive?: AcademyBonusDeepDive;
  masteryChecklist: string[];
  crossCourseLinks?: string[];
  isCompleted?: boolean;
  entityStatus?: {
    isManual: boolean;
    isLldPassed: boolean;
    isTriagePassed: boolean;
    isHldPassed: boolean;
  };
  // Legacy aliases for backward compatibility
  theoryQuestionId?: string;
  incidentKataId?: string;
  lldChallengeId?: string;
  hldScenarioId?: string;
}

export interface AcademyMilestone {
  id: string;
  title: string;
  stepRange: string;
}

export interface AcademyCourse {
  id: string;
  category: 'career' | 'domain';
  title: string;
  badge: string;
  difficulty?: 'solid_senior' | 'staff_principal';
  estimatedDuration?: string;
  description: string;
  totalSteps: number;
  milestonesCount?: number;
  milestones?: AcademyMilestone[];
  steps?: AcademyStep[];
  userProgress?: {
    completedSteps?: number[];
    completedCount?: number;
    currentStep?: number;
    percentage: number;
    rank?: string;
    pillars?: {
      concurrency: number;
      databases: number;
      systemDesign: number;
      forensics: number;
    };
  };
}


// Legacy aliases for backward compatibility
export type RoadmapStep = AcademyStep;
export type RoadmapMilestone = AcademyMilestone;
export type GuidedRoadmap = AcademyCourse;

