import { useMemo } from 'react';
import { validateInvariants, InvariantValidationResult } from '@interview-prep/shared';
import type { TransportNode, TransportEdge } from '@interview-prep/shared';

export interface UseTopologyValidationParams {
  manifest: any;
  nodes: any[];
  edges: any[];
  simulationResults?: any;
}

export function useTopologyValidation({
  manifest,
  nodes,
  edges,
  simulationResults
}: UseTopologyValidationParams): InvariantValidationResult {
  return useMemo(() => {
    if (!manifest || !manifest.studio_2_simulation) {
      return { isValid: true, violations: [], passedRuleIds: [] };
    }

    // Convert React Flow nodes & edges to TransportNode and TransportEdge
    const transportNodes: TransportNode[] = (nodes || []).map((n, idx) => ({
      id: n.id,
      type: n.data?.type || n.type || 'app_service',
      title: n.data?.title || n.data?.label || n.id,
      grid_position: n.data?.grid_position || { col: idx % 4, row: Math.floor(idx / 4) },
      params: n.data?.params || {},
      is_locked: Boolean(n.data?.is_locked)
    }));

    const transportEdges: TransportEdge[] = (edges || []).map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      protocol: e.data?.protocol || 'http_rest',
      is_locked: Boolean(e.data?.is_locked)
    }));

    return validateInvariants({
      manifest,
      nodes: transportNodes,
      edges: transportEdges,
      simulationResults
    });
  }, [manifest, nodes, edges, simulationResults]);
}
