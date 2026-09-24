import { useEffect, useRef } from 'react';
import { Node, Edge } from '@xyflow/react';
import { generateGraphAdjacencyIr, convertCanvasToMermaid } from './graphIrGenerator';
import { SimulationTelemetryFrame } from '../../../types/systemDesignCanvas';

interface UseCanvasDeicticSyncProps {
  nodes: Node[];
  edges: Edge[];
  topologySignature: string;
  telemetry: SimulationTelemetryFrame | null;
  onDeicticContextChange?: (context: {
    focusedElement?: any;
    mutationSummary?: string;
    graphIr?: string;
    architectureMermaid?: string;
  }) => void;
}

export function useCanvasDeicticSync({
  nodes,
  edges,
  topologySignature,
  telemetry,
  onDeicticContextChange
}: UseCanvasDeicticSyncProps) {
  const deicticTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastAnomalyTimeRef = useRef<number>(0);
  const lastPulseTimeRef = useRef<number>(0);
  const lastAnomalySignatureRef = useRef<string>('');

  // 1. Debounced topology mutation deictic event (500ms) with Micro-Graph Adjacency IR
  useEffect(() => {
    if (!onDeicticContextChange) return;
    if (deicticTimerRef.current) clearTimeout(deicticTimerRef.current);

    deicticTimerRef.current = setTimeout(() => {
      const graphIr = generateGraphAdjacencyIr(nodes, edges);
      const architectureMermaid = convertCanvasToMermaid(nodes, edges);
      onDeicticContextChange({
        mutationSummary: `Топология холста: ${nodes.length} узлов, ${edges.length} связей. Компоненты: ${nodes.map((n) => n.data?.label || n.id).join(', ')}`,
        graphIr,
        architectureMermaid
      });
    }, 500);

    return () => {
      if (deicticTimerRef.current) clearTimeout(deicticTimerRef.current);
    };
  }, [topologySignature, onDeicticContextChange]);

  // 2. Semantic Anomaly Digest (No raw JSON flooding, 1-line pulse or urgent anomaly alerts)
  useEffect(() => {
    if (!telemetry || !onDeicticContextChange) return;

    const now = Date.now();
    const { nodeMetrics, globalErrorRate, globalInputRps, globalP99LatencyMs, antiPatterns } = telemetry;

    const criticalAntiPattern = antiPatterns?.find((a) => a.severity === 'critical');
    let worstNode: { id: string; label: string; metrics: any } | null = null;

    if (nodeMetrics) {
      for (const [nodeId, m] of Object.entries(nodeMetrics)) {
        if (m.errorRate > 0.05 || m.utilization >= 0.85 || m.health === 'failed' || m.health === 'critical') {
          if (!worstNode || m.errorRate > worstNode.metrics.errorRate || m.utilization > worstNode.metrics.utilization) {
            const nodeObj = nodes.find((n) => n.id === nodeId);
            worstNode = {
              id: nodeId,
              label: (nodeObj?.data?.label as string) || nodeId,
              metrics: m
            };
          }
        }
      }
    }

    if (worstNode || criticalAntiPattern) {
      const anomalySig = worstNode
        ? `${worstNode.id}:${worstNode.metrics.health}:${worstNode.metrics.errorRate > 0.05}:${worstNode.metrics.utilization >= 0.85}`
        : criticalAntiPattern?.id || '';

      if (anomalySig !== lastAnomalySignatureRef.current || now - lastAnomalyTimeRef.current > 15000) {
        lastAnomalyTimeRef.current = now;
        lastAnomalySignatureRef.current = anomalySig;

        let alertMsg = '';
        if (worstNode) {
          const m = worstNode.metrics;
          const dropPct = (m.errorRate * 100).toFixed(1);
          const utilPct = (m.utilization * 100).toFixed(0);
          alertMsg = `🚨 [АНОМАЛИЯ ХОЛСТА: БОТЛНЕК НА УЗЛЕ "${worstNode.label}"]:\nНагрузка: ${m.currentRps} RPS, утилизация: ${utilPct}%, дроп: ${dropPct}% запросов! p99 задержка: ${m.p99Ms}мс.`;
        } else if (criticalAntiPattern) {
          alertMsg = `🚨 [КРИТИЧЕСКИЙ ДЕФЕКТ ТОПОЛОГИИ ХОЛСТА]: ${criticalAntiPattern.title} - ${criticalAntiPattern.description}`;
        }

        onDeicticContextChange({
          mutationSummary: alertMsg
        });
      }
    } else {
      lastAnomalySignatureRef.current = '';

      if (now - lastPulseTimeRef.current > 25000 && globalInputRps > 0) {
        lastPulseTimeRef.current = now;
        const successRate = (100 * (1 - globalErrorRate)).toFixed(1);
        const pulseMsg = `[ТЕЛЕМЕТРИЯ СЕТИ]: Входной поток: ${globalInputRps} RPS. Успешность: ${successRate}%. p99: ${globalP99LatencyMs}мс. Все узлы в норме.`;
        onDeicticContextChange({
          mutationSummary: pulseMsg
        });
      }
    }
  }, [telemetry, nodes, onDeicticContextChange]);
}
