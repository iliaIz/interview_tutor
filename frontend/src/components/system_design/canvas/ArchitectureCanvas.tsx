import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  ReactFlowInstance,
  ReactFlowProvider
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { systemDesignNodeTypes, systemDesignEdgeTypes } from './nodes/nodeTypesRegistry';
import { 
  calculateTopologySignature, 
  generateGraphAdjacencyIr, 
  convertCanvasToMermaid 
} from './graphIrGenerator';
import { ComponentPalette } from './palette/ComponentPalette';
import { LiveMetricsHUD } from './telemetry/LiveMetricsHUD';
import { ChaosMonkeyPanel } from './chaos/ChaosMonkeyPanel';
import { useSimulationWorker } from '../simulation/useSimulationWorker';
import { useCanvasSPOF } from './useCanvasSPOF';
import { useCanvasDeicticSync } from './useCanvasDeicticSync';
import { 
  ArchitectureNodeType, 
  ArchitectureNodeConfig, 
  ArchitectureGraphPayload 
} from '../../../types/systemDesignCanvas';

interface ArchitectureCanvasProps {
  scenarioTitle?: string;
  onExportPayload?: (payload: ArchitectureGraphPayload) => void;
  onDeicticContextChange?: (context: {
    focusedElement?: any;
    mutationSummary?: string;
    graphIr?: string;
    architectureMermaid?: string;
  }) => void;
}

const INITIAL_NODES: Node[] = [
  {
    id: 'node-client',
    type: 'client',
    position: { x: 50, y: 220 },
    data: {
      label: 'Web / Mobile Client',
      nodeType: 'client' as ArchitectureNodeType,
      config: { technology: 'Web / App Users' }
    }
  },
  {
    id: 'node-gateway',
    type: 'gateway',
    position: { x: 320, y: 220 },
    data: {
      label: 'API Gateway',
      nodeType: 'gateway' as ArchitectureNodeType,
      config: { technology: 'Spring Cloud Gateway', replicas: 2, maxRpsCapacity: 15000 }
    }
  },
  {
    id: 'node-service',
    type: 'service',
    position: { x: 600, y: 220 },
    data: {
      label: 'Core Service',
      nodeType: 'service' as ArchitectureNodeType,
      config: { technology: 'Spring Boot 3.3', replicas: 3, threadPool: 50, serviceRateMu: 300 }
    }
  },
  {
    id: 'node-cache',
    type: 'cache',
    position: { x: 880, y: 100 },
    data: {
      label: 'Redis Cache',
      nodeType: 'cache' as ArchitectureNodeType,
      config: { technology: 'Redis Cluster', replicas: 3, cacheHitRatio: 0.85 }
    }
  },
  {
    id: 'node-db',
    type: 'database',
    position: { x: 880, y: 340 },
    data: {
      label: 'PostgreSQL Primary',
      nodeType: 'database' as ArchitectureNodeType,
      config: { technology: 'PostgreSQL 16 (Patroni)', replicas: 2, poolSize: 50, readWriteRatio: 0.8 }
    }
  },
  {
    id: 'node-queue',
    type: 'queue',
    position: { x: 600, y: 440 },
    data: {
      label: 'Kafka Event Bus',
      nodeType: 'queue' as ArchitectureNodeType,
      config: { technology: 'Apache Kafka', partitions: 8 }
    }
  }
];

const INITIAL_EDGES: Edge[] = [
  {
    id: 'edge-client-gw',
    source: 'node-client',
    target: 'node-gateway',
    type: 'flow',
    data: { config: { protocol: 'REST', isAsync: false, timeoutMs: 3000, trafficWeight: 1.0 } }
  },
  {
    id: 'edge-gw-service',
    source: 'node-gateway',
    target: 'node-service',
    type: 'flow',
    data: { config: { protocol: 'gRPC', isAsync: false, timeoutMs: 2000, trafficWeight: 1.0 } }
  },
  {
    id: 'edge-service-cache',
    source: 'node-service',
    target: 'node-cache',
    type: 'flow',
    data: { config: { protocol: 'Redis', isAsync: false, timeoutMs: 500, trafficWeight: 0.85 } }
  },
  {
    id: 'edge-service-db',
    source: 'node-service',
    target: 'node-db',
    type: 'flow',
    data: { config: { protocol: 'JDBC', isAsync: false, timeoutMs: 3000, trafficWeight: 0.15 } }
  },
  {
    id: 'edge-service-queue',
    source: 'node-service',
    target: 'node-queue',
    type: 'flow',
    data: { config: { protocol: 'Kafka', isAsync: true, timeoutMs: 5000, trafficWeight: 0.5 } }
  }
];

