import React, { useState, useEffect, useCallback, useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { sql } from '@codemirror/lang-sql';
import { luxuryPastelTheme } from '../practice/editorTheme';
import { SqlChallenge, SqlExecutionResult, normalizeSqlArenaContext } from '@interview-prep/shared';
import { usePracticeTutorStore } from '../../store/usePracticeTutorStore';
import { executeSqlChallenge } from '../../services/sql/pgliteExecutionEngine';
import { SqlArenaHeader } from './SqlArenaHeader';
import { SqlDataGrid } from './SqlDataGrid';
import { SqlDiffViewer } from './SqlDiffViewer';
import { SqlSchemaViewer } from './SqlSchemaViewer';
import { triggerSuccessConfetti } from '../../utils/confetti';
import { 
  Play, RotateCcw, Database, ShieldAlert, AlertCircle, Lightbulb, Check, Bot
} from 'lucide-react';

interface SqlArenaProps {
  initialChallengeId?: string;
  onBackToCompanyTrack?: () => void;
  companyContextName?: string;
}

export const SqlArena: React.FC<SqlArenaProps> = ({
  initialChallengeId,
  onBackToCompanyTrack,
  companyContextName = 'Райффайзенбанк'
}) => {
  const [challenges, setChallenges] = useState<SqlChallenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string>(initialChallengeId || '');
  const [editorSql, setEditorSql] = useState<string>('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<SqlExecutionResult | null>(null);
  const [activeTab, setActiveTab] = useState<'result' | 'diff' | 'schema' | 'explanation'>('result');
  const [solvedIds, setSolvedIds] = useState<Set<string>>(new Set());

  // Fetch SQL challenges from backend
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
    return challenges.find((c) => c.id === selectedId) || challenges[0];
  }, [challenges, selectedId]);

  const handleSelectChallenge = (id: string) => {
    const c = challenges.find((ch) => ch.id === id);
    if (!c) return;
    setSelectedId(id);
    setEditorSql(c.initialEditorSql);
    setResult(null);
    setActiveTab('result');
  };

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
        handleRunQuery();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleRunQuery]);

  const handleReset = () => {
    if (activeChallenge) {
      setEditorSql(activeChallenge.initialEditorSql);
      setResult(null);
    }
  };

  const handleOpenCopilot = () => {
    if (!activeChallenge) return;
    const polyContext = normalizeSqlArenaContext({
      challenge: activeChallenge,
      currentSql: editorSql,
      executionResult: result || undefined,
      companyContextName
    });
    usePracticeTutorStore.getState().setActiveContext(polyContext);
    usePracticeTutorStore.getState().toggleOpen(true);
  };

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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-3 font-sans">
        <div className="w-10 h-10 border-4 border-pastel-accentIndigo/30 border-t-pastel-accentIndigo rounded-full animate-spin" />
        <p className="text-sm text-pastel-muted font-medium">Загрузка песочницы PostgreSQL 16 (PGlite)...</p>
      </div>
    );
  }

  if (loadError || !activeChallenge) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4 font-sans px-4 text-center">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div className="space-y-1 max-w-md">
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">Не удалось загрузить задачи SQL</h3>
          <p className="text-xs text-rose-500/90 font-mono">{loadError || 'Задачи SQL не найдены'}</p>
        </div>
        <button
          onClick={() => void fetchChallenges()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-pastel-accentIndigo hover:bg-pastel-accentIndigo/90 text-white font-medium text-xs transition-colors shadow-sm cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
          Повторить попытку
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 space-y-4 font-sans pb-24">
      <SqlArenaHeader
        challenges={challenges}
        selectedId={selectedId}
        onSelectChallenge={handleSelectChallenge}
        solvedIds={solvedIds}
        onBackToCompanyTrack={onBackToCompanyTrack}
        companyContextName={companyContextName}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Challenge Overview & Traps */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white/95 border border-pastel-border/80 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
                {activeChallenge.category}
              </span>
              <span className="text-xs font-mono font-bold text-slate-500 uppercase">
                Грейд: {activeChallenge.difficulty}
              </span>
            </div>

            <h2 className="text-base font-bold text-slate-900 leading-snug">
              {activeChallenge.title}
            </h2>

            <div className="p-3 rounded-xl bg-amber-50/90 border border-amber-200/90 text-amber-950 space-y-1">
              <span className="font-bold text-xs flex items-center gap-1.5 text-amber-900">
                <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                Ловушка собеседования:
              </span>
              <p className="text-xs leading-relaxed text-amber-900">
                {activeChallenge.companyContext.interviewTrapDescription}
              </p>
            </div>

            <div className="text-xs text-slate-700 leading-relaxed max-h-72 overflow-y-auto space-y-2 pr-1 border-t border-pastel-border/50 pt-2 whitespace-pre-line">
              {activeChallenge.instructionsMarkdown}
            </div>
          </div>
        </div>

        {/* Right Column: CodeMirror Editor & Execution Outputs */}
        <div className="lg:col-span-7 space-y-3">
          <div className="bg-white border border-pastel-border/80 rounded-2xl overflow-hidden shadow-sm flex flex-col">
            <div className="flex items-center justify-between px-3.5 py-2 bg-slate-50 border-b border-pastel-border/60">
              <span className="text-xs font-bold text-slate-700 font-mono flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-indigo-600" />
                Редактор SQL-запроса
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleOpenCopilot}
                  className="px-2.5 py-1 text-[11px] font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300/80 rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
                  title="Открыть AI-Напарника с контекстом текущей SQL-задачи"
                >
                  <Bot className="w-3.5 h-3.5 text-amber-700" />
                  <span>AI-Напарник</span>
                </button>
                <button
                  onClick={handleReset}
                  className="px-2 py-1 text-[11px] font-medium text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-200/60 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" /> Сброс
                </button>
                <button
                  onClick={handleRunQuery}
                  disabled={isExecuting}
                  className="px-3.5 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl transition-all shadow-sm flex items-center gap-1.5 active:scale-95"
                >
                  {isExecuting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      <span>Выполнение...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Выполнить (Ctrl+Enter)</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="min-h-[180px] max-h-[260px] overflow-auto">
              <CodeMirror
                value={editorSql}
                height="100%"
                extensions={[sql()]}
                theme={luxuryPastelTheme}
                onChange={(val) => setEditorSql(val)}
                className="text-xs font-mono"
              />
            </div>
          </div>

          {/* Results Tabs & Display */}
          <div className="bg-white border border-pastel-border/80 rounded-2xl p-3.5 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-pastel-border/60 pb-2">
              <div className="flex items-center gap-1.5">
                {(
                  [
                    ['result', 'Результат выборки', 'bg-indigo-50 text-indigo-700 border-indigo-200'],
                    ['diff', 'Сравнение (Diff)', 'bg-amber-50 text-amber-800 border-amber-200'],
                    ['schema', 'Схема БД', 'bg-slate-100 text-slate-800 border-slate-300'],
                    ['explanation', 'Разбор ловушки', 'bg-purple-50 text-purple-700 border-purple-200'],
                  ] as const
                ).map(([tabId, label, activeStyle]) => (
                  <button
                    key={tabId}
                    onClick={() => setActiveTab(tabId)}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors flex items-center gap-1 ${
                      activeTab === tabId ? `${activeStyle} border` : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {label}
                    {tabId === 'diff' && result && (
                      <span className={`w-2 h-2 rounded-full ${result.success ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                    )}
                  </button>
                ))}
              </div>

              {result?.success && (
                <span className="text-xs font-bold text-emerald-700 flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  <Check className="w-3 h-3 text-emerald-600" /> Верно
                </span>
              )}
            </div>

            {result?.error && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-mono flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-sans font-bold">Ошибка PostgreSQL:</span>
                  <pre className="text-[11px] whitespace-pre-wrap">{result.error}</pre>
                </div>
              </div>
            )}

            <div className="min-h-[160px]">
              {activeTab === 'result' && (
                <SqlDataGrid
                  columns={result?.columns || []}
                  rows={result?.rows || []}
                  executionTimeMs={result?.executionTimeMs}
                  emptyMessage={
                    result === null
                      ? 'Нажмите «Выполнить (Ctrl+Enter)», чтобы запустить запрос против in-browser PostgreSQL 16.'
                      : 'Запрос успешно выполнен, но вернул 0 строк.'
                  }
                />
              )}

              {activeTab === 'diff' && (
                <div>
                  {result?.diff ? (
                    <SqlDiffViewer diff={result.diff} />
                  ) : (
                    <p className="text-xs text-pastel-muted text-center py-8">
                      Выполните запрос для сравнения результата с эталоном.
                    </p>
                  )}
                </div>
              )}

              {activeTab === 'schema' && (
                <SqlSchemaViewer
                  schemaSql={activeChallenge.schemaSql}
                  seedSql={activeChallenge.seedSql}
                />
              )}

              {activeTab === 'explanation' && (
                <div className="p-4 rounded-xl bg-purple-50/50 border border-purple-200/80 text-xs text-purple-950 space-y-2 leading-relaxed">
                  <h4 className="font-bold text-purple-900 flex items-center gap-1.5">
                    <Lightbulb className="w-4 h-4 text-purple-600" />
                    Глубокий разбор PostgreSQL инварианта:
                  </h4>
                  <p className="whitespace-pre-line">{activeChallenge.explanationMarkdown}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
