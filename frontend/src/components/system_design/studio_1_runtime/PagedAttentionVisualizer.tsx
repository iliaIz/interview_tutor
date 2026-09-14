import React, { useState, useMemo } from 'react';
import { Layers, Sliders, CheckCircle2, AlertTriangle, Sparkles, Cpu, HardDrive } from 'lucide-react';

export const PagedAttentionVisualizer: React.FC = () => {
  const [usePagedAttention, setUsePagedAttention] = useState<boolean>(true);
  const [promptTokens, setPromptTokens] = useState<number>(38);
  const [generatedTokens, setGeneratedTokens] = useState<number>(44);
  const [maxContextTokens] = useState<number>(256);

  const blockSize = 16; // 16 tokens per physical block
  const totalPhysicalBlocks = 32; // 512 total capacity

  const totalActiveTokens = promptTokens + generatedTokens;

  // Calculation for contiguous vs paged
  const stats = useMemo(() => {
    if (usePagedAttention) {
      // PagedAttention allocates blocks on demand
      const neededBlocks = Math.ceil(totalActiveTokens / blockSize);
      const usedTokens = totalActiveTokens;
      const allocatedCapacity = neededBlocks * blockSize;
      const internalFragTokens = allocatedCapacity - usedTokens;
      const fragmentationPercent = Math.round((internalFragTokens / allocatedCapacity) * 100);

      return {
        neededBlocks,
        allocatedCapacity,
        fragmentationPercent,
        concurrencyCapacity: Math.floor((totalPhysicalBlocks * blockSize) / allocatedCapacity),
        memorySavedPercent: 68
      };
    } else {
      // Contiguous pre-allocates for maxContextTokens
      const preAllocatedTokens = maxContextTokens;
      const neededBlocks = Math.ceil(preAllocatedTokens / blockSize);
      const wastedTokens = preAllocatedTokens - totalActiveTokens;
      const fragmentationPercent = Math.round((wastedTokens / preAllocatedTokens) * 100);

      return {
        neededBlocks,
        allocatedCapacity: preAllocatedTokens,
        fragmentationPercent,
        concurrencyCapacity: 1,
        memorySavedPercent: 0
      };
    }
  }, [usePagedAttention, totalActiveTokens, maxContextTokens]);

  return (
    <div className="flex flex-col gap-4 p-4 bg-slate-900 text-slate-100 rounded-2xl border border-slate-800 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-purple-400" />
          <div>
            <h4 className="text-sm font-bold text-white">PagedAttention: HBM KV-Cache Block Table</h4>
            <p className="text-xs text-slate-400">
              Виртуализация памяти GPU: физические блоки по <span className="font-mono text-purple-300">16 токенов</span>
            </p>
          </div>
        </div>

        {/* Mode Toggle */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setUsePagedAttention(false)}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
              !usePagedAttention
                ? 'bg-rose-950/80 text-rose-300 border border-rose-600/50 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Contiguous (HF Baseline)
          </button>
          <button
            onClick={() => setUsePagedAttention(true)}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              usePagedAttention
                ? 'bg-purple-950/80 text-purple-300 border border-purple-600/50 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            PagedAttention (vLLM)
          </button>
        </div>
      </div>

      {/* Sliders */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800/80">
          <div className="flex justify-between text-xs text-slate-300 font-semibold mb-1">
            <span>Prompt Tokens:</span>
            <span className="font-mono text-blue-400 font-bold">{promptTokens} токенов</span>
          </div>
          <input
            type="range"
            min={10}
            max={120}
            value={promptTokens}
            onChange={(e) => setPromptTokens(Number(e.target.value))}
            className="w-full accent-blue-500 cursor-pointer"
          />
        </div>

        <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800/80">
          <div className="flex justify-between text-xs text-slate-300 font-semibold mb-1">
            <span>Generated Tokens:</span>
            <span className="font-mono text-purple-400 font-bold">{generatedTokens} токенов</span>
          </div>
          <input
            type="range"
            min={5}
            max={120}
            value={generatedTokens}
            onChange={(e) => setGeneratedTokens(Number(e.target.value))}
            className="w-full accent-purple-500 cursor-pointer"
          />
        </div>
      </div>

      {/* Real-time stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-2.5 bg-slate-950/60 rounded-xl border border-slate-800 text-center">
          <div className="text-[11px] text-slate-400">Активные токены</div>
          <div className="text-base font-bold font-mono text-white mt-0.5">
            {totalActiveTokens}
          </div>
        </div>

        <div className="p-2.5 bg-slate-950/60 rounded-xl border border-slate-800 text-center">
          <div className="text-[11px] text-slate-400">Выделено блоков</div>
          <div className="text-base font-bold font-mono text-purple-400 mt-0.5">
            {stats.neededBlocks} / {totalPhysicalBlocks}
          </div>
        </div>

        <div className="p-2.5 bg-slate-950/60 rounded-xl border border-slate-800 text-center">
          <div className="text-[11px] text-slate-400">Фрагментация HBM</div>
          <div className={`text-base font-bold font-mono mt-0.5 ${
            stats.fragmentationPercent > 30 ? 'text-rose-400' : 'text-emerald-400'
          }`}>
            {stats.fragmentationPercent}%
          </div>
        </div>

        <div className="p-2.5 bg-slate-950/60 rounded-xl border border-slate-800 text-center">
          <div className="text-[11px] text-slate-400">Емкость батчинга</div>
          <div className="text-base font-bold font-mono text-emerald-400 mt-0.5">
            {stats.concurrencyCapacity}× parallel
          </div>
        </div>
      </div>

      {/* 32 Physical HBM Blocks Visualization Grid */}
      <div className="flex flex-col gap-2">
        <div className="flex justify-between text-xs text-slate-400">
          <span>Карта физических блоков HBM (каждый блок = 16 токенов):</span>
          <span className="font-mono text-[11px]">
            {usePagedAttention ? 'Динамическая аллокация страниц' : 'Статическая резервация 256 токенов'}
          </span>
        </div>

        <div className="grid grid-cols-8 sm:grid-cols-16 gap-1.5 p-3 bg-slate-950 rounded-xl border border-slate-800">
          {Array.from({ length: totalPhysicalBlocks }).map((_, idx) => {
            const isAllocated = idx < stats.neededBlocks;
            const isActuallyUsed = idx * blockSize < totalActiveTokens;
            const isWastedFragment = isAllocated && !isActuallyUsed;

            return (
              <div
                key={idx}
                className={`h-9 rounded-lg border text-[9px] font-mono flex flex-col items-center justify-center transition-all ${
                  isWastedFragment && !usePagedAttention
                    ? 'bg-rose-950/40 border-rose-600/50 text-rose-300'
                    : isAllocated
                      ? 'bg-purple-600/30 border-purple-500/60 text-purple-200'
                      : 'bg-slate-900 border-slate-800 text-slate-600'
                }`}
                title={`Block #${idx}: ${
                  isWastedFragment && !usePagedAttention
                    ? 'Fragmented Waste'
                    : isAllocated
                      ? 'Active Token Block'
                      : 'Free HBM'
                }`}
              >
                <span>B{idx}</span>
                <span className="text-[8px] opacity-75">
                  {isWastedFragment && !usePagedAttention ? 'waste' : isAllocated ? '16t' : 'free'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pedagogical Explanation */}
      <div className={`p-3 rounded-xl border text-xs leading-relaxed ${
        usePagedAttention ? 'bg-purple-950/20 border-purple-800/40 text-purple-200' : 'bg-rose-950/20 border-rose-800/40 text-rose-200'
      }`}>
        {usePagedAttention ? (
          <div>
            <strong>PagedAttention Advantage:</strong> Память KV-кэша разбита на физические страницы по 16 токенов. Блоки выделяются динамически в несмежные области HBM по мере генерации каждого нового токена. Внешняя фрагментация сведена к нулю, а внутренняя фрагментация ограничена последним блоком (всего {stats.fragmentationPercent}%). Это позволяет разместить в {stats.concurrencyCapacity} раз больше параллельных запросов в той же видеокарте.
          </div>
        ) : (
          <div>
            <strong>Contiguous Pre-allocation Flaw:</strong> Стандартный стек аллоцирует непрерывный кусок памяти под максимальную длину контекста ({maxContextTokens} токенов) заранее. Из них реально используется только {totalActiveTokens} токенов. <strong>{stats.fragmentationPercent}% видеопамяти простаивает впустую</strong>, вызывая Out-Of-Memory (OOM) и блокируя параллельный батчинг.
          </div>
        )}
      </div>
    </div>
  );
};
