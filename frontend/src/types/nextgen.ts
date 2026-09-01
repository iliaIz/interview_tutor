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
  difficulty: 'senior' | 'lead';
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

export interface RoadmapStep {
  stepNumber: number;
  title: string;
  milestoneId: string;
  seniorBarConcept: string;
  theoryQuestionId?: string;
  incidentKataId?: string;
  lldChallengeId?: string;
  hldScenarioId?: string;
  estimatedMinutes: number;
}

export interface RoadmapMilestone {
  id: string;
  title: string;
  stepRange: string;
}

export interface GuidedRoadmap {
  id: string;
  title: string;
  totalSteps: number;
  badge: string;
  description: string;
  milestones: RoadmapMilestone[];
  steps: RoadmapStep[];
  userProgress?: {
    completedSteps: number[];
    currentStep: number;
    percentage: number;
  };
}
