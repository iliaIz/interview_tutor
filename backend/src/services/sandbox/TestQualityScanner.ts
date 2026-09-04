export interface TestQualityViolation {
  rule: 'FLAKY_SLEEP' | 'NO_ASSERTIONS' | 'OVER_MOCKING' | 'IGNORED_TEST';
  file: string;
  lineNumber: number;
  snippet: string;
  message: string;
  severity: 'ERROR' | 'WARNING';
}

export interface TestQualityScanResult {
  isValid: boolean;
  violations: TestQualityViolation[];
  summary: {
    flakySleepCount: number;
    noAssertionCount: number;
    overMockingCount: number;
    ignoredTestCount: number;
  };
}

export class TestQualityScanner {
  private static readonly SLEEP_REGEX = /\b(Thread\s*\.\s*sleep|TimeUnit\s*\.\s*\w+\s*\.\s*sleep)\s*\(/;
  private static readonly OVER_MOCK_REGEX = /\bmock\s*\(\s*(List|Map|Set|Collection|ArrayList|HashMap|HashSet)\s*\.\s*class\s*\)/;
  private static readonly ASSERTION_REGEX = /\b(assert\w*|assertThat|expect|verify|fail|await)\s*[\(\{]/;
  private static readonly IGNORED_ANNOTATION_REGEX = /@(?:Disabled|Ignore)\b/;

  /**
   * Scans candidate test files for testing anti-patterns
   */
  public static scan(files: Array<{ path: string; content: string }>): TestQualityScanResult {
    const violations: TestQualityViolation[] = [];
    let flakySleepCount = 0;
    let noAssertionCount = 0;
    let overMockingCount = 0;
    let ignoredTestCount = 0;

    for (const file of files) {
      if (!file.path.toLowerCase().includes('test') || !file.content) continue;

      const lines = file.content.split(/\r?\n/);

      // Line by line checks for Sleep, Over-mocking, and Ignored annotations
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const cleanLine = line.replace(/\/\/.*$/, '').replace(/"(?:[^"\\]|\\.)*"/g, '""'); // strip comments and string literals
        const lineNum = i + 1;

        if (this.SLEEP_REGEX.test(cleanLine)) {
          flakySleepCount++;
          violations.push({
            rule: 'FLAKY_SLEEP',
            file: file.path,
            lineNumber: lineNum,
            snippet: line.trim(),
            message: 'Использование Thread.sleep() в тестах строго запрещено (Flaky timing). Используйте Awaitility или внедряемый java.time.Clock.',
            severity: 'ERROR'
          });
        }

        if (this.OVER_MOCK_REGEX.test(cleanLine)) {
          overMockingCount++;
          violations.push({
            rule: 'OVER_MOCKING',
            file: file.path,
            lineNumber: lineNum,
            snippet: line.trim(),
            message: 'Обнаружено избыточное мокирование (Over-mocking): не мокируйте стандартные коллекции (List, Map, Set). Используйте реальные структуры данных.',
            severity: 'ERROR'
          });
        }

        if (this.IGNORED_ANNOTATION_REGEX.test(cleanLine)) {
          ignoredTestCount++;
          violations.push({
            rule: 'IGNORED_TEST',
            file: file.path,
            lineNumber: lineNum,
            snippet: line.trim(),
            message: 'Тест отключен аннотацией @Disabled / @Ignore. Включите тест перед сдачей.',
            severity: 'WARNING'
          });
        }
      }

      // Check test methods for presence of assertions
      // Matches @Test ... void methodName(...) { ... }
      const methodRegex = /@(?:[\w.]+\.)?(?:Test|ParameterizedTest|TestFactory|RepeatedTest)[\s\S]*?(?:public|protected|private|void)\s+([a-zA-Z0-9_]+)\s*\([^)]*\)\s*(?:throws\s+[\w,\s]+)?\s*\{([\s\S]*?)\}/g;
      let match: RegExpExecArray | null;
      while ((match = methodRegex.exec(file.content)) !== null) {
        const methodName = match[1];
        const methodBody = match[2];

        if (!this.ASSERTION_REGEX.test(methodBody) && !methodName.startsWith('setup') && !methodName.startsWith('tearDown')) {
          noAssertionCount++;
          violations.push({
            rule: 'NO_ASSERTIONS',
            file: file.path,
            lineNumber: 1,
            snippet: `void ${methodName}()`,
            message: `Тестовый метод '${methodName}' не содержит утверждений (assert/assertThat/verify). Тест без ассертов не проверяет поведение сервиса.`,
            severity: 'WARNING'
          });
        }
      }
    }

    const hasErrors = violations.some(v => v.severity === 'ERROR');

    return {
      isValid: !hasErrors,
      violations,
      summary: {
        flakySleepCount,
        noAssertionCount,
        overMockingCount,
        ignoredTestCount
      }
    };
  }
}
