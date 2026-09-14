import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { 
  Server, Database, HardDrive, Cpu, Radio, 
  Layers, AlertTriangle, ShieldCheck, Activity 
} from 'lucide-react';
import type { NodeTelemetry } from '../../../../workers/des/types/workerMessages';

export interface BaseSystemNodeData {
  title: string;
  type: string;
  params?: Record<string, any>;
  telemetry?: NodeTelemetry;
  is_locked?: boolean;
}

export const BaseSystemNode = memo(({ id, data, selected }: NodeProps) => {
  const nodeData = (data as unknown) as BaseSystemNodeData;
  const telemetry = nodeData?.telemetry;

  const getNodeIcon = () => {
    switch (nodeData?.type) {
      case 'database':
      case 'rdbms_primary':
      case 'rdbms_replica':
        return <Database className="w-4 h-4 text-emerald-400" />;
      case 'redis_cache':
      case 'memcached':
        return <HardDrive className="w-4 h-4 text-amber-400" />;
      case 'kafka_topic':
      case 'message_queue':
        return <Radio className="w-4 h-4 text-pink-400" />;
      case 'api_gateway':
      case 'load_balancer':
        return <Layers className="w-4 h-4 text-blue-400" />;
      default:
        return <Server className="w-4 h-4 text-purple-400" />;
    }
  };

  const isSaturated = telemetry?.is_saturated || false;

  return (
    <div
      className={`relative min-w-[200px] rounded-2xl bg-slate-900/95 border transition-all duration-300 backdrop-blur-md shadow-lg ${
        selected
          ? 'border-purple-500 shadow-purple-500/20 ring-2 ring-purple-500/30'
          : isSaturated
            ? 'border-rose-500/80 shadow-rose-500/20 animate-pulse'
            : 'border-slate-800 hover:border-slate-700'
      }`}
    >
      {/* Target Handle */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2.5 !h-2.5 !bg-purple-400 !border-slate-900"
      />

      {/* Node Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800/80 bg-slate-950/40 rounded-t-2xl">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
            {getNodeIcon()}
          </div>
          <span className="text-xs font-bold text-slate-200 truncate">
            {nodeData?.title || id}
          </span>
        </div>
        <span className="text-[9px] font-mono text-slate-400 uppercase px-1.5 py-0.5 rounded bg-slate-800 shrink-0">
          {nodeData?.type || 'node'}
        </span>
      </div>

      {/* Node Body / Telemetry */}
      <div className="p-3 flex flex-col gap-1.5 text-[11px]">
        {telemetry ? (
          <>
            <div className="flex justify-between items-center text-slate-400">
              <span>Throughput:</span>
              <span className="font-mono font-semibold text-slate-200">
                {Math.round(telemetry.throughput_rps).toLocaleString()} rps
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-400">
              <span>Latency P99:</span>
              <span className={`font-mono font-semibold ${
                telemetry.latency_p99_ms > 50 ? 'text-rose-400' : 'text-emerald-400'
              }`}>
                {telemetry.latency_p99_ms.toFixed(1)} ms
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-400">
              <span>Queue Depth:</span>
              <span className="font-mono text-slate-300">
                {Math.round(telemetry.queue_depth_mean)}
              </span>
            </div>

            {/* Utilization Bar */}
            <div className="mt-1">
              <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
                <span>Утилизация</span>
                <span className="font-mono font-bold text-slate-300">
                  {Math.round(telemetry.utilization_percent)}%
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    telemetry.utilization_percent > 85
                      ? 'bg-rose-500'
                      : telemetry.utilization_percent > 65
                        ? 'bg-amber-400'
                        : 'bg-emerald-400'
                  }`}
                  style={{ width: `${Math.min(100, telemetry.utilization_percent)}%` }}
                />
              </div>
            </div>
          </>
        ) : (
          <div className="text-[11px] text-slate-500 text-center py-1">
            Ожидание симуляции...
          </div>
        )}
      </div>

      {/* Source Handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2.5 !h-2.5 !bg-purple-400 !border-slate-900"
      />
    </div>
  );
});

BaseSystemNode.displayName = 'BaseSystemNode';
