export interface TechStackInfo {
  language: string;
  javaVersion: string;
  framework: string;
  keyLibraries: string[];
}

export interface ProductionContext {
  systemName: string;
  architectureType: string;
  incidentSymptoms: string;
  businessImpact: string;
  prReviewContext: string;
}

export interface BugChallenge {
  id: string;
  topicId?: string;
  topicName?: string;
  title: string;
  subtopic: string;
  language: 'java' | 'sql' | 'kotlin';
  codeSnippet: string;
  bugExplanation: string;
  fixedCode: string;
  hints: string[];
  categoryBadge?: string;
  difficultyBadge?: string;
  sampledQuestionId?: string;
  isTopicExhausted?: boolean;
  remainingCount?: number;
  totalTopicQuestions?: number;
  isSolved?: boolean;
  lastScore?: number;
  lastFeedback?: string;
  keyTakeaways?: string[];
  techStack?: TechStackInfo;
  productionContext?: ProductionContext;
  createdAt?: string;
}

export interface GenerateBugChallengeParams {
  questionId?: string;
  topicId?: string;
  topic?: string;
  questionText?: string;
  referenceAnswer?: string;
  workoutPreset?: 'exhaustive' | 'senior_multi' | 'random';
  defectFocus?: string;
  difficulty?: 'middle' | 'senior';
  excludeIds?: string[];
  techStackProfile?: 'modern_cloud' | 'fintech_transactional' | 'enterprise_migration' | 'reactive_streaming' | 'custom';
  customTechStack?: string;
  customInstructions?: string;
}

export const TECH_STACK_ARCHETYPES: Record<string, { name: string; badge: string; description: string; stackPrompt: string }> = {
  modern_cloud: {
    name: 'Modern Cloud-Native',
    badge: '🚀 Loom & Spring 3.4+',
    description: 'Java 21 LTS, Spring Boot 3.4.x, Project Loom (Virtual Threads), PostgreSQL 16, Hibernate 6.6+, Kafka 3.8',
    stackPrompt: `Язык: Java 21 LTS. Фреймворк: Spring Boot 3.4.x / Spring Framework 6.2. Модель: Project Loom (Virtual Threads per Task). Персистентность: Spring Data JPA + Hibernate 6.6+, HikariCP, PostgreSQL 16. Брокер: Kafka 3.8 (KRaft). Метрики: Micrometer 1.14.`
  },
  fintech_transactional: {
    name: 'FinTech / Mission-Critical',
    badge: '💳 Outbox & ACID',
    description: 'Java 21 LTS, Spring Boot 3.4.x, Transactional Outbox, Debezium CDC, Redisson 3.35 Fenced Locks, PostgreSQL 16',
    stackPrompt: `Язык: Java 21 LTS. Фреймворк: Spring Boot 3.4.x. Персистентность: Spring Data JPA, PostgreSQL 16 (Repeatable Read / Serializable), Transactional Outbox. Распределенная синхронизация: Redisson 3.35 Fenced Locks. Брокер: Kafka EOS (Exactly-Once).`
  },
  enterprise_migration: {
    name: 'Enterprise Migration',
    badge: '🏛️ Boot 2.7 ➔ 3.x / Jakarta',
    description: 'Java 17 ➔ 21, Spring Boot 2.7.18 ➔ 3.4+, Jakarta EE 10/11 (jakarta.*), Hibernate 5.6 ➔ 6.6 (SQM), Flyway 10',
    stackPrompt: `Язык: Java 17/21. Фреймворк: Spring Boot 3.4.x (миграция с 2.7). Пространство имен: строго jakarta.* (Servlet, JPA, Validation). Персистентность: Hibernate 6.6 (Semantic Query Model SQM), Flyway 10. HTTP: RestClient / HttpComponentsClientHttpRequestFactory.`
  },
  reactive_streaming: {
    name: 'Highload Reactive',
    badge: '⚡ WebFlux & Netty',
    description: 'Java 21, Spring WebFlux, Project Reactor 3.6, Netty EventLoop, Spring Data R2DBC, Redis Reactive',
    stackPrompt: `Язык: Java 21. Фреймворк: Spring Boot 3.4.x WebFlux. Движок: Project Reactor 3.6 + Netty EventLoop. Персистентность: Spring Data R2DBC (PostgreSQL Driver), ReactiveRedisTemplate. Трассировка: Micrometer Reactor Context Propagation.`
  }
};

export const DEFECT_FOCUS_MAP: Record<string, string> = {
  streams: 'ФОКУС: Java Streams API, Collectors null/collision safety, mapMulti vs flatMap (Zero-GC), Collectors.teeing, ForkJoinPool isolation, distinct/sorted stateful traps, Spliterators, sliding window collectors.',
  concurrency: 'ФОКУС: Многопоточность Java 21+, устранение Carrier Thread Pinning (synchronized -> ReentrantLock/StampedLock), ScopedValue vs ThreadLocal, JMM Release/Acquire fences на VarHandle, lock-free FieldUpdater, LongAdder, CompletableFuture DAGs.',
  testing: 'ФОКУС: Практическое тестирование и рефакторинг, Legacy Seams (Subclass & Override, Overloaded Constructor), Approval / Golden Master, JUnit 5 (@MethodSource, @TestFactory, Extensions), Mockito 5 (@MockitoBean, InOrder, mockStatic), Testcontainers (@ServiceConnection), ArchUnit и Pitest Mutation Score.',
  memory: 'ФОКУС: Утечки памяти (Memory Leaks / Metaspace), удержание ссылок (ThreadLocal, static collections), декартово произведение в Hibernate 6 и перегрузка GC.',
  spring_aop: 'ФОКУС: Spring AOP прокси (Self-invocation bypass), жизненный цикл бинов (@PostConstruct / Prototype injection), распространение транзакций (@Transactional propagation / rollback on checked exceptions).',
  contracts: 'ФОКУС: Нарушение контрактов equals/hashCode, мутации неизменяемых коллекций, некорректные Comparator (compare == 0 vs equals), serialization traps.',
  all: 'ФОКУС: Любые фундаментальные архитектурные, логические, Streams, Concurrency, Testing или транзакционные ловушки.'
};
