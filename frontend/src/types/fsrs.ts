export interface FsrsQueueItemDTO {
  questionId: string;
  topic: string;
  question: string;
  answer: string;
  retrievability: number; // 0.0 .. 1.0 (Current recall probability)
  stability: number;      // S (days)
  difficulty: number;     // D (1.0 .. 10.0)
  reps: number;
  lapses: number;
  dueAt: string;
  isOverdue: boolean;
}

export interface FsrsForecastPoint {
  day: number;
  avgRetention: number; // 0.0 .. 1.0
  dueCount: number;
}

export interface FsrsStatsDTO {
  freshCount: number;       // R >= 0.90
  riskCount: number;        // 0.70 <= R < 0.90
  criticalCount: number;    // R < 0.70 / Overdue
  totalTracked: number;
  averageRetention: number; // 0.0 .. 1.0
  retentionForecast: FsrsForecastPoint[];
}

export interface FsrsReviewResponse {
  card: {
    user_id: string;
    question_id: string;
    stability: number;
    difficulty: number;
    scheduled_days: number;
    reps: number;
    lapses: number;
    state: number;
    due_at: string;
  };
  propagatedCount: number;
}
