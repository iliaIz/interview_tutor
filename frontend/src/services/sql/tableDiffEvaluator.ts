import { SqlResultDiff } from '@interview-prep/shared';

/**
 * tableDiffEvaluator.ts
 * Deterministic relational tuple comparison service for SQL Arena (Pillar 10).
 * Handles Three-Valued Logic NULLs, floating point precision, and order checking.
 * File length limit: <= 350 lines (Rule 8).
 */

function normalizeValue(val: unknown): unknown {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') {
    // Round to 4 decimal places to prevent float epsilon mismatches
    return Math.round(val * 10000) / 10000;
  }
  if (typeof val === 'boolean') return val;
  if (val instanceof Date) return val.toISOString();
  if (typeof val === 'string') return val.trim();
  return String(val).trim();
}

function areValuesEqual(a: unknown, b: unknown): boolean {
  const normA = normalizeValue(a);
  const normB = normalizeValue(b);

  if (normA === null && normB === null) return true;
  if (normA === null || normB === null) return false;

  if (typeof normA === 'number' && typeof normB === 'number') {
    return Math.abs(normA - normB) < 0.0001;
  }

  return normA === normB;
}

function areRowsEqual(
  expected: Record<string, unknown>,
  actual: Record<string, unknown>,
  columns: string[]
): boolean {
  for (const col of columns) {
    const expVal = expected[col];
    const actVal = actual[col];
    if (!areValuesEqual(expVal, actVal)) {
      return false;
    }
  }
  return true;
}

export function evaluateSqlResultDiff(
  expectedRows: Record<string, unknown>[],
  actualRows: Record<string, unknown>[],
  orderMatters: boolean
): SqlResultDiff {
  const expectedCols = expectedRows.length > 0 ? Object.keys(expectedRows[0]).map((k) => k.toLowerCase()) : [];
  const actualCols = actualRows.length > 0 ? Object.keys(actualRows[0]).map((k) => k.toLowerCase()) : [];

  // Normalize column case in row records
  const normExpectedRows = expectedRows.map((r) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(r)) out[k.toLowerCase()] = v;
    return out;
  });

  const normActualRows = actualRows.map((r) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(r)) out[k.toLowerCase()] = v;
    return out;
  });

  // Check column counts and names
  const sortedExpCols = [...expectedCols].sort();
  const sortedActCols = [...actualCols].sort();
  const columnMismatch =
    sortedExpCols.length !== sortedActCols.length ||
    sortedExpCols.some((c, i) => c !== sortedActCols[i]);

  if (columnMismatch) {
    return {
      isMatched: false,
      columnMismatch: true,
      expectedColumns: expectedCols,
      actualColumns: actualCols,
      expectedRowCount: expectedRows.length,
      actualRowCount: actualRows.length,
      missingRows: normExpectedRows,
      unexpectedRows: normActualRows,
      orderMismatch: false
    };
  }

  // Check row counts
  if (expectedRows.length !== actualRows.length) {
    return {
      isMatched: false,
      columnMismatch: false,
      expectedColumns: expectedCols,
      actualColumns: actualCols,
      expectedRowCount: expectedRows.length,
      actualRowCount: actualRows.length,
      missingRows: normExpectedRows.slice(actualRows.length),
      unexpectedRows: normActualRows.slice(expectedRows.length),
      orderMismatch: false
    };
  }

  // Row matching
  if (orderMatters) {
    for (let i = 0; i < normExpectedRows.length; i++) {
      if (!areRowsEqual(normExpectedRows[i], normActualRows[i], expectedCols)) {
        return {
          isMatched: false,
          columnMismatch: false,
          expectedColumns: expectedCols,
          actualColumns: actualCols,
          expectedRowCount: expectedRows.length,
          actualRowCount: actualRows.length,
          missingRows: [normExpectedRows[i]],
          unexpectedRows: [normActualRows[i]],
          orderMismatch: true
        };
      }
    }

    return {
      isMatched: true,
      columnMismatch: false,
      expectedColumns: expectedCols,
      actualColumns: actualCols,
      expectedRowCount: expectedRows.length,
      actualRowCount: actualRows.length,
      missingRows: [],
      unexpectedRows: [],
      orderMismatch: false
    };
  }

  // Order does not matter: Multiset bag equality
  const unmatchedActual = [...normActualRows];
  const missingRows: Record<string, unknown>[] = [];

  for (const expRow of normExpectedRows) {
    const matchIdx = unmatchedActual.findIndex((actRow) =>
      areRowsEqual(expRow, actRow, expectedCols)
    );
    if (matchIdx !== -1) {
      unmatchedActual.splice(matchIdx, 1);
    } else {
      missingRows.push(expRow);
    }
  }

  const isMatched = missingRows.length === 0 && unmatchedActual.length === 0;

  return {
    isMatched,
    columnMismatch: false,
    expectedColumns: expectedCols,
    actualColumns: actualCols,
    expectedRowCount: expectedRows.length,
    actualRowCount: actualRows.length,
    missingRows,
    unexpectedRows: unmatchedActual,
    orderMismatch: false
  };
}
