import Database from 'better-sqlite3';
import { CodingChallenge } from '@interview-prep/shared';
import { seedCanonicalManifests } from '../scenarioLoader';
import { ChallengeCatalogLoader } from './ChallengeCatalogLoader';

/**
 * CatalogSeeder.ts
 * Atomic, idempotent SQLite catalog seeder backed by TypeBox-validated JSON catalogs.
 * Enforces disjoint TST / DP / LLD task_code partitioning to prevent DP-01..DP-07 clobbering.
 * Cognitive bounding limit: <= 280 lines.
 */

const TITLE_FIXES: Record<string, string> = {
  'lld-key-value-cache-ttl': 'In-Memory Key-Value Cache с TTL и LRU/LFU',
  'lld-task-scheduler-cron': 'Task Scheduler с Cron и Приоритетами',
  'lld-url-shortener': 'URL Shortener с Base62 и TTL',
  'lld-rate-limiting-gateway-priority': 'Rate Limiting Gateway с VIP-приоритетами'
};

const DIFFICULTY_ORDER: Record<string, number> = { Junior: 0, Middle: 1, Senior: 2, Lead: 3 };

function normalizeDifficulty(raw?: string): string {
  const lower = (raw || 'middle').toLowerCase();
  if (lower.startsWith('lead')) return 'Lead';
  if (lower.startsWith('senior')) return 'Senior';
  if (lower.startsWith('junior')) return 'Junior';
  return 'Middle';
}

