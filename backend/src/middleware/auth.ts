import { Request, Response, NextFunction } from 'express';
import { authService, User } from '../services/authService';

export interface AuthenticatedRequest extends Request {
  user?: User;
  sessionId?: string;
}

export function parseCookies(cookieHeader?: string): Record<string, string> {
  if (!cookieHeader) return {};
  const cookies: Record<string, string> = {};
  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const idx = pair.indexOf('=');
    if (idx < 0) continue;
    const key = pair.substring(0, idx).trim();
    const val = pair.substring(idx + 1).trim();
    try {
      cookies[key] = decodeURIComponent(val);
    } catch {
      cookies[key] = val;
    }
  }
  return cookies;
}

export function extractSessionToken(req: Request): string | null {
  // 1. Check cookies (Standard Web browser)
  const cookies = parseCookies(req.headers.cookie);
  if (cookies['session_token']) {
    return cookies['session_token'];
  }

  // 2. Check Authorization Header (Bearer <token>)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }

  return null;
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = extractSessionToken(req);

  if (!token) {
    return res.status(401).json({
      error: 'Unauthorized',
      code: 'AUTH_REQUIRED',
      message: 'Требуется закрытый доступ по инвайт-коду'
    });
  }

  const result = authService.validateSession(token);
  if (!result) {
    return res.status(401).json({
      error: 'Unauthorized',
      code: 'SESSION_EXPIRED',
      message: 'Сессия истекла или была отозвана. Пожалуйста, введите инвайт-код снова.'
    });
  }

  req.user = result.user;
  req.sessionId = result.session.session_id;
  next();
}

export function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = extractSessionToken(req);
  if (token) {
    const result = authService.validateSession(token);
    if (result) {
      req.user = result.user;
      req.sessionId = result.session.session_id;
    }
  }
  next();
}

export function requireRole(...allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        code: 'AUTH_REQUIRED',
        message: 'Требуется авторизация'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        code: 'INSUFFICIENT_PERMISSIONS',
        message: 'Недостаточно прав для выполнения данной операции'
      });
    }

    next();
  };
}

