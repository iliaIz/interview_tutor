import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Shield, Globe, Activity, Layers } from 'lucide-react';
import type { NodeTelemetry } from '../../../../workers/des/types/workerMessages';

export const CellularClusterNode = memo(({ id, data, selected }: NodeProps) => {
  const nodeData = data as any;
  const telemetry: NodeTelemetry | undefined = nodeData?.telemetry;

  const blastRadius = telemetry?.cell_blast_radius_percent ?? (nodeData?.params?.blast_radius_fraction ? nodeData.params.blast_radius_fraction * 100 : 10);
  const syncLatency = telemetry?.allreduce_sync_latency_ms ?? 4.8;
  const az = nodeData?.params?.availability_zone || 'AZ-eu-west-1a';

  return (
    <div
      className={`relative min-w-[210px] rounded-2xl bg-slate-900/95 border transition-all duration-300 backdrop-blur-md shadow-lg ${
        selected
          ? 'border-blue-500 shadow-blue-500/30 ring-2 ring-blue-500/30'
          : 'border-blue-950/60 hover:border-blue-700/60'
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2.5 !h-2.5 !bg-blue-400 !border-slate-900"
      />

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-blue-900/40 bg-blue-950/40 rounded-t-2xl">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-lg bg-blue-900/60 flex items-center justify-center text-blue-300 shrink-0">
            <Globe className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold text-white truncate">
            {nodeData?.title || 'Planetary Cell'}
          </span>
        </div>
        <span className="text-[9px] font-mono font-bold text-blue-300 uppercase px-1.5 py-0.5 rounded bg-blue-900/60 border border-blue-700/50">
          Zero Blast-Radius
        </span>
      </div>

      {/* Body */}
      <div className="p-3 flex flex-col gap-1.5 text-[11px]">
        <div className="flex justify-between items-center text-slate-400">
          <span>Радиус поражения:</span>
          <span className="font-mono font-bold text-emerald-400">≤ {blastRadius.toFixed(1)}%</span>
        </div>
        <div className="flex justify-between items-center text-slate-400">
          <span>AllReduce Sync:</span>
          <span className="font-mono font-semibold text-blue-300">{syncLatency.toFixed(1)} ms</span>
        </div>
        <div className="flex justify-between items-center text-slate-400">
          <span>Availability Zone:</span>
          <span className="font-mono text-slate-300 text-[10px]">{az}</span>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2.5 !h-2.5 !bg-blue-400 !border-slate-900"
      />
    </div>
  );
});

CellularClusterNode.displayName = 'CellularClusterNode';
