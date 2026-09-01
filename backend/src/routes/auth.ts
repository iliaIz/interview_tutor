import { Router, Request, Response } from 'express';
import { authService } from '../services/authService';
import { requireAuth, requireRole, AuthenticatedRequest, extractSessionToken } from '../middleware/auth';
import { db } from '../services/db';

export const authRouter = Router();



// POST /api/auth/login
authRouter.post('/login', (req: Request, res: Response) => {
  try {
    const { inviteCode } = req.body;
    if (!inviteCode || typeof inviteCode !== 'string' || !inviteCode.trim()) {
      return res.status(400).json({ error: 'Пожалуйста, укажите инвайт-код' });
    }

    const authResult = authService.validateInviteCode(inviteCode);
    if (!authResult) {
      return res.status(401).json({
        error: 'Неверный или неактивный инвайт-код',
        message: 'Проверьте правильность ввода кода или обратитесь к администратору'
      });
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
  } catch (err: any) {
    console.error('Auth login error:', err);
    res.status(500).json({ error: 'Login failed', message: err.message });
  }
});

// GET /api/auth/me
authRouter.get('/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  res.json({
    authenticated: true,
    user: req.user
  });
});

// POST /api/auth/logout
authRouter.post('/logout', (req: Request, res: Response) => {
  try {
    const token = extractSessionToken(req);
    if (token) {
      authService.revokeSession(token);
    }

    // Clear cookie
    res.setHeader('Set-Cookie', 'session_token=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0');
    res.json({ success: true });
  } catch (err: any) {
    console.error('Auth logout error:', err);
    res.status(500).json({ error: 'Logout failed', message: err.message });
  }
});

// POST /api/auth/ws-ticket (One-Time Ticket for Gemini Live WebSocket)
authRouter.post('/ws-ticket', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const ticket = authService.createWsTicket(req.user!.id);
    res.json({
      ticket,
      expiresInSeconds: 15
    });
  } catch (err: any) {
    console.error('WS ticket error:', err);
    res.status(500).json({ error: 'Failed to create WS ticket', message: err.message });
  }
});

// PUT /api/auth/profile (Update display name)
authRouter.put('/profile', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Имя не может быть пустым' });
    }

    const cleanName = name.trim().slice(0, 60);
    const userId = req.user!.id;

    db.prepare('UPDATE users SET name = ? WHERE id = ?').run(cleanName, userId);


    try {
      db.prepare('UPDATE user_profile_settings SET candidate_name = ? WHERE id = ? OR id = "default_user"').run(cleanName, userId);
    } catch {}

    const updatedUser = {
      ...req.user!,
      name: cleanName
    };

    res.json({
      success: true,
      user: updatedUser
    });
  } catch (err: any) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Failed to update profile', message: err.message });
  }
});

// GET /api/auth/invites (List all invites - Owner only)
authRouter.get('/invites', requireAuth, requireRole('owner'), (req: AuthenticatedRequest, res: Response) => {
  try {
    const invites = authService.listInvites();
    res.json(invites);
  } catch (err: any) {
    console.error('List invites error:', err);
    res.status(500).json({ error: 'Failed to list invites', message: err.message });
  }
});

// POST /api/auth/invites (Create invite - Owner only)
authRouter.post('/invites', requireAuth, requireRole('owner'), (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, role, code, maxUses, label } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Пожалуйста, укажите имя пользователя/кандидата' });
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
  } catch (err: any) {
    console.error('Create invite error:', err);
    res.status(500).json({ error: 'Failed to create invite', message: err.message });
  }
});

// POST /api/auth/invites/:id/revoke (Revoke invite - Owner only)
authRouter.post('/invites/:id/revoke', requireAuth, requireRole('owner'), (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    const success = authService.revokeInvite(id);

    if (!success) {
      return res.status(404).json({ error: 'Инвайт не найден или уже отозван' });
    }
    res.json({ success: true, message: 'Инвайт успешно отозван' });
  } catch (err: any) {
    console.error('Revoke invite error:', err);
    res.status(500).json({ error: 'Failed to revoke invite', message: err.message });
  }
});


