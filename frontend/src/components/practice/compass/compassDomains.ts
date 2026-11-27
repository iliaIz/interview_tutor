/**
 * compassDomains.ts
 * Pure declarative 5-domain registry & grounding prompt builders for CompassDialogShell.
 * Zero DOM/React imports so contract tests can verify 5/5 domain coverage directly in Node.
 */

import type { TutorDomain } from '../tutor/TutorDomain';
import {
  LLD_COMPASS_CONFIG,
  TESTING_COMPASS_CONFIG,
  REFACTORING_COMPASS_CONFIG
} from './compassCoreDomains';

export type CompassDomainKey = 'lld' | 'testing' | 'refactoring' | 'concurrency' | 'transaction';

export interface CompassRuleDef {
  id: string;
  number: string;
  title: string;
  badge: string;
  shortFormula: string;
  fullPrinciple: string;
  checklist: string[];
  formulaOrCode?: string;
}

export interface CompassDomainConfig {
  domain: CompassDomainKey;
  title: string;
  subtitle: string;
  badge: string;
  hasTestingRadar?: boolean;
  rules: CompassRuleDef[];
}

export function resolveCompassDomainKey(domain: TutorDomain | CompassDomainKey | string): CompassDomainKey {
  if (domain === 'transactions' || domain === 'transaction') return 'transaction';
  if (domain === 'concurrency') return 'concurrency';
  if (domain === 'refactoring') return 'refactoring';
  if (domain === 'lld' || domain === 'java21') return 'lld';
  return 'testing';
}

export function buildCompassGroundingPrompt(domain: CompassDomainKey, rule: CompassRuleDef): string {
  return `Разбери правило "${rule.title}" (${domain}) применительно к моему текущему коду: ${rule.shortFormula}`;
}

const CONCURRENCY_COMPASS_CONFIG: CompassDomainConfig = {
  domain: 'concurrency',
  title: 'Concurrency Компас: 5 Заповедей Многопоточности',
  subtitle: 'Virtual Threads, защита от Carrier Pinning, JMM и неблокирующие структуры',
  badge: 'Project Loom LTS',
  rules: [
    {
      id: 'LOOM_CARRIER_PINNING',
      number: '01',
      title: 'Loom: защита от Carrier Pinning',
      badge: 'Virtual Threads',
      shortFormula: 'Используйте ReentrantLock вместо synchronized вокруг блокирующих операций.',
      fullPrinciple:
        'В Java 21 блок synchronized с блокирующим I/O привязывает виртуальный поток к carrier-потоку ForkJoinPool.',
      checklist: [
        'synchronized заменен на ReentrantLock с try-finally?',
        'Отсутствует пиннинг при сетевом и дисковом I/O?',
        'Обеспечена разблокировка в блоке finally?'
      ]
    },
    {
      id: 'JMM_HAPPENS_BEFORE',
      number: '02',
      title: 'Видимость памяти и JMM',
      badge: 'Happens-Before',
      shortFormula: 'Разделяемые флаги объявляйте volatile или безопасно публикуйте через final.',
      fullPrinciple:
        'Без барьеров памяти JIT и CPU могут кешировать или переупорядочивать чтения и записи между потоками.',
      checklist: [
        'Флаги завершения объявлены как volatile?',
        'Используются final поля для безопасной публикации?',
        'Исключен сломанный double-checked locking?'
      ]
    },
    {
      id: 'ATOMIC_CAS_LOOPS',
      number: '03',
      title: 'Атомарный стейт и CAS',
      badge: 'Race-Free',
      shortFormula: 'Применяйте ConcurrentHashMap.compute(), LongAdder и compareAndSet.',
      fullPrinciple:
        'Связка containsKey + put создает гонку Check-Then-Act. Используйте computeIfAbsent и атомарные аккумуляторы.',
      checklist: [
        'containsKey + put заменены на computeIfAbsent()?',
        'Счетчики используют AtomicLong или LongAdder?',
        'CAS-циклы корректно обрабатывают ретраи?'
      ]
    },
    {
      id: 'STAMPED_LOCK_OPTIMISTIC',
      number: '04',
      title: 'Оптимистичные чтения (StampedLock)',
      badge: 'Read-Heavy',
      shortFormula: 'tryOptimisticRead() + validate(stamp) убирает contention при преобладании чтений.',
      fullPrinciple:
        'При редких записях оптимистичное чтение не берет блокировку и переходит на readLock только при инвалидации штампа.',
      checklist: [
        'После tryOptimisticRead() вызывается validate(stamp)?',
        'Есть фоллбэк на readLock() при изменении данных?',
        'Учтена нереентерабельность StampedLock?'
      ]
    },
    {
      id: 'DISRUPTOR_LOCK_FREE',
      number: '05',
      title: 'Неблокирующие очереди и CPU Cache',
      badge: 'High-Load',
      shortFormula: 'Ring Buffer, защита от False Sharing и пакетный дренаж событий.',
      fullPrinciple:
        'Блокирующие очереди вызывают contention потоков; кольцевые буферы и батчинг минимизируют промахи кэша CPU.',
      checklist: [
        'Писатели и читатели не блокируют друг друга на одном замке?',
        'Горячие счетчики изолированы от False Sharing?',
        'Используется пакетная обработка там, где возможно?'
      ]
    }
  ]
};

