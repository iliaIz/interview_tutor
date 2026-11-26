import {
  CompassRule,
  TESTING_COMPASS_RULES,
  LLD_COMPASS_RULES,
  TRANSACTION_COMPASS_RULES,
  CONCURRENCY_COMPASS_RULES,
  REFACTORING_COMPASS_RULES
} from '../prompts/practiceTutorPrompts';

/**
 * compassRuleResolver.ts
 * Cross-compass rule lookup across all 5 Practice Compasses with legacy UI alias compatibility.
 * Cognitive bounding limit: <= 80 lines.
 */

const COMPASS_RULE_SOURCES: Array<{ map: Record<string, CompassRule>; defaultCategory: string }> = [
  { map: TESTING_COMPASS_RULES, defaultCategory: 'Testing & Mutation Katas' },
  { map: LLD_COMPASS_RULES, defaultCategory: 'Low-Level Design (LLD)' },
  { map: TRANSACTION_COMPASS_RULES, defaultCategory: 'Transactions' },
  { map: CONCURRENCY_COMPASS_RULES, defaultCategory: 'Concurrency Lab' },
  { map: REFACTORING_COMPASS_RULES, defaultCategory: 'Refactoring Katas' }
];

const LEGACY_COMPASS_RULE_ALIASES: Record<string, string> = {
  LOCK_FREE_DISRUPTOR: 'DISRUPTOR_LOCK_FREE',
  REPLACE_CONDITIONAL_POLYMORPHISM: 'REPLACE_CONDITIONAL_WITH_POLYMORPHISM',
  SMELL_REMEDIATION_DEMETER: 'SMELL_REMEDIATION',
  DEADLOCK_FREE_HIERARCHY: 'DEADLOCK_FREE_ORDERING'
};

export interface ResolvedCompassRule {
  rule: CompassRule;
  resolvedRuleId: string;
  defaultCategory: string;
}

export function resolveCompassRule(ruleId: string): ResolvedCompassRule | null {
  if (!ruleId) return null;
  const lookupId = LEGACY_COMPASS_RULE_ALIASES[ruleId] || ruleId;
  for (const { map, defaultCategory } of COMPASS_RULE_SOURCES) {
    if (map[lookupId]) {
      return { rule: map[lookupId], resolvedRuleId: lookupId, defaultCategory };
    }
    const entry = Object.entries(map).find(([, r]) => r.id === lookupId);
    if (entry) {
      return { rule: entry[1], resolvedRuleId: entry[0], defaultCategory };
    }
  }
  return null;
}
