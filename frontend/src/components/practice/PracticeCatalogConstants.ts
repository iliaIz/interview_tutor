import React from 'react';
import { ChallengeCategory } from '../../types/practice';
import {
  Code2,
  Layers,
  Zap,
  Sparkles,
  Shield,
  Bug,
  Database,
  Crown,
  CheckCircle2,
  Crosshair,
  Terminal,
  Flame
} from 'lucide-react';

export const FlameIcon = Flame;

export const CATEGORIES: { id: ChallengeCategory; name: string; icon: React.ComponentType<any>; badge?: string }[] = [
  { id: 'all', name: 'Все задачи', icon: Code2 },
  { id: 'alfa_digital', name: '🅰️ Альфа-Банк', icon: FlameIcon, badge: 'Alfa Digital Track' },
  { id: 'raiffeisen', name: '🏦 Райффайзенбанк', icon: Crown, badge: 'FinTech Track' },
  { id: 'design_patterns', name: 'Design Patterns', icon: Layers, badge: '7 Katas (SOTA 2026)' },
  { id: 'refactoring_kata', name: 'Refactoring Arena', icon: Shield, badge: '24 Katas (L0–L3)' },
  { id: 'spring_transactions', name: 'Spring Transactions Lab', icon: Database, badge: 'SOTA 2026' },
  { id: 'testing_mutation', name: 'Testing & Mutation', icon: Bug, badge: '42 Katas (L0–L3)' },
  { id: 'lld_bigtech', name: 'BigTech LLD', icon: Layers, badge: 'Яндекс/Озон' },
  { id: 'lld_fintech', name: 'FinTech & Ledger', icon: Crown, badge: 'Т-Банк/Stripe' },
  { id: 'lld_concurrency', name: 'Concurrency Lab', icon: Zap, badge: 'Loom/Threads' },
  { id: 'java21_idioms', name: 'Java 21 Idioms', icon: Sparkles }
];

export const DESIGN_PATTERNS_ARCHETYPES = [
  { id: 'all', name: 'Все (7 кат)', badge: '🏆 Все паттерны', icon: Sparkles, match: [] },
  { id: 'modern_alternatives', name: '⚡ Java 21 Replacements (2)', badge: '⚡ Idiomatic 2026', icon: Zap, match: ['dp_01', 'dp_02', 'sealed_visitor', 'lambda_strategy'] },
  { id: 'anti_patterns', name: '🚫 Anti-Pattern Smells (3)', badge: '🚫 Smells & Traps', icon: Shield, match: ['dp_03', 'dp_04', 'dp_05', 'singleton_god', 'order_fsm', 'hexagonal_adapter'] },
  { id: 'enterprise_gof', name: '🏛️ Enterprise Spring GoF (2)', badge: '🏛️ Spring AOP & DI', icon: Layers, match: ['dp_06', 'dp_07', 'spring_proxy', 'decorator_audit'] }
];

