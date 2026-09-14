import { evaluate, CelEvaluationError, CelParseError } from 'cel-js';

export interface CelEvaluationResult {
  success: boolean;
  value?: any;
  error?: string;
}

/**
 * Изоморфная песочница для безопасного вычисления CEL-предикатов (Common Expression Language).
 * Исполняется идентично в Node.js (бэкенд) и Web Browser (фронтенд).
 */
export function evaluateCel(expression: string, context: Record<string, any>): CelEvaluationResult {
  try {
    const value = evaluate(expression, context);
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
