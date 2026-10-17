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
  Terminal
} from 'lucide-react';

export function FlameIcon(props: any) {
  return <Sparkles {...props} />;
}

export const CATEGORIES: { id: ChallengeCategory; name: string; icon: React.ComponentType<any>; badge?: string }[] = [
  { id: 'all', name: 'Все задачи', icon: Code2 },
  { id: 'refactoring_kata', name: 'Refactoring Arena', icon: Shield, badge: '24 Katas (L0–L3)' },
  { id: 'spring_transactions', name: 'Spring Transactions Lab', icon: Database, badge: 'SOTA 2026' },
  { id: 'testing_mutation', name: 'Testing & Mutation', icon: Bug, badge: '42 Katas (L0–L3)' },
  { id: 'lld_bigtech', name: 'BigTech LLD', icon: Layers, badge: 'Яндекс/Озон' },
  { id: 'lld_fintech', name: 'FinTech & Ledger', icon: Crown, badge: 'Т-Банк/Stripe' },
  { id: 'lld_concurrency', name: 'Concurrency Lab', icon: Zap, badge: 'Loom/Threads' },
  { id: 'java21_idioms', name: 'Java 21 Idioms', icon: Sparkles }
];

export const TESTING_ARCHETYPES = [
  { id: 'all', name: 'Все (42 каты)', badge: '🏆 Все уровни', icon: Sparkles, match: [] },
  { id: 'l0_primitives', name: '🟢 L0: Primitives (6)', badge: '🟢 База', icon: CheckCircle2, match: ['prim-01', 'prim-02', 'prim-03', 'prim-04', 'prim-05', 'prim-06'] },
  { id: 'l1_reverse', name: '🟡 L1: Reverse Testing (6)', badge: '🟡 Code Defenders', icon: Crosshair, match: ['rev-01', 'rev-02', 'rev-03', 'rev-04', 'rev-05', 'rev-06'] },
  { id: 'legacy', name: 'Legacy Seams (5)', badge: '✂️ Seams', icon: Shield, match: ['trip-service', 'gilded-rose', 'overloaded-constructor', 'legacy-invoice', 'legacy-tax'] },
  { id: 'junit5', name: 'JUnit 5 & Boundaries (5)', badge: '🧪 Deep JUnit', icon: Terminal, match: ['financial-tx', 'combinatorial-pricing', 'dynamic-rbac', 'nested-account', 'security-context'] },
  { id: 'mockito', name: 'Mockito 5 Verification (5)', badge: '🎭 Mockito 5', icon: CheckCircle2, match: ['audit-trail', 'async-event-captor', 'spy-do-return', 'resilient-retry', 'deterministic-time-uuid'] },
  { id: 'fsm', name: 'State Machines & Retries (5)', badge: '🔄 Automata', icon: FlameIcon, match: ['order-state-machine', 'idempotent-account', 'circuit-breaker-state', 'sliding-window-rate-limiter', 'distributed-saga'] },
  { id: 'concurrency', name: 'Concurrency & Loom (5)', badge: '⚡ Loom & Races', icon: Zap, match: ['awaitility-polling', 'cyclic-barrier', 'threadmxbean-deadlock', 'virtual-thread-pinning', 'lockfree-ringbuffer'] },
  { id: 'archunit', name: 'ArchUnit & Slices (5)', badge: '🏛️ ArchUnit', icon: Layers, match: ['archunit-layer-isolation', 'archunit-enterprise-api-governance', 'archunit-transactional-integrity', 'spring-webmvc-problem-detail', 'jackson-financial-pan-masking'] },
];

export const REFACTORING_ARCHETYPES = [
  { id: 'all', name: 'Все каты (24)', badge: '🏆 Все уровни (L0–L3)', icon: Sparkles, match: [] },
  { id: 'l0_junior', name: '🟢 Junior L0 (4)', badge: '🟢 Clean Code', icon: CheckCircle2, match: ['l0-ref-01', 'l0-ref-02', 'l0-ref-03', 'l0-ref-04'] },
  { id: 'l1_middle', name: '🟡 Middle L1 (4)', badge: '🟡 Seams & DTO', icon: Shield, match: ['l1-ref-01', 'l1-ref-02', 'l1-ref-03', 'l1-ref-04'] },
  { id: 'l2_senior', name: '🔴 Senior L2 (8)', badge: '🔴 Concurrency & Loom', icon: Zap, match: ['l2-ref-01', 'l2-ref-02', 'l2-ref-03', 'l2-ref-04', 'l2-ref-05', 'l2-ref-06', 'l2-ref-07', 'l2-ref-08'] },
  { id: 'l3_staff', name: '🟣 Staff L3 (8)', badge: '🟣 BigTech Architecture', icon: Crown, match: ['l3-ref-01', 'l3-ref-02', 'l3-ref-03', 'l3-ref-04', 'l3-ref-05', 'l3-ref-06', 'l3-ref-07', 'l3-ref-08'] }
];

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
