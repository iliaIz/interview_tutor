import { useState, useEffect, useCallback, useMemo } from 'react';
import { SqlChallenge, SqlExecutionResult, normalizeSqlArenaContext } from '@interview-prep/shared';
import { usePracticeTutorStore } from '../../../store/usePracticeTutorStore';
import { executeSqlChallenge } from '../../../services/sql/pgliteExecutionEngine';
import { triggerSuccessConfetti } from '../../../utils/confetti';

export interface UseSqlArenaProps {
  initialChallengeId?: string;
  companyContextName?: string;
}

export interface UseSqlArenaReturn {
  challenges: SqlChallenge[];
  activeChallenge: SqlChallenge | null;
  loading: boolean;
  loadError: string | null;
  selectedId: string;
  editorSql: string;
  setEditorSql: (sql: string) => void;
  isExecuting: boolean;
  result: SqlExecutionResult | null;
  activeTab: 'result' | 'diff' | 'schema' | 'explanation';
  setActiveTab: (tab: 'result' | 'diff' | 'schema' | 'explanation') => void;
  solvedIds: Set<string>;
  fetchChallenges: () => Promise<void>;
  handleSelectChallenge: (id: string) => void;
  handleRunQuery: () => Promise<void>;
  handleReset: () => void;
  handleOpenCopilot: () => void;
}

export function useSqlArena({
  initialChallengeId,
  companyContextName = 'Райффайзенбанк'
}: UseSqlArenaProps): UseSqlArenaReturn {
  const [challenges, setChallenges] = useState<SqlChallenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string>(initialChallengeId || '');
  const [editorSql, setEditorSql] = useState<string>('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<SqlExecutionResult | null>(null);
  const [activeTab, setActiveTab] = useState<'result' | 'diff' | 'schema' | 'explanation'>('result');
  const [solvedIds, setSolvedIds] = useState<Set<string>>(new Set());

  const fetchChallenges = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/sql-challenges', { credentials: 'include' });
      if (!res.ok) {
        throw new Error(`Ошибка сервера (${res.status}): не удалось получить SQL-задачи`);
      }
      const data: SqlChallenge[] = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setChallenges(data);
        const target = data.find((c) => c.id === initialChallengeId) || data[0];
        setSelectedId(target.id);
        setEditorSql(target.initialEditorSql);
      } else {
        throw new Error('Задачи SQL не найдены');
      }
    } catch (err: any) {
      console.error('[SqlArena] Failed to load challenges:', err);
      setLoadError(err.message || 'Ошибка загрузки SQL-задач');
    } finally {
      setLoading(false);
    }
  }, [initialChallengeId]);

  useEffect(() => {
    void fetchChallenges();
  }, [fetchChallenges]);

  const activeChallenge = useMemo(() => {
    return challenges.find((c) => c.id === selectedId) || challenges[0] || null;
  }, [challenges, selectedId]);

  const handleSelectChallenge = useCallback((id: string) => {
    const c = challenges.find((ch) => ch.id === id);
    if (!c) return;
    setSelectedId(id);
    setEditorSql(c.initialEditorSql);
    setResult(null);
    setActiveTab('result');
  }, [challenges]);

  const handleRunQuery = useCallback(async () => {
    if (!activeChallenge || isExecuting) return;
    setIsExecuting(true);
    setResult(null);

    try {
      const res = await executeSqlChallenge(activeChallenge, editorSql);
      setResult(res);

      if (res.success) {
        setSolvedIds((prev) => new Set([...prev, activeChallenge.id]));
        triggerSuccessConfetti();
        setActiveTab('result');
      } else if (res.diff && !res.diff.isMatched) {
        setActiveTab('diff');
      }
    } catch (err) {
      console.error('[SqlArena] Query execution failed:', err);
    } finally {
      setIsExecuting(false);
    }
  }, [activeChallenge, editorSql, isExecuting]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        void handleRunQuery();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleRunQuery]);

  const handleReset = useCallback(() => {
    if (activeChallenge) {
      setEditorSql(activeChallenge.initialEditorSql);
      setResult(null);
    }
  }, [activeChallenge]);

  const handleOpenCopilot = useCallback(() => {
    if (!activeChallenge) return;
    const polyContext = normalizeSqlArenaContext({
      challenge: activeChallenge,
      currentSql: editorSql,
      executionResult: result || undefined,
      companyContextName
    });
    usePracticeTutorStore.getState().setActiveContext(polyContext);
    usePracticeTutorStore.getState().toggleOpen(true);
  }, [activeChallenge, editorSql, result, companyContextName]);

  useEffect(() => {
    if (!activeChallenge) return;
    const store = usePracticeTutorStore.getState();
    if (store.activeContext?.arena === 'sql_arena') {
      store.setActiveContext(
        normalizeSqlArenaContext({
          challenge: activeChallenge,
          currentSql: editorSql,
          executionResult: result || undefined,
          companyContextName
        })
      );
    }
  }, [activeChallenge, editorSql, result, companyContextName]);

  useEffect(() => {
    return () => {
      const store = usePracticeTutorStore.getState();
      if (store.activeContext?.arena === 'sql_arena') {
        store.setActiveContext(null);
      }
    };
  }, []);

  return {
    challenges,
    activeChallenge,
    loading,
    loadError,
    selectedId,
    editorSql,
    setEditorSql,
    isExecuting,
    result,
    activeTab,
    setActiveTab,
    solvedIds,
    fetchChallenges,
    handleSelectChallenge,
    handleRunQuery,
    handleReset,
    handleOpenCopilot
  };
}
