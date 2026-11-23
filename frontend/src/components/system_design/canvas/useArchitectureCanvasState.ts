import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  ReactFlowInstance,
  OnNodesChange,
  OnEdgesChange,
  OnConnect
} from '@xyflow/react';
import {
  calculateTopologySignature,
  generateGraphAdjacencyIr,
  convertCanvasToMermaid
} from './graphIrGenerator';
import { useSimulationWorker } from '../simulation/useSimulationWorker';
import { useCanvasSPOF } from './useCanvasSPOF';
import { useCanvasDeicticSync } from './useCanvasDeicticSync';
import {
  ArchitectureNodeType,
  ArchitectureNodeConfig,
  ArchitectureGraphPayload
} from '../../../types/systemDesignCanvas';

export interface UseArchitectureCanvasStateProps {
  initialNodes: Node[];
  initialEdges: Edge[];
  onExportPayload?: (payload: ArchitectureGraphPayload) => void;
  onDeicticContextChange?: (context: {
    focusedElement?: any;
    mutationSummary?: string;
    graphIr?: string;
    architectureMermaid?: string;
  }) => void;
}

export interface UseArchitectureCanvasStateReturn {
  nodes: Node[];
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  edges: Edge[];
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  finalNodes: Node[];
  enrichedEdges: Edge[];
  onNodesChange: OnNodesChange<Node>;
  onEdgesChange: OnEdgesChange<Edge>;
  onConnect: OnConnect;
  handleNodeClick: (_event: React.MouseEvent, node: Node) => void;
  handleEdgeClick: (_event: React.MouseEvent, edge: Edge) => void;
  onDrop: (event: React.DragEvent) => void;
  onDragOver: (event: React.DragEvent) => void;
  reactFlowWrapper: React.RefObject<HTMLDivElement | null>;
  setReactFlowInstance: (instance: ReactFlowInstance | null) => void;
  telemetry: any;
  inputRps: number;
  setInputRps: (rps: number) => void;
  triggerChaos: (chaosType: any, targetNodeId?: string) => void;
  isPaused: boolean;
  togglePause: () => void;
}

export function useArchitectureCanvasState({
  initialNodes,
  initialEdges,
  onExportPayload,
  onDeicticContextChange
}: UseArchitectureCanvasStateProps): UseArchitectureCanvasStateReturn {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

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

  const { enrichedNodes: spofNodes } = useCanvasSPOF(nodes, edges);

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

  return {
    nodes,
    setNodes,
    edges,
    setEdges,
    finalNodes,
    enrichedEdges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    handleNodeClick,
    handleEdgeClick,
    onDrop,
    onDragOver,
    reactFlowWrapper,
    setReactFlowInstance,
    telemetry,
    inputRps,
    setInputRps,
    triggerChaos,
    isPaused,
    togglePause
  };
}
