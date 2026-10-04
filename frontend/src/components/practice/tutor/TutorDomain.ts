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

export function resolveTutorDomain(input: DomainInput): TutorDomain {
  if (input.hasActiveTxScenario) {
    return 'transactions';
  }

  const category = (input.category || '').toLowerCase();
  const track = (input.track || '').toLowerCase();
  const title = (input.title || '').toLowerCase();

  const combined = [category, track, title].filter(Boolean).join(' ');

  // 1. Refactoring Katas & Legacy
  if (
    combined.includes('refactoring') ||
    combined.includes('legacy') ||
    combined.includes('seam') ||
    combined.includes('gilded') ||
    combined.includes('trip') ||
    combined.includes('overloaded-constructor') ||
    combined.includes('legacy-invoice') ||
    combined.includes('legacy-tax')
  ) {
    return 'refactoring';
  }

  // 2. Java 21 Idioms
  if (
    combined.includes('java21') ||
    combined.includes('java_21') ||
    combined.includes('java 21') ||
    combined.includes('pattern_matching') ||
    combined.includes('pattern matching') ||
    combined.includes('record_pattern') ||
    combined.includes('sealed')
  ) {
    return 'java21';
  }

  // 3. Concurrency Lab & Multithreading (takes precedence over general lld)
  if (
    combined.includes('concurrency') ||
    combined.includes('deadlock') ||
    combined.includes('race_condition') ||
    combined.includes('thread') ||
    combined.includes('atomic') ||
    combined.includes('lock') ||
    combined.includes('loom') ||
    combined.includes('disruptor') ||
    combined.includes('virtual-thread') ||
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
