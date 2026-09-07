import { db } from './connection';

export function initializeSchema() {
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
      user_id TEXT NOT NULL DEFAULT 'default_user',
      topic TEXT NOT NULL,
      completed_ids TEXT,
      last_question_id TEXT,
      mastered_ids TEXT,
      review_ids TEXT,
      percentage INTEGER DEFAULT 0,
      shuffle INTEGER DEFAULT 0,
      batch_size INTEGER DEFAULT 5,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, topic)
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
      user_id TEXT DEFAULT 'default_user',
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
      speech_coaching_json TEXT,
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

    CREATE TABLE IF NOT EXISTS fsrs_card_states (
      user_id TEXT NOT NULL DEFAULT 'default_user',
      question_id TEXT NOT NULL,
      stability REAL DEFAULT 1.0,
      difficulty REAL DEFAULT 5.0,
      elapsed_days REAL DEFAULT 0.0,
      scheduled_days INTEGER DEFAULT 1,
      reps INTEGER DEFAULT 0,
      lapses INTEGER DEFAULT 0,
      state INTEGER DEFAULT 0,
      last_review_at DATETIME,
      due_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, question_id)
    );

    CREATE INDEX IF NOT EXISTS idx_fsrs_due ON fsrs_card_states(user_id, due_at);
    CREATE INDEX IF NOT EXISTS idx_fsrs_state ON fsrs_card_states(user_id, state);
    CREATE INDEX IF NOT EXISTS idx_fsrs_due_queue ON fsrs_card_states(user_id, state, due_at);

    CREATE TABLE IF NOT EXISTS fsrs_review_logs (
      log_id TEXT PRIMARY KEY,
      question_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      rating INTEGER NOT NULL,
      state INTEGER NOT NULL,
      due_at DATETIME NOT NULL,
      stability REAL NOT NULL,
      difficulty REAL NOT NULL,
      review_time DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_fsrs_logs_history ON fsrs_review_logs(user_id, question_id, review_time DESC);

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

    CREATE TABLE IF NOT EXISTS spring_transaction_challenges (
      id TEXT PRIMARY KEY,
      scenario_number INTEGER,
      slug TEXT NOT NULL,
      title TEXT NOT NULL,
      domain TEXT NOT NULL,
      difficulty TEXT NOT NULL,
      badge TEXT NOT NULL,
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

    CREATE TABLE IF NOT EXISTS spring_transaction_submissions (
      id TEXT PRIMARY KEY,
      user_id TEXT DEFAULT 'default_user',
      scenario_id TEXT NOT NULL,
      passed INTEGER DEFAULT 0,
      score INTEGER DEFAULT 0,
      user_configs_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_tx_sub_user ON spring_transaction_submissions(user_id);
    CREATE INDEX IF NOT EXISTS idx_tx_sub_scenario ON spring_transaction_submissions(scenario_id);

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

    CREATE INDEX IF NOT EXISTS idx_sd_user_scenario ON system_design_submissions(user_id, scenario_id);
    CREATE INDEX IF NOT EXISTS idx_triage_user_inc ON triage_submissions(user_id, incident_id);

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

  // Migrations
  try {
    const cols = db.pragma('table_info(coding_challenges)') as any[];
    if (!cols.some((c) => c.name === 'track')) {
      db.exec("ALTER TABLE coding_challenges ADD COLUMN track TEXT DEFAULT 'lld_bigtech'");
      console.log("✅ Added 'track' column to coding_challenges table");
    }
  } catch (e) {
    console.error('Migration error for coding_challenges:', e);
  }

  try {
    const cols = db.pragma('table_info(user_progress)') as any[];
    const hasUserId = cols.some((c) => c.name === 'user_id');
    if (!hasUserId) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS user_progress_v2 (
          user_id TEXT NOT NULL DEFAULT 'default_user',
          topic TEXT NOT NULL,
          completed_ids TEXT,
          last_question_id TEXT,
          mastered_ids TEXT,
          review_ids TEXT,
          percentage INTEGER DEFAULT 0,
          shuffle INTEGER DEFAULT 0,
          batch_size INTEGER DEFAULT 5,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (user_id, topic)
        );
        INSERT OR IGNORE INTO user_progress_v2 (user_id, topic, completed_ids, last_question_id, mastered_ids, review_ids, percentage, shuffle, batch_size, updated_at)
          SELECT 'default_user', topic, completed_ids, last_question_id, mastered_ids, review_ids, 0, shuffle, batch_size, updated_at FROM user_progress;
        DROP TABLE user_progress;
        ALTER TABLE user_progress_v2 RENAME TO user_progress;
        CREATE INDEX IF NOT EXISTS idx_user_prog_user ON user_progress(user_id);
      `);
      console.log('✅ Migrated user_progress table to multi-user composite primary key');
    }
    db.exec('CREATE INDEX IF NOT EXISTS idx_user_prog_user ON user_progress(user_id);');
  } catch (e) {
    console.error('Migration error for user_progress:', e);
  }

  try {
    const cols = db.pragma('table_info(guided_roadmaps)') as any[];
    if (!cols.some((c) => c.name === 'category')) {
      db.exec("ALTER TABLE guided_roadmaps ADD COLUMN category TEXT DEFAULT 'career'");
      console.log("✅ Added 'category' column to guided_roadmaps table");
    }
  } catch (e) {
    console.error('Migration error for guided_roadmaps:', e);
  }

  try {
    const cols = db.pragma('table_info(question_evaluations)') as any[];
    if (!cols.some((c) => c.name === 'user_id')) {
      db.exec("ALTER TABLE question_evaluations ADD COLUMN user_id TEXT DEFAULT 'default_user'");
      console.log("✅ Added 'user_id' column to question_evaluations table");
    }
    if (!cols.some((c) => c.name === 'speech_coaching_json')) {
      db.exec('ALTER TABLE question_evaluations ADD COLUMN speech_coaching_json TEXT');
      console.log("✅ Added 'speech_coaching_json' column to question_evaluations table");
    }
    db.exec('CREATE INDEX IF NOT EXISTS idx_eval_user ON question_evaluations(user_id);');
  } catch (e) {
    console.error('Migration error for question_evaluations:', e);
  }

  try {
    db.exec('ALTER TABLE bug_challenges ADD COLUMN tech_stack_json TEXT;');
  } catch {}
  try {
    db.exec('ALTER TABLE bug_challenges ADD COLUMN production_context_json TEXT;');
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

  // Purge inactive tokens
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
}
