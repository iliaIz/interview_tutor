import React from 'react';
import { SqlArenaHeader } from './SqlArenaHeader';
import { SqlChallengeDetailCard } from './components/SqlChallengeDetailCard';
import { SqlWorkbenchPanel } from './components/SqlWorkbenchPanel';
import { SqlDataGrid } from './SqlDataGrid';
import { SqlDiffViewer } from './SqlDiffViewer';
import { SqlSchemaViewer } from './SqlSchemaViewer';
import { useSqlArena } from './hooks/useSqlArena';
import { RotateCcw, AlertCircle, Lightbulb, Check } from 'lucide-react';

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
  const {
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
  } = useSqlArena({ initialChallengeId, companyContextName });

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
          <SqlChallengeDetailCard challenge={activeChallenge} />
        </div>

        {/* Right Column: CodeMirror Editor & Execution Outputs */}
        <div className="lg:col-span-7 space-y-3">
          <SqlWorkbenchPanel
            editorSql={editorSql}
            setEditorSql={setEditorSql}
            isExecuting={isExecuting}
            onRunQuery={handleRunQuery}
            onReset={handleReset}
            onOpenCopilot={handleOpenCopilot}
          />

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
