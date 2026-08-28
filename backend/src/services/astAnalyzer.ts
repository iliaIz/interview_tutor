/**
 * Deterministic Static Code Pre-Processor & AST Signal Extractor
 * SOTA August 2026 Standard for Java 21 / Spring Assessment
 *
 * Responsibilities:
 * 1. Comment & Javadoc Stripping: Eliminates prompt injection vectors (e.g. system instruction overrides inside comments).
 * 2. Concurrency Signal Extraction: Detects synchronized blocks/methods (for Loom carrier thread pinning checks),
 *    Thread.sleep, CountDownLatch, and unsafe field mutations (count++).
 * 3. Architecture & Seam Detection: Detects direct layer bypass (Controller -> Repository) and protected seam methods (for Trip Service Kata).
 */

export interface AstSignal {
  category: 'CONCURRENCY' | 'ARCHITECTURE' | 'MODERN_JAVA' | 'SEAM_PATTERN';
  type: string;
  location?: string;
  description: string;
}

export interface AstAnalysisResult {
  sanitizedCode: string;
  strippedCommentCount: number;
  signals: AstSignal[];
  hasSynchronized: boolean;
  hasVirtualThreads: boolean;
  hasBlockingInLock: boolean;
  hasUnsafeIncrement: boolean;
  hasSeamMethod: boolean;
  hasDirectRepoAccessInController: boolean;
}

/**
 * Strips single-line (// ...) and multi-line block comments (/* ... *\/)
 * while preserving string literals.
 */
