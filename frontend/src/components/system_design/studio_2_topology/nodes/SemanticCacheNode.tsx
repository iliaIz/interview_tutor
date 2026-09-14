import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { HardDrive, Sparkles, Zap, ShieldCheck } from 'lucide-react';
import type { NodeTelemetry } from '../../../../workers/des/types/workerMessages';

export const SemanticCacheNode = memo(({ id, data, selected }: NodeProps) => {
  const nodeData = data as any;
  const telemetry: NodeTelemetry | undefined = nodeData?.telemetry;

  const hitRate = telemetry?.cache_hit_rate_percent ?? 65;
  const xfetchRefreshes = telemetry?.xfetch_early_refreshes_count ?? 0;

  return (
    <div
      className={`relative min-w-[200px] rounded-2xl bg-slate-900/95 border transition-all duration-300 backdrop-blur-md shadow-lg ${
        selected
          ? 'border-amber-500 shadow-amber-500/30 ring-2 ring-amber-500/30'
          : 'border-amber-950/60 hover:border-amber-700/60'
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2.5 !h-2.5 !bg-amber-400 !border-slate-900"
      />

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-amber-900/40 bg-amber-950/40 rounded-t-2xl">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-lg bg-amber-900/60 flex items-center justify-center text-amber-300 shrink-0">
            <HardDrive className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold text-white truncate">
            {nodeData?.title || 'Semantic Cache'}
          </span>
        </div>
        <span className="text-[9px] font-mono font-bold text-amber-300 uppercase px-1.5 py-0.5 rounded bg-amber-900/60 border border-amber-700/50">
          XFetch
        </span>
      </div>

      {/* Body */}
      <div className="p-3 flex flex-col gap-1.5 text-[11px]">
        <div className="flex justify-between items-center text-slate-400">
          <span>Hit Rate:</span>
          <span className="font-mono font-bold text-emerald-400">{hitRate.toFixed(1)}%</span>
        </div>
        <div className="flex justify-between items-center text-slate-400">
          <span>XFetch Precomputes:</span>
          <span className="font-mono text-amber-300">{xfetchRefreshes} req</span>
        </div>
        <div className="flex justify-between items-center text-slate-400">
          <span>Cache Latency:</span>
          <span className="font-mono font-semibold text-slate-200">1.2 ms</span>
        </div>
        <div className="flex justify-between items-center text-slate-400">
          <span>Similarity Threshold:</span>
          <span className="font-mono text-slate-300">0.92 cosine</span>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2.5 !h-2.5 !bg-amber-400 !border-slate-900"
      />
    </div>
  );
});

SemanticCacheNode.displayName = 'SemanticCacheNode';
