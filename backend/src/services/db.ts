import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const dbPath = process.env.DB_PATH || path.join(__dirname, '../../data/interview.db');

const dataDir = path.dirname(dbPath);

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// Initialize Tables
db.exec(`
  CREATE TABLE IF NOT EXISTS questions (
    id TEXT PRIMARY KEY,
    global_id INTEGER,
    num INTEGER,
    topic TEXT,
    question TEXT,
    answer TEXT,
    source_pages TEXT
  );

  CREATE TABLE IF NOT EXISTS user_progress (
    topic TEXT PRIMARY KEY,
    completed_ids TEXT,
    last_question_id TEXT,
    mastered_ids TEXT,
    review_ids TEXT,
    shuffle INTEGER DEFAULT 0,
    batch_size INTEGER DEFAULT 5,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS podcast_jobs (
    job_id TEXT PRIMARY KEY,
    status TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    audio_url TEXT,
    transcript TEXT,
    metadata TEXT,
    error TEXT,
    audio_path TEXT
  );

  CREATE TABLE IF NOT EXISTS question_evaluations (
    id TEXT PRIMARY KEY,
    question_id TEXT NOT NULL,
    topic TEXT NOT NULL,
    mode TEXT NOT NULL,
    score INTEGER NOT NULL,
    is_passed BOOLEAN NOT NULL,
    positive_points TEXT,
    missing_points TEXT,
    feedback TEXT,
    user_answer TEXT,
    transcript TEXT,
    audio_metrics TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (question_id) REFERENCES questions(id)
  );

  CREATE TABLE IF NOT EXISTS interview_profiles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    badge TEXT NOT NULL,
    description TEXT,
    is_preset BOOLEAN DEFAULT 0,
    strategy TEXT NOT NULL,
    voice TEXT NOT NULL,
    max_probes INTEGER DEFAULT 3,
    custom_prompt_override TEXT,
    custom_anchors TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS candidate_error_vectors (
    id TEXT PRIMARY KEY,
    user_id TEXT DEFAULT 'default_user',
    question_id TEXT,
    topic TEXT NOT NULL,
    subtopic TEXT,
    error_concept TEXT NOT NULL,
    embedding BLOB NOT NULL,
    deficit_weight REAL DEFAULT 1.0,
    status TEXT DEFAULT 'ACTIVE_DEFICIT',
    solo_streak INTEGER DEFAULT 0,
    assisted_count INTEGER DEFAULT 0,
    last_tested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS question_embeddings (
    question_id TEXT PRIMARY KEY,
    topic TEXT,
    embedding BLOB NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS user_profile_settings (
    id TEXT PRIMARY KEY,
    candidate_name TEXT DEFAULT 'Кандидат',
    target_seniority TEXT DEFAULT 'senior',
    primary_stack TEXT DEFAULT 'Java 21, Spring Boot 3.3, PostgreSQL, Kafka',
    preferred_tone TEXT DEFAULT 'rigorous',
    focus_areas_json TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS bug_challenges (
    id TEXT PRIMARY KEY,
    topic_id TEXT NOT NULL,
    topic_name TEXT NOT NULL,
    preset TEXT,
    difficulty TEXT,
    category_badge TEXT,
    title TEXT NOT NULL,
    subtopic TEXT NOT NULL,
    language TEXT DEFAULT 'java',
    code_snippet TEXT NOT NULL,
    bug_explanation TEXT NOT NULL,
    fixed_code TEXT NOT NULL,
    hints_json TEXT,
    is_solved INTEGER DEFAULT 0,
    last_score INTEGER,
    last_feedback TEXT,
    key_takeaways_json TEXT,
    tech_stack_json TEXT,
    production_context_json TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS coding_challenges (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    track TEXT DEFAULT 'lld_bigtech',
    badge TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    target_stack TEXT NOT NULL,
    time_limit_minutes INTEGER DEFAULT 60,
    short_description TEXT NOT NULL,
    instructions_markdown TEXT NOT NULL,
    manifest_json TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS coding_submissions (
    id TEXT PRIMARY KEY,
    challenge_id TEXT NOT NULL,
    user_id TEXT DEFAULT 'default_user',
    files_json TEXT NOT NULL,
    active_phase INTEGER DEFAULT 1,
    status TEXT DEFAULT 'DRAFT',
    score INTEGER,
    evaluation_json TEXT,
    time_spent_seconds INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (challenge_id) REFERENCES coding_challenges(id)
  );

  CREATE INDEX IF NOT EXISTS idx_eval_question ON question_evaluations(question_id);
  CREATE INDEX IF NOT EXISTS idx_eval_topic ON question_evaluations(topic);
  CREATE INDEX IF NOT EXISTS idx_bug_topic ON bug_challenges(topic_id);
  CREATE INDEX IF NOT EXISTS idx_err_vec_status ON candidate_error_vectors(status);
  CREATE INDEX IF NOT EXISTS idx_err_vec_topic ON candidate_error_vectors(topic);
  CREATE INDEX IF NOT EXISTS idx_err_vec_user ON candidate_error_vectors(user_id);
  CREATE INDEX IF NOT EXISTS idx_code_chall_cat ON coding_challenges(category);
  CREATE INDEX IF NOT EXISTS idx_code_sub_chall ON coding_submissions(challenge_id);
  CREATE INDEX IF NOT EXISTS idx_code_sub_user ON coding_submissions(user_id);
  CREATE INDEX IF NOT EXISTS idx_questions_topic ON questions(topic);
  CREATE INDEX IF NOT EXISTS idx_sd_user_scenario ON system_design_submissions(user_id, scenario_id);
  CREATE INDEX IF NOT EXISTS idx_triage_user_inc ON triage_submissions(user_id, incident_id);
  CREATE TABLE IF NOT EXISTS system_design_challenges (
    id TEXT PRIMARY KEY,
    scenario_number INTEGER,
    slug TEXT NOT NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    manifest_json TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS production_triage_challenges (
    id TEXT PRIMARY KEY,
    incident_number INTEGER,
    slug TEXT NOT NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    severity TEXT NOT NULL,
    manifest_json TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS guided_roadmaps (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT DEFAULT 'career',
    total_steps INTEGER NOT NULL,
    manifest_json TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );


  CREATE TABLE IF NOT EXISTS roadmap_progress (
    user_id TEXT DEFAULT 'default_user',
    roadmap_id TEXT NOT NULL,
    completed_steps_json TEXT NOT NULL,
    current_step INTEGER DEFAULT 1,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, roadmap_id)
  );

  CREATE TABLE IF NOT EXISTS system_design_submissions (
    id TEXT PRIMARY KEY,
    scenario_id TEXT NOT NULL,
    user_id TEXT DEFAULT 'default_user',
    architecture_mermaid TEXT,
    notes_markdown TEXT,
    evaluation_json TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS triage_submissions (
    id TEXT PRIMARY KEY,
    incident_id TEXT NOT NULL,
    user_id TEXT DEFAULT 'default_user',
    rca_hypothesis TEXT NOT NULL,
    prevention_plan TEXT NOT NULL,
    evaluation_json TEXT,
    score INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT DEFAULT 'candidate',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login_at DATETIME
  );

  CREATE TABLE IF NOT EXISTS invite_tokens (
    id TEXT PRIMARY KEY,
    code_hash TEXT UNIQUE NOT NULL,
    label TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT DEFAULT 'candidate',
    is_active INTEGER DEFAULT 1,
    max_uses INTEGER DEFAULT 0,
    use_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_used_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS user_sessions (
    session_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    user_agent TEXT,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS ws_tickets (
    ticket_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_ws_tickets_exp ON ws_tickets(expires_at);
`);


