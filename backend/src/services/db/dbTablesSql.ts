/**
 * Canonical SQLite Tables Schema (SSOT: Spec 57 & 00_CORE_INFRASTRUCTURE_AND_SECURITY.md).
 * Cognitive bounding limit: <= 310 lines.
 */

export const CANONICAL_TABLES_SQL = `
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
    turn_telemetry TEXT,
    speech_coaching_json TEXT,
    audio_path TEXT,
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
    task_code TEXT,
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
  CREATE TABLE IF NOT EXISTS system_design_manifests (
    canonical_id TEXT PRIMARY KEY,
    version TEXT NOT NULL,
    target_level TEXT NOT NULL,
    archetype TEXT NOT NULL,
    title TEXT NOT NULL,
    subtitle TEXT,
    problem_statement TEXT NOT NULL,
    pedagogical_mode TEXT NOT NULL,
    manifest_json TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS system_design_aliases (
    alias TEXT PRIMARY KEY,
    canonical_id TEXT NOT NULL,
    FOREIGN KEY (canonical_id) REFERENCES system_design_manifests(canonical_id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS user_progress_ledger (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default_user',
    canonical_id TEXT NOT NULL,
    studio_stage TEXT NOT NULL,
    status TEXT NOT NULL,
    score INTEGER,
    artifacts_json TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (canonical_id) REFERENCES system_design_manifests(canonical_id)
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
  CREATE TABLE IF NOT EXISTS company_question_mastery (
    user_id TEXT NOT NULL DEFAULT 'default_user',
    company_id TEXT NOT NULL,
    question_id TEXT NOT NULL,
    is_mastered INTEGER DEFAULT 0,
    score INTEGER DEFAULT 0,
    last_evaluated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, company_id, question_id)
  );
`;
