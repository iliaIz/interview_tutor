import Database from 'better-sqlite3';

/**
 * Composite Query Indexes and Schema Migrations (SSOT: 00_CORE_INFRASTRUCTURE_AND_SECURITY.md).
 * Cognitive bounding limit: <= 350 lines.
 */

export const COMPOSITE_INDEXES_SQL = `
  CREATE INDEX IF NOT EXISTS idx_eval_question ON question_evaluations(question_id);
  CREATE INDEX IF NOT EXISTS idx_eval_topic ON question_evaluations(topic);
  CREATE INDEX IF NOT EXISTS idx_eval_user_question ON question_evaluations(user_id, question_id);
  CREATE INDEX IF NOT EXISTS idx_eval_user_topic ON question_evaluations(user_id, topic);
  CREATE INDEX IF NOT EXISTS idx_bug_topic ON bug_challenges(topic_id);
  CREATE INDEX IF NOT EXISTS idx_err_vec_status ON candidate_error_vectors(status);
  CREATE INDEX IF NOT EXISTS idx_err_vec_topic ON candidate_error_vectors(topic);
  CREATE INDEX IF NOT EXISTS idx_err_vec_user ON candidate_error_vectors(user_id);
  CREATE INDEX IF NOT EXISTS idx_code_chall_cat ON coding_challenges(category);
  CREATE INDEX IF NOT EXISTS idx_coding_challenges_slug ON coding_challenges(slug);
  CREATE INDEX IF NOT EXISTS idx_spring_tx_challenges_slug ON spring_transaction_challenges(slug);
  CREATE INDEX IF NOT EXISTS idx_code_sub_chall ON coding_submissions(challenge_id);
  CREATE INDEX IF NOT EXISTS idx_code_sub_user ON coding_submissions(user_id);
  CREATE INDEX IF NOT EXISTS idx_code_sub_user_chall ON coding_submissions(user_id, challenge_id);
  CREATE INDEX IF NOT EXISTS idx_questions_topic ON questions(topic);
  CREATE INDEX IF NOT EXISTS idx_sd_manifests_level ON system_design_manifests(target_level);
  CREATE INDEX IF NOT EXISTS idx_sd_manifests_archetype ON system_design_manifests(archetype);
  CREATE INDEX IF NOT EXISTS idx_sd_aliases_canonical ON system_design_aliases(canonical_id);
  CREATE INDEX IF NOT EXISTS idx_sd_progress_user ON user_progress_ledger(user_id, canonical_id);
  CREATE INDEX IF NOT EXISTS idx_sd_user_scenario ON system_design_submissions(user_id, scenario_id);
  CREATE INDEX IF NOT EXISTS idx_tx_sub_user ON spring_transaction_submissions(user_id);
  CREATE INDEX IF NOT EXISTS idx_tx_sub_scenario ON spring_transaction_submissions(scenario_id);
  CREATE INDEX IF NOT EXISTS idx_tx_sub_user_scen ON spring_transaction_submissions(user_id, scenario_id);
  CREATE INDEX IF NOT EXISTS idx_triage_user_inc ON triage_submissions(user_id, incident_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_ws_tickets_exp ON ws_tickets(expires_at);
  CREATE INDEX IF NOT EXISTS idx_fsrs_due ON fsrs_card_states(user_id, due_at);
  CREATE INDEX IF NOT EXISTS idx_fsrs_state ON fsrs_card_states(user_id, state);
  CREATE INDEX IF NOT EXISTS idx_fsrs_due_queue ON fsrs_card_states(user_id, state, due_at);
  CREATE INDEX IF NOT EXISTS idx_fsrs_logs_history ON fsrs_review_logs(user_id, question_id, review_time DESC);
`;

export function runSchemaMigrations(db: Database.Database) {
  const safeAddColumn = (table: string, col: string, def: string) => {
    try {
      const cols = db.pragma(`table_info(${table})`) as any[];
      if (!cols.some(c => c.name === col)) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
      }
    } catch {}
  };

  safeAddColumn('coding_challenges', 'track', "TEXT DEFAULT 'lld_bigtech'");
  safeAddColumn('coding_challenges', 'task_code', 'TEXT');
  safeAddColumn('guided_roadmaps', 'category', "TEXT DEFAULT 'career'");
  safeAddColumn('question_evaluations', 'turn_telemetry', 'TEXT');
  safeAddColumn('question_evaluations', 'user_id', "TEXT DEFAULT 'default_user'");
  safeAddColumn('question_evaluations', 'speech_coaching_json', 'TEXT');
  safeAddColumn('question_evaluations', 'audio_path', 'TEXT');
  safeAddColumn('bug_challenges', 'tech_stack_json', 'TEXT');
  safeAddColumn('bug_challenges', 'production_context_json', 'TEXT');

  try {
    db.exec(`
      DELETE FROM user_sessions WHERE user_id IN (SELECT user_id FROM invite_tokens WHERE is_active = 0);
      DELETE FROM ws_tickets WHERE user_id IN (SELECT user_id FROM invite_tokens WHERE is_active = 0);
      DELETE FROM invite_tokens WHERE is_active = 0;
      DELETE FROM users WHERE id NOT IN (SELECT user_id FROM invite_tokens) AND id != 'user_master';
    `);
  } catch {}
}
