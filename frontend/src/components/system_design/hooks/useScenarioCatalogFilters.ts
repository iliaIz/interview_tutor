import { useState, useMemo, useEffect, useCallback } from 'react';
import { SystemDesignScenario } from '../../../types/nextgen';
import { LevelFilter, getScenarioRung } from '../utils/scenarioLevel';

export interface UseScenarioCatalogFiltersReturn {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  selectedCategory: string;
  setSelectedCategory: (cat: string) => void;
  selectedLevel: LevelFilter;
  setSelectedLevel: (lvl: LevelFilter) => void;
  selectedScenarioId: string | null;
  setSelectedScenarioId: (id: string | null) => void;
  categories: string[];
  levelCounts: { all: number; L3: number; L4: number; L5_L7: number };
  filteredScenarios: SystemDesignScenario[];
  activeScenario: SystemDesignScenario | null;
  resetFilters: () => void;
}

export function useScenarioCatalogFilters(
  scenarios: SystemDesignScenario[],
  onLaunchScenario: (scenario: SystemDesignScenario) => void
): UseScenarioCatalogFiltersReturn {
  const initialParams = useMemo(() => {
    if (typeof window === 'undefined') return { level: 'all' as LevelFilter, scenario: null };
    const params = new URLSearchParams(window.location.search);
    const rawLevel = params.get('level');
    const level: LevelFilter =
      rawLevel === 'L3' || rawLevel === 'L4' || rawLevel === 'L5_L7' || rawLevel === 'all'
        ? rawLevel
        : 'all';
    return {
      level,
      scenario: params.get('scenario')
    };
  }, []);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedLevel, setSelectedLevel] = useState<LevelFilter>(initialParams.level);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(initialParams.scenario);

  const safeScenarios = useMemo(() => (Array.isArray(scenarios) ? scenarios : []), [scenarios]);

  // Initial selection
  useEffect(() => {
    if (safeScenarios.length > 0 && !selectedScenarioId) {
      setSelectedScenarioId(safeScenarios[0].canonical_id || safeScenarios[0].id || null);
    }
  }, [safeScenarios, selectedScenarioId]);

  // Sync state changes to URL query parameters for deep linking
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);

    if (selectedLevel !== 'all') {
      params.set('level', selectedLevel);
    } else {
      params.delete('level');
    }

    if (selectedScenarioId) {
      params.set('scenario', selectedScenarioId);
    } else {
      params.delete('scenario');
    }

    const newQuery = params.toString();
    const newUrl = newQuery ? `${window.location.pathname}?${newQuery}` : window.location.pathname;
    window.history.replaceState(null, '', newUrl);
  }, [selectedLevel, selectedScenarioId]);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    safeScenarios.forEach((s) => {
      if (s.archetype) cats.add(s.archetype);
      else if (s.category) cats.add(s.category);
    });
    return ['all', ...Array.from(cats)];
  }, [safeScenarios]);

  const levelCounts = useMemo(() => {
    const counts = { all: safeScenarios.length, L3: 0, L4: 0, L5_L7: 0 };
    safeScenarios.forEach((s) => {
      const rung = getScenarioRung(s);
      counts[rung]++;
    });
    return counts;
  }, [safeScenarios]);

  const filteredScenarios = useMemo(() => {
    return safeScenarios.filter((s) => {
      const matchesLevel = selectedLevel === 'all' || getScenarioRung(s) === selectedLevel;
      const matchesCat =
        selectedCategory === 'all' || s.archetype === selectedCategory || s.category === selectedCategory;

      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        s.title.toLowerCase().includes(q) ||
        (s.subtitle || '').toLowerCase().includes(q) ||
        (s.archetype || '').toLowerCase().includes(q) ||
        (s.category || '').toLowerCase().includes(q) ||
        (s.canonical_id || s.id || '').toLowerCase().includes(q) ||
        (s.problem_statement || s.contextMarkdown || '').toLowerCase().includes(q);

      return matchesLevel && matchesCat && matchesSearch;
    });
  }, [safeScenarios, selectedLevel, selectedCategory, searchQuery]);

  useEffect(() => {
    if (filteredScenarios.length > 0) {
      if (!selectedScenarioId || !filteredScenarios.some((s) => (s.canonical_id || s.id) === selectedScenarioId)) {
        setSelectedScenarioId(filteredScenarios[0].canonical_id || filteredScenarios[0].id || null);
      }
    }
  }, [filteredScenarios, selectedScenarioId]);

  const activeScenario = useMemo(() => {
    return (
      safeScenarios.find((s) => (s.canonical_id || s.id) === selectedScenarioId) ||
      filteredScenarios[0] ||
      null
    );
  }, [safeScenarios, selectedScenarioId, filteredScenarios]);

  const resetFilters = useCallback(() => {
    setSearchQuery('');
    setSelectedCategory('all');
    setSelectedLevel('all');
  }, []);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }
      if (filteredScenarios.length === 0) return;

      const currentIndex = filteredScenarios.findIndex(
        (s) => (s.canonical_id || s.id) === selectedScenarioId
      );

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const nextIdx = Math.min(currentIndex + 1, filteredScenarios.length - 1);
        setSelectedScenarioId(filteredScenarios[nextIdx].canonical_id || filteredScenarios[nextIdx].id || null);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prevIdx = Math.max(currentIndex - 1, 0);
        setSelectedScenarioId(filteredScenarios[prevIdx].canonical_id || filteredScenarios[prevIdx].id || null);
      } else if (e.key === 'Enter' && activeScenario) {
        e.preventDefault();
        onLaunchScenario(activeScenario);
      }
    },
    [filteredScenarios, selectedScenarioId, activeScenario, onLaunchScenario]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return {
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
    selectedLevel,
    setSelectedLevel,
    selectedScenarioId,
    setSelectedScenarioId,
    categories,
    levelCounts,
    filteredScenarios,
    activeScenario,
    resetFilters
  };
}
