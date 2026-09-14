import React, { useState, useCallback, useMemo, useEffect } from 'react';
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
  ReactFlowProvider,
  useReactFlow
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { 
  Sparkles, Wrench, Flame, ShieldAlert, CheckCircle2, 
  Activity, Play, RefreshCw, ZoomIn, ZoomOut, Layers 
} from 'lucide-react';
import { BaseSystemNode } from './nodes/BaseSystemNode';
import { GpuInferenceNode } from './nodes/GpuInferenceNode';
import { VectorDatabaseNode } from './nodes/VectorDatabaseNode';
import { SemanticCacheNode } from './nodes/SemanticCacheNode';
import { CellularClusterNode } from './nodes/CellularClusterNode';
import { ProtocolEdge } from './edges/ProtocolEdge';
import { useSimulationWorker } from './hooks/useSimulationWorker';
import { useTopologyValidation } from './hooks/useTopologyValidation';
import { PredictModal } from './poe/PredictModal';
import { LiveTelemetryBar } from './poe/LiveTelemetryBar';
import { SocraticExplainModal } from './poe/SocraticExplainModal';
import { RuntimeForensicsDrawer } from '../studio_1_runtime/RuntimeForensicsDrawer';

const customNodeTypes = {
  system_node: BaseSystemNode,
  gpu_node: GpuInferenceNode,
  vector_node: VectorDatabaseNode,
  cache_node: SemanticCacheNode,
  cellular_node: CellularClusterNode,
  default: BaseSystemNode
};

const customEdgeTypes = {
  protocol_edge: ProtocolEdge,
  default: ProtocolEdge
};

export interface TopologyCanvasProps {
  scenarioManifest: any;
  onProceedToDefense?: () => void;
  isRuntimeFixApplied?: boolean;
  isActive?: boolean;
}

