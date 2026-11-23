import { db } from './db';
import { resolveScenarioManifest, resolveCanonicalId } from './scenarioResolver';

export interface SystemDesignScenarioFilter {
  category?: string;
  search?: string;
  level?: string;
}

export class SystemDesignCatalog {
  static listScenarios(filter: SystemDesignScenarioFilter = {}): any[] {
    const { category, search, level } = filter;

    const countRow = db.prepare('SELECT COUNT(*) as count FROM system_design_manifests').get() as any;
    if (countRow && countRow.count > 0) {
      let query = 'SELECT canonical_id, target_level, archetype, title, subtitle, pedagogical_mode, manifest_json FROM system_design_manifests WHERE 1=1';
      const params: any[] = [];

      if (level && typeof level === 'string' && level !== 'all') {
        query += ' AND target_level = ?';
        params.push(level.toUpperCase());
      }
      if (category && typeof category === 'string' && category !== 'all') {
        query += ' AND (archetype = ? OR target_level = ?)';
        params.push(category, category);
      }
      if (search && typeof search === 'string' && search.trim()) {
        query += ' AND (title LIKE ? OR problem_statement LIKE ? OR archetype LIKE ?)';
        params.push(`%${search.trim()}%`, `%${search.trim()}%`, `%${search.trim()}%`);
      }

      query += ' ORDER BY target_level ASC, canonical_id ASC';
      const rows = db.prepare(query).all(...params) as any[];
      return rows.map((r) => {
        try {
          return JSON.parse(r.manifest_json);
        } catch {
          return r;
        }
      });
    }

    // Fallback if no canonical manifests
    let query = 'SELECT id, scenario_number, slug, title, category, difficulty, manifest_json FROM system_design_challenges WHERE 1=1';
    const params: any[] = [];

    if (category && typeof category === 'string' && category !== 'all') {
      query += ' AND category = ?';
      params.push(category);
    }
    if (search && typeof search === 'string' && search.trim()) {
      query += ' AND (title LIKE ? OR category LIKE ?)';
      params.push(`%${search.trim()}%`, `%${search.trim()}%`);
    }

    query += ' ORDER BY scenario_number ASC';
    const rows = db.prepare(query).all(...params) as any[];

    return rows.map((r) => {
      let item: any;
      try {
        item = JSON.parse(r.manifest_json);
      } catch {
        item = r;
      }
      if (!item.target_level) {
        const lvl = item.level || '';
        const diff = (item.difficulty || '').toLowerCase();
        const id = (item.canonical_id || item.id || '').toLowerCase();
        if (lvl === 'L0' || diff === 'junior' || id.startsWith('hld-micro')) {
          item.target_level = 'L3_JUNIOR';
        } else if (lvl === 'L2' || id.includes('faded')) {
          item.target_level = 'L4_MIDDLE';
        } else if (lvl === 'L3' || diff === 'senior' || diff === 'lead' || id.startsWith('hld-scenario')) {
          item.target_level = diff === 'lead' ? 'L6_STAFF' : 'L5_SENIOR';
        } else {
          item.target_level = 'L5_SENIOR';
        }
      }
      return item;
    });
  }

  static getScenarioById(scenarioId: string): any | null {
    return resolveScenarioManifest(scenarioId);
  }

  static getSubmission(scenarioId: string, userId: string): any | null {
    const canonicalId = resolveCanonicalId(scenarioId);
    const row: any = db.prepare(`
      SELECT id, scenario_id, user_id, architecture_mermaid, notes_markdown, evaluation_json, created_at
      FROM system_design_submissions
      WHERE (scenario_id = ? OR scenario_id = ?) AND user_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `).get(scenarioId, canonicalId, userId);

    if (!row) return null;

    let parsedTopology = null;
    let architectureMermaid = null;
    try {
      if (row.architecture_mermaid) {
        const parsed = JSON.parse(row.architecture_mermaid);
        if (parsed && typeof parsed === 'object' && (parsed.nodes || parsed.edges)) {
          parsedTopology = parsed;
        } else {
          architectureMermaid = row.architecture_mermaid;
        }
      }
    } catch (_) {
      architectureMermaid = row.architecture_mermaid;
    }

    let parsedEvaluation = null;
    try {
      if (row.evaluation_json) parsedEvaluation = JSON.parse(row.evaluation_json);
    } catch (_) {}

    return {
      id: row.id,
      scenarioId: row.scenario_id,
      canvasTopology: parsedTopology,
      architectureMermaid,
      architectureNotes: row.notes_markdown,
      candidateNotes: row.notes_markdown,
      evaluation: parsedEvaluation,
      evaluationJson: row.evaluation_json,
      createdAt: row.created_at
    };
  }

  static getLedgerProgress(scenarioId: string, userId: string): any | null {
    const canonicalId = resolveCanonicalId(scenarioId);
    const row: any = db.prepare(`
      SELECT id, user_id, canonical_id, studio_stage, status, score, artifacts_json, created_at, updated_at
      FROM user_progress_ledger
      WHERE canonical_id = ? AND user_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `).get(canonicalId, userId);

    if (!row) return null;

    let parsedArtifacts = null;
    try {
      if (row.artifacts_json) parsedArtifacts = JSON.parse(row.artifacts_json);
    } catch (_) {}

    return {
      id: row.id,
      userId: row.user_id,
      canonicalId: row.canonical_id,
      studioStage: row.studio_stage,
      status: row.status,
      score: row.score,
      artifacts: parsedArtifacts,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}