export function stripComments(source: string): { sanitized: string; strippedCount: number } {
  let strippedCount = 0;
  let inString = false;
  let inChar = false;
  let inLineComment = false;
  let inBlockComment = false;
  let result = '';

  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    const next = source[i + 1];

    if (inLineComment) {
      if (char === '\n') {
        inLineComment = false;
        result += '\n';
      }
      continue;
    }

    if (inBlockComment) {
      if (char === '*' && next === '/') {
        inBlockComment = false;
        i++; // skip '/'
      } else if (char === '\n') {
        result += '\n'; // preserve line numbers
      }
      continue;
    }

    if (inString) {
      result += char;
      if (char === '\\') {
        // Escaped character in string
        if (next) {
          result += next;
          i++;
        }
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (inChar) {
      result += char;
      if (char === '\\') {
        if (next) {
          result += next;
          i++;
        }
      } else if (char === "'") {
        inChar = false;
      }
      continue;
    }

    // Check start of string or char
    if (char === '"') {
      inString = true;
      result += char;
      continue;
    }

    if (char === "'") {
      inChar = true;
      result += char;
      continue;
    }

    // Check start of comments
    if (char === '/' && next === '/') {
      inLineComment = true;
      strippedCount++;
      i++; // skip '/'
      continue;
    }

    if (char === '/' && next === '*') {
      inBlockComment = true;
      strippedCount++;
      i++; // skip '*'
      continue;
    }

    result += char;
  }

  return { sanitized: result, strippedCount };
}

/**
 * Performs static structural analysis on sanitized Java code.
 */
export function analyzeJavaSource(filePath: string, sanitizedCode: string): AstAnalysisResult {
  const signals: AstSignal[] = [];

  // Concurrency markers
  const syncMatch = sanitizedCode.match(/\bsynchronized\b/g);
  const hasSynchronized = Boolean(syncMatch);
  if (hasSynchronized) {
    signals.push({
      category: 'CONCURRENCY',
      type: 'SYNCHRONIZED_KEYWORD_DETECTED',
      location: filePath,
      description: `Synchronized keyword found (${syncMatch?.length || 1} occurrences). Risk of Virtual Thread carrier thread pinning if wrapping I/O or blocking operations.`
    });
  }

  const vThreadMatch = sanitizedCode.match(/Executors\.newVirtualThreadPerTaskExecutor\(\)|Thread\.ofVirtual\(\)/);
  const hasVirtualThreads = Boolean(vThreadMatch);
  if (hasVirtualThreads) {
    signals.push({
      category: 'MODERN_JAVA',
      type: 'VIRTUAL_THREADS_USED',
      location: filePath,
      description: 'Native Java 21 Virtual Threads instantiation detected.'
    });
  }

  // Blocking operations inside locks heuristic
  const hasHttpCall = /restTemplate\.|webClient\.|httpClient\.|feignClient\.|socket\./i.test(sanitizedCode);
  const hasSleep = /Thread\.sleep\(/.test(sanitizedCode);
  const hasBlockingInLock = hasSynchronized && (hasHttpCall || hasSleep);
  if (hasBlockingInLock) {
    signals.push({
      category: 'CONCURRENCY',
      type: 'POTENTIAL_CARRIER_THREAD_PINNING',
      location: filePath,
      description: 'Blocking call (HTTP/Sleep) detected in class containing synchronized methods/blocks. Carrier thread pinning risk in Java 21.'
    });
  }

  // Non-atomic compound mutation check (count++, totalTransactions++)
  const hasUnsafeIncrement = /(?:total\w*|count\w*|balance\w*|seq\w*)\s*\+\+/i.test(sanitizedCode);
  if (hasUnsafeIncrement) {
    signals.push({
      category: 'CONCURRENCY',
      type: 'NON_ATOMIC_COMPOUND_OPERATION',
      location: filePath,
      description: 'Detected raw field increment (e.g. counter++) without AtomicInteger, AtomicLong, or explicit mutex.'
    });
  }

  // Seam Pattern detection (protected methods that enable subclass & override in unit tests)
  const seamMatch = /protected\s+[\w<>,\[\]]+\s+(?:getLoggedUser|findTrips|callExternal|getTime|fetch\w+)\s*\(/i.test(sanitizedCode);
  const hasSeamMethod = Boolean(seamMatch);
  if (hasSeamMethod) {
    signals.push({
      category: 'SEAM_PATTERN',
      type: 'PROTECTED_SEAM_METHOD_EXTRACTED',
      location: filePath,
      description: 'Extracted protected method seam detected for testable subclass overriding without changing public API contracts.'
    });
  }

  // Spring architectural layer check: Controller calling Repository directly
  const isController = /@RestController|@Controller/.test(sanitizedCode) || /Controller\.java$/i.test(filePath);
  const hasRepoDirect = /Repository\b|Dao\b/.test(sanitizedCode);
  const hasDirectRepoAccessInController = isController && hasRepoDirect && !/Service\b/.test(sanitizedCode);
  if (hasDirectRepoAccessInController) {
    signals.push({
      category: 'ARCHITECTURE',
      type: 'LAYER_ISOLATION_VIOLATION',
      location: filePath,
      description: 'Controller directly interacts with persistence repository/DAO, bypassing service layer.'
    });
  }

  // Modern Java 21 Idioms: Records, Pattern Matching, Sealed Classes
  if (/\brecord\s+\w+\s*\(/.test(sanitizedCode)) {
    signals.push({
      category: 'MODERN_JAVA',
      type: 'RECORD_DECLARATION',
      location: filePath,
      description: 'Modern Java Record used for immutable state representation.'
    });
  }

  if (/\binstanceof\s+\w+\s+\w+/.test(sanitizedCode) || /switch\s*\([^)]+\)\s*\{[\s\S]*case\s+\w+\s+\w+/.test(sanitizedCode)) {
    signals.push({
      category: 'MODERN_JAVA',
      type: 'PATTERN_MATCHING_USED',
      location: filePath,
      description: 'Java 21 Pattern Matching for instanceof / switch detected.'
    });
  }

  return {
    sanitizedCode,
    strippedCommentCount: 0,
    signals,
    hasSynchronized,
    hasVirtualThreads,
    hasBlockingInLock,
    hasUnsafeIncrement,
    hasSeamMethod,
    hasDirectRepoAccessInController
  };
}

/**
 * Pre-processes multiple workspace files for a challenge submission.
 */
export function preProcessWorkspaceFiles(files: { path: string; content: string }[]): {
  sanitizedFiles: { path: string; content: string }[];
  totalStrippedComments: number;
  allSignals: AstSignal[];
  summaryFactsXml: string;
} {
  const sanitizedFiles: { path: string; content: string }[] = [];
  let totalStrippedComments = 0;
  const allSignals: AstSignal[] = [];

  for (const file of files) {
    const { sanitized, strippedCount } = stripComments(file.content);
    totalStrippedComments += strippedCount;
    sanitizedFiles.push({ path: file.path, content: sanitized });

    const analysis = analyzeJavaSource(file.path, sanitized);
    allSignals.push(...analysis.signals);
  }

  // Build <ast_facts> XML block for prompt grounding
  let summaryFactsXml = '<ast_facts>\n';
  if (allSignals.length === 0) {
    summaryFactsXml += '  <signal>No severe AST anti-patterns detected in pre-processing.</signal>\n';
  } else {
    for (const s of allSignals) {
      summaryFactsXml += `  <signal category="${s.category}" type="${s.type}" location="${s.location || 'workspace'}">${s.description}</signal>\n`;
    }
  }
  summaryFactsXml += '</ast_facts>';

  return {
    sanitizedFiles,
    totalStrippedComments,
    allSignals,
    summaryFactsXml
  };
}