const TRANSACTION_COMPASS_CONFIG: CompassDomainConfig = {
  domain: 'transaction',
  title: 'Transaction Compass: 5 Заповедей Spring ACID',
  subtitle: 'CGLIB-прокси, матрица распространения, правила отката и математика пула HikariCP',
  badge: 'Spring AOP & ACID',
  rules: [
    {
      id: 'cglib-lifecycle',
      number: '01',
      title: 'CGLIB-прокси и ловушка Self-Invocation',
      badge: 'AOP Proxy',
      shortFormula: 'Вызов this.innerMethod() идет мимо CGLIB-прокси и игнорирует @Transactional.',
      fullPrinciple:
        'TransactionInterceptor срабатывает только при внешнем вызове через Spring-прокси к public не-final методу.',
      formulaOrCode: 'Caller -> CGLIB Proxy -> TransactionInterceptor -> Target Method',
      checklist: [
        'Метод вызывается извне через прокси-бин?',
        'Метод объявлен как public и не final?',
        'Устранен внутренний самовызов this.method()?'
      ]
    },
    {
      id: 'propagation-matrix',
      number: '02',
      title: 'Матрица распространения (Propagation)',
      badge: 'Boundaries',
      shortFormula: 'REQUIRED (1 conn) | REQUIRES_NEW (2-й conn из пула) | NESTED (JDBC Savepoint).',
      fullPrinciple:
        'REQUIRES_NEW приостанавливает внешнюю транзакцию и берет второе физическое соединение из пула HikariCP.',
      formulaOrCode: 'REQUIRES_NEW = suspend parent + borrow 2nd HikariCP connection',
      checklist: [
        'REQUIRES_NEW используется осознанно с учетом пула?',
        'Для локального отката без 2-го коннекта рассмотрен NESTED?',
        'Понятно поведение REQUIRED при вложенных вызовах?'
      ]
    },
    {
      id: 'rollback-invariants',
      number: '03',
      title: 'Правила отката и UnexpectedRollbackException',
      badge: 'Rollback',
      shortFormula: 'По умолчанию Spring откатывает только RuntimeException. Checked-исключения коммитятся!',
      fullPrinciple:
        'Перехват try-catch вокруг упавшего REQUIRED метода оставляет пометку rollbackOnly и роняет коммит родителя.',
      formulaOrCode: '@Transactional(rollbackFor = Exception.class)',
      checklist: [
        'Задан rollbackFor = Exception.class для checked-ошибок?',
        'Нет наивного try-catch вокруг REQUIRED-вызова?',
        'Изолированный сбой вынесен в REQUIRES_NEW или Outbox?'
      ]
    },
    {
      id: 'hikaricp-deadlock-theorem',
      number: '04',
      title: 'Теорема пула соединений HikariCP',
      badge: 'Deadlock Math',
      shortFormula: 'P >= T * (D - 1) + 1 — минимальный размер пула при вложенных соединениях.',
      fullPrinciple:
        'При нехватке соединений в пуле параллельные потоки с REQUIRES_NEW навсегда заблокируют друг друга.',
      formulaOrCode: 'Pool size P >= Threads T * (Depth D - 1) + 1',
      checklist: [
        'Размер пула рассчитан с учетом глубины REQUIRES_NEW?',
        'Задан адекватный connectionTimeout?',
        'Побочный аудит вынесен в асинхронный Outbox?'
      ]
    },
    {
      id: 'performance-hygiene',
      number: '05',
      title: 'ReadOnly и запрет Idle-in-Transaction',
      badge: 'Performance',
      shortFormula: 'Сетевой I/O (HTTP, Kafka, S3) выполняется ВНЕ транзакции БД.',
      fullPrinciple:
        'readOnly = true отключает dirty-checking в Hibernate, а вынос сетевых вызовов за @Transactional спасает пул HikariCP.',
      formulaOrCode: 'External I/O -> NO TX | DB mutation -> short @Transactional',
      checklist: [
        'Методы чтения помечены @Transactional(readOnly = true)?',
        'Внешние HTTP/Kafka вызовы вынесены из транзакции?',
        'Установлен явный timeout на транзакцию?'
      ]
    }
  ]
};

export const COMPASS_DOMAINS: Record<CompassDomainKey, CompassDomainConfig> = {
  lld: LLD_COMPASS_CONFIG,
  testing: TESTING_COMPASS_CONFIG,
  refactoring: REFACTORING_COMPASS_CONFIG,
  concurrency: CONCURRENCY_COMPASS_CONFIG,
  transaction: TRANSACTION_COMPASS_CONFIG
};
