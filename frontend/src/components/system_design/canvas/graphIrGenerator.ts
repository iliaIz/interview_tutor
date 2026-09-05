import { Node, Edge } from '@xyflow/react';

/**
 * Calculates a fast, deterministic hash signature for canvas nodes and edges.
 * Unlike [nodes.length, edges.length], this changes whenever component configuration,
 * replicas, protocols, or connection directions change.
 */
export function calculateTopologySignature(nodes: Node[], edges: Edge[]): string {
  const nodeParts: string[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    const cfg = (n.data as any)?.config || {};
    nodeParts.push(
      `${n.id}:${n.type || (n.data as any)?.nodeType}:${cfg.replicas ?? 1}:${cfg.serviceRateMu ?? 100}:${cfg.threadPool ?? 50}:${cfg.partitions ?? 1}:${cfg.cacheHitRatio ?? 0}`
    );
  }
  nodeParts.sort();

  const edgeParts: string[] = [];
  for (let i = 0; i < edges.length; i++) {
    const e = edges[i];
    const cfg = (e.data as any)?.config || {};
    edgeParts.push(
      `${e.source}->${e.target}:${cfg.protocol || (e.data as any)?.protocol || 'REST'}:${cfg.isAsync || (e.data as any)?.isAsync ? 1 : 0}:${cfg.trafficWeight ?? 1.0}`
    );
  }
  edgeParts.sort();

  return `${nodeParts.join('|')}#${edgeParts.join('|')}`;
}

/**
 * Generates a compact Micro-Graph Adjacency IR DSL for Gemini Live deictic multimodal grounding.
 * Formats topology into dense, token-efficient adjacency lines:
 * Example:
 * GRAPH_ADJACENCY:
 * - [client] node-client (rps=2000) -> node-gateway (REST)
 * - [gateway] node-gateway (replicas=2) -> node-service (gRPC)
 * - [service] node-service (replicas=4, mu=200) -> node-cache (Redis), node-db (JDBC)
 */
export function generateGraphAdjacencyIr(nodes: Node[], edges: Edge[]): string {
  if (!nodes || nodes.length === 0) {
    return 'GRAPH_ADJACENCY: (empty)';
  }

  const outgoingMap = new Map<string, Array<{ targetId: string; targetLabel: string; protocol: string; isAsync: boolean }>>();
  const nodeById = new Map<string, Node>();

  for (const n of nodes) {
    nodeById.set(n.id, n);
    outgoingMap.set(n.id, []);
  }

  for (const e of edges) {
    const targetNode = nodeById.get(e.target);
    const targetLabel = (targetNode?.data as any)?.label || targetNode?.id || e.target;
    const cfg = (e.data as any)?.config || {};
    const protocol = cfg.protocol || (e.data as any)?.protocol || 'REST';
    const isAsync = Boolean(cfg.isAsync || (e.data as any)?.isAsync);

    const list = outgoingMap.get(e.source);
    if (list) {
      list.push({ targetId: e.target, targetLabel, protocol, isAsync });
    }
  }

  const lines: string[] = ['GRAPH_ADJACENCY:'];

  for (const n of nodes) {
    const nodeType = (n.data as any)?.nodeType || n.type || 'service';
    const label = (n.data as any)?.label || n.id;
    const cfg = (n.data as any)?.config || {};

    const attributes: string[] = [];
    if (cfg.replicas && cfg.replicas > 1) attributes.push(`replicas=${cfg.replicas}`);
    if (cfg.serviceRateMu) attributes.push(`mu=${cfg.serviceRateMu}`);
    if (cfg.cacheHitRatio !== undefined) attributes.push(`hit_rate=${cfg.cacheHitRatio}`);
    if (cfg.partitions) attributes.push(`partitions=${cfg.partitions}`);
    if (cfg.technology) attributes.push(`tech=${cfg.technology}`);

    const attrStr = attributes.length > 0 ? ` (${attributes.join(', ')})` : '';
    const outgoing = outgoingMap.get(n.id) || [];

    if (outgoing.length === 0) {
      lines.push(`- [${nodeType}] ${label}${attrStr}`);
    } else {
      const targetsStr = outgoing
        .map(out => `${out.targetLabel} (${out.isAsync ? 'async ' : ''}${out.protocol})`)
        .join(', ');
      lines.push(`- [${nodeType}] ${label}${attrStr} -> ${targetsStr}`);
    }
  }

  return lines.join('\n');
}

/**
 * Converts React Flow canvas topology into valid Mermaid TD format.
 */
export function convertCanvasToMermaid(nodes: Node[], edges: Edge[]): string {
  if (!nodes || nodes.length === 0) {
    return 'graph TD\n  empty["Пустая архитектура"]';
  }

  const lines: string[] = ['graph TD'];

  for (const n of nodes) {
    const label = (n.data as any)?.label || n.id;
    const type = (n.data as any)?.nodeType || n.type || 'service';
    const cleanId = n.id.replace(/[^a-zA-Z0-9_]/g, '_');
    lines.push(`  ${cleanId}["[${type}] ${label}"]`);
  }

  for (const e of edges) {
    const srcId = e.source.replace(/[^a-zA-Z0-9_]/g, '_');
    const tgtId = e.target.replace(/[^a-zA-Z0-9_]/g, '_');
    const cfg = (e.data as any)?.config || {};
    const proto = cfg.protocol || (e.data as any)?.protocol || 'calls';
    const isAsync = Boolean(cfg.isAsync || (e.data as any)?.isAsync);
    const arrow = isAsync ? `-. ${proto} .->` : `-->|${proto}|`;
    lines.push(`  ${srcId} ${arrow} ${tgtId}`);
  }

  return lines.join('\n');
}
