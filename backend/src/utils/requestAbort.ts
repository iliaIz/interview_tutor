import { Request } from 'express';

/**
 * Returns an AbortSignal tied to the lifecycle of the incoming HTTP request.
 * Automatically aborts if client disconnects or terminates the connection.
 */
export function getRequestAbortSignal(req: Request): AbortSignal {
  if ((req as any).signal instanceof AbortSignal) {
    return (req as any).signal;
  }
  const controller = new AbortController();
  if (req.destroyed) {
    controller.abort();
  } else {
    req.on('close', () => {
      controller.abort();
    });
  }
  return controller.signal;
}
