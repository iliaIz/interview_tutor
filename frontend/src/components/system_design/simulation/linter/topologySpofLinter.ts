/**
 * topologySpofLinter.ts
 * Internal topology rule and ingress-to-storage SPOF evaluator backing TopologySimulationKernel.
 */

import type { AntiPatternWarning } from '../../../../types/systemDesignCanvas';
import { ArchitectureTopologyLinter, LinterNode, LinterEdge } from '../ArchitectureTopologyLinter';

export interface SpofNodeAnalysis {
  isSpof: boolean;
  reason?: string;
  isArticulationPoint: boolean;
  hasRedundancy: boolean;
}

export interface GraphNodeLike {
  id: string;
  type?: string;
  data?: {
    nodeType?: string;
    label?: string;
    config?: { replicas?: number; technology?: string; [key: string]: any };
    [key: string]: any;
  };
}

export interface GraphEdgeLike {
  source: string;
  target: string;
  id?: string;
  protocol?: string;
  isAsync?: boolean;
}

export function evaluateTopologyLint(
  nodes: GraphNodeLike[],
  edges: GraphEdgeLike[]
): { antiPatterns: AntiPatternWarning[]; spofMap: Map<string, SpofNodeAnalysis> } {
  const linterNodes: LinterNode[] = nodes.map((n) => {
    const nodeType = (n.data?.nodeType || n.type || 'service') as any;
    return {
      id: n.id,
      type: nodeType,
      data: {
        nodeType,
        label: n.data?.label || n.id,
        instances: n.data?.config?.replicas || 1,
        replicas: n.data?.config?.replicas || 1,
        config: n.data?.config
      }
    };
  });
  const linterEdges: LinterEdge[] = edges.map((e, idx) => ({
    id: e.id || `edge_${idx}_${e.source}_${e.target}`,
    source: e.source,
    target: e.target,
    data: {
      protocol: (e.protocol as any) || 'REST',
      isAsync: Boolean(e.isAsync),
      config: { protocol: (e.protocol as any) || 'REST', isAsync: Boolean(e.isAsync) }
    }
  }));

  const diagnostics = ArchitectureTopologyLinter.lint(linterNodes, linterEdges);
  const antiPatterns: AntiPatternWarning[] = diagnostics.map((diag) => ({
    id: `diag_${diag.ruleId}_${diag.affectedNodeIds.join('_')}`,
    type:
      diag.ruleId === 'SYNC_RPC_CYCLE' ? 'cyclic_dependency' :
      diag.ruleId === 'DIRECT_DB_INGRESS' || diag.ruleId === 'UNBUFFERED_ANALYTICAL_WRITE' ? 'unbuffered_db_write' :
      diag.ruleId === 'MISSING_CIRCUIT_BREAKER' ? 'cascading_timeout' : 'spof',
    severity: diag.severity === 'error' ? 'critical' : 'warning',
    title: diag.message.split(':')[0] || diag.ruleId,
    description: diag.message,
    affectedNodeIds: diag.affectedNodeIds
  }));

  return { antiPatterns, spofMap: computeSpofMap(nodes, edges) };
}

function computeSpofMap(nodes: GraphNodeLike[], edges: GraphEdgeLike[]): Map<string, SpofNodeAnalysis> {
  const result = new Map<string, SpofNodeAnalysis>();
  if (nodes.length <= 2) {
    for (const n of nodes) {
      result.set(n.id, { isSpof: false, isArticulationPoint: false, hasRedundancy: (n.data?.config?.replicas || 1) > 1 });
    }
    return result;
  }

  const adj = new Map<string, Set<string>>();
  for (const n of nodes) adj.set(n.id, new Set());
  for (const e of edges) {
    adj.get(e.source)?.add(e.target);
    adj.get(e.target)?.add(e.source);
  }

  const ingressIds = new Set<string>();
  const storageIds = new Set<string>();
  for (const n of nodes) {
    const nt = n.data?.nodeType || n.type || '';
    if (nt === 'client' || nt === 'gateway') ingressIds.add(n.id);
    if (nt === 'database' || nt === 'blob_storage' || nt === 'queue') storageIds.add(n.id);
  }

  const canAllIngressReachStorageWithout = (excludedId: string): boolean => {
    if (ingressIds.size === 0 || storageIds.size === 0) return true;
    // If the excluded node is the sole ingress entry point, removing it disconnects all traffic from storage.
    if (ingressIds.has(excludedId) && ingressIds.size === 1) {
      return storageIds.size === 1 && storageIds.has(excludedId);
    }
    for (const ingressId of ingressIds) {
      if (ingressId === excludedId) continue;
      const visited = new Set<string>([excludedId, ingressId]);
      const queue = [ingressId];
      let reached = false;
      while (queue.length > 0) {
        const curr = queue.shift()!;
        if (storageIds.has(curr) && curr !== excludedId) { reached = true; break; }
        for (const next of adj.get(curr) || []) {
          if (!visited.has(next)) { visited.add(next); queue.push(next); }
        }
      }
      if (!reached) return false;
    }
    return true;
  };

  for (const n of nodes) {
    const replicas = n.data?.config?.replicas ?? 1;
    const hasRedundancy = replicas > 1;
    const nt = n.data?.nodeType || n.type || '';
    if (nt === 'client') {
      result.set(n.id, { isSpof: false, isArticulationPoint: false, hasRedundancy: true });
      continue;
    }
    const isArticulationPoint = !canAllIngressReachStorageWithout(n.id);
    const isSpof = isArticulationPoint && !hasRedundancy;
    const reason = isSpof
      ? `Узел «${n.data?.label || n.id}» не имеет репликации (${replicas}x) и является критическим звеном. Его отказ полностью изолирует клиентов от данных.`
      : isArticulationPoint && hasRedundancy
      ? `Критический узел, но защищен пулом реплик (${replicas}x).`
      : undefined;
    result.set(n.id, { isSpof, reason, isArticulationPoint, hasRedundancy });
  }
  return result;
}
