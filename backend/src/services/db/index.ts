import { db } from './connection';
import { initializeSchema } from './schema';

// Run DDL and migrations upon module loading
initializeSchema();

export { db };
export { seedDefaultProfiles } from './seeders/seedProfiles';
export { recoverOrphanedJobs } from './seeders/seedJobs';
export { seedQuestionsFromJSON } from './seeders/seedQuestions';
export { seedCodingChallenges } from './seeders/seedChallenges';
export { seedNextGenCatalogs } from './seeders/seedNextGenCatalogs';
export { seedMasterInviteCode } from './seeders/seedMasterCodes';
