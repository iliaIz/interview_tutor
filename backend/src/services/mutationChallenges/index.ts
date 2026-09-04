import { CodingChallenge } from '../challengeSeedData';
import { LEGACY_SEAMS_CHALLENGES } from './legacyChallenges';
import { JUNIT5_CHALLENGES } from './junit5Challenges';
import { MOCKITO_CHALLENGES } from './mockitoChallenges';
import { FSM_CHALLENGES } from './fsmChallenges';
import { CONCURRENCY_CHALLENGES } from './concurrencyChallenges';
import { ARCHUNIT_CHALLENGES } from './archUnitChallenges';

export {
  LEGACY_SEAMS_CHALLENGES,
  JUNIT5_CHALLENGES,
  MOCKITO_CHALLENGES,
  FSM_CHALLENGES,
  CONCURRENCY_CHALLENGES,
  ARCHUNIT_CHALLENGES
};

export const ALL_MUTATION_CHALLENGES: CodingChallenge[] = [
  ...LEGACY_SEAMS_CHALLENGES,
  ...JUNIT5_CHALLENGES,
  ...MOCKITO_CHALLENGES,
  ...FSM_CHALLENGES,
  ...CONCURRENCY_CHALLENGES,
  ...ARCHUNIT_CHALLENGES
];

export interface ArchetypeFilter {
  id: string;
  title: string;
  badge: string;
  description: string;
  kataIds: string[];
}

export const ARCHETYPES_METADATA: ArchetypeFilter[] = [
  {
    id: 'all',
    title: 'Все архетипы (30)',
    badge: '🏆 Полный арсенал',
    description: 'Полный BigTech-каталог из 30 канонических задач на мутационное тестирование в 6 доменных архетипах.',
    kataIds: ALL_MUTATION_CHALLENGES.map(c => c.id)
  },
  {
    id: 'legacy_seams',
    title: 'Legacy Code Seams (5)',
    badge: '✂️ Legacy Seams',
    description: 'Швы Майкла Физерса, Approval Testing, детерминированные часы Clock и вырезание синглтонов.',
    kataIds: LEGACY_SEAMS_CHALLENGES.map(c => c.id)
  },
  {
    id: 'junit5_boundaries',
    title: 'JUnit 5 & Boundaries (5)',
    badge: '🧪 JUnit 5 Deep',
    description: 'Параметризованные тесты, динамические тесты @TestFactory, TypedArgumentConverter и кастомные Extensions.',
    kataIds: JUNIT5_CHALLENGES.map(c => c.id)
  },
  {
    id: 'mockito_verification',
    title: 'Mockito 5 Verification (5)',
    badge: '🎭 Mockito 5',
    description: 'Строгий порядок InOrder, ArgumentCaptor для PII/W3C, частичное мокирование @Spy и mockStatic.',
    kataIds: MOCKITO_CHALLENGES.map(c => c.id)
  },
  {
    id: 'state_machines',
    title: 'State Machines & Retries (5)',
    badge: '🔄 State Machines',
    description: 'Конечные автоматы, идемпотентность, скользящие лимитеры и саги с компенсациями.',
    kataIds: FSM_CHALLENGES.map(c => c.id)
  },
  {
    id: 'concurrency_loom',
    title: 'Concurrency & Virtual Threads (5)',
    badge: '⚡ Loom & Races',
    description: 'Awaitility polling, CyclicBarrier для гонок, Ordered Locking против дедлоков, Pinning и lock-free RingBuffer.',
    kataIds: CONCURRENCY_CHALLENGES.map(c => c.id)
  },
  {
    id: 'archunit_slices',
    title: 'ArchUnit & Spring Slices (5)',
    badge: '🏛️ ArchUnit & Slices',
    description: 'Фитнес-функции ArchUnit, изоляция слоев, запрет System.exit(), @Transactional public, @WebMvcTest RFC 7807 и @JsonTest.',
    kataIds: ARCHUNIT_CHALLENGES.map(c => c.id)
  }
];
