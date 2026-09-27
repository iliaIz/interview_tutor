import crypto from 'crypto';
import { db } from './db';

export interface User {
  id: string;
  name: string;
  role: 'owner' | 'user';
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
      role: tokenRecord.user_role === 'owner' || tokenRecord.role === 'owner' ? 'owner' : 'user',
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
      role: row.user_role === 'owner' ? 'owner' : 'user',
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
   * Generates a single-use 60-second ticket for WebSocket connection.
   */
  public createWsTicket(userId: string): string {
    const ticketId = 'ws_' + crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 1000).toISOString();

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
        role: row.user_role === 'owner' ? 'owner' : 'user',
        created_at: row.user_created_at
      }
    };
  }


  /**
   * Lists all invites with stats (for Owner).
   */
  public listInvites(): any[] {
    const rows = db.prepare(`
      SELECT t.id, t.label, t.role, t.is_active, t.max_uses, t.use_count, t.created_at, t.last_used_at,
             u.id as user_id, u.name as user_name, u.last_login_at
      FROM invite_tokens t
      JOIN users u ON t.user_id = u.id
      ORDER BY t.created_at DESC
    `).all() as any[];

    return rows.map(r => ({
      id: r.id,
      label: r.label,
      role: r.role,
      isActive: Boolean(r.is_active),
      maxUses: r.max_uses,
      useCount: r.use_count,
      createdAt: r.created_at,
      lastUsedAt: r.last_used_at,
      userId: r.user_id,
      userName: r.user_name,
      userLastLoginAt: r.last_login_at
    }));
  }

  /**
   * Creates a new invite token with assigned role and user.
   */
  public createInvite(params: {
    name: string;
    role?: 'owner' | 'user';
    code?: string;
    maxUses?: number;
    label?: string;
  }): { inviteId: string; plainCode: string; user: User } {
    const cleanName = (params.name || 'Пользователь').trim();
    const role: 'owner' | 'user' = params.role === 'owner' ? 'owner' : 'user';
    const maxUses = typeof params.maxUses === 'number' ? params.maxUses : 0;
    
    // Generate human-friendly code if omitted, e.g. JAVA-USER-A8B9
    const plainCode = params.code && params.code.trim() 
      ? params.code.trim().toUpperCase() 
      : `JAVA-${role.toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    
    const codeHash = this.hashInviteCode(plainCode);
    const userId = `user_${crypto.randomBytes(4).toString('hex')}`;
    const inviteId = `inv_${crypto.randomBytes(4).toString('hex')}`;
    const label = params.label || cleanName;

    // Create user
    db.prepare(`
      INSERT INTO users (id, name, role, created_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `).run(userId, cleanName, role);

    // Create invite token
    db.prepare(`
      INSERT INTO invite_tokens (id, code_hash, label, user_id, role, is_active, max_uses, use_count, created_at)
      VALUES (?, ?, ?, ?, ?, 1, ?, 0, CURRENT_TIMESTAMP)
    `).run(inviteId, codeHash, label, userId, role, maxUses);

    const user: User = {
      id: userId,
      name: cleanName,
      role,
      created_at: new Date().toISOString()
    };


    return { inviteId, plainCode, user };
  }

  /**
   * Permanently deletes an invite code and its associated user/sessions from SQLite.
   */
  public revokeInvite(inviteId: string): boolean {
    if (inviteId === 'invite_master' || inviteId.startsWith('invite_master')) {
      return false; // Protect master access tokens from accidental deletion
    }

    const token = db.prepare('SELECT user_id FROM invite_tokens WHERE id = ?').get(inviteId) as any;
    if (!token) return false;

    // 1. Delete associated active sessions and ws tickets
    db.prepare('DELETE FROM user_sessions WHERE user_id = ?').run(token.user_id);
    db.prepare('DELETE FROM ws_tickets WHERE user_id = ?').run(token.user_id);

    // 2. Delete the invite token
    const res = db.prepare('DELETE FROM invite_tokens WHERE id = ?').run(inviteId);

    // 3. Delete user record if not master user
    if (token.user_id !== 'user_master') {
      db.prepare('DELETE FROM users WHERE id = ?').run(token.user_id);
    }

    return res.changes > 0;
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

// Auto cleanup every hour (unref so one-off scripts and CLI commands can exit cleanly)
const cleanupInterval = setInterval(() => {
  authService.cleanupExpired();
}, 60 * 60 * 1000);
cleanupInterval.unref();
