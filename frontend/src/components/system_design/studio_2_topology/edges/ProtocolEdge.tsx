import React, { memo } from 'react';
import { EdgeProps, getSmoothStepPath, BaseEdge, EdgeLabelRenderer } from '@xyflow/react';

export const ProtocolEdge = memo(({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
  selected
}: EdgeProps) => {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetPosition,
    targetX,
    targetY,
    borderRadius: 16
  });

  const edgeData = data as any;
  const protocol = edgeData?.protocol || 'http_rest';

  const getProtocolLabel = () => {
    switch (protocol) {
      case 'grpc': return 'gRPC';
      case 'tcp_socket': return 'TCP';
      case 'async_event': return 'Kafka / Event';
      case 'db_protocol': return 'PostgreSQL Wire';
      case 'nvlink_roce': return 'NVLink 900 GB/s';
      default: return 'HTTP/2';
    }
  };

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: selected ? '#c084fc' : '#64748b',
          strokeWidth: selected ? 2.5 : 1.5,
          strokeDasharray: protocol === 'async_event' ? '5,5' : undefined
        }}
      />

      {/* Animated packet dot */}
      <circle r="3" fill={selected ? '#d8b4fe' : '#a855f7'}>
        <animateMotion
          dur={protocol === 'nvlink_roce' ? '0.8s' : '2.2s'}
          repeatCount="indefinite"
          path={edgePath}
        />
      </circle>

      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all'
          }}
          className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-slate-950/90 text-purple-300 border border-purple-800/50 backdrop-blur-xs shadow-xs"
        >
          {getProtocolLabel()}
        </div>
      </EdgeLabelRenderer>
    </>
  );
});

ProtocolEdge.displayName = 'ProtocolEdge';