export class CatalogSeeder {
  /**
   * Seeds base Java interview questions and curated Alfa Digital questions from root json/.
   */
  public static seedQuestionsFromJSON(db: Database.Database, catalogDir?: string): void {
    const questions = ChallengeCatalogLoader.loadJsonCatalogArray('all_interview_questions.json', catalogDir);
    if (!questions) {
      console.log('⚠️ JSON source file not found: all_interview_questions.json');
      return;
    }

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

    const syncQuestions = db.transaction((qs: any[]) => {
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

    syncQuestions(questions);
    console.log(`✅ Database synced with ${questions.length} questions from enhorse/java-interview!`);

    const alfaQuestions = ChallengeCatalogLoader.loadJsonCatalogArray('alfa_interview_questions.json', catalogDir);
    if (alfaQuestions) {
      syncQuestions(alfaQuestions);
      console.log(`✅ Seeded ${alfaQuestions.length} curated Alfa Digital questions into questions table`);
    }
  }

  private static upsertCodingChallenges(
    db: Database.Database,
    challenges: CodingChallenge[],
    mode: 'standard' | 'design_patterns'
  ): void {
    const upsertStmt = db.prepare(`
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
        task_code = COALESCE(excluded.task_code, coding_challenges.task_code),
        updated_at = CURRENT_TIMESTAMP
    `);

    challenges.forEach((ch, idx) => {
      const cleanTitle = TITLE_FIXES[ch.id] || ch.title;
      const cleanDiff = normalizeDifficulty(ch.difficulty);
      const isDp = mode === 'design_patterns';
      const defaultBadge = isDp
        ? '🏛️ Design Patterns'
        : ch.track === 'lld_fintech'
          ? '💳 FinTech'
          : ch.track === 'lld_concurrency'
            ? '⚡ Concurrency'
            : '🏛️ LLD';

      upsertStmt.run({
        id: ch.id,
        slug: ch.slug || ch.id,
        title: cleanTitle,
        category: isDp ? 'design_patterns' : (ch.category || 'machine_coding'),
        track: isDp ? 'design_patterns' : (ch.track || 'lld_bigtech'),
        badge: ch.badge || defaultBadge,
        difficulty: cleanDiff,
        target_stack: ch.targetStack || ch.techStack || 'Java 21 LTS',
        time_limit_minutes: ch.timeLimitMinutes || ch.estimatedMinutes || 45,
        short_description: ch.shortDescription || (ch.scenarioMarkdown ? ch.scenarioMarkdown.slice(0, 150) + '...' : cleanTitle),
        instructions_markdown: ch.instructionsMarkdown || ch.scenarioMarkdown || '',
        manifest_json: JSON.stringify(ch),
        task_code: isDp ? (ch.taskCode || `DP-${String(idx + 1).padStart(2, '0')}`) : null
      });
    });
  }

  /**
   * Assigns deterministic task codes across 3 strictly disjoint partitions inside one transaction:
   * 1) track = 'testing_mutation' -> TST-01..TST-N
   * 2) track = 'design_patterns' OR category = 'design_patterns' -> DP-01..DP-N
   * 3) Remaining coding challenges -> LLD-01..LLD-N
   */
  public static assignDisjointTaskCodes(db: Database.Database): void {
    const updateCodeStmt = db.prepare('UPDATE coding_challenges SET task_code = ? WHERE id = ?');
    const sortStandard = (rows: Array<{ id: string; difficulty: string }>) =>
      rows.sort((a, b) => (DIFFICULTY_ORDER[a.difficulty] ?? 99) - (DIFFICULTY_ORDER[b.difficulty] ?? 99) || a.id.localeCompare(b.id));

    const assign = db.transaction(() => {
      const tstRows = db.prepare(
        "SELECT id, difficulty FROM coding_challenges WHERE COALESCE(track, '') = 'testing_mutation'"
      ).all() as Array<{ id: string; difficulty: string }>;
      sortStandard(tstRows).forEach((row, idx) => {
        updateCodeStmt.run(`TST-${String(idx + 1).padStart(2, '0')}`, row.id);
      });

      const dpRows = db.prepare(
        "SELECT id, difficulty, task_code FROM coding_challenges WHERE COALESCE(track, '') != 'testing_mutation' AND (COALESCE(track, '') = 'design_patterns' OR COALESCE(category, '') = 'design_patterns')"
      ).all() as Array<{ id: string; difficulty: string; task_code: string | null }>;
      dpRows.sort((a, b) => (a.task_code || a.id).localeCompare(b.task_code || b.id) || a.id.localeCompare(b.id));
      dpRows.forEach((row, idx) => {
        updateCodeStmt.run(`DP-${String(idx + 1).padStart(2, '0')}`, row.id);
      });

      const lldRows = db.prepare(
        "SELECT id, difficulty FROM coding_challenges WHERE COALESCE(track, '') NOT IN ('testing_mutation', 'design_patterns') AND COALESCE(category, '') != 'design_patterns'"
      ).all() as Array<{ id: string; difficulty: string }>;
      sortStandard(lldRows).forEach((row, idx) => {
        updateCodeStmt.run(`LLD-${String(idx + 1).padStart(2, '0')}`, row.id);
      });
    });

    assign();
  }

  /**
   * Seeds Base, Additional LLD, Mutation, Machine Coding, and Refactoring catalogs atomically.
   */
  public static seedCodingChallenges(db: Database.Database, catalogDir?: string): void {
    const legacy = ChallengeCatalogLoader.loadLegacySeededChallenges(catalogDir);
    const machineCoding = ChallengeCatalogLoader.loadMachineCodingChallenges(catalogDir);
    const refactoring = ChallengeCatalogLoader.loadRefactoringChallenges(catalogDir);

    const runSeed = db.transaction(() => {
      CatalogSeeder.upsertCodingChallenges(db, legacy, 'standard');
      CatalogSeeder.upsertCodingChallenges(db, machineCoding, 'standard');
      CatalogSeeder.upsertCodingChallenges(db, refactoring, 'standard');
      CatalogSeeder.assignDisjointTaskCodes(db);
    });

    runSeed();
    console.log(`✅ Seeded ${legacy.length + machineCoding.length + refactoring.length} coding challenges and disjoint task codes`);
  }

  private static seedTriageAndRoadmapsAndTx(db: Database.Database, catalogDir?: string): void {
    const incidents = ChallengeCatalogLoader.loadJsonCatalogArray('production_triage_challenges.json', catalogDir);
    if (incidents) {
      const upsertTriage = db.prepare(`
        INSERT INTO production_triage_challenges (id, incident_number, slug, title, category, severity, manifest_json, updated_at)
        VALUES (@id, @incident_number, @slug, @title, @category, @severity, @manifest_json, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET
          incident_number = excluded.incident_number, slug = excluded.slug, title = excluded.title,
          category = excluded.category, severity = excluded.severity, manifest_json = excluded.manifest_json, updated_at = CURRENT_TIMESTAMP
      `);
      for (const inc of incidents) {
        upsertTriage.run({
          id: inc.id, incident_number: inc.incidentNumber || 1, slug: inc.slug || inc.id,
          title: inc.title, category: inc.category || 'Production Forensics', severity: inc.severity || 'CRITICAL', manifest_json: JSON.stringify(inc)
        });
      }
      console.log(`✅ Seeded ${incidents.length} Production Triage cases into SQLite`);
    }

    const roadmaps = ChallengeCatalogLoader.loadJsonCatalogArray('guided_roadmaps.json', catalogDir);
    if (roadmaps) {
      const activeIds = roadmaps.map((r: any) => r.id);
      if (activeIds.length > 0) {
        db.prepare(`DELETE FROM guided_roadmaps WHERE id NOT IN (${activeIds.map(() => '?').join(',')})`).run(...activeIds);
      }
      const upsertRm = db.prepare(`
        INSERT INTO guided_roadmaps (id, title, category, total_steps, manifest_json, updated_at)
        VALUES (@id, @title, @category, @total_steps, @manifest_json, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET
          title = excluded.title, category = excluded.category, total_steps = excluded.total_steps,
          manifest_json = excluded.manifest_json, updated_at = CURRENT_TIMESTAMP
      `);
      for (const rm of roadmaps) {
        upsertRm.run({ id: rm.id, title: rm.title, category: rm.category || 'career', total_steps: rm.totalSteps || 25, manifest_json: JSON.stringify(rm) });
      }
      console.log(`✅ Seeded ${roadmaps.length} Master Academy Programs into SQLite`);
    }

    const txScenarios = ChallengeCatalogLoader.loadJsonCatalogArray('spring_transaction_scenarios.json', catalogDir);
    if (txScenarios) {
      const upsertTx = db.prepare(`
        INSERT INTO spring_transaction_challenges (id, scenario_number, slug, title, domain, difficulty, badge, manifest_json, updated_at)
        VALUES (@id, @scenario_number, @slug, @title, @domain, @difficulty, @badge, @manifest_json, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET
          scenario_number = excluded.scenario_number, slug = excluded.slug, title = excluded.title, domain = excluded.domain,
          difficulty = excluded.difficulty, badge = excluded.badge, manifest_json = excluded.manifest_json, updated_at = CURRENT_TIMESTAMP
      `);
      txScenarios.forEach((sc: any, idx: number) => {
        upsertTx.run({
          id: sc.id, scenario_number: idx + 1, slug: sc.id, title: sc.title,
          domain: sc.domain || 'Enterprise Transactions', difficulty: sc.difficulty || 'Middle', badge: sc.badge || 'Spring TX', manifest_json: JSON.stringify(sc)
        });
      });
      console.log(`✅ Seeded ${txScenarios.length} Spring Transaction scenarios into SQLite`);
    }
  }

  /**
   * Seeds System Design manifests, Triage incidents, Guided Roadmaps, Spring TX scenarios, and Design Patterns.
   */
  public static seedNextGenCatalogs(db: Database.Database, catalogDir?: string): void {
    const runSeed = db.transaction(() => {
      seedCanonicalManifests(db);
      CatalogSeeder.seedTriageAndRoadmapsAndTx(db, catalogDir);
      const dpChallenges = ChallengeCatalogLoader.loadDesignPatternChallenges(catalogDir);
      if (dpChallenges.length > 0) {
        CatalogSeeder.upsertCodingChallenges(db, dpChallenges, 'design_patterns');
        CatalogSeeder.assignDisjointTaskCodes(db);
        console.log(`✅ Seeded ${dpChallenges.length} SOTA 2026 Design Pattern Katas into SQLite`);
      }
    });
    runSeed();
  }

  /**
   * Atomic cold-boot seeder executing ALL JSON catalogs inside a single SQLite transaction.
   */
  public static seedAllCatalogs(db: Database.Database, catalogDir?: string): void {
    const seedAll = db.transaction(() => {
      CatalogSeeder.seedQuestionsFromJSON(db, catalogDir);
      CatalogSeeder.seedCodingChallenges(db, catalogDir);
      CatalogSeeder.seedNextGenCatalogs(db, catalogDir);
      CatalogSeeder.assignDisjointTaskCodes(db);
    });
    seedAll();
  }
}
