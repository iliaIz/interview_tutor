/**
 * diff.ts
 * Pure deterministic unified diff generator for side-by-side / inline inspection.
 * Cognitive Bounding SLA: <= 100 lines (Rule 8 compliant).
 */

export function generateUnifiedDiff(original: string, fixed: string): string {
  const origLines = (original || '').trim().split('\n');
  const fixedLines = (fixed || '').trim().split('\n');
  const diff: string[] = [];

  let i = 0;
  let j = 0;

  while (i < origLines.length || j < fixedLines.length) {
    const oLine = origLines[i];
    const fLine = fixedLines[j];

    if (oLine === fLine) {
      if (oLine !== undefined) diff.push(' ' + oLine);
      i++;
      j++;
    } else {
      const nextMatchInFixed = fLine ? origLines.indexOf(fLine, i) : -1;
      const nextMatchInOrig = oLine ? fixedLines.indexOf(oLine, j) : -1;

      if (oLine !== undefined && (nextMatchInFixed !== -1 || j >= fixedLines.length)) {
        diff.push('-' + oLine);
        i++;
      } else if (fLine !== undefined && (nextMatchInOrig !== -1 || i >= origLines.length)) {
        diff.push('+' + fLine);
        j++;
      } else {
        if (oLine !== undefined) {
          diff.push('-' + oLine);
          i++;
        }
        if (fLine !== undefined) {
          diff.push('+' + fLine);
          j++;
        }
      }
    }
  }

  return diff.join('\n');
}
