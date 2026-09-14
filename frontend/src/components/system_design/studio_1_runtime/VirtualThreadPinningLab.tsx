import React, { useState, useEffect } from 'react';
import { Cpu, AlertOctagon, CheckCircle2, Lock, ShieldAlert, Sparkles, Activity } from 'lucide-react';

export const VirtualThreadPinningLab: React.FC = () => {
  const [concurrencyPrimitive, setConcurrencyPrimitive] = useState<'synchronized' | 'reentrant_lock'>('synchronized');
  const [virtualThreadsCount, setVirtualThreadsCount] = useState<number>(500);
  const [jfrEventsCount, setJfrEventsCount] = useState<number>(142);
  const [activeQueueDepth, setActiveQueueDepth] = useState<number>(450);

  const isPinned = concurrencyPrimitive === 'synchronized';

  useEffect(() => {
    if (isPinned) {
      const timer = setInterval(() => {
        setJfrEventsCount((prev) => prev + Math.floor(Math.random() * 5) + 3);
        setActiveQueueDepth((prev) => Math.min(2500, prev + Math.floor(Math.random() * 25) + 10));
      }, 400);
      return () => clearInterval(timer);
    } else {
      setJfrEventsCount(0);
      const timer = setInterval(() => {
        setActiveQueueDepth((prev) => Math.max(0, prev - 45));
      }, 200);
      return () => clearInterval(timer);
    }
  }, [isPinned]);

  const carrierWorkers = [1, 2, 3, 4, 5, 6, 7, 8];

  return (
    <div className="flex flex-col gap-4 p-4 bg-slate-900 text-slate-100 rounded-2xl border border-slate-800 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Cpu className="w-5 h-5 text-purple-400" />
          <div>
            <h4 className="text-sm font-bold text-white">Java 21 Virtual Threads: Carrier Pinning Lab</h4>
            <p className="text-xs text-slate-400">
              Детекция JFR-событий <span className="font-mono text-purple-300">jdk.VirtualThreadPinned</span>
            </p>
          </div>
        </div>

        {/* Toggle Lock Primitive */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setConcurrencyPrimitive('synchronized')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              isPinned
                ? 'bg-rose-950/80 text-rose-300 border border-rose-600/50 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            synchronized (this)
          </button>
          <button
            onClick={() => setConcurrencyPrimitive('reentrant_lock')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              !isPinned
                ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-600/50 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            ReentrantLock
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-2.5 bg-slate-950/60 rounded-xl border border-slate-800 text-center">
          <div className="text-[11px] text-slate-400">Виртуальные потоки</div>
          <div className="text-base font-bold font-mono text-purple-400 mt-0.5">
            {virtualThreadsCount.toLocaleString()}
          </div>
        </div>

        <div className="p-2.5 bg-slate-950/60 rounded-xl border border-slate-800 text-center">
          <div className="text-[11px] text-slate-400">ForkJoin Carrier Threads</div>
          <div className="text-base font-bold font-mono text-blue-400 mt-0.5">8 OS Threads</div>
        </div>

        <div className="p-2.5 bg-slate-950/60 rounded-xl border border-slate-800 text-center">
          <div className="text-[11px] text-slate-400">JFR Pinning Events</div>
          <div className={`text-base font-bold font-mono mt-0.5 ${
            isPinned ? 'text-rose-400 animate-pulse' : 'text-emerald-400'
          }`}>
            {jfrEventsCount}
          </div>
        </div>

        <div className="p-2.5 bg-slate-950/60 rounded-xl border border-slate-800 text-center">
          <div className="text-[11px] text-slate-400">Очередь задач</div>
          <div className={`text-base font-bold font-mono mt-0.5 ${
            activeQueueDepth > 200 ? 'text-rose-400' : 'text-emerald-400'
          }`}>
            {activeQueueDepth}
          </div>
        </div>
      </div>

      {/* 8 ForkJoinPool Carrier Threads Visual Grid */}
      <div className="flex flex-col gap-2">
        <div className="flex justify-between text-xs text-slate-400">
          <span>Состояние пула ForkJoinPool-worker:</span>
          <span className="font-mono text-[11px]">
            {isPinned ? '🔴 8/8 PINNED (Blocked Carrier Threads)' : '🟢 8/8 UNPINNED (Clean Cooperative Yielding)'}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {carrierWorkers.map((workerId) => {
            const workerPinned = isPinned;
            return (
              <div
                key={workerId}
                className={`p-3 rounded-xl border transition-all duration-300 flex flex-col justify-between ${
                  workerPinned
                    ? 'bg-rose-950/30 border-rose-700/50 shadow-rose-950/50'
                    : 'bg-emerald-950/30 border-emerald-700/50'
                }`}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono font-bold text-slate-200">worker-{workerId}</span>
                  <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                    workerPinned ? 'bg-rose-500/20 text-rose-300' : 'bg-emerald-500/20 text-emerald-300'
                  }`}>
                    {workerPinned ? 'Pinned' : 'Yielding'}
                  </span>
                </div>

                <div className="mt-2 text-[10px] font-mono text-slate-400">
                  {workerPinned ? (
                    <span className="text-rose-400 flex items-center gap-1">
                      <AlertOctagon className="w-3 h-3" /> Stack locked in C++ frame
                    </span>
                  ) : (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <Activity className="w-3 h-3" /> Mounts/Unmounts 0.2µs
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pedagogical Explanation */}
      <div className={`p-3 rounded-xl border text-xs leading-relaxed ${
        isPinned ? 'bg-rose-950/20 border-rose-800/40 text-rose-200' : 'bg-emerald-950/20 border-emerald-800/40 text-emerald-200'
      }`}>
        {isPinned ? (
          <div>
            <strong>Причина сбоя:</strong> В Java 21 блок <code className="bg-rose-950 px-1 py-0.5 rounded font-mono">synchronized</code> привязывает стек виртуального потока к несущему потоку ОС (carrier pinning). Если внутри <code className="font-mono">synchronized</code> происходит блокирующий I/O или ожидание соединения из пула, несущий поток ОС заблокирован целиком. 8 таких блокировок замораживают весь ForkJoinPool приложения!
          </div>
        ) : (
          <div>
            <strong>Архитектурный фикс:</strong> Применение <code className="bg-emerald-950 px-1 py-0.5 rounded font-mono">ReentrantLock</code> позволяет виртуальному потоку корректно отмонтироваться (unmount) от несущего OS-потока. Несущий поток свободен обслуживать другие виртуальные потоки, очередь не растет, а задержка остается в пределах субмиллисекунд.
          </div>
        )}
      </div>
    </div>
  );
};
