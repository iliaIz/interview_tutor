import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { seedCanonicalManifests } from './scenarioLoader';
import { resolveJsonCatalogPath } from '../utils/pathResolver';

/**
 * Seeding utilities for coding challenges, system design, incident triage, and roadmaps.
 * Cognitive bounding limit: <= 350 lines.
 */

export function seedQuestionsFromJSON(db: Database.Database) {
  const jsonPath = resolveJsonCatalogPath('all_interview_questions.json');

  if (!fs.existsSync(jsonPath)) {
    console.log('⚠️ JSON source file not found at path:', jsonPath);
    return;
  }

  console.log('🌱 Syncing database questions from JSON:', jsonPath);
  const rawData = fs.readFileSync(jsonPath, 'utf-8');
  const questions = JSON.parse(rawData);

  const upsertStmt = db.prepare(`
    INSERT INTO questions (id, global_id, num, topic, question, answer, source_pages)
    VALUES (@id, @global_id, @num, @topic, @question, @answer, @source_pages)
    ON CONFLICT(id) DO UPDATE SET
      global_id = excluded.global_id,
      num = excluded.num,
      topic = excluded.topic,
      question = excluded.question,
      answer = excluded.answer,
      source_pages = excluded.source_pages
  `);

  const syncAll = db.transaction((qs: any[]) => {
    for (const q of qs) {
      upsertStmt.run({
        id: q.id,
        global_id: q.global_id,
        num: q.num,
        topic: q.topic,
        question: q.question,
        answer: q.answer,
        source_pages: JSON.stringify(q.source_pages || [])
      });
    }
  });

  syncAll(questions);
  console.log(`✅ Database synced with ${questions.length} questions from enhorse/java-interview!`);

  const alfaPath = resolveJsonCatalogPath('alfa_interview_questions.json');
  if (fs.existsSync(alfaPath)) {
    try {
      const rawAlfa = fs.readFileSync(alfaPath, 'utf-8');
      const alfaQuestions = JSON.parse(rawAlfa);
      syncAll(alfaQuestions);
      console.log(`✅ Seeded ${alfaQuestions.length} curated Alfa Digital questions into questions table`);
    } catch (err) {
      console.error('Failed to seed alfa_interview_questions:', err);
    }
  }
}

export function seedCodingChallenges(db: Database.Database) {
  try {
    const { SEEDED_CHALLENGES } = require('./challengeSeedData');
    const upsertStmt = db.prepare(`
      INSERT INTO coding_challenges (
        id, slug, title, category, track, badge, difficulty, target_stack,
        time_limit_minutes, short_description, instructions_markdown, manifest_json, updated_at
      ) VALUES (
        @id, @slug, @title, @category, @track, @badge, @difficulty, @target_stack,
        @time_limit_minutes, @short_description, @instructions_markdown, @manifest_json, CURRENT_TIMESTAMP
      )
      ON CONFLICT(id) DO UPDATE SET
        slug = excluded.slug,
        title = excluded.title,
        category = excluded.category,
        track = excluded.track,
        badge = excluded.badge,
        difficulty = excluded.difficulty,
        target_stack = excluded.target_stack,
        time_limit_minutes = excluded.time_limit_minutes,
        short_description = excluded.short_description,
        instructions_markdown = excluded.instructions_markdown,
        manifest_json = excluded.manifest_json,
        updated_at = CURRENT_TIMESTAMP
    `);

    const TITLE_FIXES: Record<string, string> = {
      'lld-key-value-cache-ttl': 'In-Memory Key-Value Cache с TTL и LRU/LFU',
      'lld-task-scheduler-cron': 'Task Scheduler с Cron и Приоритетами',
      'lld-url-shortener': 'URL Shortener с Base62 и TTL',
      'lld-rate-limiting-gateway-priority': 'Rate Limiting Gateway с VIP-приоритетами',
    };

    const normalizeDifficulty = (raw: string): string => {
      const lower = (raw || 'middle').toLowerCase();
      if (lower.startsWith('lead')) return 'Lead';
      if (lower.startsWith('senior')) return 'Senior';
      if (lower.startsWith('junior')) return 'Junior';
      return 'Middle';
    };

    const syncAll = db.transaction((challenges: any[]) => {
      for (const ch of challenges) {
        const cleanTitle = TITLE_FIXES[ch.id] || ch.title;
        const cleanDiff = normalizeDifficulty(ch.difficulty);
        upsertStmt.run({
          id: ch.id,
          slug: ch.slug || ch.id,
          title: cleanTitle,
          category: ch.category || 'machine_coding',
          track: ch.track || 'lld_bigtech',
          badge: ch.badge || (ch.track === 'lld_fintech' ? '💳 FinTech' : ch.track === 'lld_concurrency' ? '⚡ Concurrency' : '🏛️ LLD'),
          difficulty: cleanDiff,
          target_stack: ch.targetStack || ch.techStack || 'Java 21 LTS',
          time_limit_minutes: ch.timeLimitMinutes || 45,
          short_description: ch.shortDescription || (ch.scenarioMarkdown ? ch.scenarioMarkdown.slice(0, 150) + '...' : cleanTitle),
          instructions_markdown: ch.instructionsMarkdown || ch.scenarioMarkdown || '',
          manifest_json: JSON.stringify(ch)
        });
      }
    });

    syncAll(SEEDED_CHALLENGES);

    // Also load and sync SOTA LLD challenges from machine_coding_challenges.json
    const lldJsonPaths = [
      path.join(__dirname, '../../../json/machine_coding_challenges.json'),
      path.join(__dirname, '../../json/machine_coding_challenges.json'),
      path.join(process.cwd(), 'json/machine_coding_challenges.json')
    ];
    const lldPath = lldJsonPaths.find(p => fs.existsSync(p));
    if (lldPath) {
      const lldChallenges = JSON.parse(fs.readFileSync(lldPath, 'utf-8'));
      syncAll(lldChallenges);
      console.log(`✅ Seeded ${lldChallenges.length} SOTA Machine Coding & LLD challenges from JSON`);
    }

    // Also load and sync Enterprise Refactoring Katas from refactoring_challenges.json (SPEC-13)
    const refactorJsonPaths = [
      path.join(__dirname, '../../../json/refactoring_challenges.json'),
      path.join(__dirname, '../../json/refactoring_challenges.json'),
      path.join(process.cwd(), 'json/refactoring_challenges.json')
    ];
    const refactorPath = refactorJsonPaths.find(p => fs.existsSync(p));
    if (refactorPath) {
      const refactorChallenges = JSON.parse(fs.readFileSync(refactorPath, 'utf-8'));
      syncAll(refactorChallenges);
      console.log(`✅ Seeded ${refactorChallenges.length} Enterprise Refactoring Katas from JSON`);
    }

    // Assign deterministic task codes: TST-01..TST-42 and LLD-01..LLD-55
    const diffOrder: Record<string, number> = { Junior: 0, Middle: 1, Senior: 2, Lead: 3 };
    const updateCodeStmt = db.prepare('UPDATE coding_challenges SET task_code = ? WHERE id = ?');

    const assignCodes = db.transaction(() => {
      const testingRows = db.prepare("SELECT id, difficulty FROM coding_challenges WHERE track = 'testing_mutation'").all() as Array<{ id: string; difficulty: string }>;
      testingRows.sort((a, b) => (diffOrder[a.difficulty] ?? 99) - (diffOrder[b.difficulty] ?? 99) || a.id.localeCompare(b.id));
      testingRows.forEach((row, idx) => {
        const code = `TST-${String(idx + 1).padStart(2, '0')}`;
        updateCodeStmt.run(code, row.id);
      });

      const lldRows = db.prepare("SELECT id, difficulty FROM coding_challenges WHERE track != 'testing_mutation'").all() as Array<{ id: string; difficulty: string }>;
      lldRows.sort((a, b) => (diffOrder[a.difficulty] ?? 99) - (diffOrder[b.difficulty] ?? 99) || a.id.localeCompare(b.id));
      lldRows.forEach((row, idx) => {
        const code = `LLD-${String(idx + 1).padStart(2, '0')}`;
        updateCodeStmt.run(code, row.id);
      });
    });

    assignCodes();
    console.log(`✅ Seeded premier coding challenges and task codes into SQLite DB`);
  } catch (err) {
    console.error('Error seeding coding challenges:', err);
  }
}

