import { ArchitectureTopologyGraph, LintDiagnostic } from './ArchitectureTopologyGraph';

export interface TopologyRule {
  readonly id: LintDiagnostic['ruleId'];
  evaluate(graph: ArchitectureTopologyGraph): LintDiagnostic[];
}
