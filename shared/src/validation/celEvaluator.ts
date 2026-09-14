import { evaluate, parse, CelEvaluationError, CelParseError } from 'cel-js';

export interface CelEvaluationResult {
  success: boolean;
  value?: any;
  error?: string;
}

// In-memory AST/CST cache to avoid redundant lexing & parsing during 60 FPS canvas interactions
const cstCache = new Map<string, any>();
const MAX_CST_CACHE_SIZE = 500;

function getOrParseCst(expression: string): any {
  if (cstCache.has(expression)) {
    return cstCache.get(expression);
  }
  const result = parse(expression);
  if (!result.isSuccess) {
    throw new CelParseError('Given string is not a valid CEL expression: ' + (result.errors || []).join(', '));
  }
  if (cstCache.size >= MAX_CST_CACHE_SIZE) {
    // Evict oldest entry (LRU approximation via iterator)
    const firstKey = cstCache.keys().next().value;
    if (firstKey !== undefined) cstCache.delete(firstKey);
  }
  cstCache.set(expression, result.cst);
  return result.cst;
}

/**
 * Изоморфная песочница для безопасного вычисления CEL-предикатов (Common Expression Language).
 * Исполняется идентично в Node.js (бэкенд) и Web Browser (фронтенд).
 * Использует кеширование CST для ускорения повторных вычислений в реальном времени.
 */
export function evaluateCel(expression: string, context: Record<string, any>): CelEvaluationResult {
  try {
    const cst = getOrParseCst(expression);
    const value = evaluate(cst, context);
    return {
      success: true,
      value
    };
  } catch (err: any) {
    let message = err.message || 'Unknown CEL evaluation error';
    if (err instanceof CelParseError) {
      message = `CEL Syntax Error: ${err.message}`;
    } else if (err instanceof CelEvaluationError) {
      message = `CEL Runtime Error: ${err.message}`;
    }
    return {
      success: false,
      error: message
    };
  }
}