export const TESTING_ARCHETYPES = [
  { id: 'all', name: 'Все (42 каты)', badge: '🏆 Все уровни', icon: Sparkles, match: [] },
  { id: 'l0_primitives', name: '🟢 L0: Primitives (6)', badge: '🟢 База', icon: CheckCircle2, match: ['prim_01', 'prim_02', 'prim_03', 'prim_04', 'prim_05', 'prim_06'] },
  { id: 'l1_reverse', name: '🟡 L1: Reverse Testing (6)', badge: '🟡 Code Defenders', icon: Crosshair, match: ['rev_01', 'rev_02', 'rev_03', 'rev_04', 'rev_05', 'rev_06'] },
  { id: 'legacy', name: 'Legacy Seams (5)', badge: '✂️ Seams', icon: Shield, match: ['trip_service_seam', 'gilded_rose_approval', 'overloaded_constructor', 'legacy_security_context', 'legacy_tax_engine'] },
  { id: 'junit5', name: 'JUnit 5 & Boundaries (5)', badge: '🧪 Deep JUnit', icon: Terminal, match: ['financial_tx_validator', 'combinatorial_pricing', 'dynamic_rbac', 'banking_account_lifecycle', 'security_context_cleanup'] },
  { id: 'mockito', name: 'Mockito 5 Verification (5)', badge: '🎭 Mockito 5', icon: CheckCircle2, match: ['strict_in_order_audit', 'async_event_dto_captor', 'spy_partial_mocking', 'resilient_cascading_retry', 'deterministic_time_mockstatic'] },
  { id: 'fsm', name: 'State Machines & Retries (5)', badge: '🔄 Automata', icon: FlameIcon, match: ['order_state_machine', 'idempotent_account', 'resilience_circuit_breaker', 'sliding_window_rate_limiter', 'distributed_saga'] },
  { id: 'concurrency', name: 'Concurrency & Loom (5)', badge: '⚡ Loom & Races', icon: Zap, match: ['awaitility_polling', 'race_condition_ledger', 'deadlock_provocation', 'virtual_thread_carrier_pinning', 'lock_free_ringbuffer'] },
  { id: 'archunit', name: 'ArchUnit & Slices (5)', badge: '🏛️ ArchUnit', icon: Layers, match: ['archunit_layer_isolation', 'archunit_enterprise_api_governance', 'archunit_transactional_integrity', 'spring_webmvc_problem_detail', 'jackson_financial_pan_masking'] }
];

export const REFACTORING_ARCHETYPES = [
  { id: 'all', name: 'Все каты (26)', badge: '🏆 Все уровни (L0–L3)', icon: Sparkles, match: [] },
  { id: 'l0_junior', name: '🟢 Junior L0 (4)', badge: '🟢 Clean Code', icon: CheckCircle2, match: ['l0-ref'] },
  { id: 'l1_middle', name: '🟡 Middle L1 (4)', badge: '🟡 Seams & DTO', icon: Shield, match: ['l1-ref'] },
  { id: 'l2_senior', name: '🔴 Senior L2 (10)', badge: '🔴 Concurrency & Loom', icon: Zap, match: ['l2-ref', 'gilded_rose', 'trip_service'] },
  { id: 'l3_staff', name: '🟣 Staff L3 (8)', badge: '🟣 BigTech Architecture', icon: Crown, match: ['l3-ref'] }
];

export function isChallengeInCategory(c: { id?: string; category?: string; track?: string }, category: ChallengeCategory): boolean {
  if (category === 'all') return true;
  if (category === 'alfa_digital') {
    const alfaIds = [
      'cr-alfa-01', 'cr-alfa-02', 'cr-alfa-03', 'cr-alfa-04', 'cr-alfa-05', 'cr-alfa-06',
      'lc-alfa-01', 'lc-alfa-02', 'lld-key-value-cache-ttl', 'lc-alfa-04', 'lc-alfa-05'
    ];
    return alfaIds.includes(c.id || '') || c.track === 'alfa_livecoding' || c.track === 'alfa_code_review';
  }
  if (category === 'raiffeisen') {
    const rIds = ['iban-validator', 'sparse-vector', 'case_transfer_service', 'case_account_collections'];
    return rIds.includes(c.id || '') || c.track === 'raiffeisen_code_review';
  }
  if (category === 'design_patterns') return c.category === 'design_patterns' || c.track === 'design_patterns';
  if (category === 'refactoring_kata') return c.category === 'refactoring_kata' || c.track === 'refactoring';
  if (category === 'spring_transactions') return c.category === 'spring_transactions';
  if (category === 'testing_mutation') return c.category === 'testing_mutation' || c.track === 'testing_mutation';
  if (category === 'lld_bigtech') return (c.track === 'lld_bigtech' && c.category === 'machine_coding') || c.category === 'lld_bigtech';
  if (category === 'lld_fintech') return c.track === 'lld_fintech' || c.category === 'lld_fintech';
  if (category === 'lld_concurrency') return c.track === 'lld_concurrency' || c.category === 'lld_concurrency' || c.category === 'concurrency_lab';
  if (category === 'java21_idioms') return c.category === 'java21_idioms';
  return c.category === category || c.track === category;
}

