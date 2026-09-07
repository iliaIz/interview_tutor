import React from 'react';
import { 
  Activity, Terminal, Search, X, Lock, ShieldAlert, 
  AlertTriangle, Cpu, ChevronUp, ChevronDown, CheckCircle2, Table 
} from 'lucide-react';
import { CodeViewer } from '../CodeViewer';

export interface ThreadInfo {
  name: string;
  tid: string;
  nid: string;
  state: string;
  lockWaiting?: string;
  lockHolding?: string;
  stack: string[];
}

export type ParsedDump =
  | {
      type: 'thread_dump';
      threads: ThreadInfo[];
      counts: {
        total: number;
        runnable: number;
        blocked: number;
        waiting: number;
        deadlock: boolean;
      };
      deadlockSnippet: string;
    }
  | {
      type: 'heap_histogram';
      entries: Array<{
        rank: string;
        instances: number;
        bytes: number;
        className: string;
      }>;
      maxBytes: number;
    }
  | {
      type: 'generic';
    };

interface TriageProfilerArtifactViewProps {
  rawArtifactText: string;
  parsedDump: ParsedDump;
  artifactViewMode: 'profiler' | 'raw';
  setArtifactViewMode: (mode: 'profiler' | 'raw') => void;
  threadFilter: 'all' | 'blocked' | 'runnable' | 'waiting';
  setThreadFilter: (filter: 'all' | 'blocked' | 'runnable' | 'waiting') => void;
  logSearchQuery: string;
  setLogSearchQuery: (query: string) => void;
  expandedThreadNames: Set<string>;
  setExpandedThreadNames: React.Dispatch<React.SetStateAction<Set<string>>>;
}

