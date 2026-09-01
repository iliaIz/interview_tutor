import { Router, Request, Response } from 'express';
import { authService } from '../services/authService';
import { requireAuth, AuthenticatedRequest, extractSessionToken } from '../middleware/auth';

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