const ArchitectureCanvasInner: React.FC<ArchitectureCanvasProps> = ({
  onExportPayload,
  onDeicticContextChange
}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState(INITIAL_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState(INITIAL_EDGES);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  // Discrete Event Simulation Web Worker hook
  const {
    telemetry,
    inputRps,
    setInputRps,
    updateTopology,
    triggerChaos,
    isPaused,
    togglePause
  } = useSimulationWorker({ initialInputRps: 2000 });

  const topologySignature = useMemo(() => calculateTopologySignature(nodes, edges), [nodes, edges]);

  useEffect(() => {
    updateTopology(nodes, edges, inputRps);
  }, [topologySignature, inputRps, updateTopology]);

  // SPOF Analysis Hook
  const { enrichedNodes: spofNodes } = useCanvasSPOF(nodes, edges);

  // Deictic Context Sync Hook
  useCanvasDeicticSync({
    nodes,
    edges,
    topologySignature,
    telemetry,
    onDeicticContextChange
  });

  const handleNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    onDeicticContextChange?.({
      focusedElement: {
        id: node.id,
        label: node.data?.label || node.id,
        nodeType: node.data?.nodeType || node.type,
        config: node.data?.config
      }
    });
  }, [onDeicticContextChange]);

  const handleEdgeClick = useCallback((_event: React.MouseEvent, edge: Edge) => {
    onDeicticContextChange?.({
      focusedElement: {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        config: edge.data?.config
      }
    });
  }, [onDeicticContextChange]);

  // Enrich nodes with telemetry & SPOF flags
  const finalNodes = useMemo(() => {
    return spofNodes.map(node => {
      const metrics = telemetry?.nodeMetrics?.[node.id];
      const isChaosTarget = telemetry?.chaosState.affectedNodeId === node.id ||
        (telemetry?.chaosState.activeChaos === 'kill_primary' && node.type === 'database');

      if (!metrics && !isChaosTarget) return node;
      return {
        ...node,
        data: {
          ...node.data,
          metrics,
          isChaosTarget
        }
      };
    });
  }, [spofNodes, telemetry?.nodeMetrics, telemetry?.chaosState]);

  // Enrich edges with telemetry metrics
  const enrichedEdges = useMemo(() => {
    if (!telemetry?.edgeMetrics) return edges;
    return edges.map(edge => {
      const metrics = telemetry.edgeMetrics[edge.id];
      if (!metrics) return edge;
      return {
        ...edge,
        data: {
          ...edge.data,
          metrics
        }
      };
    });
  }, [edges, telemetry?.edgeMetrics]);

  const onConnect = useCallback((params: Connection) => {
    setEdges(eds => addEdge({
      ...params,
      type: 'flow',
      data: {
        config: {
          protocol: 'REST',
          isAsync: false,
          timeoutMs: 3000,
          trafficWeight: 1.0
        }
      }
    }, eds));
  }, [setEdges]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const nodeType = event.dataTransfer.getData('application/reactflow/type') as ArchitectureNodeType;
    const label = event.dataTransfer.getData('application/reactflow/label');
    const rawConfig = event.dataTransfer.getData('application/reactflow/config');

    if (!nodeType || !reactFlowInstance || !reactFlowWrapper.current) return;

    let config: ArchitectureNodeConfig = {};
    try {
      if (rawConfig) config = JSON.parse(rawConfig);
    } catch {
      config = {};
    }

    const position = reactFlowInstance.screenToFlowPosition({
      x: event.clientX,
      y: event.clientY
    });

    const newNode: Node = {
      id: `node-${Date.now()}`,
      type: nodeType,
      position,
      data: { label, nodeType, config }
    };

    setNodes(nds => nds.concat(newNode));
  }, [reactFlowInstance, setNodes]);

  useEffect(() => {
    if (onExportPayload) {
      onExportPayload({
        nodes: nodes.map(n => ({
          id: n.id,
          type: (n.data?.nodeType as ArchitectureNodeType) || 'service',
          label: (n.data?.label as string) || n.id,
          config: (n.data?.config as ArchitectureNodeConfig) || {},
          position: n.position
        })),
        edges: edges.map(e => ({
          id: e.id,
          source: e.source,
          target: e.target,
          config: (e.data?.config as any) || { protocol: 'REST', isAsync: false, timeoutMs: 3000 }
        })),
        simulationMetrics: telemetry || undefined,
        architectureMermaid: convertCanvasToMermaid(nodes, edges),
        graphIr: generateGraphAdjacencyIr(nodes, edges)
      });
    }
  }, [topologySignature, telemetry, onExportPayload, nodes, edges]);

  return (
    <div className="flex h-full w-full relative overflow-hidden bg-slate-50 dark:bg-slate-950">
      <ComponentPalette 
        onSelectComponent={(type, label) => {
          const newNode: Node = {
            id: `node-${Date.now()}`,
            type,
            position: { x: 400 + Math.random() * 60, y: 200 + Math.random() * 60 },
            data: { label, nodeType: type, config: {} }
          };
          setNodes(nds => nds.concat(newNode));
        }}
      />

      <div ref={reactFlowWrapper} className="flex-1 h-full relative">
        <ReactFlow
          nodes={finalNodes}
          edges={enrichedEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={handleNodeClick}
          onEdgeClick={handleEdgeClick}
          onInit={setReactFlowInstance}
          onDrop={onDrop}
          onDragOver={onDragOver}
          nodeTypes={systemDesignNodeTypes}
          edgeTypes={systemDesignEdgeTypes}
          snapToGrid={true}
          snapGrid={[15, 15]}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.2}
          maxZoom={2.0}
        >
          <Background 
            variant={BackgroundVariant.Dots} 
            gap={18} 
            size={1.5} 
            color="#94a3b8" 
            className="opacity-40" 
          />
          <Controls className="!bg-white/90 dark:!bg-slate-900/90 !border !border-slate-200 dark:!border-slate-800 !rounded-xl !shadow-md" />
          <MiniMap 
            nodeStrokeWidth={3}
            zoomable
            pannable
            className="!bg-white/80 dark:!bg-slate-900/80 !border !border-slate-200 dark:!border-slate-800 !rounded-xl !shadow-md" 
          />
        </ReactFlow>

        <LiveMetricsHUD
          telemetry={telemetry}
          inputRps={inputRps}
          onSetInputRps={setInputRps}
          isPaused={isPaused}
          onTogglePause={togglePause}
        />

        <ChaosMonkeyPanel
          chaosState={telemetry?.chaosState || { activeChaos: null }}
          onTriggerChaos={triggerChaos}
        />
      </div>
    </div>
  );
};

export const ArchitectureCanvas: React.FC<ArchitectureCanvasProps> = (props) => {
  return (
    <ReactFlowProvider>
      <ArchitectureCanvasInner {...props} />
    </ReactFlowProvider>
  );
};
