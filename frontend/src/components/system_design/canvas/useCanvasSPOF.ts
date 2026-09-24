import { useMemo } from 'react';
import { Node, Edge } from '@xyflow/react';
import { analyzeGraphSpof, SpofNodeAnalysis } from '../../../utils/spofAnalyzer';

/**
 * Hook to continuously compute Single Point of Failure (SPOF) nodes
 * and return enriched nodes with isSpof and spofReason flags.
 */
export function useCanvasSPOF(nodes: Node[], edges: Edge[]) {
  const spofMap = useMemo<Map<string, SpofNodeAnalysis>>(() => {
    return analyzeGraphSpof(
      nodes.map((n) => ({
        id: n.id,
        type: n.type,
        data: n.data as any
      })),
      edges.map((e) => ({
        source: e.source,
        target: e.target
      }))
    );
  }, [nodes, edges]);

  const enrichedNodes = useMemo(() => {
    let hasChanges = false;
    const nextNodes = nodes.map((node) => {
      const spof = spofMap.get(node.id);
      const isSpof = Boolean(spof?.isSpof);
      const spofReason = spof?.reason;

      const currentData = (node.data || {}) as any;
      if (currentData.isSpof !== isSpof || currentData.spofReason !== spofReason) {
        hasChanges = true;
        return {
          ...node,
          data: {
            ...currentData,
            isSpof,
            spofReason
          }
        };
      }
      return node;
    });

    return hasChanges ? nextNodes : nodes;
  }, [nodes, spofMap]);

  return { spofMap, enrichedNodes };
}
