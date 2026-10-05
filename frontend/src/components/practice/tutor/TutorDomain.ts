/**
 * TutorDomain.ts
 *
 * Single Source of Truth (SSOT) for Practice Domain Classification on Frontend.
 * Perfectly aligned with backend `challengeDomain.ts` order and precedence.
 * Rule 8: <= 100 lines.
 */

export type TutorDomain =
  | 'refactoring'
  | 'java21'
  | 'concurrency'
  | 'transactions'
  | 'lld'
  | 'testing';

export interface DomainInput {
  category?: string;
  track?: string;
  title?: string;
  hasActiveTxScenario?: boolean;
}

export function normalizeCategorySlug(raw: string | null | undefined): string {
  return (raw || '')
    .toLowerCase()
    .replace(/[-_]/g, ' ')
    .trim();
}

export function resolveTutorDomain(input: DomainInput): TutorDomain {
  if (input.hasActiveTxScenario) {
    return 'transactions';
  }

  const category = normalizeCategorySlug(input.category);
  const track = normalizeCategorySlug(input.track);
  const title = normalizeCategorySlug(input.title);

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

  // 2. Secondary heuristic fallback on combined metadata
  const combined = [category, track, title].filter(Boolean).join(' ');

  // Refactoring Katas & Legacy
  if (
    combined.includes('refactoring') ||
    combined.includes('legacy') ||
    combined.includes('seam') ||
    combined.includes('gilded') ||
    combined.includes('trip') ||
    combined.includes('overloaded constructor') ||
    combined.includes('legacy invoice') ||
    combined.includes('legacy tax')
  ) {
    return 'refactoring';
  }

  // Java 21 Idioms
  if (
    combined.includes('java21') ||
    combined.includes('java 21') ||
    combined.includes('pattern matching') ||
    combined.includes('record pattern') ||
    combined.includes('sealed')
  ) {
    return 'java21';
  }

  // Concurrency Lab & Multithreading
  if (
    combined.includes('concurrency') ||
    combined.includes('deadlock') ||
    combined.includes('race condition') ||
    combined.includes('thread') ||
    combined.includes('atomic') ||
    /\block\b/.test(combined) ||
    combined.includes('loom') ||
    combined.includes('disruptor') ||
    combined.includes('virtual thread') ||
    combined.includes('ringbuffer') ||
    combined.includes('stampedlock') ||
    combined.includes('awaitility')
  ) {
    return 'concurrency';
  }

  // 4. Spring Transactions
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

  // 5. Low-Level Design (LLD) & Machine Coding
  if (
    combined.includes('lld') ||
    combined.includes('machine_coding') ||
    combined.includes('machine coding') ||
    combined.includes('architecture') ||
    combined.includes('solid') ||
    combined.includes('rate limiter') ||
    combined.includes('matching engine') ||
    combined.includes('parking lot') ||
    combined.includes('sliding window')
  ) {
    return 'lld';
  }

  // 6. Testing & Mutation Katas (Default)
  return 'testing';
}

export const DOMAIN_LABELS: Record<TutorDomain, string> = {
  refactoring: 'Рефакторинг (Legacy Seams)',
  java21: 'Java 21 LTS (Records & Sealed)',
  concurrency: 'Многопоточность (Loom & JMM)',
  transactions: 'Spring Transactions (ACID)',
  lld: 'LLD & Machine Coding',
  testing: 'Тестирование & Мутации',
};