const TopologyCanvasInner: React.FC<TopologyCanvasProps> = ({
  scenarioManifest,
  onProceedToDefense,
  isRuntimeFixApplied,
  isActive
}) => {
  const simSpec = scenarioManifest?.studio_2_simulation || {};
  const topology = simSpec.topology || { nodes: [], edges: [] };
  const targetRps = simSpec.traffic_profile?.target_rps_peak || simSpec.traffic_profile?.target_rps_mean || 5000;

  // 1. Simulation Worker & Invariant Validation
  const {
    isRunning,
    result,
    telemetry,
    timeline,
    runSimulation,
    stopSimulation,
    resetSimulation
  } = useSimulationWorker();

  // 2. Map Manifest Nodes to React Flow Nodes with grid_position
  const initialNodes: Node[] = useMemo(() => {
    return (topology.nodes || []).map((n: any, idx: number) => {
      const col = n.grid_position?.col ?? (idx % 3);
      const row = n.grid_position?.row ?? Math.floor(idx / 3);

      let nodeType = 'system_node';
      if (n.type === 'gpu_inference_node') nodeType = 'gpu_node';
      else if (n.type === 'vector_database') nodeType = 'vector_node';
      else if (n.type === 'semantic_cache') nodeType = 'cache_node';
      else if (n.type === 'cellular_cluster' || n.type === 'cell_router') nodeType = 'cellular_node';

      return {
        id: n.id,
        type: nodeType,
        position: { x: col * 280 + 60, y: row * 180 + 40 },
        data: {
          title: n.title || n.id,
          type: n.type,
          params: n.params || {},
          telemetry: telemetry[n.id],
          is_locked: n.is_locked
        }
      };
    });
  }, [topology.nodes, telemetry]);

  // 3. Map Manifest Edges to React Flow Edges
  const initialEdges: Edge[] = useMemo(() => {
    return (topology.edges || []).map((e: any) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: 'protocol_edge',
      data: {
        protocol: e.protocol || 'http_rest',
        is_locked: e.is_locked
      }
    }));
  }, [topology.edges]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Sync telemetry into node data whenever simulation produces results
  useEffect(() => {
    setNodes((prevNodes) =>
      prevNodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          telemetry: telemetry[node.id]
        }
      }))
    );
  }, [telemetry, setNodes]);

  const validationResult = useTopologyValidation({
    manifest: scenarioManifest,
    nodes,
    edges,
    simulationResults: result?.summary
  });

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, type: 'protocol_edge' }, eds)),
    [setEdges]
  );

  // 4. POE State Management
  const [isPredictModalOpen, setIsPredictModalOpen] = useState(false);
  const [isExplainModalOpen, setIsExplainModalOpen] = useState(false);
  const [userHypothesisId, setUserHypothesisId] = useState<string | null>(null);
  const [isChaosEnabled, setIsChaosEnabled] = useState(false);
  const [isForensicsDrawerOpen, setIsForensicsDrawerOpen] = useState(false);

  const { fitView } = useReactFlow();

  // Re-fit canvas viewport when tab becomes active or on window resize
  useEffect(() => {
    if (isActive !== false) {
      const timer = setTimeout(() => {
        fitView({ duration: 300, padding: 0.15 });
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [isActive, fitView]);

  const effectiveManifest = useMemo(() => {
    if (!isRuntimeFixApplied) return scenarioManifest;
    const cloned = JSON.parse(JSON.stringify(scenarioManifest));
    const manifestNodes = cloned.studio_2_simulation?.topology?.nodes || [];
    for (const node of manifestNodes) {
      if (node.params) {
        if (node.params.thread_pinning_risk) node.params.thread_pinning_risk = false;
        if (node.params.connection_pool_bottleneck) node.params.connection_pool_bottleneck = false;
        if (node.params.processing_time_ms && node.params.processing_time_ms > 40) {
          node.params.processing_time_ms = Math.round(node.params.processing_time_ms * 0.4);
        }
      }
    }
    return cloned;
  }, [scenarioManifest, isRuntimeFixApplied]);

  const handleStartSimulationClick = () => {
    if (!userHypothesisId) {
      setIsPredictModalOpen(true);
    } else {
      runSimulation(effectiveManifest, { enableChaos: isChaosEnabled });
    }
  };

  const handleConfirmPrediction = (hypoId: string) => {
    setUserHypothesisId(hypoId);
    setIsPredictModalOpen(false);
    runSimulation(effectiveManifest, { enableChaos: isChaosEnabled });
  };

  return (
    <div className="flex flex-col h-full w-full bg-slate-950 relative overflow-hidden font-sans select-none">
      {/* Top Floating Control Bar */}
      <div className="absolute top-4 left-6 right-6 z-20 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="px-3.5 py-1.5 rounded-2xl bg-slate-900/90 border border-slate-800 backdrop-blur-md shadow-lg flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-bold text-slate-200">
              {scenarioManifest?.title || 'System Architecture Topology'}
            </span>
            <span className="text-[10px] font-mono text-purple-300 uppercase px-1.5 py-0.5 rounded bg-purple-950 border border-purple-800">
              {scenarioManifest?.target_level || 'L5'}
            </span>
          </div>

          {/* Runtime fix status pill */}
          {isRuntimeFixApplied && (
            <div className="px-3 py-1.5 rounded-2xl bg-emerald-950/80 border border-emerald-600/60 backdrop-blur-md text-xs font-semibold text-emerald-300 flex items-center gap-1.5 shadow-lg">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>Runtime-фикс активен: пенальти снят</span>
            </div>
          )}

          {/* Invariant status pill */}
          {validationResult.violations.length > 0 ? (
            <div className="px-3 py-1.5 rounded-2xl bg-rose-950/80 border border-rose-700/60 backdrop-blur-md text-xs font-semibold text-rose-300 flex items-center gap-1.5 shadow-lg">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
              <span>{validationResult.violations.length} нарушение инварианта</span>
            </div>
          ) : (
            <div className="px-3 py-1.5 rounded-2xl bg-slate-900/80 border border-emerald-800/40 backdrop-blur-md text-xs font-semibold text-emerald-300 flex items-center gap-1.5 shadow-lg">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Инварианты соблюдены</span>
            </div>
          )}
        </div>

        {/* Right action button: Open Forensics Drawer */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            onClick={() => setIsForensicsDrawerOpen(true)}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 text-purple-300 text-xs font-bold backdrop-blur-md shadow-lg transition cursor-pointer"
          >
            <Wrench className="w-3.5 h-3.5 text-purple-400" />
            <span>Студия 1: Runtime Forensics</span>
          </button>
        </div>
      </div>

      {/* Main React Flow Canvas */}
      <div className="flex-1 h-full w-full">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={customNodeTypes}
          edgeTypes={customEdgeTypes}
          fitView
          minZoom={0.3}
          maxZoom={1.5}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            color="#334155"
          />
          <Controls
            className="!bg-slate-900 !border-slate-800 !text-slate-300 rounded-xl overflow-hidden shadow-lg"
          />
          <MiniMap
            nodeColor="#64748b"
            maskColor="rgba(15, 23, 42, 0.75)"
            className="!bg-slate-900 !border-slate-800 rounded-xl overflow-hidden"
          />
        </ReactFlow>
      </div>

      {/* Bottom Sticky HUD: Live Telemetry Bar */}
      <LiveTelemetryBar
        isRunning={isRunning}
        isChaosEnabled={isChaosEnabled}
        onToggleChaos={() => setIsChaosEnabled(!isChaosEnabled)}
        onStartSimulation={handleStartSimulationClick}
        onStopSimulation={stopSimulation}
        onResetSimulation={resetSimulation}
        onOpenExplain={() => setIsExplainModalOpen(true)}
        result={result}
        targetRps={targetRps}
        hasPredicted={Boolean(userHypothesisId)}
      />

      {/* Step 1: Predict Modal */}
      <PredictModal
        isOpen={isPredictModalOpen}
        onClose={() => setIsPredictModalOpen(false)}
        onConfirmPrediction={handleConfirmPrediction}
        scenarioTitle={scenarioManifest?.title || ''}
        targetRps={targetRps}
      />

      {/* Step 3: Socratic Explain Modal */}
      {result && (
        <SocraticExplainModal
          isOpen={isExplainModalOpen}
          onClose={() => setIsExplainModalOpen(false)}
          userHypothesisId={userHypothesisId}
          result={result}
          scenarioTitle={scenarioManifest?.title || ''}
          onProceedToDefense={onProceedToDefense}
        />
      )}

      {/* Studio 1 Runtime Forensics Slide-over Drawer */}
      <RuntimeForensicsDrawer
        isOpen={isForensicsDrawerOpen}
        onClose={() => setIsForensicsDrawerOpen(false)}
        scenarioManifest={scenarioManifest}
      />
    </div>
  );
};

export const TopologyCanvas: React.FC<TopologyCanvasProps> = (props) => {
  return (
    <ReactFlowProvider>
      <TopologyCanvasInner {...props} />
    </ReactFlowProvider>
  );
};
