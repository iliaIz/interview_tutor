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
  ReactFlowProvider
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { 
  ArrowLeft, AlertTriangle, CheckCircle2, XCircle, ShieldAlert,
  RotateCcw, Sparkles, Wrench, Activity, ChevronRight, ChevronLeft,
  Flame, CheckCircle
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { FADED_ARCHETYPES, FadedArchetype } from './FadedScaffoldingCatalog';
import { MarkdownRenderer } from '../../MarkdownRenderer';
import { systemDesignNodeTypes, systemDesignEdgeTypes } from '../canvas/nodes/nodeTypesRegistry';
import { calculateTopologySignature } from '../canvas/graphIrGenerator';
import { ComponentPalette } from '../canvas/palette/ComponentPalette';
import { ArchitectureTopologyLinter, LinterNode, LinterEdge } from '../simulation/ArchitectureTopologyLinter';
import { ArchitectureNodeType } from '../../../types/systemDesignCanvas';

interface FadedScaffoldingArenaProps {
  initialArchetypeId?: string;
  onBack: () => void;
}

const FadedScaffoldingContent: React.FC<FadedScaffoldingArenaProps> = ({ initialArchetypeId, onBack }) => {
  const [selectedId, setSelectedId] = useState<string>(initialArchetypeId || FADED_ARCHETYPES[0].id);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const activeArchetype = useMemo(() => {
    return FADED_ARCHETYPES.find(a => a.id === selectedId) || FADED_ARCHETYPES[0];
  }, [selectedId]);

  const [nodes, setNodes, onNodesChange] = useNodesState(activeArchetype.initialBrokenTopology.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(activeArchetype.initialBrokenTopology.edges);

  // Sync nodes & edges when switching archetype
  React.useEffect(() => {
    setNodes(activeArchetype.initialBrokenTopology.nodes);
    setEdges(activeArchetype.initialBrokenTopology.edges);
    setValidationReport(null);
  }, [activeArchetype.id, setNodes, setEdges]);

  const [validationReport, setValidationReport] = useState<{
    isResolved: boolean;
    issues: string[];
    passedChecks: string[];
  } | null>(null);

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge({ ...connection, type: 'flow', animated: true }, eds));
    },
    [setEdges]
  );

  const handleResetTopology = () => {
    setNodes(activeArchetype.initialBrokenTopology.nodes);
    setEdges(activeArchetype.initialBrokenTopology.edges);
    setValidationReport(null);
  };

  const handleAddPaletteNode = (type: ArchitectureNodeType, label: string) => {
    const id = `node_${type}_${Date.now()}`;
    const newNode: Node = {
      id,
      type,
      position: { x: 300 + Math.random() * 80, y: 150 + Math.random() * 100 },
      data: {
        label,
        nodeType: type,
        config: { replicas: type === 'database' ? 2 : type === 'service' ? 3 : 1 }
      }
    };
    setNodes((nds) => nds.concat(newNode));
  };

  // Deterministic topology signature: react to node config & edge protocol changes
  const topologySignature = useMemo(() => {
    return calculateTopologySignature(nodes, edges);
  }, [nodes, edges]);

  // Live re-validation if candidate modifies canvas while looking at diagnostics
  const reportRef = React.useRef(validationReport);
  reportRef.current = validationReport;

  const handleVerifyResolution = useCallback(() => {
    const linterNodes: LinterNode[] = nodes.map(n => ({
      id: n.id,
      type: n.type,
      data: n.data as any
    }));

    const linterEdges: LinterEdge[] = edges.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      data: e.data as any
    }));

    const diagnostics = ArchitectureTopologyLinter.lint(linterNodes, linterEdges);
    const criticalDiags = diagnostics.filter(d => d.severity === 'error');

    const issues: string[] = [];
    const passedChecks: string[] = [];

    // 1. AST Topology Linter checks
    if (criticalDiags.length > 0) {
      criticalDiags.forEach(d => issues.push(`[Линтер] ${d.message}`));
    } else {
      passedChecks.push('Топология свободна от критических SPOF и синхронных дедлок-циклов');
    }

    // 2. Archetype specific rule checks
    const presentNodeTypes = new Set(nodes.map(n => (n.data?.nodeType || n.type || '').toString().toLowerCase()));

    for (const reqType of activeArchetype.validationRules.requiredNodeTypes) {
      if (!presentNodeTypes.has(reqType.toLowerCase())) {
        issues.push(`Отсутствует обязательный компенсирующий компонент типа: "${reqType.toUpperCase()}"`);
      } else {
        passedChecks.push(`Внедрен компенсирующий компонент типа "${reqType.toUpperCase()}"`);
      }
    }

    // 3. Minimum components count check
    if (nodes.length < activeArchetype.validationRules.minComponentsCount) {
      issues.push(`Архитектура не декомпозирована (текущих компонентов: ${nodes.length}, требуется минимум: ${activeArchetype.validationRules.minComponentsCount})`);
    } else {
      passedChecks.push(`Достаточная степень декомпозиции узлов (${nodes.length} компонентов)`);
    }

    // 4. Forbidden patterns check
    for (const forbidden of activeArchetype.validationRules.forbiddenPatterns) {
      const violatedEdge = edges.find(e => {
        const srcNode = nodes.find(n => n.id === e.source);
        const tgtNode = nodes.find(n => n.id === e.target);
        const srcType = (srcNode?.data?.nodeType || srcNode?.type || '').toString().toLowerCase();
        const tgtType = (tgtNode?.data?.nodeType || tgtNode?.type || '').toString().toLowerCase();
        const isSync = (e.data as any)?.isAsync !== true;

        if (srcType === forbidden.sourceType && tgtType === forbidden.targetType) {
          if (forbidden.isSync === undefined || forbidden.isSync === isSync) return true;
        }
        return false;
      });

      if (violatedEdge) {
        issues.push(`Запрещенный паттерн: ${forbidden.description}`);
      }
    }

    const isResolved = issues.length === 0;
    setValidationReport({ isResolved, issues, passedChecks });

    if (isResolved) {
      try {
        confetti({
          particleCount: 70,
          spread: 80,
          origin: { y: 0.6 }
        });
      } catch (_) {}
    }
  }, [nodes, edges, activeArchetype]);

  // Live re-verify on topology changes if candidate is looking at validation results
  useEffect(() => {
    if (reportRef.current !== null) {
      handleVerifyResolution();
    }
  }, [topologySignature, handleVerifyResolution]);

  return (
    <div className="flex flex-col h-full bg-pastel-canvas text-pastel-text overflow-hidden">
      {/* Top Bar */}
      <header className="flex-shrink-0 flex items-center justify-between px-6 py-3 border-b border-pastel-border bg-pastel-card/90 backdrop-blur-md z-10">
        <div className="flex items-center space-x-4">
          <button
            onClick={onBack}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-pastel-border hover:bg-pastel-hover text-xs font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Каталог</span>
          </button>
          <div className="flex items-center space-x-2">
            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center space-x-1">
              <Flame className="w-3.5 h-3.5" />
              <span>Level 2: Faded Scaffolding #{activeArchetype.number}</span>
            </span>
            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
              {activeArchetype.incidentSeverity}
            </span>
            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-pastel-card text-pastel-text-muted border border-pastel-border">
              {activeArchetype.affectedDomain}
            </span>
          </div>
        </div>

        {/* Archetype Selector Pills */}
        <div className="flex items-center space-x-1.5 overflow-x-auto py-1 max-w-xl">
          {FADED_ARCHETYPES.map((arch) => {
            const isSelected = arch.id === selectedId;
            return (
              <button
                key={arch.id}
                onClick={() => setSelectedId(arch.id)}
                className={`px-2.5 py-1 rounded-md text-xs whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-rose-600 text-white font-medium shadow-sm'
                    : 'bg-pastel-card hover:bg-pastel-hover text-pastel-text/80 border border-pastel-border'
                }`}
              >
                #{arch.number} {arch.title.split(' ')[0]}
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Workspace: Left Drawer (Telemetry & Diagnosis) + Right Canvas */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Collapsible Left Telemetry & Requirements Drawer */}
        <div
          className={`h-full border-r border-pastel-border bg-pastel-card/95 backdrop-blur-md transition-all duration-300 z-20 flex flex-col ${
            isSidebarOpen ? 'w-[420px]' : 'w-0 border-none'
          } overflow-hidden`}
        >
          {isSidebarOpen && (
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              <div>
                <h2 className="text-base font-bold text-pastel-text">
                  {activeArchetype.title}
                </h2>
                <p className="text-xs text-pastel-text-muted mt-0.5">
                  {activeArchetype.subtitle}
                </p>
              </div>

              {/* Active Incident Live Telemetry HUD */}
              <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-rose-400 font-semibold text-xs uppercase tracking-wider">
                    <Activity className="w-4 h-4 animate-pulse" />
                    <span>Телеметрия сбоя в Production</span>
                  </div>
                  <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[10px] font-mono">
                    ACTIVE OUTAGE
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(activeArchetype.simulatedFailureMetrics).map(([k, v]) => (
                    <div key={k} className="p-2 rounded-lg bg-black/20 border border-rose-500/20">
                      <div className="text-[10px] text-pastel-text-muted capitalize">
                        {k.replace(/([A-Z])/g, ' $1')}
                      </div>
                      <div className="text-xs font-mono font-bold text-rose-300 mt-0.5">
                        {v.toString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Incident Diagnosis Markdown */}
              <div className="p-4 rounded-xl border border-pastel-border bg-pastel-card/50">
                <MarkdownRenderer content={activeArchetype.diagnosisMarkdown} />
              </div>

              {/* Target Engineering Requirements */}
              <div className="p-4 rounded-xl border border-pastel-border bg-pastel-card/50 space-y-2">
                <span className="text-xs font-semibold text-pastel-text uppercase tracking-wider block">
                  Инженерные критерии устранения аварии:
                </span>
                <ul className="space-y-1.5">
                  {activeArchetype.targetRequirements.map((req, i) => (
                    <li key={i} className="text-xs text-pastel-text/90 flex items-start space-x-2">
                      <Wrench className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0 mt-0.5" />
                      <span>{req}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Deadly Sins to Avoid */}
              <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-2">
                <div className="flex items-center space-x-2 text-amber-400 font-semibold text-xs uppercase tracking-wider">
                  <ShieldAlert className="w-4 h-4" />
                  <span>Матрица смертных грехов (Антипаттерны):</span>
                </div>
                <ul className="space-y-1">
                  {activeArchetype.deadlySinsToCheck.map((sin, i) => (
                    <li key={i} className="text-xs text-amber-200/90 font-mono">
                      • {sin}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Drawer Toggle Button */}
        <button
          onClick={() => setIsSidebarOpen(prev => !prev)}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-30 p-1 rounded-r-lg bg-pastel-card border border-l-0 border-pastel-border text-pastel-text-muted hover:text-pastel-text shadow-md"
          style={{ left: isSidebarOpen ? '420px' : '0px' }}
        >
          {isSidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>

        {/* Canvas Area */}
        <div className="flex-1 flex flex-col h-full relative">
          {/* Top Floating Action HUD */}
          <div className="absolute top-4 left-6 z-20 flex items-center space-x-3">
            <button
              onClick={handleVerifyResolution}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 shadow-md flex items-center space-x-2 transition-all"
            >
              <CheckCircle className="w-4 h-4" />
              <span>Проверить архитектурное исправление</span>
            </button>
            <button
              onClick={handleResetTopology}
              className="px-3 py-2 rounded-xl text-xs font-medium bg-pastel-card hover:bg-pastel-hover border border-pastel-border text-pastel-text shadow-sm flex items-center space-x-1.5 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Сбросить к аварийному состоянию</span>
            </button>
          </div>

          {/* Component Palette floating on the right */}
          <div className="absolute top-4 right-6 z-20">
            <ComponentPalette onSelectComponent={handleAddPaletteNode} />
          </div>

          {/* Verification Results Modal / Card Overlay */}
          {validationReport && (
            <div className="absolute bottom-6 left-6 right-6 max-w-2xl mx-auto z-30 p-5 rounded-2xl border shadow-xl backdrop-blur-lg bg-pastel-card/95 space-y-3 animate-in fade-in slide-in-from-bottom-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {validationReport.isResolved ? (
                    <CheckCircle2 className="w-6 h-6 text-emerald-400 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-6 h-6 text-rose-400 flex-shrink-0" />
                  )}
                  <div>
                    <h3 className="text-sm font-bold text-pastel-text">
                      {validationReport.isResolved
                        ? 'АВАРИЯ УСПЕШНО ЛИКВИДИРОВАНА!'
                        : 'АРХИТЕКТУРНЫЕ ДЕФЕКТЫ НЕ УСТРАНЕНЫ'}
                    </h3>
                    <p className="text-xs text-pastel-text-muted">
                      {validationReport.isResolved
                        ? 'Телеметрия производственного стенда нормализована. Все узкие места устранены.'
                        : 'Топология по-прежнему содержит критические уязвимости или недостаточные компоненты.'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setValidationReport(null)}
                  className="text-xs text-pastel-text-muted hover:text-pastel-text"
                >
                  Закрыть
                </button>
              </div>

              {validationReport.issues.length > 0 && (
                <div className="space-y-1 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
                  <span className="text-[11px] font-semibold text-rose-300 uppercase">
                    Обнаруженные дефекты:
                  </span>
                  {validationReport.issues.map((iss, i) => (
                    <div key={i} className="text-xs text-rose-200">
                      • {iss}
                    </div>
                  ))}
                </div>
              )}

              {validationReport.passedChecks.length > 0 && (
                <div className="space-y-1 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <span className="text-[11px] font-semibold text-emerald-300 uppercase">
                    Успешно выполненные критерии:
                  </span>
                  {validationReport.passedChecks.map((chk, i) => (
                    <div key={i} className="text-xs text-emerald-200 flex items-center space-x-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                      <span>{chk}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* React Flow Interactive Canvas */}
          <div className="w-full h-full">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              nodeTypes={systemDesignNodeTypes}
              edgeTypes={systemDesignEdgeTypes}
              fitView
              className="bg-[#0f172a]"
            >
              <Controls className="bg-pastel-card border-pastel-border fill-pastel-text" />
              <MiniMap
                className="bg-pastel-card border border-pastel-border rounded-lg overflow-hidden"
                nodeColor="#64748b"
                maskColor="rgba(0, 0, 0, 0.6)"
              />
              <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#334155" />
            </ReactFlow>
          </div>
        </div>
      </div>
    </div>
  );
};

export const FadedScaffoldingArena: React.FC<FadedScaffoldingArenaProps> = (props) => {
  return (
    <ReactFlowProvider>
      <FadedScaffoldingContent {...props} />
    </ReactFlowProvider>
  );
};
