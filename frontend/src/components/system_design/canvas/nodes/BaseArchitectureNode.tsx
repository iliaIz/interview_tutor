import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { 
  Globe, 
  DoorOpen, 
  Server, 
  Database, 
  Zap, 
  MessageSquare, 
  HardDrive, 
  ShieldAlert, 
  AlertTriangle 
} from 'lucide-react';
import { CanvasNodeData, ArchitectureNodeType } from '../../../../types/systemDesignCanvas';

const NODE_ICONS: Record<ArchitectureNodeType, React.ReactNode> = {
  client: <Globe className="w-5 h-5 text-sky-500" />,
  gateway: <DoorOpen className="w-5 h-5 text-violet-500" />,
  service: <Server className="w-5 h-5 text-emerald-500" />,
  database: <Database className="w-5 h-5 text-amber-500" />,
  cache: <Zap className="w-5 h-5 text-yellow-500" />,
  queue: <MessageSquare className="w-5 h-5 text-rose-500" />,
  blob_storage: <HardDrive className="w-5 h-5 text-teal-500" />,
  circuit_breaker: <ShieldAlert className="w-5 h-5 text-red-500" />
};

export const BaseArchitectureNode: React.FC<NodeProps> = memo(({ data, selected }) => {
  const nodeData = data as unknown as CanvasNodeData;
  const { label, nodeType, config = {}, metrics } = nodeData;

  const health = metrics?.health || 'healthy';
  const utilization = metrics?.utilization ?? 0;
  const currentRps = metrics?.currentRps ?? 0;
  const p99Ms = metrics?.p99Ms ?? 0;
  const errorRate = metrics?.errorRate ?? 0;

  // Health halo styles
  let borderStyle = 'border-pastel-border/40';
  let auraGlow = 'hover:shadow-pastel-card';
  let badgeColor = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';

  if (health === 'warning') {
    borderStyle = 'border-amber-400 dark:border-amber-500';
    auraGlow = 'shadow-[0_0_15px_rgba(245,158,11,0.25)] animate-pulse';
    badgeColor = 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30';
  } else if (health === 'critical') {
    borderStyle = 'border-rose-500';
    auraGlow = 'shadow-[0_0_20px_rgba(244,63,94,0.4)] animate-pulse';
    badgeColor = 'bg-rose-500/20 text-rose-600 dark:text-rose-300 border-rose-500/40';
  } else if (health === 'failed') {
    borderStyle = 'border-red-600 dark:border-red-500 bg-red-950/20';
    auraGlow = 'shadow-[0_0_25px_rgba(220,38,38,0.5)]';
    badgeColor = 'bg-red-600 text-white border-red-700';
  }

  return (
    <div className={`
      relative min-w-[210px] rounded-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-md
      border-2 transition-all duration-300 select-none p-3.5
      ${borderStyle} ${auraGlow}
      ${selected ? 'ring-2 ring-violet-500 ring-offset-2 dark:ring-offset-slate-950' : ''}
    `}>
      {/* 4 Handles for intuitive multidirectional connections */}
      <Handle type="target" position={Position.Top} className="!w-2.5 !h-2.5 !bg-violet-400 !border-2 !border-white dark:!border-slate-900" />
      <Handle type="source" position={Position.Bottom} className="!w-2.5 !h-2.5 !bg-violet-400 !border-2 !border-white dark:!border-slate-900" />
      <Handle type="target" position={Position.Left} className="!w-2.5 !h-2.5 !bg-violet-400 !border-2 !border-white dark:!border-slate-900" />
      <Handle type="source" position={Position.Right} className="!w-2.5 !h-2.5 !bg-violet-400 !border-2 !border-white dark:!border-slate-900" />

      {/* Header with Icon and Label */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800">
            {NODE_ICONS[nodeType] || <Server className="w-5 h-5 text-slate-500" />}
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 tracking-tight leading-none">
              {label}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
              {config.technology || nodeType}
            </div>
          </div>
        </div>

        {/* Replicas badge */}
        {config.replicas && config.replicas > 1 && (
          <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            {config.replicas}x
          </span>
        )}
      </div>

      {/* Live Metrics Grid */}
      <div className="grid grid-cols-2 gap-1.5 mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-[10px]">
        <div>
          <span className="text-slate-600 dark:text-slate-300">Нагрузка:</span>
          <div className="font-mono font-semibold text-slate-800 dark:text-slate-200">
            {currentRps.toLocaleString()} <span className="text-[9px] font-normal text-slate-600 dark:text-slate-300">RPS</span>
          </div>
        </div>
        <div>
          <span className="text-slate-600 dark:text-slate-300">p99 Latency:</span>
          <div className="font-mono font-semibold text-slate-800 dark:text-slate-200">
            {p99Ms} <span className="text-[9px] font-normal text-slate-600 dark:text-slate-300">мс</span>
          </div>
        </div>
      </div>

      {/* Utilization Bar */}
      <div className="mt-2">
        <div className="flex justify-between items-center text-[9px] text-slate-600 dark:text-slate-300 mb-0.5">
          <span>Утилизация CPU/Pool</span>
          <span className="font-mono font-medium">{Math.round(utilization * 100)}%</span>
        </div>
        <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-300 ${
              utilization >= 0.9 ? 'bg-rose-500' :
              utilization >= 0.75 ? 'bg-amber-400' : 'bg-emerald-500'
            }`}
            style={{ width: `${Math.min(100, Math.round(utilization * 100))}%` }}
          />
        </div>
      </div>

      {/* Error Rate Pill (if any errors) */}
      {errorRate > 0 && (
        <div className={`mt-2 flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-md border ${badgeColor}`}>
          <AlertTriangle className="w-3 h-3 flex-shrink-0" />
          <span>Ошибки: {(errorRate * 100).toFixed(1)}%</span>
        </div>
      )}
    </div>
  );
});
BaseArchitectureNode.displayName = 'BaseArchitectureNode';
