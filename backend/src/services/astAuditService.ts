/**
 * astAuditService.ts - Deterministic Static & Heuristic Analysis for Java Code Submissions
 * Evaluates candidate code against SOTA Java 8-21 rules, Loom Carrier Pinning,
 * Streams best practices, and Spring Boot 3.4+ testing standards.
 */

export interface AstViolation {
  id: string;
  name: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  line?: number;
  message: string;
  remediation: string;
}

export interface AstAuditResult {
  isClean: boolean;
  scoreDeduction: number;
  violations: AstViolation[];
  passedRules: string[];
  summary: string;
}

export class AstAuditService {
  /**
   * Performs multi-rule static audit on Java code snippet.
   */
  public static audit(code: string): AstAuditResult {
    if (!code || code.trim().length === 0) {
      return {
        isClean: true,
        scoreDeduction: 0,
        violations: [],
        passedRules: ['Empty Code Snippet'],
        summary: 'Код пуст.'
      };
    }

    const violations: AstViolation[] = [];
    const passedRules: string[] = [];
    const lines = code.split('\n');

    // Rule 1: Carrier Thread Pinning (synchronized in Loom / Virtual Thread contexts)
    let hasSynchronized = false;
    let synchronizedLine: number | undefined;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/\bsynchronized\s*(\(|\{)/.test(line) || /^\s*public\s+synchronized\s+/.test(line)) {
        hasSynchronized = true;
        synchronizedLine = i + 1;
        break;
      }
    }

    if (hasSynchronized) {
      violations.push({
        id: 'carrier-thread-pinning',
        name: 'Риск Carrier Thread Pinning',
        severity: 'critical',
        line: synchronizedLine,
        message: 'Использование `synchronized` зажимает Carrier Thread ОС в виртуальных потоках (Project Loom).',
        remediation: 'Замените встроенный монитор `synchronized` на `ReentrantLock` с явным блоком `try-finally` или `StampedLock`.'
      });
    } else {
      passedRules.push('No synchronized carrier pinning detected');
    }

    // Rule 2: Unbounded ThreadLocal leak
    let hasThreadLocalSet = false;
    let threadLocalLine: number | undefined;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/ThreadLocal\s*<.*?>/.test(line) || /\b[tT]hreadLocal\.set\s*\(/.test(line)) {
        hasThreadLocalSet = true;
        threadLocalLine = i + 1;
        break;
      }
    }

    if (hasThreadLocalSet && !code.includes('.remove()')) {
      violations.push({
        id: 'unbounded-threadlocal-leak',
        name: 'Риск утечки памяти ThreadLocal',
        severity: 'high',
        line: threadLocalLine,
        message: 'Вызов `ThreadLocal.set()` без гарантированного `.remove()` или использование в виртуальных потоках.',
        remediation: 'Используйте `ScopedValue` (Java 21+ JEP 446) для неизменяемого контекста или гарантируйте очистку в блоке `finally { threadLocal.remove(); }`.'
      });
    } else if (hasThreadLocalSet) {
      passedRules.push('ThreadLocal usage with proper removal');
    } else {
      passedRules.push('Clean of unbounded ThreadLocal');
    }

