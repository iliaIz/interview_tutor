/**
 * astRules.ts - Unified Static & Heuristic Java AST Rules for Frontend & Client Audit
 * Synchronized with backend AstAuditService for deterministic zero-drift rule evaluation.
 */

export interface AstRuleItem {
  id: string;
  name: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  text: string;
  isViolation: boolean;
  remediation?: string;
  regex: RegExp;
}

export const AST_RULES_DEFINITIONS: Omit<AstRuleItem, 'isViolation'>[] = [
  {
    id: 'carrier-thread-pinning',
    name: 'Carrier Thread Pinning',
    severity: 'critical',
    text: 'Carrier Pinning: synchronized блокирует Carrier Thread ОС в Loom',
    remediation: 'Замените synchronized на ReentrantLock с блоком try-finally или StampedLock.',
    regex: /\bsynchronized\s*(\(|\{)|public\s+synchronized\s+/
  },
  {
    id: 'unbounded-threadlocal-leak',
    name: 'ThreadLocal Memory Leak',
    severity: 'high',
    text: 'ThreadLocal Leak: потенциальная утечка памяти в пулах потоков',
    remediation: 'Используйте ScopedValue (Java 21 JEP 446) или гарантируйте очистку в finally { remove(); }.',
    regex: /ThreadLocal\s*<.*?>|[tT]hreadLocal\.set\s*\(/
  },
  {
    id: 'unsafe-tomap-collision',
    name: 'Unsafe 2-argument toMap',
    severity: 'high',
    text: 'Unsafe toMap: 2-аргументный вызов без mergeFunction бросает NPE / IllegalStateException',
    remediation: 'Используйте 3-аргументный Collectors.toMap(k, v, mergeFn) или кастомный SafeMap.',
    regex: /Collectors\.toMap\s*\(\s*[^,]+,\s*[^,)]+\s*\)/
  },
  {
    id: 'deprecated-mockbean-springboot34',
    name: 'Deprecated @MockBean',
    severity: 'medium',
    text: 'Deprecated @MockBean: используйте @MockitoBean в Spring Boot 3.4+',
    remediation: 'Перейдите на @MockitoBean из Spring Framework 6.2 Bean Override API.',
    regex: /@MockBean\b/
  },
  {
    id: 'blocking-call-in-controller',
    name: 'Blocking Call in Web Controller',
    severity: 'high',
    text: 'Web Blocking: Thread.sleep в контроллере исчерпывает пул запросов Tomcat',
    remediation: 'Используйте CompletableFuture, WebFlux Mono/Flux или асинхронные обработчики.',
    regex: /\bThread\.sleep\s*\(/
  },
  {
    id: 'side-effects-in-peek',
    name: 'Mutation in Stream.peek',
    severity: 'medium',
    text: 'Side-effects in peek: мутация состояния внутри peek() нарушает чистоту стрима',
    remediation: 'Используйте map() для чистых трансформаций или forEach() для терминальных эффектов.',
    regex: /\.peek\s*\(\s*[^)]*(=|\.set|\.add|\.put)/
  },
  {
    id: 'enforce-clock-injection',
    name: 'Direct System Time Call',
    severity: 'high',
    text: 'Direct System Time: вызов Instant.now() или System.currentTimeMillis() нарушает детерминированность тестов',
    remediation: 'Внедряйте java.time.Clock через конструктор и вызывайте clock.instant().',
    regex: /\b(System\.currentTimeMillis|Instant\.now|LocalDate\.now|LocalDateTime\.now|ZonedDateTime\.now)\s*\(\s*\)/
  },
  {
    id: 'no-double-in-money',
    name: 'Primitive double/float for Currency',
    severity: 'critical',
    text: 'Floating Point Money: использование double/float для баланса/валют приводит к потере точности',
    remediation: 'Используйте BigDecimal с RoundingMode.HALF_EVEN (Banker\'s rounding).',
    regex: /\b(double|float)\s+(amount|balance|price|fee|money|cost)\b/i
  }
];


/**
 * Strips comments and string literals to eliminate false-positive AST violations.
 */
function sanitizeCodeForAst(raw: string): string {
  return raw
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/.*$/gm, ' ')
    .replace(/"(?:\\.|[^"\\])*"/g, '""');
}

/**
 * Deterministically evaluates code against unified AST rules.
 */
export function evaluateAstRules(code: string, activeRuleIds?: string[]): { text: string; isViolation: boolean; id: string }[] {
  if (!code || code.trim().length === 0) {
    return [{ text: 'Архитектурный шаблон проверен: чистая реализация', isViolation: false, id: 'clean' }];
  }

  const sanitized = sanitizeCodeForAst(code);
  const results: { text: string; isViolation: boolean; id: string }[] = [];

  const targetRules = activeRuleIds && activeRuleIds.length > 0
    ? AST_RULES_DEFINITIONS.filter((r) => activeRuleIds.includes(r.id))
    : AST_RULES_DEFINITIONS;

  for (const rule of targetRules) {
    if (rule.regex.test(sanitized)) {
      // Special check for ThreadLocal: if .remove() is present in the code, it's not an unbounded leak
      if (rule.id === 'unbounded-threadlocal-leak' && code.includes('.remove()')) {
        continue;
      }
      // Special check for Thread.sleep: only flag if Controller is mentioned
      if (rule.id === 'blocking-call-in-controller' && !/Controller/i.test(code)) {
        continue;
      }
      // Special check for Clock injection: ignore test classes
      if (rule.id === 'enforce-clock-injection' && (/@Test\b/i.test(code) || /class\s+\w+Test\b/.test(code))) {
        continue;
      }


      results.push({
        id: rule.id,
        text: rule.text,
        isViolation: true
      });
    }
  }

  if (results.length === 0) {
    results.push({
      id: 'clean',
      text: 'Архитектурный шаблон проверен: чистая реализация',
      isViolation: false
    });
  }

  return results;
}
