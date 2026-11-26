import { DatabaseBootstrap } from './db/DatabaseBootstrap';
import { CatalogSeeder } from './db/CatalogSeeder';
import {
  seedDefaultProfiles as seedProfiles,
  recoverOrphanedJobs as recoverJobs,
  seedMasterInviteCode as seedMasterInvite
} from './dbSeedProfiles';

/**
 * Backward-compatible SQLite singleton facade backed by DatabaseBootstrap and CatalogSeeder (Spec 57).
 */
export const db = DatabaseBootstrap.createDatabase();

export { DatabaseBootstrap } from './db/DatabaseBootstrap';
export { CatalogSeeder } from './db/CatalogSeeder';
export { ChallengeCatalogLoader, loadCodingChallengeCatalogs } from './db/ChallengeCatalogLoader';

export const seedQuestionsFromJSON = () => CatalogSeeder.seedQuestionsFromJSON(db);
export const seedCodingChallenges = () => CatalogSeeder.seedCodingChallenges(db);
export const seedNextGenCatalogs = () => CatalogSeeder.seedNextGenCatalogs(db);
export const seedDefaultProfiles = () => seedProfiles(db);
export const recoverOrphanedJobs = () => recoverJobs(db);
export const seedMasterInviteCode = () => seedMasterInvite(db);
export const cleanupInactiveInvites = () => DatabaseBootstrap.cleanupInactiveInvites(db);
