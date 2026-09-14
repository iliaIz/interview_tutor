import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Cpu, Zap, AlertTriangle, Sparkles, Activity } from 'lucide-react';
import type { NodeTelemetry } from '../../../../workers/des/types/workerMessages';

export const GpuInferenceNode = memo(({ id, data, selected }: NodeProps) => {
  const nodeData = data as any;
  const telemetry: NodeTelemetry | undefined = nodeData?.telemetry;

  const ttft = telemetry?.ttft_p99_ms ?? 18.5;
  const tpot = telemetry?.tpot_p99_ms ?? 12.2;
  const kvUtil = telemetry?.kv_cache_utilization_percent ?? 42;
  const preempted = telemetry?.preempted_requests_count ?? 0;

  return (
    <div
      className={`relative min-w-[220px] rounded-2xl bg-slate-900/95 border transition-all duration-300 backdrop-blur-md shadow-lg ${
        selected
          ? 'border-purple-500 shadow-purple-500/30 ring-2 ring-purple-500/30'
          : preempted > 0
            ? 'border-amber-500/80 shadow-amber-500/20'
            : 'border-purple-900/50 hover:border-purple-700/60'
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2.5 !h-2.5 !bg-purple-400 !border-slate-900"
      />

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-purple-900/40 bg-purple-950/40 rounded-t-2xl">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-lg bg-purple-900/60 flex items-center justify-center text-purple-300 shrink-0">
            <Cpu className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold text-white truncate">
            {nodeData?.title || 'GPU LLM Cluster'}
          </span>
        </div>
        <span className="text-[9px] font-mono font-bold text-purple-300 uppercase px-1.5 py-0.5 rounded bg-purple-900/60 border border-purple-700/50">
          PagedAttention
        </span>
      </div>

      {/* Body */}
      <div className="p-3 flex flex-col gap-1.5 text-[11px]">
        <div className="flex justify-between items-center text-slate-400">
          <span>TTFT P99:</span>
          <span className="font-mono font-bold text-emerald-400">{ttft.toFixed(1)} ms</span>
        </div>
        <div className="flex justify-between items-center text-slate-400">
          <span>TPOT P99:</span>
          <span className="font-mono font-bold text-blue-400">{tpot.toFixed(1)} ms/tok</span>
        </div>

        {/* KV Cache HBM gauge */}
        <div className="mt-1">
          <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
            <span>HBM KV-Cache:</span>
            <span className={`font-mono font-bold ${kvUtil > 85 ? 'text-rose-400' : 'text-purple-300'}`}>
              {kvUtil.toFixed(1)}%
            </span>
          </div>
          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                kvUtil > 85 ? 'bg-rose-500' : kvUtil > 70 ? 'bg-amber-400' : 'bg-purple-500'
              }`}
              style={{ width: `${Math.min(100, kvUtil)}%` }}
            />
          </div>
        </div>

        {preempted > 0 && (
          <div className="mt-1 flex items-center gap-1 text-[10px] text-amber-300 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/50">
            <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
            <span>Preemptions: {preempted} req</span>
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2.5 !h-2.5 !bg-purple-400 !border-slate-900"
      />
    </div>
  );
});

GpuInferenceNode.displayName = 'GpuInferenceNode';
