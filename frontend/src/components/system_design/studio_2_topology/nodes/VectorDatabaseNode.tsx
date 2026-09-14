import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Database, Search, Sparkles } from 'lucide-react';
import type { NodeTelemetry } from '../../../../workers/des/types/workerMessages';

export const VectorDatabaseNode = memo(({ id, data, selected }: NodeProps) => {
  const nodeData = data as any;
  const telemetry: NodeTelemetry | undefined = nodeData?.telemetry;

  const latency = telemetry?.vector_search_latency_ms ?? 8.4;
  const recall = nodeData?.params?.target_recall ?? 0.985;
  const efSearch = nodeData?.params?.ef_search ?? 64;

  return (
    <div
      className={`relative min-w-[210px] rounded-2xl bg-slate-900/95 border transition-all duration-300 backdrop-blur-md shadow-lg ${
        selected
          ? 'border-emerald-500 shadow-emerald-500/30 ring-2 ring-emerald-500/30'
          : 'border-emerald-950/60 hover:border-emerald-700/60'
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2.5 !h-2.5 !bg-emerald-400 !border-slate-900"
      />

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-emerald-900/40 bg-emerald-950/40 rounded-t-2xl">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-lg bg-emerald-900/60 flex items-center justify-center text-emerald-300 shrink-0">
            <Search className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold text-white truncate">
            {nodeData?.title || 'HNSW Vector DB'}
          </span>
        </div>
        <span className="text-[9px] font-mono font-bold text-emerald-300 uppercase px-1.5 py-0.5 rounded bg-emerald-900/60 border border-emerald-700/50">
          SQ8 / HNSW
        </span>
      </div>

      {/* Body */}
      <div className="p-3 flex flex-col gap-1.5 text-[11px]">
        <div className="flex justify-between items-center text-slate-400">
          <span>Search P99:</span>
          <span className="font-mono font-bold text-emerald-400">{latency.toFixed(1)} ms</span>
        </div>
        <div className="flex justify-between items-center text-slate-400">
          <span>Recall Rate:</span>
          <span className="font-mono font-bold text-blue-400">{(recall * 100).toFixed(1)}%</span>
        </div>
        <div className="flex justify-between items-center text-slate-400">
          <span>efSearch:</span>
          <span className="font-mono text-slate-300">{efSearch}</span>
        </div>
        <div className="flex justify-between items-center text-slate-400">
          <span>Dimension:</span>
          <span className="font-mono text-slate-300">1536d</span>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2.5 !h-2.5 !bg-emerald-400 !border-slate-900"
      />
    </div>
  );
});

VectorDatabaseNode.displayName = 'VectorDatabaseNode';
