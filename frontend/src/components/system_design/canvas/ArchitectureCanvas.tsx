import React from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  Node,
  ReactFlowProvider
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { systemDesignNodeTypes, systemDesignEdgeTypes } from './nodes/nodeTypesRegistry';
import { ComponentPalette } from './palette/ComponentPalette';
import { LiveMetricsHUD } from './telemetry/LiveMetricsHUD';
import { ChaosMonkeyPanel } from './chaos/ChaosMonkeyPanel';
import { useArchitectureCanvasState } from './useArchitectureCanvasState';
import { INITIAL_NODES, INITIAL_EDGES } from './initialCanvasGraph';
import { ArchitectureGraphPayload } from '../../../types/systemDesignCanvas';

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

const ArchitectureCanvasInner: React.FC<ArchitectureCanvasProps> = ({
  onExportPayload,
  onDeicticContextChange
}) => {
  const {
    setNodes,
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
  } = useArchitectureCanvasState({
    initialNodes: INITIAL_NODES,
    initialEdges: INITIAL_EDGES,
    onExportPayload,
    onDeicticContextChange
  });

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