export function seedNextGenCatalogs(db: Database.Database) {
  try {
    const resolveJsonPath = (filename: string) => {
      const p = resolveJsonCatalogPath(filename);
      return fs.existsSync(p) ? p : undefined;
    };

    // 1. System Design: SSOT Canonical Manifests
    seedCanonicalManifests(db);

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

    // 5. Design Patterns Katas
    const dpPath = resolveJsonPath('design_patterns_challenges.json');
    if (dpPath) {
      const dpChallenges = JSON.parse(fs.readFileSync(dpPath, 'utf-8'));
      const upsertDp = db.prepare(`
        INSERT INTO coding_challenges (
          id, slug, title, category, track, badge, difficulty, target_stack,
          time_limit_minutes, short_description, instructions_markdown, manifest_json, task_code, updated_at
        ) VALUES (
          @id, @slug, @title, @category, @track, @badge, @difficulty, @target_stack,
          @time_limit_minutes, @short_description, @instructions_markdown, @manifest_json, @task_code, CURRENT_TIMESTAMP
        )
        ON CONFLICT(id) DO UPDATE SET
          slug = excluded.slug,
          title = excluded.title,
          category = excluded.category,
          track = excluded.track,
          badge = excluded.badge,
          difficulty = excluded.difficulty,
          target_stack = excluded.target_stack,
          time_limit_minutes = excluded.time_limit_minutes,
          short_description = excluded.short_description,
          instructions_markdown = excluded.instructions_markdown,
          manifest_json = excluded.manifest_json,
          task_code = excluded.task_code,
          updated_at = CURRENT_TIMESTAMP
      `);
      const syncDp = db.transaction((items: any[]) => {
        let idx = 1;
        for (const ch of items) {
          const taskCode = ch.taskCode || `DP-${String(idx++).padStart(2, '0')}`;
          upsertDp.run({
            id: ch.id,
            slug: ch.slug || ch.id,
            title: ch.title,
            category: 'design_patterns',
            track: 'design_patterns',
            badge: ch.badge || '🏛️ Design Patterns',
            difficulty: ch.difficulty || 'Middle',
            target_stack: ch.targetStack || 'Java 21 LTS',
            time_limit_minutes: ch.estimatedMinutes || 45,
            short_description: ch.shortDescription || ch.title,
            instructions_markdown: ch.instructionsMarkdown || '',
            manifest_json: JSON.stringify(ch),
            task_code: taskCode
          });
        }
      });
      syncDp(dpChallenges);
      console.log(`✅ Seeded ${dpChallenges.length} SOTA 2026 Design Pattern Katas into SQLite`);
    }
  } catch (err) {
    console.error('Error seeding Next-Gen catalogs:', err);
  }
}
