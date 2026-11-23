/**
 * prismLogGrammar.ts
 * Custom JVM Forensics & SRE Observability Log Grammar for Prism.
 * SLA: <= 80 lines (Rule 8 compliant).
 */

export function registerSreLogGrammar(PrismInstance: any): void {
  if (!PrismInstance || !PrismInstance.languages) return;

  PrismInstance.languages.log = {
    'thread-deadlock': {
      pattern: /Found \d+ Java-level deadlock|Deadlock detected|deadlock/i,
      alias: 'important'
    },
    'thread-state-runnable': {
      pattern: /java\.lang\.Thread\.State:\s*RUNNABLE/i,
      alias: 'attr-name'
    },
    'thread-state-blocked': {
      pattern: /java\.lang\.Thread\.State:\s*BLOCKED[^\n]*/i,
      alias: 'deleted'
    },
    'thread-state-waiting': {
      pattern: /java\.lang\.Thread\.State:\s*(TIMED_WAITING|WAITING)[^\n]*/i,
      alias: 'keyword'
    },
    'lock-address': {
      pattern: /<0x[0-9a-fA-F]+>|parking to wait for <0x[0-9a-fA-F]+>|waiting on <0x[0-9a-fA-F]+>|locked <0x[0-9a-fA-F]+>/i,
      alias: 'number'
    },
    'log-error': {
      pattern: /\b(FATAL|ERROR|SEVERE|CRITICAL|OutOfMemoryError|NullPointerException|Deadlock|TimeoutException|SQLException|HikariPool-\d+ - Connection is not available)\b/,
      alias: 'deleted'
    },
    'log-warn': {
      pattern: /\b(WARN|WARNING|Slow query|High GC pause|Pool exhausted)\b/,
      alias: 'annotation'
    },
    'log-info': {
      pattern: /\b(INFO|DEBUG|TRACE)\b/,
      alias: 'function'
    },
    'thread-name': {
      pattern: /"[^"\n]+"(?=\s+#\d+)/,
      alias: 'class-name'
    },
    'timestamp': {
      pattern: /\b\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?\b/,
      alias: 'comment'
    },
    'string': {
      pattern: /(["'])(?:\\(?:\r\n|[\s\S])|(?!\1)[^\\\r\n])*\1/,
      greedy: true
    },
    'number': /\b\d+(?:\.\d+)?(?:ms|s|MB|GB|KB|K|M|B)?\b/
  };

  PrismInstance.languages.jstack = PrismInstance.languages.log;
}
