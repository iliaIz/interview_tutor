import React, { memo } from 'react';
import { BaseEdge, EdgeProps, getBezierPath, EdgeLabelRenderer } from '@xyflow/react';
import { CanvasEdgeData } from '../../../../types/systemDesignCanvas';

export const FlowEdge: React.FC<EdgeProps> = memo(({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data
}) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const edgeData = data as unknown as CanvasEdgeData | undefined;
  const protocol = edgeData?.config?.protocol || 'REST';
  const isAsync = edgeData?.config?.isAsync || false;
  const metrics = edgeData?.metrics;
  const currentRps = metrics?.currentRps ?? 0;
  const isCongested = metrics?.isCongested ?? false;

  // Particle speed based on current RPS: higher RPS -> faster animation
  const speedSec = Math.max(0.6, Math.min(3.0, 3.0 - (currentRps / 2000)));

  // Protocol badge colors
  let protocolColor = 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800';
  if (protocol === 'Kafka') {
    protocolColor = 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800';
  } else if (protocol === 'gRPC') {
    protocolColor = 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800';
  } else if (protocol === 'JDBC') {
    protocolColor = 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800';
  }

  const strokeColor = isCongested ? '#f43f5e' : '#8b5cf6';

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          strokeWidth: isCongested ? 2.5 : 2,
          stroke: strokeColor,
          strokeDasharray: isAsync ? '5,5' : undefined,
          transition: 'stroke 0.3s'
        }}
      />

      {/* Hardware-accelerated SVG Traffic Particle */}
      {currentRps > 0 && (
        <circle r={isCongested ? 3.5 : 2.5} fill={isCongested ? '#f43f5e' : '#a78bfa'}>
          <animateMotion
            dur={`${speedSec}s`}
            repeatCount="indefinite"
            path={edgePath}
          />
        </circle>
      )}

      {/* Protocol Badge in Edge Center */}
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
          className={`
            px-2 py-0.5 rounded-full text-[9px] font-mono font-semibold border shadow-sm
            flex items-center gap-1 select-none backdrop-blur-sm
            ${protocolColor}
          `}
        >
          <span>{protocol}</span>
          {currentRps > 0 && (
            <span className="opacity-75 text-[8px]">
              {currentRps.toLocaleString()} <span className="text-[7px]">RPS</span>
            </span>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
});
FlowEdge.displayName = 'FlowEdge';
