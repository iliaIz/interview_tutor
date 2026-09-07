import crypto from 'crypto';
import { db } from '../connection';

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
