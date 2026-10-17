import { AstBytecodeConstraint } from '@interview-prep/shared';

/**
 * RefactoringAstVerifier.ts
 * Gate 2: In-Memory AST Structural Verifier for Refactoring Katas.
 * Validates that candidate didn't just 'make tests pass' but actually
 * eliminated architectural smells (e.g. synchronized in Loom, double in Money, ThreadLocal).
 * Cognitive bounding limit: <= 350 lines (Rule 8).
 */

export interface AstViolation {
  rule: string;
  file: string;
  lineNumber: number;
  snippet: string;
  message: string;
}

export interface AstVerificationResult {
  passed: boolean;
  violations: AstViolation[];
}

export class RefactoringAstVerifier {
  /**
   * Statically verifies that submitted source files satisfy structural architectural constraints.
   */
  public static verify(
    files: Array<{ path: string; content: string }>,
    constraints?: AstBytecodeConstraint
  ): AstVerificationResult {
    const violations: AstViolation[] = [];
    if (!constraints) {
      return { passed: true, violations };
    }

    const {
      disallowedAstNodes = [],
      disallowedClassImports = [],
      disallowedFieldTypes = [],
      requiredInjections = []
    } = constraints;

    // Filter to main source files (ignore test files for structural domain rules)
    const sourceFiles = files.filter(f => !f.path.includes('Test') && !f.path.includes('/test/'));

    for (const file of sourceFiles) {
      if (!file.content) continue;

      // 1. Strip block comments preserving line counts
      const withoutBlockComments = file.content.replace(/\/\*[\s\S]*?\*\//g, match =>
        match.replace(/[^\n]/g, ' ')
      );
      const lines = withoutBlockComments.split(/\r?\n/);

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const cleanCode = line.replace(/\/\/.*$/, '').replace(/"(?:\\.|[^"\\])*"/g, '""');
        const lineNum = i + 1;

        // Check 1: Disallowed AST Nodes (e.g. SynchronizedTree for Project Loom Carrier Pinning)
        if (disallowedAstNodes.includes('SynchronizedTree')) {
          if (/\bsynchronized\s*[\({]/.test(cleanCode)) {
            violations.push({
              rule: 'DISALLOWED_SYNCHRONIZED_LOCK',
              file: file.path,
              lineNumber: lineNum,
              snippet: line.trim(),
              message: 'Обнаружен блок synchronized. В Project Loom используйте ReentrantLock для предотвращения пиннинга потоков-носителей (Carrier Pinning).'
            });
          }
        }

        // Check 2: Disallowed Class Imports (e.g. ThreadLocal or legacy javax.*)
        for (const disallowedImport of disallowedClassImports) {
          const importPattern = new RegExp(`\\bimport\\s+${disallowedImport.replace('*', '.*')}`);
          if (importPattern.test(cleanCode) || (disallowedImport === 'java.lang.ThreadLocal' && /\bThreadLocal\s*</.test(cleanCode))) {
            violations.push({
              rule: 'DISALLOWED_IMPORT',
              file: file.path,
              lineNumber: lineNum,
              snippet: line.trim(),
              message: `Использование ${disallowedImport} запрещено архитектурным контрактом задачи (миграция на ScopedValue / jakarta.*).`
            });
          }
        }

        // Check 3: Disallowed Field Types (e.g. double or float in financial domains)
        for (const disallowedType of disallowedFieldTypes) {
          const fieldPattern = new RegExp(`\\b(?:private|protected|public)\\s+(?:final\\s+)?(?:${disallowedType}|Double|Float)\\s+\\w+`);
          if (fieldPattern.test(cleanCode)) {
            violations.push({
              rule: 'DISALLOWED_PRIMITIVE_TYPE',
              file: file.path,
              lineNumber: lineNum,
              snippet: line.trim(),
              message: `Использование примитивного типа '${disallowedType}' запрещено в финансовом домене. Используйте java.math.BigDecimal или Value Object Money.`
            });
          }
        }
      }

      // Check 4: Required Injections (e.g. java.time.Clock injection into service)
      for (const requiredType of requiredInjections) {
        const typeSimpleName = requiredType.split('.').pop() || requiredType;
        const hasInjection = new RegExp(`\\b${typeSimpleName}\\b`).test(file.content);
        if (!hasInjection) {
          violations.push({
            rule: 'MISSING_REQUIRED_INJECTION',
            file: file.path,
            lineNumber: 1,
            snippet: file.path,
            message: `Сервис обязан внедрять '${requiredType}' через конструктор для обеспечения детерминированного тестирования времени.`
          });
        }
      }
    }

    return {
      passed: violations.length === 0,
      violations
    };
  }
}
