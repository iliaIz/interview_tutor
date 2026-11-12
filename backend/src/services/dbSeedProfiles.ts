import Database from 'better-sqlite3';
import crypto from 'crypto';

/**
 * Seeding utilities for user profiles, master invites, and orphaned podcast recovery.
 * Cognitive bounding limit: <= 350 lines.
 */

export function seedDefaultProfiles(db: Database.Database) {
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
        voice: 'Puck',
        max_probes: 3,
        custom_prompt_override: null,
        custom_anchors: null
      },
      {
        id: 'preset_soft_mentor',
        name: 'Мягкий наставник (Поддерживающий)',
        badge: '🌸 Сократ',
        description: 'Теплая атмосфера: наглядные аналогии, терпеливый разбор физики процессов и мягкие наводящие подсказки при застревании.',
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

export function recoverOrphanedJobs(db: Database.Database) {
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

export function seedMasterInviteCode(db: Database.Database) {
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
