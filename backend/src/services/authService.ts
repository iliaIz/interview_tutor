import crypto from 'crypto';
import { db } from './db';

export interface User {
  id: string;
  name: string;
  role: 'owner' | 'candidate' | 'mentor';
  created_at: string;
  last_login_at?: string;
}

export class AuthService {
  /**
   * Hashes an invite code for secure comparison.
   */
  public hashInviteCode(code: string): string {
    return crypto.createHash('sha256').update(code.trim().toUpperCase()).digest('hex');
  }

  /**
   * Validates invite code against active tokens in SQLite.
   */
  public validateInviteCode(rawCode: string): { user: User; tokenRecord: any } | null {
    if (!rawCode || typeof rawCode !== 'string') return null;
    const cleanCode = rawCode.trim().toUpperCase();
    const codeHash = this.hashInviteCode(cleanCode);

    const tokenRecord = db.prepare(`
      SELECT t.*, u.name as user_name, u.role as user_role, u.created_at as user_created_at
      FROM invite_tokens t
      JOIN users u ON t.user_id = u.id
      WHERE t.code_hash = ? AND t.is_active = 1
    `).get(codeHash) as any;

    if (!tokenRecord) {
      return null;
    }

    // Check usage limits if max_uses > 0
    if (tokenRecord.max_uses > 0 && tokenRecord.use_count >= tokenRecord.max_uses) {
      return null;
    }

    // Update usage stats
    db.prepare(`
      UPDATE invite_tokens
      SET use_count = use_count + 1, last_used_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(tokenRecord.id);

    db.prepare(`
      UPDATE users
      SET last_login_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(tokenRecord.user_id);

    const user: User = {
      id: tokenRecord.user_id,
      name: tokenRecord.user_name || tokenRecord.label,
      role: tokenRecord.user_role || tokenRecord.role || 'candidate',
      created_at: tokenRecord.user_created_at
    };

    return { user, tokenRecord };
  }

  /**
   * Creates a 30-day session for a user.
   */
  public createSession(userId: string, userAgent = '', ipAddress = ''): string {
    const sessionId = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    db.prepare(`
      INSERT INTO user_sessions (session_id, user_id, user_agent, ip_address, created_at, expires_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
    `).run(sessionId, userId, userAgent.slice(0, 255), ipAddress.slice(0, 45), expiresAt);

    return sessionId;
  }

  /**
   * Validates a session token and returns the attached user.
   */
  public validateSession(sessionId: string): { user: User; session: any } | null {
    if (!sessionId || typeof sessionId !== 'string') return null;

    const row = db.prepare(`
      SELECT s.*, u.name as user_name, u.role as user_role, u.created_at as user_created_at
      FROM user_sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.session_id = ? AND s.expires_at > CURRENT_TIMESTAMP
    `).get(sessionId) as any;

    if (!row) return null;

    const user: User = {
      id: row.user_id,
      name: row.user_name,
      role: row.user_role,
      created_at: row.user_created_at
    };

    return { user, session: row };
  }

  /**
   * Revokes a session on logout.
   */
  public revokeSession(sessionId: string): void {
    if (!sessionId) return;
    db.prepare('DELETE FROM user_sessions WHERE session_id = ?').run(sessionId);
  }

  /**
   * Generates a single-use 15-second ticket for WebSocket connection.
   */
  public createWsTicket(userId: string): string {
    const ticketId = 'ws_' + crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 1000).toISOString();

    db.prepare(`
      INSERT INTO ws_tickets (ticket_id, user_id, created_at, expires_at)
      VALUES (?, ?, CURRENT_TIMESTAMP, ?)
    `).run(ticketId, userId, expiresAt);

    return ticketId;
  }

  /**
   * Verifies and burns a single-use WebSocket ticket.
   */
  public verifyAndConsumeWsTicket(ticketId: string): { user: User } | null {
    if (!ticketId || typeof ticketId !== 'string') return null;

    const row = db.prepare(`
      SELECT t.*, u.name as user_name, u.role as user_role, u.created_at as user_created_at
      FROM ws_tickets t
      JOIN users u ON t.user_id = u.id
      WHERE t.ticket_id = ? AND t.expires_at > CURRENT_TIMESTAMP
    `).get(ticketId) as any;

    if (!row) return null;

    // Burn ticket immediately (One-Time-Pad style)
    db.prepare('DELETE FROM ws_tickets WHERE ticket_id = ?').run(ticketId);

    return {
      user: {
        id: row.user_id,
        name: row.user_name,
        role: row.user_role,
        created_at: row.user_created_at
      }
    };
  }

  /**
   * Periodic cleanup of expired sessions and burned tickets.
   */
  public cleanupExpired(): void {
    try {
      db.prepare('DELETE FROM user_sessions WHERE expires_at <= CURRENT_TIMESTAMP').run();
      db.prepare('DELETE FROM ws_tickets WHERE expires_at <= CURRENT_TIMESTAMP').run();
    } catch {}
  }
}

export const authService = new AuthService();

// Auto cleanup every hour
setInterval(() => {
  authService.cleanupExpired();
}, 60 * 60 * 1000);