export function isChallengeInArchetype(
  c: { id: string; slug?: string; taskCode?: string; difficulty?: string },
  category: ChallengeCategory,
  archetypeId: string
): boolean {
  if (archetypeId === 'all') return true;

  if (category === 'design_patterns') {
    const arch = DESIGN_PATTERNS_ARCHETYPES.find((a) => a.id === archetypeId);
    if (!arch || arch.match.length === 0) return true;
    const target = `${c.id} ${c.slug || ''} ${c.taskCode || ''}`.toLowerCase().replace(/-/g, '_');
    return arch.match.some((m) => target.includes(m.toLowerCase().replace(/-/g, '_')));
  }

  if (category === 'refactoring_kata') {
    const cid = (c.id || '').toLowerCase();
    const diff = (c.difficulty || '').toLowerCase();
    if (archetypeId === 'l0_junior') return cid.startsWith('l0-ref') || diff === 'junior';
    if (archetypeId === 'l1_middle') return cid.startsWith('l1-ref') || diff === 'middle';
    if (archetypeId === 'l2_senior') return cid.startsWith('l2-ref') || cid === 'kata_gilded_rose' || cid === 'kata_trip_service' || diff === 'senior';
    if (archetypeId === 'l3_staff') return cid.startsWith('l3-ref') || diff === 'lead' || diff === 'staff';
    return true;
  }

  if (category === 'testing_mutation') {
    const arch = TESTING_ARCHETYPES.find((a) => a.id === archetypeId);
    if (!arch || arch.match.length === 0) return true;
    const target = `${c.id} ${c.slug || ''} ${c.taskCode || ''}`.toLowerCase().replace(/-/g, '_');
    return arch.match.some((m) => target.includes(m.toLowerCase().replace(/-/g, '_')));
  }

  return true;
}

export const GRADE_CONFIG = [
  {
    id: 'Junior',
    name: 'Junior Foundation',
    badge: '🟢 Базовый уровень (L0)',
    subline: 'Скалярные ассерты, чистые функции, Clock-инжекция, AAA-паттерн',
    tagClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    barColor: 'bg-emerald-500',
    bgHeader: 'from-emerald-50/80 via-teal-50/40 to-white'
  },
  {
    id: 'Middle',
    name: 'Middle Specialist',
    badge: '🟡 Продвинутый уровень (L1)',
    subline: 'Обратное тестирование, швы для легаси, Mockito 5, кэши с TTL, паттерны проектирования',
    tagClass: 'bg-blue-100 text-blue-800 border-blue-300',
    barColor: 'bg-blue-500',
    bgHeader: 'from-blue-50/80 via-sky-50/40 to-white'
  },
  {
    id: 'Senior',
    name: 'Senior Architect',
    badge: '🔴 Экспертный уровень (L2)',
    subline: 'Deadlock-Free Ledgers, Outbox, Concurrency, ArchUnit, FSM, Rate Limiters, Distributed Sagas',
    tagClass: 'bg-rose-100 text-rose-800 border-rose-300',
    barColor: 'bg-rose-500',
    bgHeader: 'from-rose-50/80 via-pink-50/40 to-white'
  },
  {
    id: 'Lead',
    name: 'Staff / Principal & High-Load',
    badge: '🟣 Системный уровень (L3)',
    subline: 'LMAX Disruptor Ring Buffer, Loom Carrier Pinning, Striped Counters, Non-blocking Algorithms',
    tagClass: 'bg-purple-100 text-purple-800 border-purple-300',
    barColor: 'bg-purple-500',
    bgHeader: 'from-purple-50/80 via-violet-50/40 to-white'
  }
];

export type StatusFilter = 'all' | 'completed' | 'in_progress' | 'not_started';

export function getDifficultyColor(diff: string): string {
  switch (diff?.toLowerCase()) {
    case 'lead':
      return 'bg-purple-100 text-purple-800 border-purple-300';
    case 'senior':
      return 'bg-rose-100 text-rose-800 border-rose-300';
    case 'middle':
      return 'bg-blue-100 text-blue-800 border-blue-300';
    default:
      return 'bg-emerald-100 text-emerald-800 border-emerald-300';
  }
}
