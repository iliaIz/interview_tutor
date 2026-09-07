import { ErrorRequestHandler } from 'express';

export class AppError extends Error {
  public readonly status: number;
  public readonly code?: string;

  constructor(message: string, status = 500, code?: string) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
  }
}

/**
 * Centralized Express Error Handling Middleware.
 * Prevents swallowed errors, unhandled rejections, and produces uniform JSON responses.
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  const status = typeof err.status === 'number'
    ? err.status
    : (typeof err.statusCode === 'number' ? err.statusCode : 500);

  const message = err.message || 'Internal Server Error';

  console.error(`[AppError ${status}] ${req.method} ${req.originalUrl || req.url}:`, err);

  if (res.headersSent) {
    return next(err);
  }

  res.status(status).json({
    error: message,
    code: err.code,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
};
