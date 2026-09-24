import { db } from './db';

/**
 * Resolves scenario manifest in O(1):
 * 1. Checks system_design_aliases (dual keys, 49 historic roadmap IDs)
 * 2. Checks canonical system_design_manifests
 * 3. Fallback to legacy system_design_challenges for backward compatibility
 */
export function resolveScenarioManifest(scenarioId: string): any | null {
  // 1. Dual-key alias lookup
  const aliasRow = db.prepare('SELECT canonical_id FROM system_design_aliases WHERE alias = ?').get(scenarioId) as any;
  const canonicalId = aliasRow ? aliasRow.canonical_id : scenarioId;

  // 2. Canonical manifests table lookup
  const manifestRow = db.prepare('SELECT manifest_json FROM system_design_manifests WHERE canonical_id = ?').get(canonicalId) as any;
  if (manifestRow) {
    try {
      return JSON.parse(manifestRow.manifest_json);
    } catch {
      return null;
    }
  }

  // 3. Fallback to legacy challenges table
  const legacyRow = db.prepare('SELECT manifest_json FROM system_design_challenges WHERE id = ? OR slug = ?').get(scenarioId, scenarioId) as any;
  if (legacyRow) {
    try {
      return JSON.parse(legacyRow.manifest_json);
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Resolves the canonical ID for a given scenario alias or ID.
 */
export function resolveCanonicalId(scenarioId: string): string {
  const aliasRow = db.prepare('SELECT canonical_id FROM system_design_aliases WHERE alias = ?').get(scenarioId) as any;
  return aliasRow ? aliasRow.canonical_id : scenarioId;
}
