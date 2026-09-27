import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { CANONICAL_TABLES_SQL } from './dbSchema';
import { COMPOSITE_INDEXES_SQL, runSchemaMigrations } from './dbIndexes';
import { 
  seedQuestionsFromJSON as seedQuestions, 
  seedCodingChallenges as seedChallenges, 
  seedNextGenCatalogs as seedCatalogs 
} from './dbSeedCatalogs';
import { 
  seedDefaultProfiles as seedProfiles, 
  recoverOrphanedJobs as recoverJobs, 
  seedMasterInviteCode as seedMasterInvite 
} from './dbSeedProfiles';

const dbPath = process.env.DB_PATH || path.join(__dirname, '../../data/interview.db');
const dataDir = path.dirname(dbPath);

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export const db = new Database(dbPath);

// SOTA 2026 SQLite WAL & Memory-Mapped Pragmas (SSOT: 00_CORE_INFRASTRUCTURE_AND_SECURITY.md)
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');
db.pragma('synchronous = NORMAL');
db.pragma('temp_store = MEMORY');
db.pragma('mmap_size = 268435456'); // 256MB memory-mapped I/O
db.pragma('cache_size = -64000');    // 64MB cache
db.pragma('foreign_keys = ON');

// Initialize Canonical Schemas & Composite Query Indexes
db.exec(CANONICAL_TABLES_SQL);
db.exec(COMPOSITE_INDEXES_SQL);

// Run Idempotent Schema Drift Migrations
runSchemaMigrations(db);

// Export bound seed functions for server startup
export const seedQuestionsFromJSON = () => seedQuestions(db);
export const seedCodingChallenges = () => seedChallenges(db);
export const seedNextGenCatalogs = () => seedCatalogs(db);
export const seedDefaultProfiles = () => seedProfiles(db);
export const recoverOrphanedJobs = () => recoverJobs(db);
export const seedMasterInviteCode = () => seedMasterInvite(db);
