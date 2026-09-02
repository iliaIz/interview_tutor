import { FsrsQueueItemDTO, FsrsStatsDTO, FsrsReviewResponse } from '../types/fsrs';

export async function fetchFsrsQueue(limit: number = 10): Promise<{
  queue: FsrsQueueItemDTO[];
  count: number;
  estimatedMinutes: number;
}> {
  try {
    const res = await fetch(`/api/memory/fsrs/queue?limit=${limit}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('Failed to fetch FSRS queue:', err);
    return { queue: [], count: 0, estimatedMinutes: 0 };
  }
}

export async function fetchFsrsStats(): Promise<FsrsStatsDTO> {
  try {
    const res = await fetch('/api/memory/fsrs/stats');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('Failed to fetch FSRS stats:', err);
    return {
      freshCount: 0,
      riskCount: 0,
      criticalCount: 0,
      totalTracked: 0,
      averageRetention: 1.0,
      retentionForecast: []
    };
  }
}

export async function submitFsrsReview(questionId: string, score: number, isPassed: boolean): Promise<FsrsReviewResponse | null> {
  try {
    const res = await fetch('/api/memory/fsrs/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId, score, isPassed })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('Failed to submit FSRS review:', err);
    return null;
  }
}
