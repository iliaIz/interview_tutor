import { NodeTypes, EdgeTypes } from '@xyflow/react';
import { BaseArchitectureNode } from './BaseArchitectureNode';
import { FlowEdge } from '../edges/FlowEdge';

/**
 * Shared System Design Node Types Registry
 * Single Source of Truth for React Flow canvas renders in:
 * - ArchitectureCanvas (Full Studio)
 * - FadedScaffoldingArena (Level 2 Incident Refactoring)
 */
export const systemDesignNodeTypes: NodeTypes = {
  client: BaseArchitectureNode,
  gateway: BaseArchitectureNode,
  service: BaseArchitectureNode,
  database: BaseArchitectureNode,
  cache: BaseArchitectureNode,
  queue: BaseArchitectureNode,
  blob_storage: BaseArchitectureNode,
  circuit_breaker: BaseArchitectureNode,
  default: BaseArchitectureNode
};

/**
 * Shared System Design Edge Types Registry
 */
export const systemDesignEdgeTypes: EdgeTypes = {
  flow: FlowEdge,
  default: FlowEdge
};
