import path from 'path';
import fs from 'fs';
import { db } from '../connection';

export function seedNextGenCatalogs() {
  try {
    const resolveJsonPath = (filename: string) => {
      const paths = [
        path.join(process.cwd(), `json/${filename}`),
        path.join(__dirname, `../../../../../json/${filename}`),
        path.join(__dirname, `../../../../json/${filename}`),
        path.join(__dirname, `../../../json/${filename}`)
      ];
      return paths.find((p) => fs.existsSync(p));
    };

    // 1. System Design
    const sdPath = resolveJsonPath('system_design_scenarios.json');
    if (sdPath) {
      const scenarios = JSON.parse(fs.readFileSync(sdPath, 'utf-8'));
      const upsertSd = db.prepare(`
        INSERT INTO system_design_challenges (id, scenario_number, slug, title, category, difficulty, manifest_json, updated_at)
        VALUES (@id, @scenario_number, @slug, @title, @category, @difficulty, @manifest_json, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET
          scenario_number = excluded.scenario_number,
          slug = excluded.slug,
          title = excluded.title,
          category = excluded.category,
          difficulty = excluded.difficulty,
          manifest_json = excluded.manifest_json,
          updated_at = CURRENT_TIMESTAMP
      `);
      const syncSd = db.transaction((items: any[]) => {
        for (const sc of items) {
          upsertSd.run({
            id: sc.id,
            scenario_number: sc.scenarioNumber || 1,
            slug: sc.slug || sc.id,
            title: sc.title,
            category: sc.category || 'Distributed Systems',
            difficulty: sc.difficulty || 'senior',
            manifest_json: JSON.stringify(sc)
          });
        }
      });
      syncSd(scenarios);
      console.log(`✅ Seeded ${scenarios.length} System Design scenarios into SQLite`);
    }

    // 2. Production Triage
    const triagePath = resolveJsonPath('production_triage_challenges.json');
    if (triagePath) {
      const incidents = JSON.parse(fs.readFileSync(triagePath, 'utf-8'));
      const upsertTriage = db.prepare(`
        INSERT INTO production_triage_challenges (id, incident_number, slug, title, category, severity, manifest_json, updated_at)
        VALUES (@id, @incident_number, @slug, @title, @category, @severity, @manifest_json, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET
          incident_number = excluded.incident_number,
          slug = excluded.slug,
          title = excluded.title,
          category = excluded.category,
          severity = excluded.severity,
          manifest_json = excluded.manifest_json,
          updated_at = CURRENT_TIMESTAMP
      `);
      const syncTriage = db.transaction((items: any[]) => {
        for (const inc of items) {
          upsertTriage.run({
            id: inc.id,
            incident_number: inc.incidentNumber || 1,
            slug: inc.slug || inc.id,
            title: inc.title,
            category: inc.category || 'Production Forensics',
            severity: inc.severity || 'CRITICAL',
            manifest_json: JSON.stringify(inc)
          });
        }
      });
      syncTriage(incidents);
      console.log(`✅ Seeded ${incidents.length} Production Triage cases into SQLite`);
    }

    // 3. Guided Roadmaps
    const roadmapsPath = resolveJsonPath('guided_roadmaps.json');
    if (roadmapsPath) {
      const roadmaps = JSON.parse(fs.readFileSync(roadmapsPath, 'utf-8'));
      const upsertRm = db.prepare(`
        INSERT INTO guided_roadmaps (id, title, category, total_steps, manifest_json, updated_at)
        VALUES (@id, @title, @category, @total_steps, @manifest_json, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET
          title = excluded.title,
          category = excluded.category,
          total_steps = excluded.total_steps,
          manifest_json = excluded.manifest_json,
          updated_at = CURRENT_TIMESTAMP
      `);
      const syncRm = db.transaction((items: any[]) => {
        const activeIds = items.map((r: any) => r.id);
        if (activeIds.length > 0) {
          const placeholders = activeIds.map(() => '?').join(',');
          db.prepare(`DELETE FROM guided_roadmaps WHERE id NOT IN (${placeholders})`).run(...activeIds);
        }

        for (const rm of items) {
          upsertRm.run({
            id: rm.id,
            title: rm.title,
            category: rm.category || 'career',
            total_steps: rm.totalSteps || 25,
            manifest_json: JSON.stringify(rm)
          });
        }
      });
      syncRm(roadmaps);
      console.log(`✅ Seeded ${roadmaps.length} Master Academy Programs (Career & Domain) into SQLite`);
    }

    // 4. Spring Transaction Scenarios
    const txPath = resolveJsonPath('spring_transaction_scenarios.json');
    if (txPath) {
      const txScenarios = JSON.parse(fs.readFileSync(txPath, 'utf-8'));
      const upsertTx = db.prepare(`
        INSERT INTO spring_transaction_challenges (id, scenario_number, slug, title, domain, difficulty, badge, manifest_json, updated_at)
        VALUES (@id, @scenario_number, @slug, @title, @domain, @difficulty, @badge, @manifest_json, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET
          scenario_number = excluded.scenario_number,
          slug = excluded.slug,
          title = excluded.title,
          domain = excluded.domain,
          difficulty = excluded.difficulty,
          badge = excluded.badge,
          manifest_json = excluded.manifest_json,
          updated_at = CURRENT_TIMESTAMP
      `);
      const syncTx = db.transaction((items: any[]) => {
        let num = 1;
        for (const sc of items) {
          upsertTx.run({
            id: sc.id,
            scenario_number: num++,
            slug: sc.id,
            title: sc.title,
            domain: sc.domain || 'Enterprise Transactions',
            difficulty: sc.difficulty || 'Middle',
            badge: sc.badge || 'Spring TX',
            manifest_json: JSON.stringify(sc)
          });
        }
      });
      syncTx(txScenarios);
      console.log(`✅ Seeded ${txScenarios.length} Spring Transaction scenarios into SQLite`);
    }
  } catch (err) {
    console.error('Error seeding Next-Gen catalogs:', err);
  }
}
