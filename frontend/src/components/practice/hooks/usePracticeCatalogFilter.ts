import { useState, useEffect, useMemo, useCallback } from 'react';
import { CodingChallenge, ChallengeCategory } from '../../../types/practice';
import {
  GRADE_CONFIG,
  StatusFilter,
  isChallengeInCategory,
  isChallengeInArchetype
} from '../PracticeCatalogConstants';
import { useAppStore } from '../../../store/useAppStore';

export interface UsePracticeCatalogFilterReturn {
  challenges: CodingChallenge[];
  filteredChallenges: CodingChallenge[];
  loading: boolean;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  selectedCategory: ChallengeCategory;
  setSelectedCategory: (cat: ChallengeCategory) => void;
  selectedArchetype: string;
  setSelectedArchetype: (arch: string) => void;
  statusFilter: StatusFilter;
  setStatusFilter: (filter: StatusFilter) => void;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  activeChallenge: CodingChallenge | null;
  collapsedGrades: Record<string, boolean>;
  toggleGrade: (gradeId: string) => void;
  categoryStats: {
    total: number;
    completed: number;
    inProgress: number;
    notStarted: number;
    percent: number;
  };
  groupedSections: Array<{
    grade: any;
    items: CodingChallenge[];
    completedCount: number;
    totalCount: number;
    progressPercent: number;
  }>;
  fetchChallenges: () => Promise<void>;
}

export function usePracticeCatalogFilter(): UsePracticeCatalogFilterReturn {
  const { showToast } = useAppStore();
  const [challenges, setChallenges] = useState<CodingChallenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ChallengeCategory>('all');
  const [selectedArchetype, setSelectedArchetype] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [collapsedGrades, setCollapsedGrades] = useState<Record<string, boolean>>({});

  const fetchChallenges = useCallback(async () => {
    try {
      const res = await fetch('/api/practice/challenges', { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const loaded: CodingChallenge[] = Array.isArray(data) ? data : (data.challenges || []);
      setChallenges(loaded);

      if (loaded.length > 0 && !selectedId) {
        setSelectedId(loaded[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load challenges:', err);
      showToast({
        type: 'error',
        title: 'Ошибка каталога',
        message: 'Не удалось загрузить каталог практических задач.'
      });
    } finally {
      setLoading(false);
    }
  }, [showToast, selectedId]);

  useEffect(() => {
    void fetchChallenges();
  }, [fetchChallenges]);

  const toggleGrade = useCallback((gradeId: string) => {
    setCollapsedGrades((prev) => ({ ...prev, [gradeId]: !prev[gradeId] }));
  }, []);

  const filteredChallenges = useMemo(() => {
    return challenges.filter((c) => {
      if (!isChallengeInCategory(c, selectedCategory)) {
        return false;
      }

      if (!isChallengeInArchetype(c, selectedCategory, selectedArchetype)) {
        return false;
      }

      if (statusFilter !== 'all') {
        if (statusFilter === 'completed' && c.status !== 'COMPLETED') return false;
        if (statusFilter === 'in_progress' && c.status !== 'IN_PROGRESS' && c.status !== 'FAILED') return false;
        if (statusFilter === 'not_started' && (c.status === 'COMPLETED' || c.status === 'IN_PROGRESS' || c.status === 'FAILED')) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inTitle = c.title.toLowerCase().includes(q);
        const inDesc = (c.shortDescription || '').toLowerCase().includes(q);
        const inStack = (c.targetStack || '').toLowerCase().includes(q);
        const inCode = (c.taskCode || c.id || '').toLowerCase().includes(q);
        if (!inTitle && !inDesc && !inStack && !inCode) return false;
      }

      return true;
    });
  }, [challenges, selectedCategory, selectedArchetype, statusFilter, searchQuery]);

  useEffect(() => {
    if (filteredChallenges.length > 0) {
      const stillValid = filteredChallenges.some((c) => c.id === selectedId);
      if (!stillValid) {
        setSelectedId(filteredChallenges[0].id);
      }
    }
  }, [filteredChallenges, selectedId]);

  const activeChallenge = useMemo(() => {
    return filteredChallenges.find((c) => c.id === selectedId) || filteredChallenges[0] || null;
  }, [filteredChallenges, selectedId]);

  const categoryStats = useMemo(() => {
    const relevant = challenges.filter((c) => isChallengeInCategory(c, selectedCategory));
    const completed = relevant.filter((c) => c.status === 'COMPLETED').length;
    const inProgress = relevant.filter((c) => c.status === 'IN_PROGRESS' || c.status === 'FAILED').length;
    const total = relevant.length;
    return {
      total,
      completed,
      inProgress,
      notStarted: total - completed - inProgress,
      percent: total > 0 ? Math.round((completed / total) * 100) : 0
    };
  }, [challenges, selectedCategory]);

  const groupedSections = useMemo(() => {
    return GRADE_CONFIG.map((grade) => {
      const allForGrade = challenges.filter((c) => {
        if (!isChallengeInCategory(c, selectedCategory)) return false;
        return c.difficulty === grade.id;
      });
      const items = filteredChallenges.filter((c) => c.difficulty === grade.id);
      const completedCount = allForGrade.filter((c) => c.status === 'COMPLETED').length;
      const totalCount = allForGrade.length;
      const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
      return { grade, items, completedCount, totalCount, progressPercent };
    }).filter((sec) => sec.items.length > 0);
  }, [challenges, filteredChallenges, selectedCategory]);

  return {
    challenges,
    filteredChallenges,
    loading,
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
    selectedArchetype,
    setSelectedArchetype,
    statusFilter,
    setStatusFilter,
    selectedId,
    setSelectedId,
    activeChallenge,
    collapsedGrades,
    toggleGrade,
    categoryStats,
    groupedSections,
    fetchChallenges
  };
}
