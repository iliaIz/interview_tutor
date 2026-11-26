import fs from 'fs';
import path from 'path';
import { CodingChallenge, CodingChallengeSchema, Value } from '@interview-prep/shared';
import { resolveJsonCatalogPath } from '../../utils/pathResolver';

/**
 * ChallengeCatalogLoader.ts
 * Loads and TypeBox-validates externalized JSON catalogs from root json/ using resolveJsonCatalogPath.
 * Cognitive bounding limit: <= 140 lines.
 */

export interface LoadedChallengeCatalogs {
  base: CodingChallenge[];
  additionalLld: CodingChallenge[];
  mutation: CodingChallenge[];
  machineCoding: CodingChallenge[];
  refactoring: CodingChallenge[];
  designPatterns: CodingChallenge[];
  all: CodingChallenge[];
}

export class ChallengeCatalogLoader {
  /**
   * Resolves a catalog JSON filename, optionally preferring an explicit catalogDir override.
   */
  public static resolveCatalogFile(filename: string, catalogDir?: string): string {
    if (catalogDir) {
      const customPath = path.resolve(catalogDir, filename);
      if (fs.existsSync(customPath)) {
        return customPath;
      }
    }
    return resolveJsonCatalogPath(filename);
  }

  /**
   * Loads an arbitrary JSON array catalog without CodingChallengeSchema validation.
   */
  public static loadJsonCatalogArray<T = any>(filename: string, catalogDir?: string): T[] | null {
    const filePath = ChallengeCatalogLoader.resolveCatalogFile(filename, catalogDir);
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error(`[CATALOG_FORMAT_ERROR] Expected JSON array in ${filename} (${filePath})`);
    }
    return parsed as T[];
  }

  /**
   * Loads and strictly validates a CodingChallenge[] JSON file against CodingChallengeSchema.
   */
  public static loadValidatedCatalog(filename: string, catalogDir?: string): CodingChallenge[] {
    const filePath = ChallengeCatalogLoader.resolveCatalogFile(filename, catalogDir);
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️ [ChallengeCatalogLoader] Catalog file not found: ${filePath}`);
      return [];
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error(`[CATALOG_SCHEMA_ERROR] ${filename} root must be a JSON array`);
    }

    for (const item of parsed) {
      if (!Value.Check(CodingChallengeSchema, item)) {
        const firstErr = Value.Errors(CodingChallengeSchema, item).First();
        throw new Error(
          `[CATALOG_SCHEMA_ERROR] Invalid challenge '${item?.id ?? 'unknown'}' in ${filename} at ${firstErr?.path ?? ''}: ${firstErr?.message ?? 'validation failed'}`
        );
      }
    }
    return parsed as CodingChallenge[];
  }

  public static loadBaseChallenges(catalogDir?: string): CodingChallenge[] {
    return ChallengeCatalogLoader.loadValidatedCatalog('base_challenges.json', catalogDir);
  }

  public static loadAdditionalLldChallenges(catalogDir?: string): CodingChallenge[] {
    return ChallengeCatalogLoader.loadValidatedCatalog('additional_lld_challenges.json', catalogDir);
  }

  public static loadMutationChallenges(catalogDir?: string): CodingChallenge[] {
    return ChallengeCatalogLoader.loadValidatedCatalog('mutation_challenges.json', catalogDir);
  }

  public static loadMachineCodingChallenges(catalogDir?: string): CodingChallenge[] {
    return ChallengeCatalogLoader.loadValidatedCatalog('machine_coding_challenges.json', catalogDir);
  }

  public static loadRefactoringChallenges(catalogDir?: string): CodingChallenge[] {
    return ChallengeCatalogLoader.loadValidatedCatalog('refactoring_challenges.json', catalogDir);
  }

  public static loadDesignPatternChallenges(catalogDir?: string): CodingChallenge[] {
    return ChallengeCatalogLoader.loadValidatedCatalog('design_patterns_challenges.json', catalogDir);
  }

  /**
   * Returns the 62 legacy seeded coding & mutation katas (7 base + 13 additional LLD + 42 mutation).
   */
  public static loadLegacySeededChallenges(catalogDir?: string): CodingChallenge[] {
    return [
      ...ChallengeCatalogLoader.loadBaseChallenges(catalogDir),
      ...ChallengeCatalogLoader.loadAdditionalLldChallenges(catalogDir),
      ...ChallengeCatalogLoader.loadMutationChallenges(catalogDir)
    ];
  }
}

/**
 * Loads and TypeBox-validates all coding challenge JSON catalogs in a single pass.
 */
export function loadCodingChallengeCatalogs(catalogDir?: string): LoadedChallengeCatalogs {
  const base = ChallengeCatalogLoader.loadBaseChallenges(catalogDir);
  const additionalLld = ChallengeCatalogLoader.loadAdditionalLldChallenges(catalogDir);
  const mutation = ChallengeCatalogLoader.loadMutationChallenges(catalogDir);
  const machineCoding = ChallengeCatalogLoader.loadMachineCodingChallenges(catalogDir);
  const refactoring = ChallengeCatalogLoader.loadRefactoringChallenges(catalogDir);
  const designPatterns = ChallengeCatalogLoader.loadDesignPatternChallenges(catalogDir);

  return {
    base,
    additionalLld,
    mutation,
    machineCoding,
    refactoring,
    designPatterns,
    all: [...base, ...additionalLld, ...mutation, ...machineCoding, ...refactoring, ...designPatterns]
  };
}
