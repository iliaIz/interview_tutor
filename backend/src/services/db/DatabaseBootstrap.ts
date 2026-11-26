import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { CANONICAL_TABLES_SQL } from './dbTablesSql';
import { COMPOSITE_INDEXES_SQL, runSchemaMigrations } from '../dbIndexes';

/**
 * DatabaseBootstrap.ts
 * Decouples SQLite construction, PRAGMA tuning, DDL initialization,
 * and explicit auth invite cleanup from module-load side effects (Spec 57).
 * Cognitive bounding limit: <= 180 lines.
 */

export class DatabaseBootstrap {
  /**
   * Resolves a database path, preserving ':memory:' without touching the filesystem.
   */
  public static resolveDbPath(dbPath?: string): string {
    if (dbPath && dbPath.trim().length > 0) {
      return dbPath;
    }
    return process.env.DB_PATH || path.join(__dirname, '../../../data/interview.db');
  }

  /**
   * Opens a SQLite database at the given path (or ':memory:'), applies pragmas,
   * and initializes canonical schemas and non-destructive migrations.
   */
  public static createDatabase(dbPath?: string): Database.Database {
    const resolvedPath = DatabaseBootstrap.resolveDbPath(dbPath);
    const isMemory = resolvedPath === ':memory:' || resolvedPath.startsWith('file::memory:');

    if (!isMemory) {
      const dataDir = path.dirname(resolvedPath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
    }

    const database = new Database(resolvedPath);
    return DatabaseBootstrap.init(database, isMemory);
  }

  /**
   * Initializes an already-opened SQLite Database instance with canonical PRAGMAs and schemas.
   */
  public static init(database: Database.Database, isMemory = false): Database.Database {
    DatabaseBootstrap.applyPragmas(database, isMemory);
    DatabaseBootstrap.initSchema(database);
    return database;
  }

  /**
   * Configures SQLite WAL, memory-mapped I/O, and foreign key enforcement.
   */
  public static applyPragmas(database: Database.Database, isMemory = false): void {
    if (!isMemory) {
      database.pragma('journal_mode = WAL');
    }
    database.pragma('busy_timeout = 5000');
    database.pragma('synchronous = NORMAL');
    database.pragma('temp_store = MEMORY');
    database.pragma('mmap_size = 268435456');
    database.pragma('cache_size = -64000');
    database.pragma('foreign_keys = ON');
  }

  /**
   * Creates canonical tables, composite indexes, and applies additive column migrations.
   * Performs zero destructive DELETE operations.
   */
  public static initSchema(database: Database.Database): void {
    database.exec(CANONICAL_TABLES_SQL);
    database.exec(COMPOSITE_INDEXES_SQL);
    runSchemaMigrations(database);
  }

  /**
   * Explicitly purges revoked/inactive invite tokens and orphaned non-master user sessions.
   * Must only be invoked during production server startup, never on test DB initialization.
   */
  public static cleanupInactiveInvites(database: Database.Database): void {
    try {
      const purge = database.transaction(() => {
        database.exec(`
          DELETE FROM user_sessions WHERE user_id IN (SELECT user_id FROM invite_tokens WHERE is_active = 0);
          DELETE FROM ws_tickets WHERE user_id IN (SELECT user_id FROM invite_tokens WHERE is_active = 0);
          DELETE FROM invite_tokens WHERE is_active = 0;
          DELETE FROM users WHERE id NOT IN (SELECT user_id FROM invite_tokens) AND id != 'user_master';
        `);
      });
      purge();
    } catch (err) {
      console.error('Error cleaning up inactive invites:', err);
    }
  }
}
