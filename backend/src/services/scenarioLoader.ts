import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { ChallengeManifestSchema, Value, type ChallengeManifest } from '@interview-prep/shared';

function findManifestDir(): string | null {
  const candidates = [
    path.resolve(process.cwd(), 'scenarios/manifests'),
    path.resolve(__dirname, '../../../scenarios/manifests'),
    path.resolve(__dirname, '../../scenarios/manifests'),
    path.resolve(__dirname, '../scenarios/manifests'),
  ];
  for (const cand of candidates) {
    if (fs.existsSync(cand) && fs.statSync(cand).isDirectory()) {
      return cand;
    }
  }
  return null;
}

function scanJsonFiles(dir: string): string[] {
  let files: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(scanJsonFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      files.push(fullPath);
    }
  }
  return files;
}

export interface SeedResult {
  manifestsSeeded: number;
  aliasesSeeded: number;
  errors: string[];
}

/**
 * Сканирует файловую систему на наличие канонических манифестов (26 шт.),
 * валидирует их по схеме ChallengeManifestSchema через TypeBox и сеет в SQLite:
 * 1. system_design_manifests (основные манифесты)
 * 2. system_design_aliases (дуальные ключи: маппинг 49 старых roadmap ID на канонические)
 */
export function seedCanonicalManifests(db: Database.Database): SeedResult {
  const manifestDir = findManifestDir();
  if (!manifestDir) {
    console.warn('⚠️ [scenarioLoader] Manifest directory not found, skipping manifest seed.');
    return { manifestsSeeded: 0, aliasesSeeded: 0, errors: ['Manifest directory not found'] };
  }

  const files = scanJsonFiles(manifestDir);
  const errors: string[] = [];
  let manifestsSeeded = 0;
  let aliasesSeeded = 0;

  const upsertManifest = db.prepare(`
    INSERT INTO system_design_manifests (
      canonical_id, version, target_level, archetype, title, subtitle, problem_statement, pedagogical_mode, manifest_json, updated_at
    ) VALUES (
      @canonical_id, @version, @target_level, @archetype, @title, @subtitle, @problem_statement, @pedagogical_mode, @manifest_json, CURRENT_TIMESTAMP
    ) ON CONFLICT(canonical_id) DO UPDATE SET
      version = excluded.version,
      target_level = excluded.target_level,
      archetype = excluded.archetype,
      title = excluded.title,
      subtitle = excluded.subtitle,
      problem_statement = excluded.problem_statement,
      pedagogical_mode = excluded.pedagogical_mode,
      manifest_json = excluded.manifest_json,
      updated_at = CURRENT_TIMESTAMP
  `);

  const upsertAlias = db.prepare(`
    INSERT INTO system_design_aliases (alias, canonical_id)
    VALUES (@alias, @canonical_id)
    ON CONFLICT(alias) DO UPDATE SET canonical_id = excluded.canonical_id
  `);

  const transaction = db.transaction((manifestList: ChallengeManifest[]) => {
    for (const manifest of manifestList) {
      upsertManifest.run({
        canonical_id: manifest.canonical_id,
        version: manifest.version,
        target_level: manifest.target_level,
        archetype: manifest.archetype,
        title: manifest.title,
        subtitle: manifest.subtitle || '',
        problem_statement: manifest.problem_statement,
        pedagogical_mode: manifest.pedagogical_mode,
        manifest_json: JSON.stringify(manifest)
      });
      manifestsSeeded++;

      if (Array.isArray(manifest.legacy_aliases)) {
        for (const alias of manifest.legacy_aliases) {
          upsertAlias.run({
            alias,
            canonical_id: manifest.canonical_id
          });
          aliasesSeeded++;
        }
      }
    }
  });

  const validManifests: ChallengeManifest[] = [];

  for (const file of files) {
    try {
      const raw = fs.readFileSync(file, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Value.Check(ChallengeManifestSchema, parsed)) {
        validManifests.push(parsed as ChallengeManifest);
      } else {
        const firstError = Value.Errors(ChallengeManifestSchema, parsed).First();
        const msg = `Validation failed for ${path.basename(file)}: ${firstError?.message} at ${firstError?.path}`;
        console.error(`❌ [scenarioLoader] ${msg}`);
        errors.push(msg);
      }
    } catch (err: any) {
      const msg = `Failed to read ${file}: ${err?.message}`;
      console.error(`❌ [scenarioLoader] ${msg}`);
      errors.push(msg);
    }
  }

  if (validManifests.length > 0) {
    transaction(validManifests);
  }

  console.log(`✅ [scenarioLoader] Seeded ${manifestsSeeded} canonical manifests and ${aliasesSeeded} aliases into SQLite.`);
  return { manifestsSeeded, aliasesSeeded, errors };
}
