import { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Higher-order function that wraps async Express route handlers,
 * automatically forwarding any unhandled promise rejections to next(err).
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
