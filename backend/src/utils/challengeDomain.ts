/**
 * challengeDomain.ts
 *
 * Single Source of Truth for Practice Challenge Domain Classification (Backend, SOTA 2026).
 * Distinguishes between LLD/Machine Coding, Mutation Testing, Concurrency Lab, and Transaction Lab.
 */

export type ChallengeDomain = 'lld' | 'testing' | 'transactions' | 'concurrency';

export interface ChallengeLike {
  category?: string | null;
  track?: string | null;
  slug?: string | null;
  id?: string | null;
}

export function getChallengeDomain(challenge?: ChallengeLike | null): ChallengeDomain {
  if (!challenge) return 'testing';

  const cat = (challenge.category || '').toLowerCase().trim();
  const trk = (challenge.track || '').toLowerCase().trim();
  const id = (challenge.id || '').toLowerCase().trim();
  const slug = (challenge.slug || '').toLowerCase().trim();

  // 1. Explicit LLD & Machine Coding track/category/id takes precedence
  if (
    trk.startsWith('lld_') ||
    trk === 'lld' ||
    cat.startsWith('lld_') ||
    cat === 'machine_coding' ||
    id.startsWith('lld-') ||
    slug.startsWith('lld-') ||
    cat === 'refactoring_kata' ||
    cat === 'java21_idioms'
  ) {
    return 'lld';
  }

  // 2. Spring Transactions Lab check
  if (
    cat.includes('transaction') ||
    trk.includes('transaction') ||
    trk.startsWith('tx_') ||
    id.startsWith('tx-') ||
    id.startsWith('tx_')
  ) {
    return 'transactions';
  }

  // 3. Concurrency Lab check
  if (
    cat.includes('concurrency') ||
    trk.includes('concurrency') ||
    id.startsWith('loom-') ||
    slug.startsWith('loom-')
  ) {
    return 'concurrency';
  }

  // 4. Fallback if category has 'lld'
  if (cat.includes('lld')) {
    return 'lld';
  }

  // 5. Default: Unit Testing & Mutation Katas
  return 'testing';
}
