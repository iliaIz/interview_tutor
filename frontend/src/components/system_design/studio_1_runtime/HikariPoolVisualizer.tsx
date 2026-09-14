import React, { useState, useMemo } from 'react';
import { Database, AlertTriangle, CheckCircle2, TrendingDown, Cpu, Sliders, Info } from 'lucide-react';

export const HikariPoolVisualizer: React.FC = () => {
  const [poolSize, setPoolSize] = useState<number>(10);
  const [cpuCores, setCpuCores] = useState<number>(8);
  const [queryLatencyMs, setQueryLatencyMs] = useState<number>(5);
  const [spindleCount, setSpindleCount] = useState<number>(1);

  // HikariCP official formula: Pool = Cores * 2 + Spindles (or Tn * (Cores - 1) + Spindles)
  const optimalPoolSize = useMemo(() => {
    return Math.max(2, Math.round(cpuCores * 2 + spindleCount));
  }, [cpuCores, spindleCount]);

  // Context switch degradation logic
  const metrics = useMemo(() => {
    const isOversized = poolSize > optimalPoolSize * 2;
    const isStarved = poolSize < Math.round(optimalPoolSize * 0.5);

    // Max theoretical concurrency under Little's Law
    const baseTps = (poolSize / (queryLatencyMs / 1000));

    // Thrashing factor: when pool size >> cores, context switching eats CPU cycles
    let thrashingPenalty = 1.0;
    if (poolSize > optimalPoolSize) {
      const excessRatio = (poolSize - optimalPoolSize) / optimalPoolSize;
      thrashingPenalty = Math.max(0.3, 1.0 - (excessRatio * 0.45));
    }

    const effectiveTps = Math.round(baseTps * thrashingPenalty);
    const connectionWaitMs = isStarved 
      ? Math.round(queryLatencyMs * 4.5) 
      : isOversized 
        ? Math.round(queryLatencyMs * 2.8) 
        : Math.round(queryLatencyMs * 0.2);

    const cpuContextSwitchLoad = Math.min(100, Math.round((poolSize / optimalPoolSize) * 45));

    return {
      isOversized,
      isStarved,
      optimalPoolSize,
      effectiveTps,
      connectionWaitMs,
      cpuContextSwitchLoad,
      thrashingPenalty: Math.round((1 - thrashingPenalty) * 100)
    };
  }, [poolSize, optimalPoolSize, queryLatencyMs]);

  return (
    <div className="flex flex-col gap-4 p-4 bg-slate-900 text-slate-100 rounded-2xl border border-slate-800 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-purple-400" />
          <div>
            <h4 className="text-sm font-bold text-white">HikariCP Pool Sizing & Little's Law</h4>
            <p className="text-xs text-slate-400">
              Формула: <span className="font-mono text-purple-300">PoolSize = Cores × 2 + Spindles</span>
            </p>
          </div>
        </div>
        <div className={`px-2.5 py-1 rounded-full text-xs font-bold ${
          metrics.isOversized 
            ? 'bg-rose-950/70 text-rose-300 border border-rose-700/50' 
            : metrics.isStarved 
              ? 'bg-amber-950/70 text-amber-300 border border-amber-700/50'
              : 'bg-emerald-950/70 text-emerald-300 border border-emerald-700/50'
        }`}>
          {metrics.isOversized ? 'Context-Switch Thrashing' : metrics.isStarved ? 'Thread Starvation' : 'Optimal Sizing'}
        </div>
      </div>

      {/* Sliders Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Pool Size */}
        <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800/80">
          <div className="flex justify-between text-xs text-slate-300 font-semibold mb-1">
            <span>Размер пула:</span>
            <span className="font-mono text-purple-400 font-bold">{poolSize}</span>
          </div>
          <input
            type="range"
            min={2}
            max={150}
            value={poolSize}
            onChange={(e) => setPoolSize(Number(e.target.value))}
            className="w-full accent-purple-500 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-500 mt-1">
            <span>2 min</span>
            <span className="text-purple-400 font-semibold">opt: {optimalPoolSize}</span>
            <span>150 max</span>
          </div>
        </div>

        {/* CPU Cores */}
        <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800/80">
          <div className="flex justify-between text-xs text-slate-300 font-semibold mb-1">
            <span>Ядра CPU сервера:</span>
            <span className="font-mono text-blue-400 font-bold">{cpuCores}</span>
          </div>
          <input
            type="range"
            min={2}
            max={64}
            step={2}
            value={cpuCores}
            onChange={(e) => setCpuCores(Number(e.target.value))}
            className="w-full accent-blue-500 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-500 mt-1">
            <span>2 cores</span>
            <span>64 cores</span>
          </div>
        </div>

        {/* Query Latency */}
        <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800/80">
          <div className="flex justify-between text-xs text-slate-300 font-semibold mb-1">
            <span>Среднее время SQL:</span>
            <span className="font-mono text-emerald-400 font-bold">{queryLatencyMs} ms</span>
          </div>
          <input
            type="range"
            min={1}
            max={50}
            value={queryLatencyMs}
            onChange={(e) => setQueryLatencyMs(Number(e.target.value))}
            className="w-full accent-emerald-500 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-500 mt-1">
            <span>1 ms</span>
            <span>50 ms</span>
          </div>
        </div>
      </div>

      {/* Real-time Impact Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-2.5 bg-slate-950/60 rounded-xl border border-slate-800 text-center">
          <div className="text-[11px] text-slate-400">Эффективный TPS</div>
          <div className={`text-base font-bold font-mono mt-0.5 ${
            metrics.isOversized ? 'text-rose-400' : 'text-emerald-400'
          }`}>
            {metrics.effectiveTps.toLocaleString()}
          </div>
        </div>

        <div className="p-2.5 bg-slate-950/60 rounded-xl border border-slate-800 text-center">
          <div className="text-[11px] text-slate-400">Ожидание коннекта</div>
          <div className={`text-base font-bold font-mono mt-0.5 ${
            metrics.connectionWaitMs > 15 ? 'text-rose-400' : 'text-slate-200'
          }`}>
            {metrics.connectionWaitMs} ms
          </div>
        </div>

        <div className="p-2.5 bg-slate-950/60 rounded-xl border border-slate-800 text-center">
          <div className="text-[11px] text-slate-400">Context Switch Load</div>
          <div className="text-base font-bold font-mono text-amber-400 mt-0.5">
            {metrics.cpuContextSwitchLoad}%
          </div>
        </div>

        <div className="p-2.5 bg-slate-950/60 rounded-xl border border-slate-800 text-center">
          <div className="text-[11px] text-slate-400">TPS Degradation</div>
          <div className="text-base font-bold font-mono text-rose-400 mt-0.5">
            -{metrics.thrashingPenalty}%
          </div>
        </div>
      </div>

      {/* Pedagogical Insight */}
      <div className="p-3 bg-purple-950/30 border border-purple-800/40 rounded-xl text-xs text-purple-200 flex items-start gap-2">
        <Info className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed text-[11px]">
          {metrics.isOversized ? (
            <span>
              <strong>Антипаттерн Over-sizing:</strong> Увеличение пула соединений до {poolSize} при {cpuCores} ядрах вызывает context-switch thrashing. Потоки тратят циклы CPU на переключение контекста в ядре ОС вместо выполнения SQL-запросов, снижая полезную пропускную способность на {metrics.thrashingPenalty}%.
            </span>
          ) : metrics.isStarved ? (
            <span>
              <strong>Недостаточный пул (Starvation):</strong> Пул из {poolSize} соединений не насыщает {cpuCores} ядер CPU при задержке запроса в {queryLatencyMs} ms. Запросы накапливаются в очереди ожидания пула ({metrics.connectionWaitMs} ms).
            </span>
          ) : (
            <span>
              <strong>Сбалансированная конфигурация:</strong> Размер пула {poolSize} оптимально согласован с {cpuCores} ядрами CPU. Очередь пула минимальна, context-switch оверхед не превышает допустимый порог.
            </span>
          )}
        </p>
      </div>
    </div>
  );
};