// Migration: Ensure track column exists in coding_challenges table
try {
  const cols = db.pragma('table_info(coding_challenges)') as any[];
  if (!cols.some(c => c.name === 'track')) {
    db.exec("ALTER TABLE coding_challenges ADD COLUMN track TEXT DEFAULT 'lld_bigtech'");
    console.log("✅ Added 'track' column to coding_challenges table");
  }
} catch (e) {
  console.error("Migration error for coding_challenges:", e);
}

// Migration: Ensure category column exists in guided_roadmaps table
try {
  const cols = db.pragma('table_info(guided_roadmaps)') as any[];
  if (!cols.some(c => c.name === 'category')) {
    db.exec("ALTER TABLE guided_roadmaps ADD COLUMN category TEXT DEFAULT 'career'");
    console.log("✅ Added 'category' column to guided_roadmaps table");
  }
} catch (e) {
  console.error("Migration error for guided_roadmaps:", e);
}


// Safe column migrations for existing SQLite databases
try {
  db.exec("ALTER TABLE bug_challenges ADD COLUMN tech_stack_json TEXT;");
} catch {}
try {
  db.exec("ALTER TABLE bug_challenges ADD COLUMN production_context_json TEXT;");
} catch {}
try {
  db.exec(`
    INSERT OR IGNORE INTO user_profile_settings (
      id, candidate_name, target_seniority, primary_stack, preferred_tone, focus_areas_json
    ) VALUES (
      'default_user', 'Кандидат', 'senior', 'Java 21, Spring Boot 3.3, PostgreSQL, Kafka', 'rigorous', '["Spring Transactional", "JMM & Concurrency", "Kafka Partitions"]'
    );
  `);
} catch {}

