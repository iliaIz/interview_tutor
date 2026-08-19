export interface CandidateGapDTO {
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

export interface KnowledgeRadarDTO {
  activeDeficits: CandidateGapDTO[];
  verifyingGaps: CandidateGapDTO[];
  masteredGaps: CandidateGapDTO[];
  stats: {
    activeCount: number;
    verifyingCount: number;
    masteredCount: number;
    totalGaps: number;
  };
}

export interface UserProfileDTO {
  id: string;
  candidateName: string;
  targetSeniority: 'junior' | 'middle' | 'senior' | 'lead';
  primaryStack: string;
  preferredTone: 'rigorous' | 'supportive' | 'academic';
  focusAreas: string[];
}

export async function fetchKnowledgeRadar(): Promise<KnowledgeRadarDTO> {
  try {
    const res = await fetch('/api/memory/radar');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('Failed to fetch knowledge radar:', err);
    return {
      activeDeficits: [],
      verifyingGaps: [],
      masteredGaps: [],
      stats: { activeCount: 0, verifyingCount: 0, masteredCount: 0, totalGaps: 0 }
    };
  }
}

export async function fetchRelevantGaps(questionText: string, topic: string, questionId?: string): Promise<CandidateGapDTO[]> {
  try {
    const params = new URLSearchParams({
      questionText,
      topic,
      ...(questionId ? { questionId } : {})
    });
    const res = await fetch(`/api/memory/relevant?${params.toString()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.gaps || [];
  } catch (err) {
    console.error('Failed to fetch relevant gaps:', err);
    return [];
  }
}

export async function fetchUserProfile(): Promise<UserProfileDTO> {
  try {
    const res = await fetch('/api/memory/profile');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('Failed to fetch user profile:', err);
    return {
      id: 'default_user',
      candidateName: 'Кандидат',
      targetSeniority: 'senior',
      primaryStack: 'Java 21, Spring Boot 3.3, PostgreSQL, Kafka',
      preferredTone: 'rigorous',
      focusAreas: []
    };
  }
}

export async function saveUserProfile(profile: Partial<UserProfileDTO>): Promise<UserProfileDTO> {
  const res = await fetch('/api/memory/profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profile)
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

export async function resetGapForPractice(gapId: string): Promise<boolean> {
  const res = await fetch('/api/memory/reset-gap', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gapId })
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.success;
}
