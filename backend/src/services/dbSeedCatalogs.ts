import Database from 'better-sqlite3';
import { CatalogSeeder } from './db/CatalogSeeder';

/**
 * Slim compatibility facade over atomic JSON CatalogSeeder (Spec 57 <= 35 lines).
 */

export function seedQuestionsFromJSON(db: Database.Database, catalogDir?: string): void {
  CatalogSeeder.seedQuestionsFromJSON(db, catalogDir);
}

export function seedCodingChallenges(db: Database.Database, catalogDir?: string): void {
  CatalogSeeder.seedCodingChallenges(db, catalogDir);
}

export function seedNextGenCatalogs(db: Database.Database, catalogDir?: string): void {
  CatalogSeeder.seedNextGenCatalogs(db, catalogDir);
}

export function seedAllCatalogs(db: Database.Database, catalogDir?: string): void {
  CatalogSeeder.seedAllCatalogs(db, catalogDir);
}
