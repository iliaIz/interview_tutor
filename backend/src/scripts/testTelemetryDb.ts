/**
 * testTelemetryDb.ts
 *
 * SOTA September 2026 SQLite Persistence, Migration & Backward Compatibility Test Suite
 * for Auto-VAD Turn Telemetry.
 */

import Database from 'better-sqlite3';
import { TurnTelemetryEvent, TurnTelemetryEventSchema } from '@interview-prep/shared';

interface AssertionContext {
  passed: number;
  failed: number;
  failures: string[];
}

const ctx: AssertionContext = { passed: 0, failed: 0, failures: [] };

function assert(condition: boolean, testName: string, detail?: string): void {
  if (condition) {
    ctx.passed++;
    console.log(`  ✅ ${testName}`);
  } else {
    ctx.failed++;
    const msg = detail ? `${testName}: ${detail}` : testName;
    ctx.failures.push(msg);
    console.error(`  ❌ ${testName} ${detail ? `(${detail})` : ''}`);
  }
}

function safeParseJson(jsonString: string | null | undefined, fallback: any = null): any {
  if (!jsonString) return fallback;
  try {
    return JSON.parse(jsonString);
  } catch {
    return fallback;
  }
}

// =========================================================================
// TEST 1: Schema Setup & Idempotent Migration
// =========================================================================
function testMigrationIdempotency(): Database.Database {
  console.log('\n[Test 1] Schema Setup & Migration Idempotency');

  const db = new Database(':memory:');

  // Create base table WITHOUT turn_telemetry column (simulating legacy v1 schema)
  db.exec(`
    CREATE TABLE questions (
      id TEXT PRIMARY KEY,
      topic TEXT,
      question TEXT,
      answer TEXT
    );

    CREATE TABLE question_evaluations (
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Insert a dummy question
  db.prepare(`INSERT INTO questions (id, topic, question, answer) VALUES ('Q1', 'Java', 'What is volatile?', 'Visibility')`).run();

  // Run Migration 1st time
  const runMigration = () => {
    const cols = db.pragma('table_info(question_evaluations)') as Array<{ name: string }>;
    if (!cols.some((c) => c.name === 'turn_telemetry')) {
      db.exec('ALTER TABLE question_evaluations ADD COLUMN turn_telemetry TEXT');
      return true;
    }
    return false;
  };

  const firstRun = runMigration();
  assert(firstRun === true, 'First migration run added turn_telemetry column');

  // Verify column exists
  let cols = db.pragma('table_info(question_evaluations)') as Array<{ name: string }>;
  assert(cols.some((c) => c.name === 'turn_telemetry'), 'turn_telemetry column is now present in PRAGMA table_info');

  // Run Migration 2nd time (idempotency check)
  let secondRunError = false;
  let secondRunResult = false;
  try {
    secondRunResult = runMigration();
  } catch {
    secondRunError = true;
  }

  assert(!secondRunError, 'Second migration run executed without SQL error');
  assert(secondRunResult === false, 'Second migration run safely skipped (column already existed)');

  return db;
}

// =========================================================================
// TEST 2: Valid Turn Telemetry Array Insertion & Deserialization
// =========================================================================
function testCleanInsertionAndQuery(db: Database.Database): void {
  console.log('\n[Test 2] Clean Multi-Turn Telemetry Insertion & Deserialization');

  const turn1: TurnTelemetryEvent = {
    turnId: 'turn_sess1_0_100',
    sessionId: 'sess_db_test',
    turnIndex: 0,
    speaker: 'model',
    vadPauseSettingMs: 1800,
    speechDurationMs: 0,
    ttfrMs: 300,
    ttftMs: 600,
    ttfaMs: 850,
    ttfpMs: 950,
    audioTextSkewMs: 350,
    audioDurationMs: 4000,
    textChars: 90,
    echoLeakageDroppedMs: 0,
    networkRttMs: 35,
    modelName: 'gemini-live-v3',
    wasBargeIn: false,
    bargeInType: null,
    createdAt: Date.now()
  };

  const turn2: TurnTelemetryEvent = {
    turnId: 'turn_sess1_1_200',
    sessionId: 'sess_db_test',
    turnIndex: 1,
    speaker: 'model',
    vadPauseSettingMs: 1800,
    speechDurationMs: 4500,
    ttfrMs: 200,
    ttftMs: 500,
    ttfaMs: 700,
    ttfpMs: 780,
    audioTextSkewMs: 80,
    audioDurationMs: 3500,
    textChars: 75,
    echoLeakageDroppedMs: 40,
    networkRttMs: 42,
    modelName: 'gemini-live-v3',
    wasBargeIn: true,
    bargeInType: 'tactile',
    createdAt: Date.now()
  };

  const telemetryHistory: TurnTelemetryEvent[] = [turn1, turn2];
  const evalId = 'eval_clean_123';

  db.prepare(`
    INSERT INTO question_evaluations (
      id, question_id, topic, mode, score, is_passed, turn_telemetry
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(evalId, 'Q1', 'Java', 'voice', 90, 1, JSON.stringify(telemetryHistory));

  // Query back
  const row = db.prepare('SELECT * FROM question_evaluations WHERE id = ?').get(evalId) as any;
  assert(row !== undefined, 'Record found in database');

  const deserialized = safeParseJson(row.turn_telemetry, []);
  assert(Array.isArray(deserialized), 'Deserialized turn_telemetry is an Array');
  assert(deserialized.length === 2, 'Array contains exactly 2 turns', `Got ${deserialized.length}`);

  const loadedTurn1 = deserialized[0] as TurnTelemetryEvent;
  assert(loadedTurn1.turnIndex === 0, 'Turn 0 index preserved');
  assert(loadedTurn1.ttfaMs === 850, 'Turn 0 TTFA preserved as 850ms');
  assert(loadedTurn1.audioTextSkewMs === 350, 'Turn 0 Skew preserved as 350ms');

  const loadedTurn2 = deserialized[1] as TurnTelemetryEvent;
  assert(loadedTurn2.turnIndex === 1, 'Turn 1 index preserved');
  assert(loadedTurn2.wasBargeIn === true, 'Turn 1 barge-in flag preserved as true');
  assert(loadedTurn2.bargeInType === 'tactile', 'Turn 1 barge-in type preserved as tactile');
  assert(loadedTurn2.echoLeakageDroppedMs === 40, 'Turn 1 echo leakage preserved as 40ms');
}

// =========================================================================
// TEST 3: Legacy Record Backward Compatibility (NULL turn_telemetry)
// =========================================================================
function testLegacyNullBackwardCompatibility(db: Database.Database): void {
  console.log('\n[Test 3] Legacy Record Backward Compatibility (NULL turn_telemetry)');

  const legacyEvalId = 'eval_legacy_456';
  db.prepare(`
    INSERT INTO question_evaluations (
      id, question_id, topic, mode, score, is_passed, turn_telemetry
    ) VALUES (?, ?, ?, ?, ?, ?, NULL)
  `).run(legacyEvalId, 'Q1', 'Java', 'voice', 80, 1);

  const row = db.prepare('SELECT * FROM question_evaluations WHERE id = ?').get(legacyEvalId) as any;
  assert(row.turn_telemetry === null, 'Legacy record has NULL turn_telemetry');

  // Hydration fallback
  const hydrated = safeParseJson(row.turn_telemetry, []);
  assert(Array.isArray(hydrated), 'Hydrated legacy record returns an array');
  assert(hydrated.length === 0, 'Hydrated legacy record returns empty array [] without error');
}

// =========================================================================
// TEST 4: Corrupted JSON String Resilience
// =========================================================================
function testCorruptedJsonResilience(db: Database.Database): void {
  console.log('\n[Test 4] Corrupted JSON String Resilience');

  const corruptEvalId = 'eval_corrupt_789';
  db.prepare(`
    INSERT INTO question_evaluations (
      id, question_id, topic, mode, score, is_passed, turn_telemetry
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(corruptEvalId, 'Q1', 'Java', 'voice', 65, 0, '{malformed json string...');

  const row = db.prepare('SELECT * FROM question_evaluations WHERE id = ?').get(corruptEvalId) as any;
  assert(row.turn_telemetry.startsWith('{malformed'), 'Corrupted record read from DB');

  let didThrow = false;
  let parsedResult: any = null;
  try {
    parsedResult = safeParseJson(row.turn_telemetry, []);
  } catch {
    didThrow = true;
  }

  assert(!didThrow, 'safeParseJson did not throw an unhandled exception');
  assert(Array.isArray(parsedResult) && parsedResult.length === 0, 'Corrupted JSON safely fell back to empty array []');
}

// =========================================================================
// MAIN RUNNER
// =========================================================================
export function runTelemetryDbTests(): boolean {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  💾 SOTA 2026 SQLITE TELEMETRY PERSISTENCE & MIGRATION SUITE');
  console.log('═══════════════════════════════════════════════════════════════');

  const db = testMigrationIdempotency();
  testCleanInsertionAndQuery(db);
  testLegacyNullBackwardCompatibility(db);
  testCorruptedJsonResilience(db);
  db.close();

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(`  SUMMARY: ${ctx.passed} Passed | ${ctx.failed} Failed`);
  console.log('═══════════════════════════════════════════════════════════════');

  if (ctx.failed > 0) {
    console.error('❌ Test Failures:');
    ctx.failures.forEach((f) => console.error(`  - ${f}`));
    return false;
  }
  return true;
}

if (require.main === module) {
  const success = runTelemetryDbTests();
  process.exit(success ? 0 : 1);
}