    // Rule 3: Unsafe 2-argument Collectors.toMap
    let hasUnsafeToMap = false;
    let toMapLine: number | undefined;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Regex detects Collectors.toMap(arg1, arg2) without a 3rd merge argument
      if (/Collectors\.toMap\s*\(\s*[^,]+,\s*[^,)]+\s*\)/.test(line)) {
        hasUnsafeToMap = true;
        toMapLine = i + 1;
        break;
      }
    }

    if (hasUnsafeToMap) {
      violations.push({
        id: 'unsafe-tomap-collision',
        name: 'Небезопасный Collectors.toMap (2 аргумента)',
        severity: 'high',
        line: toMapLine,
        message: 'Вызов `Collectors.toMap` с двумя аргументами выбрасывает `IllegalStateException` при дубликатах ключей и `NPE` при null значениях.',
        remediation: 'Используйте 3-аргументную перегрузку `Collectors.toMap(keyMapper, valueMapper, (oldVal, newVal) -> newVal)` или кастомный `SafeMapCollector`.'
      });
    } else {
      passedRules.push('Safe toMap collector or collision handler present');
    }

    // Rule 4: Deprecated @MockBean (Spring Boot 3.4+)
    let hasDeprecatedMockBean = false;
    let mockBeanLine: number | undefined;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/@MockBean\b/.test(line)) {
        hasDeprecatedMockBean = true;
        mockBeanLine = i + 1;
        break;
      }
    }

    if (hasDeprecatedMockBean) {
      violations.push({
        id: 'deprecated-mockbean-springboot34',
        name: 'Устаревшая аннотация @MockBean',
        severity: 'medium',
        line: mockBeanLine,
        message: 'Аннотация `@MockBean` объявлена устаревшей в Spring Boot 3.4+.',
        remediation: 'Замените на стандартную аннотацию фреймворка `@MockitoBean` (из `org.springframework.test.context.bean.override.mockito.MockitoBean`).'
      });
    } else {
      passedRules.push('Modern Spring 3.4+ bean override compliance');
    }

    // Rule 5: Blocking calls in Controllers
    let hasControllerSleep = false;
    let sleepLine: number | undefined;
    const isController = /@RestController|@Controller|class\s+\w+Controller/.test(code);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/\bThread\.sleep\s*\(/.test(line) && isController) {
        hasControllerSleep = true;
        sleepLine = i + 1;
        break;
      }
    }

    if (hasControllerSleep) {
      violations.push({
        id: 'blocking-call-in-controller',
        name: 'Блокирующий Thread.sleep в веб-слое',
        severity: 'critical',
        line: sleepLine,
        message: 'Прямая блокировка потока через `Thread.sleep` в Spring контроллере исчерпывает пул обработчиков запросов.',
        remediation: 'Используйте асинхронную обработку `CompletableFuture`, реактивные типы `Mono.delay` или асинхронные таймеры.'
      });
    } else {
      passedRules.push('Non-blocking web tier compliance');
    }

    // Rule 6: Mutation in Stream.peek()
    let hasPeekMutation = false;
    let peekLine: number | undefined;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/\.peek\s*\([^)]*(\.add|\.put|\.remove|\+\+|--|=|set\w+)\(/.test(line)) {
        hasPeekMutation = true;
        peekLine = i + 1;
        break;
      }
    }

    if (hasPeekMutation) {
      violations.push({
        id: 'side-effects-in-peek',
        name: 'Мутация состояния внутри Stream.peek()',
        severity: 'medium',
        line: peekLine,
        message: 'Метод `peek()` предназначен только для отладочного чтения. Мутации нарушают ленивость стрима и могут быть оптимизированы JIT.',
        remediation: 'Выполняйте модификации явно в терминальной операции `forEach` или собирайте результат в новую коллекцию через `.toList()`.'
      });
    } else {
      passedRules.push('Pure non-interfering Stream operations');
    }

    // Rule 7: Direct System Time in Business Logic
    let hasSystemTime = false;
    let timeLine: number | undefined;
    const isTestFile = /@Test\b/i.test(code) || /class\s+\w+Test\b/.test(code);
    if (!isTestFile) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/\b(System\.currentTimeMillis|Instant\.now|LocalDate\.now|LocalDateTime\.now|ZonedDateTime\.now)\s*\(\s*\)/.test(line)) {
          hasSystemTime = true;
          timeLine = i + 1;
          break;
        }
      }
    }

    if (hasSystemTime) {
      violations.push({
        id: 'enforce-clock-injection',
        name: 'Прямой вызов системного времени',
        severity: 'high',
        line: timeLine,
        message: 'Вызов `Instant.now()` или `System.currentTimeMillis()` в бизнес-сервисе нарушает детерминированность модульных тестов.',
        remediation: 'Внедряйте `java.time.Clock` в конструктор класса и вызывайте `clock.instant()`.'
      });
    } else if (!isTestFile) {
      passedRules.push('Deterministic time injection compliance');
    }

    // Rule 8: Primitive double/float for Money
    let hasDoubleMoney = false;
    let moneyLine: number | undefined;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/\b(double|float)\s+(amount|balance|price|fee|money|cost)\b/i.test(line)) {
        hasDoubleMoney = true;
        moneyLine = i + 1;
        break;
      }
    }

    if (hasDoubleMoney) {
      violations.push({
        id: 'no-double-in-money',
        name: 'Плавающая точка в финансовых расчетах',
        severity: 'critical',
        line: moneyLine,
        message: 'Использование типов `double` или `float` для денежных сумм приводит к накоплению ошибок округления центов/копеек.',
        remediation: 'Используйте `BigDecimal` со `Scale = 2..4` и явным `RoundingMode.HALF_EVEN` (Banker\'s rounding).'
      });
    } else {
      passedRules.push('Financial precision compliance with BigDecimal');
    }

    // Calculate score deductions
    let totalDeduction = 0;
    for (const v of violations) {
      if (v.severity === 'critical') totalDeduction += 25;
      else if (v.severity === 'high') totalDeduction += 15;
      else if (v.severity === 'medium') totalDeduction += 10;
      else totalDeduction += 5;
    }

    const isClean = violations.length === 0;
    const summary = isClean
      ? '✅ Статический AST-аудит пройден: критических архитектурных антипаттернов не обнаружено.'
      : `⚠️ Обнаружено нарушений: ${violations.length}. Снижение оценки: -${totalDeduction} баллов.`;

    return {
      isClean,
      scoreDeduction: totalDeduction,
      violations,
      passedRules,
      summary
    };
  }
}

