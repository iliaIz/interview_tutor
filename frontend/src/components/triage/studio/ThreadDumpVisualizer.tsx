import React, { useState, useMemo } from 'react';
import {
  Activity,
  Terminal,
  Search,
  X,
  Lock,
  ShieldAlert,
  AlertTriangle,
  Cpu,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Table,
  Flame
} from 'lucide-react';
import { parseThreadDumpFast, ParsedThreadDump } from '../../../utils/threadDumpParser';
import { CodeViewer } from '../../CodeViewer';

interface ThreadDumpVisualizerProps {
  rawArtifactText: string;
  artifactViewMode: 'profiler' | 'raw';
  setArtifactViewMode: (mode: 'profiler' | 'raw') => void;
  logSearchQuery: string;
  setLogSearchQuery: (query: string) => void;
}

export const ThreadDumpVisualizer: React.FC<ThreadDumpVisualizerProps> = ({
  rawArtifactText,
  artifactViewMode,
  setArtifactViewMode,
  logSearchQuery,
  setLogSearchQuery
}) => {
  const [threadFilter, setThreadFilter] = useState<'all' | 'blocked' | 'runnable' | 'waiting' | 'deadlock'>('all');
  const [expandedThreadNames, setExpandedThreadNames] = useState<Set<string>>(new Set());

  // Structured Java Profiler Parser (Thread Dump & Heap Histogram)
  const parsedData = useMemo(() => {
    const raw = rawArtifactText || '';
    const isThreadDump =
      raw.includes('java.lang.Thread.State:') ||
      raw.includes('JNI global references:') ||
      raw.includes('Java-level deadlock');
    const isHeapHistogram = raw.includes('num') && raw.includes('#instances') && raw.includes('#bytes');

    if (isThreadDump) {
      const dump = parseThreadDumpFast(raw);
      return { type: 'thread_dump' as const, dump };
    }

    if (isHeapHistogram) {
      const lines = raw.split('\n').filter((l) => /^\s*\d+:\s+\d+\s+\d+\s+/.test(l));
      const entries = lines.slice(0, 50).map((line) => {
        const parts = line.trim().split(/\s+/);
        return {
          rank: parts[0].replace(':', ''),
          instances: parseInt(parts[1], 10),
          bytes: parseInt(parts[2], 10),
          className: parts[3]
        };
      });
      const maxBytes = entries.length > 0 ? entries[0].bytes : 1;
      return { type: 'heap_histogram' as const, entries, maxBytes };
    }

    return { type: 'generic' as const };
  }, [rawArtifactText]);

  if (artifactViewMode === 'raw') {
    return (
      <CodeViewer
        code={rawArtifactText}
        language="log"
        title="Raw JVM Output Terminal"
        searchQuery={logSearchQuery}
        showLineNumbers={true}
        maxHeight="max-h-[650px]"
      />
    );
  }

  if (parsedData.type === 'heap_histogram') {
    const { entries, maxBytes } = parsedData;
    return (
      <div className="bg-white rounded-2xl border border-pastel-border overflow-hidden shadow-2xs">
        <div className="p-4 border-b border-pastel-border/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Table className="w-4 h-4 text-purple-600" />
            <h3 className="text-xs font-bold text-pastel-text uppercase tracking-wider">
              VisualVM Heap Objects Histogram (Топ аллокаций памяти)
            </h3>
          </div>
          <span className="text-[11px] font-mono text-pastel-muted">
            Показано: {entries.length} классов
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
              {entries
                .filter((e) => !logSearchQuery.trim() || e.className.toLowerCase().includes(logSearchQuery.toLowerCase()))
                .map((entry) => {
                  const pct = Math.round((entry.bytes / (maxBytes || 1)) * 100);
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
                            <div className="h-full bg-purple-500 rounded-full" style={{ width: `${pct}%` }} />
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
    );
  }

  if (parsedData.type === 'generic') {
    return (
      <CodeViewer
        code={rawArtifactText}
        language="log"
        title="Observability SRE Terminal"
        searchQuery={logSearchQuery}
        showLineNumbers={true}
        maxHeight="max-h-[600px]"
      />
    );
  }

  const { dump } = parsedData;
  const filteredThreads = dump.threads.filter((t) => {
    if (threadFilter === 'blocked' && t.state !== 'BLOCKED') return false;
    if (threadFilter === 'runnable' && t.state !== 'RUNNABLE') return false;
    if (threadFilter === 'waiting' && !t.state.includes('WAITING')) return false;
    if (threadFilter === 'deadlock' && !t.isDeadlocked) return false;
    if (logSearchQuery.trim()) {
      const q = logSearchQuery.toLowerCase();
      return (
        t.name.toLowerCase().includes(q) ||
        t.state.toLowerCase().includes(q) ||
        (t.lockWaiting && t.lockWaiting.toLowerCase().includes(q)) ||
        t.stack.some((line) => line.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Metrics Bar & Deadlock Isolator */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <button
          onClick={() => setThreadFilter('all')}
          className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
            threadFilter === 'all'
              ? 'bg-white border-amber-300 shadow-xs ring-2 ring-amber-100'
              : 'bg-white/80 border-pastel-border hover:bg-white'
          }`}
        >
          <span className="text-[11px] font-medium text-pastel-muted block">Все потоки</span>
          <strong className="text-lg font-mono font-black text-pastel-text">{dump.counts.total}</strong>
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
            <Lock className="w-3 h-3" /> BLOCKED
          </span>
          <strong className="text-lg font-mono font-black text-rose-700">{dump.counts.blocked}</strong>
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
            <Activity className="w-3 h-3" /> RUNNABLE
          </span>
          <strong className="text-lg font-mono font-black text-emerald-700">{dump.counts.runnable}</strong>
        </button>

        <button
          onClick={() => setThreadFilter('waiting')}
          className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
            threadFilter === 'waiting'
              ? 'bg-amber-50 border-amber-300 shadow-xs ring-2 ring-amber-100'
              : 'bg-white/80 border-pastel-border hover:bg-white'
          }`}
        >
          <span className="text-[11px] font-medium text-amber-700 block">WAITING</span>
          <strong className="text-lg font-mono font-black text-amber-700">
            {dump.counts.waiting + dump.counts.timedWaiting}
          </strong>
        </button>

        <button
          onClick={() => setThreadFilter('deadlock')}
          className={`p-3 rounded-2xl border text-left transition cursor-pointer col-span-2 sm:col-span-1 ${
            threadFilter === 'deadlock'
              ? 'bg-rose-600 text-white border-rose-700 shadow-md ring-2 ring-rose-300'
              : dump.hasDeadlock
              ? 'bg-rose-50 border-rose-300 hover:bg-rose-100 text-rose-800 animate-pulse'
              : 'bg-white/80 border-pastel-border text-pastel-muted hover:bg-white'
          }`}
        >
          <span className="text-[11px] font-medium flex items-center gap-1">
            <Flame className="w-3 h-3" /> Deadlock
          </span>
          <strong className="text-lg font-mono font-black">
            {dump.deadlockCycles.length > 0 ? `${dump.counts.deadlocked} в блоке` : '0'}
          </strong>
        </button>
      </div>

      {/* Deadlock Alert Banner */}
      {dump.hasDeadlock && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border-2 border-rose-500/50 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-rose-700 font-bold text-sm">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-600 animate-pulse" />
              <span>Критическая блокировка: Java-level deadlock обнаружен!</span>
            </div>
            <button
              onClick={() => setThreadFilter('deadlock')}
              className="text-xs bg-rose-600 text-white px-2.5 py-1 rounded-lg hover:bg-rose-700 transition cursor-pointer"
            >
              Изолировать цикл дедлока
            </button>
          </div>
          {dump.deadlockSnippet && (
            <pre className="p-3 bg-slate-950 text-rose-300 rounded-xl text-xs font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed">
              {dump.deadlockSnippet}
            </pre>
          )}
        </div>
      )}

      {/* Threads List */}
      <div className="space-y-2">
        {filteredThreads.map((thread) => {
          const isBlocked = thread.state === 'BLOCKED';
          const isRunnable = thread.state === 'RUNNABLE';
          const isExpanded = expandedThreadNames.has(thread.name) || thread.isDeadlocked || isBlocked;

          return (
            <div
              key={thread.name + thread.tid}
              className={`rounded-2xl border transition-all ${
                thread.isDeadlocked
                  ? 'bg-rose-50/70 border-rose-400 ring-1 ring-rose-300 shadow-sm'
                  : isBlocked
                  ? 'bg-rose-50/50 border-rose-200 shadow-2xs'
                  : 'bg-white border-pastel-border/90 hover:border-pastel-border'
              }`}
            >
              <div
                onClick={() => {
                  setExpandedThreadNames((prev) => {
                    const next = new Set(prev);
                    if (next.has(thread.name)) next.delete(thread.name);
                    else next.add(thread.name);
                    return next;
                  });
                }}
                className="p-3 sm:p-4 flex items-center justify-between gap-3 cursor-pointer select-none"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                      thread.isDeadlocked
                        ? 'bg-rose-600 animate-bounce'
                        : isBlocked
                        ? 'bg-rose-500 animate-ping'
                        : isRunnable
                        ? 'bg-emerald-500'
                        : 'bg-amber-400'
                    }`}
                  />
                  <Cpu className="w-4 h-4 text-pastel-muted shrink-0" />
                  <span className="font-mono font-bold text-xs text-pastel-text truncate">"{thread.name}"</span>
                  <span className="text-[10px] font-mono text-pastel-muted hidden md:inline">tid={thread.tid}</span>
                  {thread.isDeadlocked && (
                    <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-rose-600 text-white uppercase">
                      Deadlock Cycle #{thread.deadlockCycleId}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                      isBlocked
                        ? 'bg-rose-100 text-rose-800 border-rose-200'
                        : isRunnable
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                        : 'bg-amber-100 text-amber-800 border-amber-200'
                    }`}
                  >
                    {thread.state}
                  </span>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-pastel-muted" /> : <ChevronDown className="w-4 h-4 text-pastel-muted" />}
                </div>
              </div>

              {isExpanded && (
                <div className="px-4 pb-4 pt-1 border-t border-pastel-border/60 font-mono text-xs space-y-2">
                  {thread.lockWaiting && (
                    <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 font-bold flex items-center gap-2">
                      <Lock className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                      <span>Ожидает блокировку монитора: {thread.lockWaiting}</span>
                    </div>
                  )}
                  {thread.lockHolding.length > 0 && (
                    <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Удерживает мониторы: {thread.lockHolding.join(', ')}</span>
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
  );
};
