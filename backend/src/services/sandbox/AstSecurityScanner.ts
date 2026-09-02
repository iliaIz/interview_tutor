export interface SecurityViolation {
  rule: string;
  file: string;
  lineNumber: number;
  snippet: string;
  message: string;
}

export interface SecurityScanResult {
  isSafe: boolean;
  violations: SecurityViolation[];
}

interface ForbiddenPattern {
  rule: string;
  regex: RegExp;
  message: string;
}

const FORBIDDEN_PATTERNS: ForbiddenPattern[] = [
  {
    rule: 'NO_SYSTEM_EXIT',
    regex: /\bSystem\s*\.\s*exit\s*\(/,
    message: 'Вызов System.exit() строго запрещен в песочнице.'
  },
  {
    rule: 'NO_PROCESS_EXEC',
    regex: /\b(Runtime\s*\.\s*getRuntime\s*\(\s*\)\s*\.\s*exec|ProcessBuilder|ProcessHandle)\b/,
    message: 'Запуск внешних процессов ОС и вызовы Runtime.exec() строго запрещены.'
  },
  {
    rule: 'NO_UNSAFE',
    regex: /\b(sun\.misc\.Unsafe|jdk\.internal\.misc\.Unsafe)\b/,
    message: 'Использование Unsafe памяти запрещено политикой безопасности.'
  },
  {
    rule: 'NO_REFLECTION_ACCESS_BYPASS',
    regex: /\.setAccessible\s*\(\s*true\s*\)/,
    message: 'Рефлексивный обход инкапсуляции (.setAccessible(true)) запрещен.'
  },
  {
    rule: 'NO_NATIVE_METHODS',
    regex: /\bnative\s+[\w<>[\]]+\s+\w+\s*\(/,
    message: 'Объявление нативных методов JNI (native) запрещено.'
  },
  {
    rule: 'NO_NATIVE_LIBRARY_LOAD',
    regex: /\bSystem\s*\.\s*(load|loadLibrary)\s*\(/,
    message: 'Загрузка динамических нативных библиотек запрещена.'
  },
  {
    rule: 'NO_NETWORK_SOCKETS',
    regex: /\b(new\s+Socket|new\s+ServerSocket|java\.net\.URL|HttpURLConnection|HttpClient\.newHttpClient)\b/,
    message: 'Прямые сетевые соединения и вызовы сокетов заблокированы в изолированной среде.'
  },
  {
    rule: 'NO_FILESYSTEM_WRITES',
    regex: /\b(new\s+FileOutputStream|new\s+FileWriter|new\s+RandomAccessFile|Files\s*\.\s*(write|delete|createFile|createDirectory))\b/,
    message: 'Прямая запись на физический диск запрещена. Используйте in-memory структуры данных.'
  },
  {
    rule: 'NO_THREAD_PRIORITY_HIJACK',
    regex: /\.setPriority\s*\(\s*(Thread\s*\.\s*MAX_PRIORITY|10)\s*\)/,
    message: 'Повышение приоритета потоков до MAX_PRIORITY запрещено.'
  }
];

export class AstSecurityScanner {
  /**
   * Scans an array of workspace source files for dangerous APIs and security violations.
   * Strips both multi-line and single-line comments, as well as string literals,
   * completely eliminating false-positive reports in comments or string log messages.
   */
  public static scan(files: Array<{ path: string; content: string }>): SecurityScanResult {
    const violations: SecurityViolation[] = [];

    for (const file of files) {
      if (!file.content || typeof file.content !== 'string') continue;

      // 1. Strip block comments while strictly preserving newline counts for accurate line numbering
      const withoutBlockComments = file.content.replace(/\/\*[\s\S]*?\*\//g, (match) => {
        return match.replace(/[^\n]/g, ' ');
      });

      const lines = withoutBlockComments.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // 2. Strip single-line comments
        let cleanCode = line.replace(/\/\/.*$/, '');
        // 3. Strip string and character literals (e.g. "System.exit", 'a')
        cleanCode = cleanCode.replace(/"(?:\\.|[^"\\])*"/g, '""').replace(/'(?:\\.|[^'\\])*'/g, "''");

        for (const pattern of FORBIDDEN_PATTERNS) {
          if (pattern.regex.test(cleanCode)) {
            violations.push({
              rule: pattern.rule,
              file: file.path,
              lineNumber: i + 1,
              snippet: line.trim(),
              message: pattern.message
            });
          }
        }
      }
    }

    return {
      isSafe: violations.length === 0,
      violations
    };
  }
}
