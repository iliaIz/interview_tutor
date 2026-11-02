import { AstBytecodeConstraint } from '@interview-prep/shared';

/**
 * RefactoringAstVerifier.ts
 * Gate 2: In-Memory AST Structural Verifier for Refactoring & Design Pattern Katas.
 * Validates that candidate didn't just 'make tests pass' but actually
 * eliminated architectural smells (e.g. synchronized in Loom, double in Money,
 * mutable Singletons, procedural status switches, or missing sealed/record idioms).
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
      requiredInjections = [],
      disallowedConstructs = [],
      requiredKeywords = [],
      maxMethodLines
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

        // Check 2: Disallowed Class Imports (e.g. ThreadLocal or legacy javax.*, optionally file-scoped 'TargetFile:import.path')
        for (const disallowedImport of disallowedClassImports) {
          let targetFileFilter: string | null = null;
          let importName = disallowedImport;
          if (disallowedImport.includes(':')) {
            const parts = disallowedImport.split(':');
            targetFileFilter = parts[0];
            importName = parts[1];
          }
          if (targetFileFilter && !file.path.includes(targetFileFilter)) {
            continue;
          }

          const importPattern = new RegExp(`\\bimport\\s+${importName.replace('*', '.*')}`);
          if (importPattern.test(cleanCode) || (importName === 'java.lang.ThreadLocal' && /\bThreadLocal\s*</.test(cleanCode))) {
            violations.push({
              rule: 'DISALLOWED_IMPORT',
              file: file.path,
              lineNumber: lineNum,
              snippet: line.trim(),
              message: `Использование ${importName} запрещено ${targetFileFilter ? `в ${targetFileFilter}` : ''} архитектурным контрактом задачи (миграция на ScopedValue / Hexagonal Port / jakarta.*).`
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

        // Check 4: Disallowed Constructs (e.g. getInstance singleton, procedural state switch, Thread.sleep, optionally 'TargetFile:construct')
        for (const rawConstruct of disallowedConstructs) {
          let targetFileFilter: string | null = null;
          let construct = rawConstruct;
          if (rawConstruct.includes(':')) {
            const parts = rawConstruct.split(':');
            targetFileFilter = parts[0];
            construct = parts[1];
          }
          if (targetFileFilter && !file.path.includes(targetFileFilter)) {
            continue;
          }

          if (construct === 'getInstance' || construct === 'SINGLETON_INSTANCE' || construct === 'getInstance()') {
            if (/\b(?:public\s+static\s+\w+\s+)?getInstance\s*\(/.test(cleanCode)) {
              violations.push({
                rule: 'DISALLOWED_SINGLETON_CONSTRUCT',
                file: file.path,
                lineNumber: lineNum,
                snippet: line.trim(),
                message: 'Обнаружен метод/вызов getInstance(). Использование мутабельного Singleton является антипаттерном. Используйте внедрение зависимостей через Spring DI.'
              });
            }
          } else if (construct === 'synchronized') {
            if (/\bsynchronized\s*[\({]/.test(cleanCode)) {
              violations.push({
                rule: 'DISALLOWED_SYNCHRONIZED_CONSTRUCT',
                file: file.path,
                lineNumber: lineNum,
                snippet: line.trim(),
                message: 'Использование synchronized запрещено. Применяйте ReentrantLock или Concurrent структуры данных.'
              });
            }
          } else if (construct === 'Thread.sleep') {
            if (/\bThread\.sleep\s*\(/.test(cleanCode)) {
              violations.push({
                rule: 'DISALLOWED_THREAD_SLEEP',
                file: file.path,
                lineNumber: lineNum,
                snippet: line.trim(),
                message: 'Использование Thread.sleep запрещено в неблокирующей архитектуре.'
              });
            }
          } else if (construct === 'System.currentTimeMillis') {
            if (/\bSystem\.currentTimeMillis\s*\(/.test(cleanCode)) {
              violations.push({
                rule: 'DISALLOWED_SYSTEM_TIME',
                file: file.path,
                lineNumber: lineNum,
                snippet: line.trim(),
                message: 'Прямой вызов System.currentTimeMillis() запрещен. Внедряйте java.time.Clock через конструктор.'
              });
            }
          } else if (construct === 'PROCEDURAL_STATE_SWITCH') {
            if (/\bswitch\s*\([^)]*(?:status|state)\b/i.test(cleanCode)) {
              violations.push({
                rule: 'DISALLOWED_PROCEDURAL_SWITCH',
                file: file.path,
                lineNumber: lineNum,
                snippet: line.trim(),
                message: 'Обнаружен процедурный switch по статусу/состоянию. Замените на полиморфный паттерн State (каждое состояние инкапсулирует свое поведение).'
              });
            }
          } else {
            // General construct / identifier / call pattern check (e.g. ExpressionVisitor, PaymentStrategy, this.updateAuditLog)
            const isIdentifier = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(construct);
            const pattern = isIdentifier
              ? new RegExp(`\\b${construct}\\b`)
              : new RegExp(construct.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

            if (pattern.test(cleanCode)) {
              violations.push({
                rule: 'DISALLOWED_CONSTRUCT',
                file: file.path,
                lineNumber: lineNum,
                snippet: line.trim(),
                message: `Использование '${construct}' запрещено архитектурным контрактом задачи.`
              });
            }
          }
        }
      }

      // Check 5: Required Injections (e.g. java.time.Clock injection into service)
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

      // Check 6: Max Method Lines
      if (maxMethodLines && maxMethodLines > 0) {
        this.checkMethodLengths(file, lines, maxMethodLines, violations);
      }
    }

    // Check 7: Required Keywords (e.g. sealed interface, permits, record across all source files)
    if (requiredKeywords && requiredKeywords.length > 0 && sourceFiles.length > 0) {
      const allContent = sourceFiles.map(f => f.content).join('\n');
      for (const kw of requiredKeywords) {
        const pattern = new RegExp(`\\b${kw.replace(/\s+/g, '\\s+')}\\b`);
        if (!pattern.test(allContent)) {
          violations.push({
            rule: 'MISSING_REQUIRED_KEYWORD',
            file: sourceFiles[0].path,
            lineNumber: 1,
            snippet: kw,
            message: `Решение обязано использовать идиому Java 21 '${kw}' согласно архитектурному контракту задачи.`
          });
        }
      }
    }

    return {
      passed: violations.length === 0,
      violations
    };
  }

  private static checkMethodLengths(
    file: { path: string },
    lines: string[],
    maxLines: number,
    violations: AstViolation[]
  ): void {
    let currentMethodName: string | null = null;
    let methodStartLine = 0;
    let braceDepth = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const clean = line.replace(/\/\/.*$/, '').replace(/"(?:\\.|[^"\\])*"/g, '""');

      const methodMatch = /(?:public|protected|private)\s+(?:static\s+)?(?:final\s+)?[\w<>[\]]+\s+(\w+)\s*\([^)]*\)\s*(?:throws\s+[\w,\s]+)?\{/.exec(clean);
      if (methodMatch && braceDepth === 1) {
        currentMethodName = methodMatch[1];
        methodStartLine = i + 1;
      }

      for (const char of clean) {
        if (char === '{') braceDepth++;
        else if (char === '}') {
          braceDepth--;
          if (braceDepth === 1 && currentMethodName) {
            const length = (i + 1) - methodStartLine;
            if (length > maxLines) {
              violations.push({
                rule: 'METHOD_LENGTH_EXCEEDED',
                file: file.path,
                lineNumber: methodStartLine,
                snippet: `${currentMethodName}() [${length} lines]`,
                message: `Метод '${currentMethodName}' превышает максимальный лимит в ${maxLines} строк (${length} строк). Декомпозируйте логику.`
              });
            }
            currentMethodName = null;
          }
        }
      }
    }
  }
}
