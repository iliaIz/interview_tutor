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
  id?: string;
  canonical_id?: string;
  legacy_aliases?: string[];
  version?: string;
  scenarioNumber?: number;
  slug?: string;
  title: string;
  subtitle?: string;
  category?: string;
  archetype?: string;
  difficulty?: 'junior' | 'middle' | 'senior' | 'lead' | string;
  level?: 'L0' | 'L1' | 'L2' | 'L3' | string;
  target_level?: 'L3_JUNIOR' | 'L4_MIDDLE' | 'L5_SENIOR' | 'L6_STAFF' | 'L7_PRINCIPAL' | string;
  pedagogical_mode?: 'WORKED_EXAMPLE' | 'FADED_COMPLETION' | 'INDEPENDENT_DESIGN' | string;
  trafficProfile?: TrafficProfile;
  contextMarkdown?: string;
  problem_statement?: string;
  calculationsMarkdown?: string;
  topologyMarkdown?: string;
  bottlenecksMarkdown?: string;
  initialMermaid?: string;
  tradeOffProbes?: TradeOffProbe[];
  studio_1_runtime?: any;
  studio_2_simulation?: any;
  studio_3_bar_raiser?: any;
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
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  level?: 'L0' | 'L1' | 'L2';
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

export type TargetArenaType = 
  | 'oral_interview' 
  | 'testing_mutation' 
  | 'transactions' 
  | 'system_design' 
  | 'incident_triage' 
  | 'machine_coding' 
  | 'theory';

export interface AcademyCoreRequirements {
  theoryTopic?: string;
  theoryTitle?: string;
  taskType?: string;
  targetArena?: TargetArenaType;
  targetScenarioId?: string;
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
  targetArena?: TargetArenaType;
  targetScenarioId?: string;
  requiredForGrade?: string;
  prerequisiteStepIds?: string[];
  domain?: string;
  pedagogicalRationale?: string;
  coreRequirements?: AcademyCoreRequirements;
  bonusDeepDive?: AcademyBonusDeepDive;
  masteryChecklist: string[];
  crossCourseLinks?: string[];
  isCompleted?: boolean;
  entityStatus?: {
    isManual: boolean;
    isTxPassed?: boolean;
    isLldPassed: boolean;
    isTestingPassed?: boolean;
    isTriagePassed: boolean;
    isHldPassed: boolean;
  };
  // Legacy aliases for backward compatibility
  theoryQuestionId?: string;
  incidentKataId?: string;
  lldChallengeId?: string;
  hldScenarioId?: string;
}

export interface NextBestStepRecommendation {
  hasRecommendation: boolean;
  message?: string;
  courseId: string;
  courseTitle: string;
  step?: AcademyStep;
  stepNumber?: number;
  title?: string;
  targetArena?: TargetArenaType;
  targetScenarioId?: string;
  estimatedMinutes?: number;
  domain?: string;
  pedagogicalRationale?: string;
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

