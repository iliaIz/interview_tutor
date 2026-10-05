export type ChallengeDomain = 'lld' | 'transactions' | 'concurrency' | 'testing' | 'refactoring' | 'java21';

export interface ChallengeDomainQuery {
  category?: string | null;
  track?: string | null;
  slug?: string | null;
}

/**
 * Normalizes raw category/track/slug strings by stripping underscores and hyphens.
 */
export function normalizeCategorySlug(raw: string | null | undefined): string {
  return (raw || '')
    .toLowerCase()
    .replace(/[-_]/g, ' ')
    .trim();
}

/**
 * Resolves the primary technical domain of a practice challenge or scenario
 * for tailored prompt instructions and persona voice greetings.
 */
export function getChallengeDomain(query: ChallengeDomainQuery): ChallengeDomain {
  const category = normalizeCategorySlug(query.category);
  const track = normalizeCategorySlug(query.track);
  const slug = normalizeCategorySlug(query.slug);

  // 1. Primary explicit category & track matching
  if (category.includes('machine coding') || category.includes('lld') || track.includes('lld')) {
    return 'lld';
  }

  if (category.includes('transaction') || track.includes('transaction') || category.includes('spring transactions')) {
    return 'transactions';
  }

  if (category.includes('concurrency') || track.includes('concurrency')) {
    return 'concurrency';
  }

  if (category.includes('refactoring') || track.includes('refactoring')) {
    return 'refactoring';
  }

  if (category.includes('java21') || category.includes('java 21') || track.includes('java21')) {
    return 'java21';
  }

  // 2. Secondary heuristic resolution on combined title / slug metadata
  const combined = [category, track, slug].filter(Boolean).join(' ');

  if (
    combined.includes('refactoring') ||
    combined.includes('legacy') ||
    combined.includes('seam') ||
    combined.includes('gilded') ||
    combined.includes('trip')
  ) {
    return 'refactoring';
  }

  if (
    combined.includes('java21') ||
    combined.includes('java 21') ||
    combined.includes('pattern matching') ||
    combined.includes('record pattern') ||
    combined.includes('sealed')
  ) {
    return 'java21';
  }

  if (
    combined.includes('concurrency') ||
    combined.includes('deadlock') ||
    combined.includes('race condition') ||
    combined.includes('thread') ||
    combined.includes('atomic') ||
    /\block\b/.test(combined) ||
    combined.includes('loom') ||
    combined.includes('disruptor')
  ) {
    return 'concurrency';
  }

  if (
    combined.includes('transaction') ||
    combined.includes('spring transactions') ||
    combined.includes('@transactional') ||
    combined.includes('isolation') ||
    combined.includes('hikaricp') ||
    combined.includes('propagation')
  ) {
    return 'transactions';
  }

  if (
    combined.includes('lld') ||
    combined.includes('machine coding') ||
    combined.includes('architecture') ||
    combined.includes('solid') ||
    combined.includes('parking lot') ||
    combined.includes('rate limiter') ||
    combined.includes('matching engine') ||
    combined.includes('cache') ||
    combined.includes('sliding window')
  ) {
    return 'lld';
  }

  return 'testing';
}
