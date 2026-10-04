/**
 * transactionCompassRules.ts
 *
 * 5 Golden Rules of Spring Transactions (Transaction Compass).
 */

import { CompassRule } from './testingCompassRules';

export const TRANSACTION_COMPASS_RULES: Record<string, CompassRule> = {
  CGLIB_LIFECYCLE: {
    id: 'cglib-lifecycle',
    name: '1. Жизненный цикл CGLIB-прокси и Self-Invocation',
    shortFormula: 'Вызовы @Transactional методов внутри одного бина идут мимо AOP-прокси и выполняются без транзакции.',
    fullPrinciple: `Spring создает динамический подкласс-прокси (CGLIB Subclass).
Перехватчик TransactionInterceptor активируется ТОЛЬКО при внешнем вызове через прокси.
Внутренний вызов this.innerMethod() выполняется внутри целевого инстанса напрямую (invokevirtual), полностью минуя прокси и аннотацию @Transactional.
Решения: вынос метода в отдельный Spring-бин, инжекция self-ссылки через ObjectProvider или вызов через AopContext.currentProxy().`,
    actionableChecklist: [
      'Метод с @Transactional вызывается из другого Spring-бина или через self-reference?',
      'Метод объявлен как public? (private и protected методы тихо игнорируются Spring AOP)',
      'Класс и целевой метод не являются final? (CGLIB не может переопределять final-методы)'
    ]
  },
  PROPAGATION_MATRIX: {
    id: 'propagation-matrix',
    name: '2. Матрица распространения транзакций (Propagation)',
    shortFormula: 'REQUIRES_NEW открывает отдельную физическую транзакцию и удерживает 2 соединения из пула HikariCP.',
    fullPrinciple: `Распространение определяет поведение границ транзакции при вложенных вызовах:
- REQUIRED: переиспользует текущую или открывает новую (1 соединение JDBC).
- REQUIRES_NEW: приостанавливает внешнюю транзакцию и требует отдельное физическое соединение из пула HikariCP. При высокой нагрузке каскад REQUIRES_NEW приводит к пуловому дедлоку (Connection Pool Starvation).
- NESTED: использует JDBC Savepoint в рамках того же соединения.`,
    actionableChecklist: [
      'Обосновано ли использование REQUIRES_NEW и хватает ли размера пула соединений HikariCP?',
      'Не приведет ли откат вложенной транзакции к неожиданному UnexpectedRollbackException?',
      'Для логирования и аудита вынесен ли вызов в асинхронный событийный поток (@TransactionalEventListener)?'
    ]
  },
  ISOLATION_ANOMALIES: {
    id: 'isolation-anomalies',
    name: '3. Уровни изоляции и транзакционные аномалии',
    shortFormula: 'Дефолтный READ COMMITTED допускает Non-Repeatable Read и Phantom Read. Защищайте критические балансы.',
    fullPrinciple: `Уровень изоляции определяет видимость незафиксированных изменений:
- READ_COMMITTED: предотвращает Dirty Read, но допускает неповторяемое чтение и фантомы.
- REPEATABLE_READ: гарантирует стабильный снимок данных (MVCC Snapshot). В PostgreSQL/MySQL не спасает от Write Skew без предикативных блокировок.
- SERIALIZABLE: максимальная изоляция с эвристикой SSI (Serializable Snapshot Isolation), требующая retry-логики на уровне приложения.`,
    actionableChecklist: [
      'Учитывается ли дефолтный уровень изоляции СУБД (PostgreSQL: READ COMMITTED)?',
      'Защищены ли операции проверки баланса (Check-Then-Act) от параллельных изменений?',
      'Реализован ли механизм повтора (Retryable) при сериализационных сбоях (SQLState 40001)?'
    ]
  },
  PESSIMISTIC_LOCKING: {
    id: 'pessimistic-locking',
    name: '4. Пессимистические блокировки и Lock Ordering',
    shortFormula: 'SELECT FOR UPDATE предотвращает Lost Update. Захватывайте замки строго по порядку: min(id1, id2) -> max(id1, id2).',
    fullPrinciple: `При параллельном обновлении балансов и счетов:
- Оптимистическая блокировка (@Version) эффективна при редких коллизиях (low contention).
- Пессимистическая блокировка (PESSIMISTIC_WRITE / SELECT FOR UPDATE) обязательна при интенсивных списаниях.
- При межбанковских переводах между счетами A и B захват блокировок в разном порядке неизбежно вызывает взаимный дедлок (Deadlock ORA-00060 / PostgreSQL 40P01).`,
    actionableChecklist: [
      'Используется ли PESSIMISTIC_WRITE для денежных счетов при Check-Then-Act?',
      'Сортируются ли ID аккаунтов перед захватом блокировок: lock(min) -> lock(max)?',
      'Задан ли таймаут ожидания блокировки (javax.persistence.lock.timeout) для предотвращения зависаний?'
    ]
  },
  OUTBOX_PATTERN: {
    id: 'outbox-pattern',
    name: '5. Идемпотентный Transactional Outbox',
    shortFormula: 'Никаких сетевых вызовов в шину (Kafka/RabbitMQ) внутри @Transactional. Только локальная запись в outbox.',
    fullPrinciple: `Сетевой вызов во внешнюю шину (Kafka producer.send) внутри @Transactional нарушает атомарность:
- Если транзакция БД откатится после отправки сообщения — сообщение уже ушло потребителям (Phantom Message).
- Если брокер зависнет — транзакция БД держит соединение HikariCP до истечения HTTP/TCP таймаута.
Решение: сохранять событие в таблицу outbox в той же транзакции БД, а отправку в шину выполнять фоновым релеем (Debezium CDC или Scheduled Poller).`,
    actionableChecklist: [
      'Отсутствуют ли сетевые вызовы к внешним сервисам и очередям внутри @Transactional?',
      'События сохраняются в локальную таблицу outbox в рамках той же транзакции БД?',
      'Реализована ли идемпотентность на стороне потребителя сообщений (consumer deduplication)?'
    ]
  }
};
