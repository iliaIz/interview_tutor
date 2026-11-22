import { AstSecurityScanner, SecurityViolation } from './AstSecurityScanner';
import { RefactoringAstVerifier, AstViolation } from './RefactoringAstVerifier';
import { TestQualityScanner, TestQualityViolation } from './TestQualityScanner';
import { AstBytecodeConstraint } from '@interview-prep/shared';

export interface StaticAnalysisPolicy {
  structuralConstraints?: AstBytecodeConstraint;
  isRefactoring?: boolean;
  enforceTestQuality?: boolean;
}

export interface StaticAnalysisViolation {
  category: 'SECURITY' | 'AST_INVARIANT' | 'TEST_QUALITY';
  rule: string;
  file: string;
  line: number;
  message: string;
  severity: 'ERROR' | 'WARNING';
}

export interface StaticAnalysisVerdict {
  passed: boolean;
  violations: StaticAnalysisViolation[];
  blockingFailure?: {
    gate: 'JVM_UNIT_TESTS' | 'AST_INVARIANTS' | 'MUTATION_TESTS';
    score: number;
    error: string;
  };
}

/**
 * JavaStaticAnalysisEngine
 * Unified Pre-Execution Static Analysis Seam (Spec 24).
 * Performs zero-overhead (<5ms) synchronous static verification across:
 * 1. Security Scanner (dangerous OS/reflection/network calls)
 * 2. Structural AST Verifier (refactoring & design pattern constraints)
 * 3. Test Quality Scanner (flaky sleep, over-mocking, missing assertions)
 * Cognitive Bounding Limit: <= 250 lines (Rule 8).
 */
export class JavaStaticAnalysisEngine {
  public static verify(
    files: Array<{ path: string; content: string }>,
    policy: StaticAnalysisPolicy = {}
  ): StaticAnalysisVerdict {
    const violations: StaticAnalysisViolation[] = [];

    // 1. Fast Security AST Scan
    const secResult = AstSecurityScanner.scan(files);
    if (!secResult.isSafe) {
      for (const v of secResult.violations) {
        violations.push({
          category: 'SECURITY',
          rule: v.rule,
          file: v.file,
          line: v.lineNumber,
          message: v.message,
          severity: 'ERROR'
        });
      }
      return {
        passed: false,
        violations,
        blockingFailure: {
          gate: 'JVM_UNIT_TESTS',
          score: 0,
          error: `Отклонено политикой безопасности песочницы: ${secResult.violations[0]?.message || 'обнаружен запрещенный вызов'}`
        }
      };
    }

    // 2. Structural AST Verification (Smells, Patterns, Clock/Loom/Money Invariants)
    if (policy.structuralConstraints) {
      const astResult = RefactoringAstVerifier.verify(files, policy.structuralConstraints);
      if (!astResult.passed) {
        for (const v of astResult.violations) {
          violations.push({
            category: 'AST_INVARIANT',
            rule: v.rule,
            file: v.file,
            line: v.lineNumber,
            message: v.message,
            severity: 'ERROR'
          });
        }
        return {
          passed: false,
          violations,
          blockingFailure: {
            gate: 'AST_INVARIANTS',
            score: 30,
            error: `Отклонено Gate 2 AST: ${astResult.violations[0]?.message || 'нарушение инвариантов'}`
          }
        };
      }
    }

    // 3. Test Quality Scan (Testing Anti-Patterns)
    const hasTestFiles = files.some(f => f.path.toLowerCase().includes('test'));
    if (policy.enforceTestQuality && hasTestFiles) {
      const qualityResult = TestQualityScanner.scan(files);
      const errors = (qualityResult.violations || []).filter(v => v.severity === 'ERROR');
      if (errors.length > 0) {
        for (const v of qualityResult.violations) {
          violations.push({
            category: 'TEST_QUALITY',
            rule: v.rule,
            file: v.file,
            line: v.lineNumber,
            message: v.message,
            severity: v.severity
          });
        }
        return {
          passed: false,
          violations,
          blockingFailure: {
            gate: 'MUTATION_TESTS',
            score: 20,
            error: `Отклонено проверкой качества тестов: ${errors[0]?.message}`
          }
        };
      }
    }

    return {
      passed: true,
      violations
    };
  }
}
