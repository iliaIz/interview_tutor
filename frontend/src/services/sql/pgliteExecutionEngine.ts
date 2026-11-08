import { PGlite } from '@electric-sql/pglite';
import { SqlChallenge, SqlExecutionResult } from '@interview-prep/shared';
import { evaluateSqlResultDiff } from './tableDiffEvaluator';

/**
 * pgliteExecutionEngine.ts
 * In-browser WebAssembly PostgreSQL 16 execution engine (Pillar 10).
 * Executes SQL challenges client-side in an ephemeral in-memory database with 0 MB VPS load.
 * File length limit: <= 350 lines (Rule 8).
 */

export interface SqlRunOptions {
  timeoutMs?: number;
}

export async function executeSqlChallenge(
  challenge: SqlChallenge,
  candidateQuery: string,
  options: SqlRunOptions = {}
): Promise<SqlExecutionResult> {
  const timeoutMs = options.timeoutMs || 8000;
  let db: PGlite | null = null;

  try {
    // 1. Initialize ephemeral in-memory PostgreSQL instance
    db = new PGlite();
    await db.waitReady;

    // 2. Apply Schema DDL & Seed Fixtures
    if (challenge.schemaSql) {
      await db.exec(challenge.schemaSql);
    }
    if (challenge.seedSql) {
      await db.exec(challenge.seedSql);
    }

    // 3. Compute Ground-Truth Reference Result
    const expectedRes = await db.query(challenge.expectedQuery);
    const expectedRows = (expectedRes.rows || []) as Record<string, unknown>[];

    // 4. Execute Candidate Query with Telemetry
    const startTime = performance.now();

    // Wrap query execution in a promise timeout
    const queryPromise = db.query(candidateQuery);
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Query execution timed out (${timeoutMs}ms)`)), timeoutMs)
    );

    const candidateRes = await Promise.race([queryPromise, timeoutPromise]);
    const executionTimeMs = Math.max(1, Math.round(performance.now() - startTime));

    const actualRows = (candidateRes.rows || []) as Record<string, unknown>[];
    const columns = actualRows.length > 0
      ? Object.keys(actualRows[0])
      : (candidateRes.fields || []).map((f) => f.name);

    // 5. Compute Deterministic Result Diff
    const diff = evaluateSqlResultDiff(expectedRows, actualRows, challenge.orderMatters);

    return {
      success: diff.isMatched,
      executionTimeMs,
      rowCount: actualRows.length,
      columns,
      rows: actualRows,
      diff
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      executionTimeMs: 0,
      rowCount: 0,
      columns: [],
      rows: [],
      error: errorMsg
    };
  } finally {
    if (db) {
      try {
        await db.close();
      } catch {
        // Silently handle close cleanup
      }
    }
  }
}

/**
 * Preview helper: runs a query directly against an initialized schema without grading.
 */
export async function previewSqlQuery(
  schemaSql: string,
  seedSql: string,
  query: string
): Promise<{ columns: string[]; rows: Record<string, unknown>[]; executionTimeMs: number; error?: string }> {
  let db: PGlite | null = null;
  try {
    db = new PGlite();
    await db.waitReady;
    if (schemaSql) await db.exec(schemaSql);
    if (seedSql) await db.exec(seedSql);

    const startTime = performance.now();
    const res = await db.query(query);
    const executionTimeMs = Math.max(1, Math.round(performance.now() - startTime));

    const rows = (res.rows || []) as Record<string, unknown>[];
    const columns = rows.length > 0 ? Object.keys(rows[0]) : (res.fields || []).map((f) => f.name);

    return { columns, rows, executionTimeMs };
  } catch (err) {
    return {
      columns: [],
      rows: [],
      executionTimeMs: 0,
      error: err instanceof Error ? err.message : String(err)
    };
  } finally {
    if (db) {
      try {
        await db.close();
      } catch {}
    }
  }
}