// Purge any previously revoked / inactive tokens and orphaned users
try {
  db.exec(`
    DELETE FROM user_sessions WHERE user_id IN (SELECT user_id FROM invite_tokens WHERE is_active = 0);
    DELETE FROM ws_tickets WHERE user_id IN (SELECT user_id FROM invite_tokens WHERE is_active = 0);
    DELETE FROM invite_tokens WHERE is_active = 0;
    DELETE FROM users WHERE id NOT IN (SELECT user_id FROM invite_tokens) AND id != 'user_master';
  `);
} catch (e) {
  console.error('Error purging inactive invite tokens:', e);
}




export function seedDefaultProfiles() {
  try {
    const countRow = db.prepare('SELECT COUNT(*) as count FROM interview_profiles').get() as { count: number };
    if (countRow && countRow.count > 0) return;

    const defaultPresets = [
      {
        id: 'preset_faang_senior',
        name: 'FAANG Senior Interviewer',
        badge: '🛡️ Адаптивное',
        description: 'Строгая и объективная оценка без подсказок, глубокая проверка понимания «под капотом» и краевых случаев.',
        is_preset: 1,
        strategy: 'adaptive_probing',
        voice: 'Aoede',
        max_probes: 3,
        custom_prompt_override: null,
        custom_anchors: null
      },
      {
        id: 'preset_express_screening',
        name: 'Быстрый скрининг (Recruiter Tech)',
        badge: '⚡ Экспресс',
        description: 'Быстрая проверка базовых определений и ключевых концепций в динамичном темпе (1 уточнение).',
        is_preset: 1,
        strategy: 'adaptive_probing',
        voice: 'Puck',
        max_probes: 1,
        custom_prompt_override: null,
        custom_anchors: null
      },
      {
        id: 'preset_deep_dive_lead',
        name: 'Глубокий стресс-тест (Tech Lead)',
        badge: '🔬 Hardcore',
        description: 'Максимальная глубина (до 5 раундов): проверка всех 10 якорей темы, отказоустойчивости и многопоточности.',
        is_preset: 1,
        strategy: 'adaptive_probing',
        voice: 'Fenrir',
        max_probes: 5,
        custom_prompt_override: null,
        custom_anchors: null
      },
      {
        id: 'preset_soft_mentor',
        name: 'Мягкий наставник (Поддерживающий)',
        badge: '🌸 Сократ',
        description: 'Теплая атмосфера: похвала за верные мысли, мягкие подсказки и живые аналогии при застревании.',
        is_preset: 1,
        strategy: 'socratic_tutoring',
        voice: 'Kore',
        max_probes: 3,
        custom_prompt_override: null,
        custom_anchors: null
      },
      {
        id: 'preset_academic_tutor',
        name: 'Академический тьютор (Разбор темы)',
        badge: '🎓 Обучение',
        description: 'Пошаговый разбор фундаментальных принципов: наводящие логические цепочки от простого к сложному.',
        is_preset: 1,
        strategy: 'socratic_tutoring',
        voice: 'Charon',
        max_probes: 4,
        custom_prompt_override: null,
        custom_anchors: null
      }
    ];

    const insert = db.prepare(`
      INSERT INTO interview_profiles (
        id, name, badge, description, is_preset, strategy, voice, max_probes,
        custom_prompt_override, custom_anchors, created_at, updated_at
      ) VALUES (
        @id, @name, @badge, @description, @is_preset, @strategy, @voice, @max_probes,
        @custom_prompt_override, @custom_anchors, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `);

    for (const preset of defaultPresets) {
      insert.run(preset);
    }
    console.log('✅ Seeded default interview profiles into SQLite DB');
  } catch (err) {
    console.error('Error seeding default profiles:', err);
  }
}

