import path from 'path';
import fs from 'fs';
import { db } from '../connection';

export function seedCodingChallenges() {
  try {
    const { SEEDED_CHALLENGES } = require('../../challengeSeedData');
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
      path.join(process.cwd(), 'json/machine_coding_challenges.json'),
      path.join(__dirname, '../../../../../json/machine_coding_challenges.json'),
      path.join(__dirname, '../../../../json/machine_coding_challenges.json'),
      path.join(__dirname, '../../../json/machine_coding_challenges.json')
    ];
    const lldPath = lldJsonPaths.find((p) => fs.existsSync(p));
    if (lldPath) {
      const lldChallenges = JSON.parse(fs.readFileSync(lldPath, 'utf-8'));
      syncAll(lldChallenges);
      console.log(`✅ Seeded ${lldChallenges.length} SOTA Machine Coding & LLD challenges from JSON`);
    }

    console.log('✅ Seeded premier coding challenges into SQLite DB');
  } catch (err) {
    console.error('Error seeding coding challenges:', err);
  }
}
