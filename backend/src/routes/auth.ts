import { Router, Request } from 'express';
import { authService } from '../services/authService';
import { requireAuth, requireRole, AuthenticatedRequest, extractSessionToken } from '../middleware/auth';
import { db } from '../services/db';
import { asyncHandler, AppError } from '../middleware/errorHandler';

export const authRouter = Router();

// POST /api/auth/login
authRouter.post('/login', asyncHandler(async (req, res) => {
  const { inviteCode } = req.body;
  if (!inviteCode || typeof inviteCode !== 'string' || !inviteCode.trim()) {
    throw new AppError('Пожалуйста, укажите инвайт-код', 400);
  }

  const authResult = authService.validateInviteCode(inviteCode);
  if (!authResult) {
    throw new AppError('Неверный или неактивный инвайт-код', 401);
  }

  const userAgent = req.headers['user-agent'] || '';
  const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '';
  const sessionId = authService.createSession(authResult.user.id, userAgent, ipAddress);

  // Set 30-day HttpOnly cookie
  const isProduction = process.env.NODE_ENV === 'production';
  const cookieOptions = [
    `session_token=${sessionId}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    'Max-Age=2592000' // 30 days
  ];

  if (isProduction || req.secure || req.headers['x-forwarded-proto'] === 'https') {
    cookieOptions.push('Secure');
  }

  res.setHeader('Set-Cookie', cookieOptions.join('; '));

  res.json({
    success: true,
    user: authResult.user,
    token: sessionId // Also return in body for mobile/hybrid fallback if needed
  });
}));

// GET /api/auth/me
authRouter.get('/me', requireAuth, asyncHandler(async (req: Request, res) => {
  const authReq = req as AuthenticatedRequest;
  res.json({
    authenticated: true,
    user: authReq.user
  });
}));

// POST /api/auth/logout
authRouter.post('/logout', asyncHandler(async (req, res) => {
  const token = extractSessionToken(req);
  if (token) {
    authService.revokeSession(token);
  }

  // Clear cookie
  res.setHeader('Set-Cookie', 'session_token=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0');
  res.json({ success: true });
}));

// POST /api/auth/ws-ticket (One-Time Ticket for Gemini Live WebSocket)
authRouter.post('/ws-ticket', requireAuth, asyncHandler(async (req: Request, res) => {
  const authReq = req as AuthenticatedRequest;
  const ticket = authService.createWsTicket(authReq.user!.id);
  res.json({
    ticket,
    expiresInSeconds: 15
  });
}));

// GET /api/auth/dev-ticket (Localhost diagnostics only)
authRouter.get('/dev-ticket', asyncHandler(async (_req, res) => {
  if (process.env.NODE_ENV === 'production') {
    throw new AppError('Dev ticket forbidden in production', 403);
  }
  const ticket = authService.createWsTicket('user_master');
  res.json({ ticket });
}));

// PUT /api/auth/profile (Update display name)
authRouter.put('/profile', requireAuth, asyncHandler(async (req: Request, res) => {
  const authReq = req as AuthenticatedRequest;
  const { name } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new AppError('Имя не может быть пустым', 400);
  }

  const cleanName = name.trim().slice(0, 60);
  const userId = authReq.user!.id;

  db.prepare('UPDATE users SET name = ? WHERE id = ?').run(cleanName, userId);

  try {
    db.prepare('UPDATE user_profile_settings SET candidate_name = ? WHERE id = ? OR id = "default_user"').run(cleanName, userId);
  } catch (err: any) {
    console.warn(`Could not sync candidate_name to user_profile_settings for user ${userId}:`, err?.message);
  }

  const updatedUser = {
    ...authReq.user!,
    name: cleanName
  };

  res.json({
    success: true,
    user: updatedUser
  });
}));

// GET /api/auth/invites (List all invites - Owner only)
authRouter.get('/invites', requireAuth, requireRole('owner'), asyncHandler(async (_req, res) => {
  const invites = authService.listInvites();
  res.json(invites);
}));

// POST /api/auth/invites (Create invite - Owner only)
authRouter.post('/invites', requireAuth, requireRole('owner'), asyncHandler(async (req, res) => {
  const { name, role, code, maxUses, label } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new AppError('Пожалуйста, укажите имя пользователя/кандидата', 400);
  }

  const created = authService.createInvite({
    name: name.trim(),
    role: role === 'owner' ? 'owner' : 'user',
    code: typeof code === 'string' && code.trim() ? code.trim() : undefined,
    maxUses: typeof maxUses === 'number' ? maxUses : 0,
    label: typeof label === 'string' && label.trim() ? label.trim() : undefined
  });

  res.json({
    success: true,
    invite: created
  });
}));

// POST /api/auth/invites/:id/revoke (Revoke invite - Owner only)
authRouter.post('/invites/:id/revoke', requireAuth, requireRole('owner'), asyncHandler(async (req, res) => {
  const id = String(req.params.id);
  const success = authService.revokeInvite(id);

  if (!success) {
    throw new AppError('Инвайт не найден или уже отозван', 404);
  }
  res.json({ success: true, message: 'Инвайт успешно отозван' });
}));