export function recoverOrphanedJobs() {
  try {
    const info = db.prepare(`
      UPDATE podcast_jobs
      SET status = 'FAILED',
          error = 'Процесс генерации прерван перезапуском сервера'
      WHERE status IN ('PROCESSING', 'QUEUED')
    `).run();
    if (info.changes > 0) {
      console.log(`🧹 Recovered ${info.changes} orphaned podcast jobs marked as FAILED`);
    }
  } catch (err) {
    console.error('Error recovering orphaned jobs:', err);
  }
}

export function seedQuestionsFromJSON() {
  const possiblePaths = [
    '/json/all_interview_questions.json',
    path.join(__dirname, '../../../json/all_interview_questions.json'),
    path.join(__dirname, '../../json/all_interview_questions.json'),
    path.join(process.cwd(), 'json/all_interview_questions.json')
  ];

  let jsonPath = possiblePaths.find(p => fs.existsSync(p));

  if (!jsonPath) {
    console.log('⚠️ JSON source file not found in paths:', possiblePaths);
    return;
  }

  console.log('🌱 Syncing database questions from JSON:', jsonPath);
  const rawData = fs.readFileSync(jsonPath, 'utf-8');
  const questions = JSON.parse(rawData);

  // Upsert fresh questions from JSON in a single transaction (avoids FOREIGN KEY violations with evaluations)
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
}

export function seedCodingChallenges() {
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

    const syncAll = db.transaction((challenges: any[]) => {
      for (const ch of challenges) {
        upsertStmt.run({
          id: ch.id,
          slug: ch.slug || ch.id,
          title: ch.title,
          category: ch.category || 'machine_coding',
          track: ch.track || 'lld_bigtech',
          badge: ch.badge || (ch.track === 'lld_fintech' ? '💳 FinTech' : ch.track === 'lld_concurrency' ? '⚡ Concurrency' : '🏛️ LLD'),
          difficulty: ch.difficulty,
          target_stack: ch.targetStack || ch.techStack || 'Java 21 LTS',
          time_limit_minutes: ch.timeLimitMinutes || 45,
          short_description: ch.shortDescription || (ch.scenarioMarkdown ? ch.scenarioMarkdown.slice(0, 150) + '...' : ch.title),
          instructions_markdown: ch.instructionsMarkdown || ch.scenarioMarkdown || '',
          manifest_json: JSON.stringify(ch)
        });
      }
    });


    syncAll(SEEDED_CHALLENGES);

    // Also load and sync 35 SOTA LLD challenges from machine_coding_challenges.json
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

    console.log(`✅ Seeded premier coding challenges into SQLite DB`);
  } catch (err) {
    console.error('Error seeding coding challenges:', err);
  }
}

export function seedNextGenCatalogs() {
  try {
    const resolveJsonPath = (filename: string) => {
      const paths = [
        path.join(__dirname, `../../../json/${filename}`),
        path.join(__dirname, `../../json/${filename}`),
        path.join(process.cwd(), `json/${filename}`)
      ];
      return paths.find(p => fs.existsSync(p));
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
        // Prune stale/legacy roadmap IDs no longer in json
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
  } catch (err) {
    console.error('Error seeding Next-Gen catalogs:', err);
  }
}

export function seedMasterInviteCode() {
  try {
    const masterCodes = ['SENIOR-JAVA-2026-VIP', 'SPRING-VIP-OWNER-2026'];

    // 1. Ensure master user exists
    db.prepare(`
      INSERT INTO users (id, name, role, created_at)
      VALUES ('user_master', 'Главный Инженер (Master)', 'owner', CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET role = 'owner'
    `).run();

    // 2. Ensure master invite tokens exist
    for (let i = 0; i < masterCodes.length; i++) {
      const code = masterCodes[i];
      const codeHash = crypto.createHash('sha256').update(code).digest('hex');
      const invId = i === 0 ? 'invite_master' : `invite_master_${i}`;

      db.prepare(`
        INSERT INTO invite_tokens (id, code_hash, label, user_id, role, is_active, max_uses, created_at)
        VALUES (?, ?, 'Мастер-доступ (VIP Owner)', 'user_master', 'owner', 1, 0, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET
          code_hash = excluded.code_hash,
          is_active = 1
      `).run(invId, codeHash);
    }

    console.log(`✅ Seeded Master VIP Owner Access (${masterCodes.join(', ')}) into SQLite`);
  } catch (err) {
    console.error('Error seeding master invite code:', err);
  }
}





