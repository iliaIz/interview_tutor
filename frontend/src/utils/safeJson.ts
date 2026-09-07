/**
 * Safely parses a JSON string into type T, returning fallback on null/undefined or parse error.
 * Prevents swallowed errors and empty catch blocks.
 */
export function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw || typeof raw !== 'string') {
    return fallback;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
