/**
 * platformInvariants.ts
 *
 * Immutable engineering invariants of the InterviewPrep platform.
 * These are non-negotiable reality anchors for Java 21 LTS, Concurrency, and Architecture.
 */

export const JAVA21_PLATFORM_INVARIANTS = `
=== ФУНДАМЕНТАЛЬНЫЕ АРХИТЕКТУРНЫЕ ИНВАРИАНТЫ ПЛАТФОРМЫ (REALITY ANCHORS) ===
1. TIME VIRTUALIZATION (ИНЖЕКЦИЯ ВРЕМЕНИ):
   - Запрещен прямой вызов System.currentTimeMillis(), Instant.now() или LocalDate.now().
   - Время ОБЯЗАНО инжектироваться через java.time.Clock.
   - Тесты обязаны выполняться за 0 мс детерминированно через Clock.fixed() или Clock.offset().

2. FINANCIAL PRECISION (ДЕНЕЖНАЯ ТОЧНОСТЬ):
   - Запрещено использовать double или float для денежных сумм, балансов и тарифов.
   - Обязательно использование java.math.BigDecimal с явным масштабом (scale) и RoundingMode.HALF_EVEN (банковское округление).
   - Сравнение выполняется строго через compareTo() == 0.

3. DEADLOCK-FREE LOCK ORDERING (ИЕРАРХИЯ ЗАХВАТА ЗАМКОВ):
   - При операциях между двумя ресурсами захват замков ОБЯЗАН следовать строгому глобальному порядку ID: lock(min(id1, id2)) -> lock(max(id1, id2)).

4. MODERN CONCURRENCY & MEMORY VISIBILITY:
   - Избегать грубых synchronized-блоков на весь метод сервиса.
   - Использовать ConcurrentHashMap с атомарными compute/computeIfAbsent, AtomicLong/AtomicReference или StampedLock.
   - Обеспечивать Happens-Before видимость разделяемого состояния.

5. SPRING TRANSACTIONS & PROXY TRAPS:
   - Помнить о ловушке Self-Invocation: внутренний вызов метода через this обходит прокси Spring AOP и игнорирует @Transactional.
   - Учитывать распространение транзакций (REQUIRED, REQUIRES_NEW) и явные уровни изоляции.
`.trim();
