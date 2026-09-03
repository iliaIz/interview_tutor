const assert = require('assert');
const { db } = require('../dist/services/db');

// Setup test user and test roadmap progress
const testUserId = 'test_user_progress_regression_' + Date.now();
const testRoadmapId = 'test-roadmap';

try {
    // 1. Initial advance to step 15
    db.prepare(`
        INSERT INTO roadmap_progress (user_id, roadmap_id, completed_steps_json, current_step, updated_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id, roadmap_id) DO UPDATE SET
          completed_steps_json = excluded.completed_steps_json,
          current_step = CASE
            WHEN excluded.current_step > roadmap_progress.current_step THEN excluded.current_step
            ELSE roadmap_progress.current_step
          END,
          updated_at = CURRENT_TIMESTAMP
    `).run(testUserId, testRoadmapId, JSON.stringify([1, 2, 3, 15]), 15);

    let row = db.prepare('SELECT current_step FROM roadmap_progress WHERE user_id = ? AND roadmap_id = ?').get(testUserId, testRoadmapId);
    assert.strictEqual(row.current_step, 15, 'Initial current_step should be 15');

    // 2. User unchecks step 2 (simulating POST /api/roadmaps/progress with completedStep: 2, isCompleted: false)
    const uncheckStep = 2;
    db.prepare(`
        INSERT INTO roadmap_progress (user_id, roadmap_id, completed_steps_json, current_step, updated_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id, roadmap_id) DO UPDATE SET
          completed_steps_json = excluded.completed_steps_json,
          current_step = CASE
            WHEN excluded.current_step > roadmap_progress.current_step THEN excluded.current_step
            ELSE roadmap_progress.current_step
          END,
          updated_at = CURRENT_TIMESTAMP
    `).run(testUserId, testRoadmapId, JSON.stringify([1, 3, 15]), uncheckStep);

    row = db.prepare('SELECT current_step FROM roadmap_progress WHERE user_id = ? AND roadmap_id = ?').get(testUserId, testRoadmapId);
    assert.strictEqual(row.current_step, 15, 'current_step should remain 15 and NOT regress to 2');

    // 3. User completes step 18
    const advanceStep = 18;
    db.prepare(`
        INSERT INTO roadmap_progress (user_id, roadmap_id, completed_steps_json, current_step, updated_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id, roadmap_id) DO UPDATE SET
          completed_steps_json = excluded.completed_steps_json,
          current_step = CASE
            WHEN excluded.current_step > roadmap_progress.current_step THEN excluded.current_step
            ELSE roadmap_progress.current_step
          END,
          updated_at = CURRENT_TIMESTAMP
    `).run(testUserId, testRoadmapId, JSON.stringify([1, 3, 15, 18]), advanceStep);

    row = db.prepare('SELECT current_step FROM roadmap_progress WHERE user_id = ? AND roadmap_id = ?').get(testUserId, testRoadmapId);
    assert.strictEqual(row.current_step, 18, 'current_step should advance to 18');

    console.log('✅ PASS: Roadmap progress monotonicity verified! No step regression on uncheck.');
} finally {
    // Cleanup test record
    db.prepare('DELETE FROM roadmap_progress WHERE user_id = ?').run(testUserId);
}