export const TriageProfilerArtifactView: React.FC<TriageProfilerArtifactViewProps> = ({
  rawArtifactText,
  parsedDump,
  artifactViewMode,
  setArtifactViewMode,
  threadFilter,
  setThreadFilter,
  logSearchQuery,
  setLogSearchQuery,
  expandedThreadNames,
  setExpandedThreadNames
}) => {
  return (
    <div className="max-w-5xl 2xl:max-w-[2000px] mx-auto space-y-4">
      {/* Profiler Toolbar */}
      <div className="bg-white/95 border border-pastel-border/80 rounded-2xl p-3 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-pastel-bg p-0.5 rounded-xl border border-pastel-border">
            <button
              onClick={() => setArtifactViewMode('profiler')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                artifactViewMode === 'profiler'
                  ? 'bg-white text-pastel-text shadow-2xs'
                  : 'text-pastel-muted hover:text-pastel-text'
              }`}
            >
              <Activity className="w-3.5 h-3.5 text-amber-600" />
              <span>VisualVM Profiler</span>
            </button>
            <button
              onClick={() => setArtifactViewMode('raw')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                artifactViewMode === 'raw'
                  ? 'bg-white text-pastel-text shadow-2xs'
                  : 'text-pastel-muted hover:text-pastel-text'
              }`}
            >
              <Terminal className="w-3.5 h-3.5 text-slate-600" />
              <span>Raw Terminal</span>
            </button>
          </div>

          {parsedDump.type === 'thread_dump' && (
            <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-pastel-bg text-pastel-text border border-pastel-border hidden sm:inline">
              Всего потоков: {parsedDump.counts.total}
            </span>
          )}
        </div>

        {/* Search input */}
        <div className="relative min-w-[220px] flex-1 max-w-md">
          <Search className="w-3.5 h-3.5 text-pastel-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={logSearchQuery}
            onChange={(e) => setLogSearchQuery(e.target.value)}
            placeholder="Поиск по стектрейсу, классам, мониторам..."
            className="w-full pl-8 pr-7 py-1.5 text-xs font-mono bg-pastel-bg border border-pastel-border rounded-xl focus:outline-hidden focus:border-amber-400 placeholder:text-pastel-muted/60"
          />
          {logSearchQuery && (
            <button
              onClick={() => setLogSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-pastel-muted hover:text-pastel-text cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* PROFILER VIEW MODE */}
      {artifactViewMode === 'profiler' && (
        <>
          {/* 1. THREAD DUMP PROFILER */}
          {parsedDump.type === 'thread_dump' && (
            <div className="space-y-4">
              {/* Metrics Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  onClick={() => setThreadFilter('all')}
                  className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                    threadFilter === 'all'
                      ? 'bg-white border-amber-300 shadow-xs ring-2 ring-amber-100'
                      : 'bg-white/80 border-pastel-border hover:bg-white'
                  }`}
                >
                  <span className="text-[11px] font-medium text-pastel-muted block">Все потоки</span>
                  <strong className="text-lg font-mono font-black text-pastel-text">{parsedDump.counts.total}</strong>
                </button>

                <button
                  onClick={() => setThreadFilter('blocked')}
                  className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                    threadFilter === 'blocked'
                      ? 'bg-rose-50 border-rose-300 shadow-xs ring-2 ring-rose-100'
                      : 'bg-white/80 border-pastel-border hover:bg-white'
                  }`}
                >
                  <span className="text-[11px] font-medium text-rose-600 flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Заблокировано (BLOCKED)
                  </span>
                  <strong className="text-lg font-mono font-black text-rose-700">{parsedDump.counts.blocked}</strong>
                </button>

                <button
                  onClick={() => setThreadFilter('runnable')}
                  className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                    threadFilter === 'runnable'
                      ? 'bg-emerald-50 border-emerald-300 shadow-xs ring-2 ring-emerald-100'
                      : 'bg-white/80 border-pastel-border hover:bg-white'
                  }`}
                >
                  <span className="text-[11px] font-medium text-emerald-700 flex items-center gap-1">
                    <Activity className="w-3 h-3" /> Выполняются (RUNNABLE)
                  </span>
                  <strong className="text-lg font-mono font-black text-emerald-700">{parsedDump.counts.runnable}</strong>
                </button>

                <button
                  onClick={() => setThreadFilter('waiting')}
                  className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                    threadFilter === 'waiting'
                      ? 'bg-amber-50 border-amber-300 shadow-xs ring-2 ring-amber-100'
                      : 'bg-white/80 border-pastel-border hover:bg-white'
                  }`}
                >
                  <span className="text-[11px] font-medium text-amber-700 block">Ожидание (WAITING)</span>
                  <strong className="text-lg font-mono font-black text-amber-700">{parsedDump.counts.waiting}</strong>
                </button>
              </div>

              {/* Deadlock Alert Banner */}
              {parsedDump.counts.deadlock && (
                <div className="p-4 rounded-2xl bg-rose-500/10 border-2 border-rose-500/50 shadow-sm space-y-2">
                  <div className="flex items-center gap-2 text-rose-700 font-bold text-sm">
                    <ShieldAlert className="w-5 h-5 text-rose-600 animate-pulse" />
                    <span>Критическая блокировка: Found one Java-level deadlock!</span>
                  </div>
                  {parsedDump.deadlockSnippet && (
                    <pre className="p-3 bg-slate-950 text-rose-300 rounded-xl text-xs font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed">
                      {parsedDump.deadlockSnippet}
                    </pre>
                  )}
                </div>
              )}

              {parsedDump.threads.length === 0 && (
                <div className="p-6 bg-amber-50/70 border border-amber-200 rounded-2xl text-center space-y-3">
                  <AlertTriangle className="w-8 h-8 text-amber-600 mx-auto" />
                  <h4 className="text-xs font-bold text-amber-900">Нестандартный формат дампа потоков</h4>
                  <p className="text-xs text-amber-800 max-w-md mx-auto">
                    Структурированный парсер не смог выделить отдельные потоки. Вы можете просмотреть полный текст дампа в режиме сырой консоли.
                  </p>
                  <button
                    type="button"
                    onClick={() => setArtifactViewMode('raw')}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-white text-amber-800 border border-amber-300 shadow-2xs hover:bg-amber-100 transition cursor-pointer"
                  >
                    Переключиться в Raw Terminal
                  </button>
                </div>
              )}

              {/* Threads List */}
              <div className="space-y-2">
                {parsedDump.threads
                  .filter(t => {
                    if (threadFilter === 'blocked' && t.state !== 'BLOCKED') return false;
                    if (threadFilter === 'runnable' && t.state !== 'RUNNABLE') return false;
                    if (threadFilter === 'waiting' && !t.state.includes('WAITING')) return false;
                    if (logSearchQuery.trim()) {
                      const q = logSearchQuery.toLowerCase();
                      return t.name.toLowerCase().includes(q) ||
                        t.state.toLowerCase().includes(q) ||
                        (t.lockWaiting && t.lockWaiting.toLowerCase().includes(q)) ||
                        t.stack.some(line => line.toLowerCase().includes(q));
                    }
                    return true;
                  })
                  .map((thread) => {
                    const isBlocked = thread.state === 'BLOCKED';
                    const isRunnable = thread.state === 'RUNNABLE';
                    const isExpanded = expandedThreadNames.has(thread.name) || isBlocked;

                    return (
                      <div
                        key={thread.name + thread.tid}
                        className={`rounded-2xl border transition-all ${
                          isBlocked
                            ? 'bg-rose-50/50 border-rose-200 shadow-2xs'
                            : 'bg-white border-pastel-border/90 hover:border-pastel-border'
                        }`}
                      >
                        <div
                          onClick={() => {
                            setExpandedThreadNames(prev => {
                              const next = new Set(prev);
                              if (next.has(thread.name)) next.delete(thread.name);
                              else next.add(thread.name);
                              return next;
                            });
                          }}
                          className="p-3 sm:p-4 flex items-center justify-between gap-3 cursor-pointer select-none"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                              isBlocked ? 'bg-rose-500 animate-ping' : isRunnable ? 'bg-emerald-500' : 'bg-amber-400'
                            }`} />
                            <Cpu className="w-4 h-4 text-pastel-muted shrink-0" />
                            <span className="font-mono font-bold text-xs text-pastel-text truncate">
                              "{thread.name}"
                            </span>
                            <span className="text-[10px] font-mono text-pastel-muted hidden md:inline">
                              tid={thread.tid}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                              isBlocked
                                ? 'bg-rose-100 text-rose-800 border-rose-200'
                                : isRunnable
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                : 'bg-amber-100 text-amber-800 border-amber-200'
                            }`}>
                              {thread.state}
                            </span>
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-pastel-muted" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-pastel-muted" />
                            )}
                          </div>
                        </div>

                        {/* Expanded Lock & Stack Frames */}
                        {isExpanded && (
                          <div className="px-4 pb-4 pt-1 border-t border-pastel-border/60 font-mono text-xs space-y-2">
                            {thread.lockWaiting && (
                              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 font-bold flex items-center gap-2">
                                <Lock className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                                <span>{thread.lockWaiting}</span>
                              </div>
                            )}
                            {thread.lockHolding && (
                              <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-2">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span>{thread.lockHolding}</span>
                              </div>
                            )}

                            <div className="bg-slate-950 rounded-xl p-3 text-slate-300 text-[11px] leading-relaxed overflow-x-auto max-h-60">
                              {thread.stack.map((line, idx) => {
                                const isProjectCode = line.includes('com.') || line.includes('org.');
                                return (
                                  <div
                                    key={idx}
                                    className={`py-0.5 ${
                                      line.includes('waiting to lock')
                                        ? 'text-rose-400 font-bold bg-rose-950/40 px-1 rounded'
                                        : isProjectCode
                                        ? 'text-emerald-300 font-medium'
                                        : 'text-slate-400'
                                    }`}
                                  >
                                    {line}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* 2. HEAP HISTOGRAM PROFILER */}
          {parsedDump.type === 'heap_histogram' && (
            <div className="bg-white rounded-2xl border border-pastel-border overflow-hidden shadow-2xs">
              <div className="p-4 border-b border-pastel-border/80 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Table className="w-4 h-4 text-purple-600" />
                  <h3 className="text-xs font-bold text-pastel-text uppercase tracking-wider">
                    VisualVM Heap Objects Histogram (Топ аллокаций памяти)
                  </h3>
                </div>
                <span className="text-[11px] font-mono text-pastel-muted">
                  Показано: {parsedDump.entries.length} классов
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono text-left">
                  <thead className="bg-pastel-bg text-pastel-text text-[10px] uppercase font-bold border-b border-pastel-border">
                    <tr>
                      <th className="px-3.5 py-2.5"># Ранг</th>
                      <th className="px-3.5 py-2.5">Класс в куче (Class Name)</th>
                      <th className="px-3.5 py-2.5">Кол-во объектов</th>
                      <th className="px-3.5 py-2.5">Размер (Bytes)</th>
                      <th className="px-3.5 py-2.5 min-w-[120px]">% Памяти</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-pastel-border/60">
                    {parsedDump.entries
                      .filter(e => !logSearchQuery.trim() || e.className.toLowerCase().includes(logSearchQuery.toLowerCase()))
                      .map((entry) => {
                        const pct = Math.round((entry.bytes / (parsedDump.maxBytes || 1)) * 100);
                        return (
                          <tr key={entry.rank} className="hover:bg-pastel-bg/50 transition">
                            <td className="px-3.5 py-2 font-bold text-pastel-muted">#{entry.rank}</td>
                            <td className="px-3.5 py-2 font-bold text-pastel-text break-all">{entry.className}</td>
                            <td className="px-3.5 py-2 text-slate-600">{entry.instances.toLocaleString()}</td>
                            <td className="px-3.5 py-2 font-bold text-purple-700">
                              {(entry.bytes / 1024 / 1024).toFixed(2)} MB ({entry.bytes.toLocaleString()} B)
                            </td>
                            <td className="px-3.5 py-2">
                              <div className="flex items-center gap-2">
                                <div className="w-16 bg-slate-100 h-2 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-purple-500 rounded-full"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                <span className="text-[10px] text-pastel-muted">{pct}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 3. GENERIC FALLBACK */}
          {parsedDump.type === 'generic' && (
            <CodeViewer
              code={rawArtifactText}
              language="log"
              title="Observability SRE Terminal"
              searchQuery={logSearchQuery}
              showLineNumbers={true}
              maxHeight="max-h-[600px]"
            />
          )}
        </>
      )}

      {/* RAW TERMINAL VIEW MODE */}
      {artifactViewMode === 'raw' && (
        <CodeViewer
          code={rawArtifactText}
          language="log"
          title="Raw JVM Output Terminal"
          searchQuery={logSearchQuery}
          showLineNumbers={true}
          maxHeight="max-h-[650px]"
        />
      )}
    </div>
  );
};
