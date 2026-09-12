export type ChallengeDomain = 'lld' | 'transactions' | 'concurrency' | 'testing';

export interface ChallengeDomainQuery {
  category?: string | null;
  track?: string | null;
  slug?: string | null;
}

/**
 * Resolves the primary technical domain of a practice challenge or scenario
 * for tailored prompt instructions and persona voice greetings.
 */
export function getChallengeDomain(query: ChallengeDomainQuery): ChallengeDomain {
  const category = (query.category || '').toLowerCase();
  const track = (query.track || '').toLowerCase();
  const slug = (query.slug || '').toLowerCase();

  const combined = [category, track, slug].filter(Boolean).join(' ');

  if (
    combined.includes('lld') ||
    combined.includes('machine_coding') ||
    combined.includes('architecture') ||
    combined.includes('solid') ||
    combined.includes('refactoring_kata')
  ) {
    return 'lld';
  }

  if (
    combined.includes('transaction') ||
    combined.includes('spring_transactions') ||
    combined.includes('@transactional') ||
    combined.includes('isolation') ||
    combined.includes('hikaricp') ||
    combined.includes('propagation')
  ) {
    return 'transactions';
  }

  if (
    combined.includes('concurrency') ||
    combined.includes('deadlock') ||
    combined.includes('race_condition') ||
    combined.includes('thread') ||
    combined.includes('atomic') ||
    combined.includes('lock')
  ) {
    return 'concurrency';
  }

  return 'testing';
}
