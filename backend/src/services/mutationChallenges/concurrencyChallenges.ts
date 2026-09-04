import { CodingChallenge } from '../challengeSeedData';

export const CONCURRENCY_CHALLENGES: CodingChallenge[] = [
  // =========================================================================
  // 1. Awaitility vs Flaky Sleep (Asynchronous Polling & Stability Guard)
  // =========================================================================
  {
    id: 'kata_test_awaitility_polling_stability',
    slug: 'kata-test-awaitility-polling-stability',
    title: 'KATA-TEST-25: Awaitility Polling vs Flaky Sleep (State Stability)',
    category: 'testing_mutation',
    track: 'testing_mutation',
    badge: '🧬 Awaitility Polling',
    difficulty: 'Senior',
    targetStack: 'Java 21 LTS, Awaitility, AssertJ',
    timeLimitMinutes: 45,
    shortDescription: 'Замена хрупких Thread.sleep на детерминированный Awaitility.until() с проверкой стабильности during().',
    instructionsMarkdown: `### 🎯 Инженерная задача
Сервис агрегации платежей **PaymentAggregationService** асинхронно накапливает транзакции:
- Статус меняется: \`COLLECTING\` $\\to$ \`PENDING_SETTLEMENT\` $\\to$ \`SETTLED\`.
- Применение \`Thread.sleep(500)\` приводит к **flaky tests** в CI: если сборка перегружена, 500 мс не хватает; на пустом сервере — впустую сжигается время.
- Требуется детерминированный опрос через \`await().atMost(2, SECONDS).until(...)\`.
- Для предотвращения гонок статуса проверяется условие удержания стабильного состояния (\`during(100, MILLISECONDS)\`).

### 🧪 Ваша цель
В \`PaymentAggregationServiceTest.java\` напишите тесты на Awaitility, уничтожающие всех 5 мутантов:
1. **Mutant 1 ( prematureSettledStatus):** Преждевременный переход в SETTLED без накопления суммы.
2. **Mutant 2 (DelayCalculationMath):** Смещение таймера финализации.
3. **Mutant 3 (FlakySleepInjection):** Искусственная задержка, ломающая жесткие таймауты.
4. **Mutant 4 (OmitTerminalSettledState):** Застревание в состоянии PENDING_SETTLEMENT.
5. **Mutant 5 (ConcurrentAmountMutation):** Гонка инкремента суммы без Atomic-примитивов.`,
    workspaceFiles: [
      {
        path: 'src/main/java/com/enterprise/concurrency/polling/PaymentAggregationService.java',
        content: `package com.enterprise.concurrency.polling;

import java.math.BigDecimal;
import java.util.Objects;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;

public class PaymentAggregationService {

    public enum BatchStatus { COLLECTING, PENDING_SETTLEMENT, SETTLED }
    public record BatchState(String batchId, BigDecimal totalAmount, BatchStatus status) {}

    private final AtomicReference<BatchState> state;
    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();

    public PaymentAggregationService(String batchId) {
        this.state = new AtomicReference<>(new BatchState(batchId, BigDecimal.ZERO, BatchStatus.COLLECTING));
    }

    public synchronized void addPayment(BigDecimal amount) {
        Objects.requireNonNull(amount);
        BatchState cur = state.get();
        state.set(new BatchState(cur.batchId(), cur.totalAmount().add(amount), cur.status()));
    }

    public void triggerAsyncSettlement(long delayMs) {
        state.updateAndGet(s -> new BatchState(s.batchId(), s.totalAmount(), BatchStatus.PENDING_SETTLEMENT));
        scheduler.schedule(() -> {
            state.updateAndGet(s -> new BatchState(s.batchId(), s.totalAmount(), BatchStatus.SETTLED));
        }, delayMs, TimeUnit.MILLISECONDS);
    }

    public BatchState getState() { return state.get(); }
    public void shutdown() { scheduler.shutdown(); }
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/test/java/com/enterprise/concurrency/polling/PaymentAggregationServiceTest.java',
        content: `package com.enterprise.concurrency.polling;

import com.enterprise.concurrency.polling.PaymentAggregationService.*;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.time.Duration;
import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

class PaymentAggregationServiceTest {

    private PaymentAggregationService service;

    @AfterEach
    void tearDown() {
        if (service != null) service.shutdown();
    }

    @Test
    @DisplayName("Should poll until SETTLED status and verify stability without Thread.sleep (Kills M1, M2, M4)")
    void shouldSettleAsynchronouslyWithAwaitility() {
        service = new PaymentAggregationService("batch-101");
        service.addPayment(new BigDecimal("250.00"));
        service.triggerAsyncSettlement(50);

        assertThat(service.getState().status()).isEqualTo(BatchStatus.PENDING_SETTLEMENT);

        // Awaitility poll: sub-100ms determinism!
        await().atMost(Duration.ofSeconds(1))
               .pollInterval(Duration.ofMillis(10))
               .untilAsserted(() -> {
                   BatchState state = service.getState();
                   assertThat(state.status()).isEqualTo(BatchStatus.SETTLED);
                   assertThat(state.totalAmount()).isEqualByComparingTo("250.00");
               });
    }

    @Test
    @DisplayName("Should verify state stability during post-settlement window (Kills M3, M5)")
    void shouldVerifyStabilityDuringWindow() {
        service = new PaymentAggregationService("batch-102");
        service.addPayment(new BigDecimal("100.00"));
        service.triggerAsyncSettlement(20);

        await().atMost(Duration.ofMillis(500))
               .until(() -> service.getState().status() == BatchStatus.SETTLED);

        // Verify state remains stable and does not regress
        await().during(Duration.ofMillis(50))
               .until(() -> service.getState().status() == BatchStatus.SETTLED);
    }
}`,
        readOnly: false,
        hidden: false,
        isMainEntryPoint: true
      }
    ],
    mutants: [
      {
        id: 'mutant_pas_01_premature_settle',
        name: 'PrematureSettledStatusMutator',
        file: 'src/main/java/com/enterprise/concurrency/polling/PaymentAggregationService.java',
        line: 25,
        mutatedContent: `package com.enterprise.concurrency.polling;
import java.math.BigDecimal; import java.util.concurrent.atomic.AtomicReference;
public class PaymentAggregationService {
    public enum BatchStatus { COLLECTING, PENDING_SETTLEMENT, SETTLED }
    public record BatchState(String batchId, BigDecimal totalAmount, BatchStatus status) {}
    private final AtomicReference<BatchState> state;
    public PaymentAggregationService(String b) { this.state = new AtomicReference<>(new BatchState(b, BigDecimal.ZERO, BatchStatus.COLLECTING)); }
    public void addPayment(BigDecimal a) {}
    public void triggerAsyncSettlement(long d) {
        // MUTANT: immediately sets SETTLED instead of PENDING!
        state.set(new BatchState("b", BigDecimal.ZERO, BatchStatus.SETTLED));
    }
    public BatchState getState() { return state.get(); }
    public void shutdown() {}
}`
      },
      {
        id: 'mutant_pas_02_delay_math',
        name: 'DelayCalculationMathMutator',
        file: 'src/main/java/com/enterprise/concurrency/polling/PaymentAggregationService.java',
        line: 28,
        mutatedContent: `package com.enterprise.concurrency.polling;
import java.math.BigDecimal; import java.util.concurrent.*; import java.util.concurrent.atomic.AtomicReference;
public class PaymentAggregationService {
    public enum BatchStatus { COLLECTING, PENDING_SETTLEMENT, SETTLED }
    public record BatchState(String batchId, BigDecimal totalAmount, BatchStatus status) {}
    private final AtomicReference<BatchState> state;
    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();
    public PaymentAggregationService(String b) { this.state = new AtomicReference<>(new BatchState(b, BigDecimal.ZERO, BatchStatus.COLLECTING)); }
    public void addPayment(BigDecimal a) { state.set(new BatchState("b", a, BatchStatus.COLLECTING)); }
    public void triggerAsyncSettlement(long delayMs) {
        state.set(new BatchState("b", state.get().totalAmount(), BatchStatus.PENDING_SETTLEMENT));
        // MUTANT: 10x delay causes timeout!
        scheduler.schedule(() -> state.set(new BatchState("b", state.get().totalAmount(), BatchStatus.SETTLED)), delayMs * 100, TimeUnit.MILLISECONDS);
    }
    public BatchState getState() { return state.get(); }
    public void shutdown() { scheduler.shutdown(); }
}`
      },
      {
        id: 'mutant_pas_03_status_regression',
        name: 'StatusRegressionMutator',
        file: 'src/main/java/com/enterprise/concurrency/polling/PaymentAggregationService.java',
        line: 29,
        mutatedContent: `package com.enterprise.concurrency.polling;
import java.math.BigDecimal; import java.util.concurrent.*; import java.util.concurrent.atomic.AtomicReference;
public class PaymentAggregationService {
    public enum BatchStatus { COLLECTING, PENDING_SETTLEMENT, SETTLED }
    public record BatchState(String batchId, BigDecimal totalAmount, BatchStatus status) {}
    private final AtomicReference<BatchState> state;
    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();
    public PaymentAggregationService(String b) { this.state = new AtomicReference<>(new BatchState(b, BigDecimal.ZERO, BatchStatus.COLLECTING)); }
    public void addPayment(BigDecimal a) { state.set(new BatchState("b", a, BatchStatus.COLLECTING)); }
    public void triggerAsyncSettlement(long delayMs) {
        state.set(new BatchState("b", state.get().totalAmount(), BatchStatus.PENDING_SETTLEMENT));
        scheduler.schedule(() -> {
            state.set(new BatchState("b", state.get().totalAmount(), BatchStatus.SETTLED));
            // MUTANT: regresses back to COLLECTING after 30ms!
            try { Thread.sleep(30); state.set(new BatchState("b", BigDecimal.ZERO, BatchStatus.COLLECTING)); } catch (Exception ignored) {}
        }, delayMs, TimeUnit.MILLISECONDS);
    }
    public BatchState getState() { return state.get(); }
    public void shutdown() { scheduler.shutdown(); }
}`
      },
      {
        id: 'mutant_pas_04_omit_settled',
        name: 'OmitTerminalSettledStateMutator',
        file: 'src/main/java/com/enterprise/concurrency/polling/PaymentAggregationService.java',
        line: 29,
        mutatedContent: `package com.enterprise.concurrency.polling;
import java.math.BigDecimal; import java.util.concurrent.atomic.AtomicReference;
public class PaymentAggregationService {
    public enum BatchStatus { COLLECTING, PENDING_SETTLEMENT, SETTLED }
    public record BatchState(String batchId, BigDecimal totalAmount, BatchStatus status) {}
    private final AtomicReference<BatchState> state;
    public PaymentAggregationService(String b) { this.state = new AtomicReference<>(new BatchState(b, BigDecimal.ZERO, BatchStatus.COLLECTING)); }
    public void addPayment(BigDecimal a) { state.set(new BatchState("b", a, BatchStatus.COLLECTING)); }
    public void triggerAsyncSettlement(long delayMs) {
        // MUTANT: never transitions to SETTLED!
        state.set(new BatchState("b", state.get().totalAmount(), BatchStatus.PENDING_SETTLEMENT));
    }
    public BatchState getState() { return state.get(); }
    public void shutdown() {}
}`
      },
      {
        id: 'mutant_pas_05_amount_math',
        name: 'ConcurrentAmountMutationMutator',
        file: 'src/main/java/com/enterprise/concurrency/polling/PaymentAggregationService.java',
        line: 20,
        mutatedContent: `package com.enterprise.concurrency.polling;
import java.math.BigDecimal; import java.util.concurrent.*; import java.util.concurrent.atomic.AtomicReference;
public class PaymentAggregationService {
    public enum BatchStatus { COLLECTING, PENDING_SETTLEMENT, SETTLED }
    public record BatchState(String batchId, BigDecimal totalAmount, BatchStatus status) {}
    private final AtomicReference<BatchState> state;
    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();
    public PaymentAggregationService(String b) { this.state = new AtomicReference<>(new BatchState(b, BigDecimal.ZERO, BatchStatus.COLLECTING)); }
    public void addPayment(BigDecimal a) {
        // MUTANT: ignores added amount!
        state.set(new BatchState("b", BigDecimal.ZERO, BatchStatus.COLLECTING));
    }
    public void triggerAsyncSettlement(long delayMs) {
        scheduler.schedule(() -> state.set(new BatchState("b", state.get().totalAmount(), BatchStatus.SETTLED)), delayMs, TimeUnit.MILLISECONDS);
    }
    public BatchState getState() { return state.get(); }
    public void shutdown() { scheduler.shutdown(); }
}`
      }
    ]
  },

  // =========================================================================
  // 2. Race Condition & Double-Spending Barrier
  // =========================================================================
  {
    id: 'kata_test_race_condition_ledger_transfer',
    slug: 'kata-test-race-condition-ledger-transfer',
    title: 'KATA-TEST-26: Double-Spending Race Condition (CyclicBarrier & CAS)',
    category: 'testing_mutation',
    track: 'testing_mutation',
    badge: '🧬 CyclicBarrier Race',
    difficulty: 'Senior',
    targetStack: 'Java 21 LTS, CyclicBarrier, AtomicReference',
    timeLimitMinutes: 45,
    shortDescription: 'Провокация гонки за баланс между конкурирующими потоками и верификация закона сохранения баланса.',
    instructionsMarkdown: `### 🎯 Инженерная задача
Сервис **LedgerTransferService** переводит средства между счетами:
- Базовый инвариант: $B_{src} + B_{dst} = const$ (закон сохранения суммарного баланса).
- Если баланс списывается без атомарной синхронизации (неатомарный read-then-write), возникает **Race Condition**: со счета с балансом $100$ можно дважды параллельно списать по $100$.
- Требуется потокобезопасная реализация на атомарном цикле CAS или упорядоченных блокировках.

### 🧪 Ваша цель
В \`LedgerTransferServiceTest.java\` используйте \`CyclicBarrier\` для одновременного старта 20 потоков, уничтожив всех 5 мутантов:
1. **Mutant 1 (UnsynchronizedDebit):** Неатомарное списание баланса (гонка данных).
2. **Mutant 2 (ConservationLawViolation):** Увеличение баланса получателя без списания отправителя.
3. **Mutant 3 (OverdraftAllowedUnderRace):** Разрешение ухода баланса в минус при конкуренции.
4. **Mutant 4 (PartialTransferOnFailure):** Списание средств без зачисления получателю.
5. **Mutant 5 (LostUpdateOnDeposit):** Перезапись баланса получателя без CAS.`,
    workspaceFiles: [
      {
        path: 'src/main/java/com/enterprise/concurrency/ledger/LedgerAccount.java',
        content: `package com.enterprise.concurrency.ledger;

import java.util.concurrent.atomic.AtomicLong;

public class LedgerAccount {
    private final String accountId;
    private final AtomicLong balanceCents;

    public LedgerAccount(String accountId, long initialCents) {
        this.accountId = accountId;
        this.balanceCents = new AtomicLong(initialCents);
    }

    public String id() { return accountId; }
    public long getBalanceCents() { return balanceCents.get(); }

    public boolean debit(long cents) {
        while (true) {
            long cur = balanceCents.get();
            if (cur < cents) return false;
            if (balanceCents.compareAndSet(cur, cur - cents)) return true;
        }
    }

    public void credit(long cents) {
        balanceCents.addAndGet(cents);
    }
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/main/java/com/enterprise/concurrency/ledger/LedgerTransferService.java',
        content: `package com.enterprise.concurrency.ledger;

public class LedgerTransferService {

    public boolean transfer(LedgerAccount from, LedgerAccount to, long cents) {
        if (cents <= 0) throw new IllegalArgumentException("Transfer amount must be positive");
        if (from.id().equals(to.id())) throw new IllegalArgumentException("Cannot transfer to self");

        // Ordered lock or atomic debit-first
        if (from.debit(cents)) {
            to.credit(cents);
            return true;
        }
        return false;
    }
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/test/java/com/enterprise/concurrency/ledger/LedgerTransferServiceTest.java',
        content: `package com.enterprise.concurrency.ledger;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import static org.assertj.core.api.Assertions.assertThat;

class LedgerTransferServiceTest {

    @Test
    @DisplayName("Should maintain total balance invariant under heavy concurrent race condition (Kills M1, M2, M3, M4, M5)")
    void shouldPreventDoubleSpendingUnderRaceCondition() throws Exception {
        int threads = 10;
        long initialFrom = 1000L;
        long initialTo = 0L;
        long transferAmount = 100L; // 10 transfers will exhaust 1000L exactly

        LedgerAccount from = new LedgerAccount("ACC-FROM", initialFrom);
        LedgerAccount to = new LedgerAccount("ACC-TO", initialTo);
        LedgerTransferService service = new LedgerTransferService();

        ExecutorService executor = Executors.newFixedThreadPool(threads);
        CyclicBarrier barrier = new CyclicBarrier(threads);
        CountDownLatch latch = new CountDownLatch(threads);
        AtomicInteger successCount = new AtomicInteger();

        // 10 threads trying to transfer 100L each simultaneously
        for (int i = 0; i < threads; i++) {
            executor.submit(() -> {
                try {
                    barrier.await();
                    if (service.transfer(from, to, transferAmount)) {
                        successCount.incrementAndGet();
                    }
                } catch (Exception ignored) {
                } finally {
                    latch.countDown();
                }
            });
        }

        assertThat(latch.await(2, TimeUnit.SECONDS)).isTrue();
        executor.shutdown();

        // Strict conservation law: sum(initial) == sum(final)
        long totalInitial = initialFrom + initialTo;
        long totalFinal = from.getBalanceCents() + to.getBalanceCents();

        assertThat(totalFinal).isEqualTo(totalInitial);
        assertThat(from.getBalanceCents()).isGreaterThanOrEqualTo(0L);
        assertThat(to.getBalanceCents()).isEqualTo(successCount.get() * transferAmount);
    }
}`,
        readOnly: false,
        hidden: false,
        isMainEntryPoint: true
      }
    ],
    mutants: [
      {
        id: 'mutant_lts_01_unsynced_debit',
        name: 'UnsynchronizedDebitMutator',
        file: 'src/main/java/com/enterprise/concurrency/ledger/LedgerAccount.java',
        line: 16,
        mutatedContent: `package com.enterprise.concurrency.ledger;
public class LedgerAccount {
    private long balance;
    public LedgerAccount(String id, long b) { this.balance = b; }
    public String id() { return "A"; }
    public long getBalanceCents() { return balance; }
    // MUTANT: non-atomic read-then-write causes race condition!
    public boolean debit(long c) {
        if (balance >= c) {
            try { Thread.sleep(1); } catch (Exception ignored) {}
            balance -= c;
            return true;
        }
        return false;
    }
    public void credit(long c) { balance += c; }
}`
      },
      {
        id: 'mutant_lts_02_conservation_violation',
        name: 'ConservationLawViolationMutator',
        file: 'src/main/java/com/enterprise/concurrency/ledger/LedgerTransferService.java',
        line: 9,
        mutatedContent: `package com.enterprise.concurrency.ledger;
public class LedgerTransferService {
    public boolean transfer(LedgerAccount from, LedgerAccount to, long cents) {
        from.debit(cents);
        // MUTANT: credits 2x cents, creating money out of thin air!
        to.credit(cents * 2);
        return true;
    }
}`
      },
      {
        id: 'mutant_lts_03_overdraft_allowed',
        name: 'OverdraftAllowedUnderRaceMutator',
        file: 'src/main/java/com/enterprise/concurrency/ledger/LedgerAccount.java',
        line: 17,
        mutatedContent: `package com.enterprise.concurrency.ledger;
import java.util.concurrent.atomic.AtomicLong;
public class LedgerAccount {
    private final AtomicLong balance;
    public LedgerAccount(String id, long b) { this.balance = new AtomicLong(b); }
    public String id() { return "A"; }
    public long getBalanceCents() { return balance.get(); }
    public boolean debit(long c) {
        // MUTANT: unconditionally decrements balance, allowing negative funds!
        balance.addAndGet(-c);
        return true;
    }
    public void credit(long c) { balance.addAndGet(c); }
}`
      },
      {
        id: 'mutant_lts_04_partial_transfer',
        name: 'PartialTransferOnFailureMutator',
        file: 'src/main/java/com/enterprise/concurrency/ledger/LedgerTransferService.java',
        line: 10,
        mutatedContent: `package com.enterprise.concurrency.ledger;
public class LedgerTransferService {
    public boolean transfer(LedgerAccount from, LedgerAccount to, long cents) {
        from.debit(cents);
        // MUTANT: does not credit recipient, destroying funds!
        return true;
    }
}`
      },
      {
        id: 'mutant_lts_05_lost_update',
        name: 'LostUpdateOnDepositMutator',
        file: 'src/main/java/com/enterprise/concurrency/ledger/LedgerAccount.java',
        line: 24,
        mutatedContent: `package com.enterprise.concurrency.ledger;
public class LedgerAccount {
    private volatile long balance;
    public LedgerAccount(String id, long b) { this.balance = b; }
    public String id() { return "A"; }
    public long getBalanceCents() { return balance; }
    public boolean debit(long c) { balance -= c; return true; }
    // MUTANT: non-atomic credit causes lost updates under contention!
    public void credit(long c) { long cur = balance; balance = cur + c; }
}`
      }
    ]
  },

  // =========================================================================
  // 3. Deadlock Provocation & Ordered Locking
  // =========================================================================
  {
    id: 'kata_test_deadlock_provocation_ordered_locking',
    slug: 'kata-test-deadlock-provocation-ordered-locking',
    title: 'KATA-TEST-27: Deadlock Provocation & Ordered Locking (ThreadMXBean)',
    category: 'testing_mutation',
    track: 'testing_mutation',
    badge: '🧬 Deadlock Detection',
    difficulty: 'Senior',
    targetStack: 'Java 21 LTS, ThreadMXBean, ReentrantLock',
    timeLimitMinutes: 45,
    shortDescription: 'Провокация взаимоблокировки (A->B против B->A) и её предотвращение через упорядоченный захват блокировок.',
    instructionsMarkdown: `### 🎯 Инженерная задача
Сервис межбанковских расчетов **InterBankSettlementService** выполняет проводки между банками:
- Если поток 1 блокирует \`BankA -> BankB\`, а поток 2 одновременно блокирует \`BankB -> BankA\`, возникает **Deadlock** (взаимная блокировка потоков).
- Детекция дедлока в JVM осуществляется через \`ManagementFactory.getThreadMXBean().findDeadlockedThreads()\`.
- Предотвращение дедлока требует **Ordered Locking**: блокировки всегда захватываются в лексикографическом порядке идентификаторов: \`lock(min(idA, idB)) -> lock(max(idA, idB))\`.

### 🧪 Ваша цель
В \`InterBankSettlementServiceTest.java\` напишите тесты, доказывающие отсутствие дедлока при встречных переводах, уничтожив всех 5 мутантов:
1. **Mutant 1 (ReverseLockingOrder):** Нарушение упорядоченности захвата блокировок.
2. **Mutant 2 (LockOmission):** Пропуск захвата блокировки на втором аккаунте.
3. **Mutant 3 (UnlockOmissionOnFailure):** Утечка блокировки при возникновении исключения в блоке try.
4. **Mutant 4 (IbanComparisonInversion):** Неправильный порядок сравнения ID (\`>\` вместо \`<\`).
5. **Mutant 5 (LockBypassOnSameIban):** Допуск перевода на тот же самый IBAN.`,
    workspaceFiles: [
      {
        path: 'src/main/java/com/enterprise/concurrency/deadlock/BankParticipant.java',
        content: `package com.enterprise.concurrency.deadlock;

import java.util.concurrent.locks.ReentrantLock;

public class BankParticipant {
    private final String iban;
    private final ReentrantLock lock = new ReentrantLock();
    private long balance;

    public BankParticipant(String iban, long balance) {
        this.iban = iban;
        this.balance = balance;
    }

    public String iban() { return iban; }
    public ReentrantLock lock() { return lock; }
    public long getBalance() { return balance; }
    public void adjust(long delta) { this.balance += delta; }
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/main/java/com/enterprise/concurrency/deadlock/InterBankSettlementService.java',
        content: `package com.enterprise.concurrency.deadlock;

import java.util.Objects;

public class InterBankSettlementService {

    public void settle(BankParticipant p1, BankParticipant p2, long amount) {
        Objects.requireNonNull(p1);
        Objects.requireNonNull(p2);
        if (p1.iban().equals(p2.iban())) throw new IllegalArgumentException("Cannot settle to same bank");

        // Deadlock-free ordered locking: lock lowest IBAN first!
        BankParticipant first = p1.iban().compareTo(p2.iban()) < 0 ? p1 : p2;
        BankParticipant second = (first == p1) ? p2 : p1;

        first.lock().lock();
        try {
            second.lock().lock();
            try {
                p1.adjust(-amount);
                p2.adjust(amount);
            } finally {
                second.lock().unlock();
            }
        } finally {
            first.lock().unlock();
        }
    }
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/test/java/com/enterprise/concurrency/deadlock/InterBankSettlementServiceTest.java',
        content: `package com.enterprise.concurrency.deadlock;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import java.lang.management.ManagementFactory;
import java.lang.management.ThreadMXBean;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class InterBankSettlementServiceTest {

    private final InterBankSettlementService service = new InterBankSettlementService();
    private final ThreadMXBean threadMx = ManagementFactory.getThreadMXBean();

    @Test
    @DisplayName("Should settle bidirectional transfers concurrently without deadlocks (Kills M1, M2, M4)")
    void shouldPreventDeadlockUnderBidirectionalTransfers() throws Exception {
        BankParticipant bankA = new BankParticipant("DE89370400440532013000", 100_000L);
        BankParticipant bankB = new BankParticipant("FR76300060000112345678", 100_000L);

        ExecutorService executor = Executors.newFixedThreadPool(2);
        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch finishLatch = new CountDownLatch(2);

        // Thread 1: A -> B
        executor.submit(() -> {
            try {
                startLatch.await();
                for (int i = 0; i < 50; i++) service.settle(bankA, bankB, 10L);
            } catch (Exception ignored) {
            } finally {
                finishLatch.countDown();
            }
        });

        // Thread 2: B -> A (reverse order!)
        executor.submit(() -> {
            try {
                startLatch.await();
                for (int i = 0; i < 50; i++) service.settle(bankB, bankA, 10L);
            } catch (Exception ignored) {
            } finally {
                finishLatch.countDown();
            }
        });

        startLatch.countDown();
        boolean finished = finishLatch.await(3, TimeUnit.SECONDS);
        executor.shutdown();

        // Check for JVM deadlock
        long[] deadlocked = threadMx.findDeadlockedThreads();
        assertThat(deadlocked).isNull();
        assertThat(finished).isTrue();
    }

    @Test
    @DisplayName("Should reject settlement to same bank IBAN (Kills M5)")
    void shouldRejectSameBank() {
        BankParticipant bankA = new BankParticipant("DE-SAME", 1000L);
        assertThatThrownBy(() -> service.settle(bankA, bankA, 50L))
            .isInstanceOf(IllegalArgumentException.class);
    }
}`,
        readOnly: false,
        hidden: false,
        isMainEntryPoint: true
      }
    ],
    mutants: [
      {
        id: 'mutant_ibs_01_naive_locking',
        name: 'ReverseLockingOrderMutator',
        file: 'src/main/java/com/enterprise/concurrency/deadlock/InterBankSettlementService.java',
        line: 12,
        mutatedContent: `package com.enterprise.concurrency.deadlock;
public class InterBankSettlementService {
    public void settle(BankParticipant p1, BankParticipant p2, long amount) {
        // MUTANT: locks in input order p1 -> p2 without ordering, causing classic deadlock!
        p1.lock().lock();
        try {
            try { Thread.sleep(5); } catch (Exception ignored) {}
            p2.lock().lock();
            try { p1.adjust(-amount); p2.adjust(amount); }
            finally { p2.lock().unlock(); }
        } finally { p1.lock().unlock(); }
    }
}`
      },
      {
        id: 'mutant_ibs_02_lock_omission',
        name: 'SecondLockOmissionMutator',
        file: 'src/main/java/com/enterprise/concurrency/deadlock/InterBankSettlementService.java',
        line: 15,
        mutatedContent: `package com.enterprise.concurrency.deadlock;
public class InterBankSettlementService {
    public void settle(BankParticipant p1, BankParticipant p2, long amount) {
        p1.lock().lock();
        try {
            // MUTANT: does not lock p2 at all!
            p1.adjust(-amount);
            p2.adjust(amount);
        } finally { p1.lock().unlock(); }
    }
}`
      },
      {
        id: 'mutant_ibs_03_unlock_leak',
        name: 'UnlockOmissionOnFailureMutator',
        file: 'src/main/java/com/enterprise/concurrency/deadlock/InterBankSettlementService.java',
        line: 23,
        mutatedContent: `package com.enterprise.concurrency.deadlock;
public class InterBankSettlementService {
    public void settle(BankParticipant p1, BankParticipant p2, long amount) {
        p1.lock().lock();
        p2.lock().lock();
        p1.adjust(-amount);
        p2.adjust(amount);
        // MUTANT: no try-finally unlock, leaks lock on second invocation!
    }
}`
      },
      {
        id: 'mutant_ibs_04_comparison_inversion',
        name: 'IbanComparisonInversionMutator',
        file: 'src/main/java/com/enterprise/concurrency/deadlock/InterBankSettlementService.java',
        line: 11,
        mutatedContent: `package com.enterprise.concurrency.deadlock;
public class InterBankSettlementService {
    public void settle(BankParticipant p1, BankParticipant p2, long amount) {
        // MUTANT: inverted comparison causes opposite lock order!
        BankParticipant first = p1.iban().compareTo(p2.iban()) > 0 ? p1 : p2;
        BankParticipant second = (first == p1) ? p2 : p1;
        first.lock().lock();
        try { second.lock().lock(); try { p1.adjust(-amount); p2.adjust(amount); } finally { second.lock().unlock(); } }
        finally { first.lock().unlock(); }
    }
}`
      },
      {
        id: 'mutant_ibs_05_same_iban_allowed',
        name: 'LockBypassOnSameIbanMutator',
        file: 'src/main/java/com/enterprise/concurrency/deadlock/InterBankSettlementService.java',
        line: 8,
        mutatedContent: `package com.enterprise.concurrency.deadlock;
public class InterBankSettlementService {
    public void settle(BankParticipant p1, BankParticipant p2, long amount) {
        // MUTANT: permits same bank transfer!
        p1.lock().lock();
        try { p1.adjust(-amount); p2.adjust(amount); } finally { p1.lock().unlock(); }
    }
}`
      }
    ]
  },

  // =========================================================================
  // 4. Virtual Thread Carrier Pinning (JFR Event Detection)
  // =========================================================================
  {
    id: 'kata_test_virtual_thread_carrier_pinning',
    slug: 'kata-test-virtual-thread-carrier-pinning',
    title: 'KATA-TEST-28: Virtual Thread Carrier Pinning (synchronized vs Lock)',
    category: 'testing_mutation',
    track: 'testing_mutation',
    badge: '🧬 Loom Pinning Guard',
    difficulty: 'Senior',
    targetStack: 'Java 21 LTS, Virtual Threads, ReentrantLock',
    timeLimitMinutes: 45,
    shortDescription: 'Замена synchronized на ReentrantLock для предотвращения пиннинга несущих потоков под Project Loom.',
    instructionsMarkdown: `### 🎯 Инженерная задача
Шлюз агрегации данных **ProductAggregatorGateway** запускает тысячи виртуальных потоков (\`Thread.ofVirtual()\`).
- **Carrier Thread Pinning:** В Java 21 использование блока \`synchronized\` во время блокирующего I/O привязывает (пиннит) виртуальный поток к нативному несущему потоку (\`ForkJoinPool.carrier\`), парализуя масштабируемость платформы.
- Решение: замена ключевого слова \`synchronized\` на \`ReentrantLock\`.
- При вызове \`lock.lock()\` виртуальный поток корректно освобождает carrier thread (unmounts).

### 🧪 Ваша цель
В \`ProductAggregatorGatewayTest.java\` напишите тесты под нагрузкой из виртуальных потоков, уничтожающие всех 5 мутантов:
1. **Mutant 1 (SynchronizedCarrierPinning):** Использование synchronized внутри I/O блока.
2. **Mutant 2 (TimeoutMathTruncate):** Неправильный таймаут ожидания агрегации.
3. **Mutant 3 (LockOmission):** Удаление блокировки кэша (гонка данных).
4. **Mutant 4 (NullProductFallbackOmission):** Падение при недоступности внешнего поставщика.
5. **Mutant 5 (CarrierExhaustionLoop):** Блокирующий активный спин вместо park/sleep.`,
    workspaceFiles: [
      {
        path: 'src/main/java/com/enterprise/concurrency/loom/ProductAggregatorGateway.java',
        content: `package com.enterprise.concurrency.loom;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.locks.ReentrantLock;

public class ProductAggregatorGateway {

    private final Map<String, String> cache = new HashMap<>();
    private final ReentrantLock lock = new ReentrantLock();

    public String fetchProduct(String id) {
        lock.lock();
        try {
            if (cache.containsKey(id)) return cache.get(id);
            // Simulated virtual-thread friendly operation
            String result = "PRODUCT-" + id;
            cache.put(id, result);
            return result;
        } finally {
            lock.unlock();
        }
    }

    public int getCacheSize() {
        lock.lock();
        try { return cache.size(); }
        finally { lock.unlock(); }
    }
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/test/java/com/enterprise/concurrency/loom/ProductAggregatorGatewayTest.java',
        content: `package com.enterprise.concurrency.loom;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import static org.assertj.core.api.Assertions.assertThat;

class ProductAggregatorGatewayTest {

    @Test
    @DisplayName("Should handle 1,000 concurrent Virtual Threads without deadlock or data loss (Kills M1, M3)")
    void shouldHandleVirtualThreadsWithoutPinning() throws Exception {
        int vThreads = 1000;
        ProductAggregatorGateway gateway = new ProductAggregatorGateway();
        CountDownLatch latch = new CountDownLatch(vThreads);

        try (ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor()) {
            for (int i = 0; i < vThreads; i++) {
                final String pid = "SKU-" + (i % 20); // 20 unique items
                executor.submit(() -> {
                    try {
                        String p = gateway.fetchProduct(pid);
                        assertThat(p).isNotNull();
                    } finally {
                        latch.countDown();
                    }
                });
            }
            assertThat(latch.await(3, TimeUnit.SECONDS)).isTrue();
        }

        assertThat(gateway.getCacheSize()).isEqualTo(20);
    }
}`,
        readOnly: false,
        hidden: false,
        isMainEntryPoint: true
      }
    ],
    mutants: [
      {
        id: 'mutant_pag_01_synchronized_pin',
        name: 'SynchronizedCarrierPinningMutator',
        file: 'src/main/java/com/enterprise/concurrency/loom/ProductAggregatorGateway.java',
        line: 13,
        mutatedContent: `package com.enterprise.concurrency.loom;
import java.util.*;
public class ProductAggregatorGateway {
    private final Map<String, String> cache = new HashMap<>();
    // MUTANT: synchronized pins carrier thread!
    public synchronized String fetchProduct(String id) {
        if (cache.containsKey(id)) return cache.get(id);
        cache.put(id, "PRODUCT-" + id);
        return cache.get(id);
    }
    public synchronized int getCacheSize() { return cache.size(); }
}`
      },
      {
        id: 'mutant_pag_02_lock_omission',
        name: 'LockOmissionMutator',
        file: 'src/main/java/com/enterprise/concurrency/loom/ProductAggregatorGateway.java',
        line: 14,
        mutatedContent: `package com.enterprise.concurrency.loom;
import java.util.*;
public class ProductAggregatorGateway {
    private final Map<String, String> cache = new HashMap<>();
    // MUTANT: completely unsynchronized HashMap access!
    public String fetchProduct(String id) {
        if (cache.containsKey(id)) return cache.get(id);
        cache.put(id, "PRODUCT-" + id);
        return "PRODUCT-" + id;
    }
    public int getCacheSize() { return cache.size(); }
}`
      },
      {
        id: 'mutant_pag_03_null_result',
        name: 'NullResultMutator',
        file: 'src/main/java/com/enterprise/concurrency/loom/ProductAggregatorGateway.java',
        line: 18,
        mutatedContent: `package com.enterprise.concurrency.loom;
public class ProductAggregatorGateway {
    public String fetchProduct(String id) {
        // MUTANT: returns null!
        return null;
    }
    public int getCacheSize() { return 0; }
}`
      },
      {
        id: 'mutant_pag_04_cache_skip',
        name: 'CacheSizeCorruptMutator',
        file: 'src/main/java/com/enterprise/concurrency/loom/ProductAggregatorGateway.java',
        line: 25,
        mutatedContent: `package com.enterprise.concurrency.loom;
public class ProductAggregatorGateway {
    public String fetchProduct(String id) { return "PRODUCT-" + id; }
    // MUTANT: cache size always reports 0!
    public int getCacheSize() { return 0; }
}`
      },
      {
        id: 'mutant_pag_05_carrier_exhaustion',
        name: 'CarrierExhaustionMutator',
        file: 'src/main/java/com/enterprise/concurrency/loom/ProductAggregatorGateway.java',
        line: 16,
        mutatedContent: `package com.enterprise.concurrency.loom;
public class ProductAggregatorGateway {
    public String fetchProduct(String id) {
        // MUTANT: infinite busy-spin!
        while (id == null) {}
        return "PRODUCT-" + id;
    }
    public int getCacheSize() { return 20; }
}`
      }
    ]
  },

  // =========================================================================
  // 5. Lock-Free RingBuffer Contention
  // =========================================================================
  {
    id: 'kata_test_lock_free_ringbuffer_contention',
    slug: 'kata-test-lock-free-ringbuffer-contention',
    title: 'KATA-TEST-29: Lock-Free RingBuffer (AtomicReferenceArray & CAS)',
    category: 'testing_mutation',
    track: 'testing_mutation',
    badge: '🧬 Lock-Free Buffer',
    difficulty: 'Senior',
    targetStack: 'Java 21 LTS, AtomicReferenceArray, Thread.onSpinWait()',
    timeLimitMinutes: 45,
    shortDescription: 'Построение lock-free кольцевого буфера на AtomicReferenceArray с проверкой границы N+1.',
    instructionsMarkdown: `### 🎯 Инженерная задача
Класс **AtomicRingBuffer<T>** реализует неблокирующий циклический буфер фиксированной емкости:
- Хранилище: \`AtomicReferenceArray<T>\`.
- Неблокирующие указатели головы (\`head\`) и хвоста (\`tail\`) на \`AtomicLong\`.
- При переполнении буфера (\`tail - head >= capacity\`) метод \`offer()\` обязан возвращать \`false\`.
- При пустом буфере (\`head == tail\`) метод \`poll()\` обязан возвращать \`null\`.
- В цикле спин-ожидания вызывается \`Thread.onSpinWait()\` (инструкция процессора PAUSE).

### 🧪 Ваша цель
В \`AtomicRingBufferTest.java\` протестируйте граничные условия вместимости под нагрузкой, уничтожив всех 5 мутантов:
1. **Mutant 1 (CapacityPlusOneLeak):** Разрешение записи $N+1$ элемента при полной емкости.
2. **Mutant 2 (PollEmptyReturnGarbage):** Возврат мусорного значения при чтении из пустого буфера.
3. **Mutant 3 (NonAtomicIndexIncrement):** Неатомарное смещение указателей (гонка индексов).
4. **Mutant 4 (BufferWrapArithmeticMath):** Ошибка взятия остатка по модулю емкости (\`%\`).
5. **Mutant 5 (LostUpdateOnOffer):** Перезапись элементов без CAS.`,
    workspaceFiles: [
      {
        path: 'src/main/java/com/enterprise/concurrency/ringbuffer/AtomicRingBuffer.java',
        content: `package com.enterprise.concurrency.ringbuffer;

import java.util.Objects;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReferenceArray;

public class AtomicRingBuffer<T> {

    private final AtomicReferenceArray<T> buffer;
    private final int capacity;
    private final AtomicLong head = new AtomicLong(0);
    private final AtomicLong tail = new AtomicLong(0);

    public AtomicRingBuffer(int capacity) {
        if (capacity <= 0) throw new IllegalArgumentException("Capacity must be positive");
        this.capacity = capacity;
        this.buffer = new AtomicReferenceArray<>(capacity);
    }

    public boolean offer(T item) {
        Objects.requireNonNull(item);
        while (true) {
            long currentTail = tail.get();
            long currentHead = head.get();

            if (currentTail - currentHead >= capacity) {
                return false; // Buffer Full
            }

            if (tail.compareAndSet(currentTail, currentTail + 1)) {
                int index = (int) (currentTail % capacity);
                while (!buffer.compareAndSet(index, null, item)) {
                    Thread.onSpinWait();
                }
                return true;
            }
            Thread.onSpinWait();
        }
    }

    public T poll() {
        while (true) {
            long currentHead = head.get();
            long currentTail = tail.get();

            if (currentHead >= currentTail) {
                return null; // Buffer Empty
            }

            if (head.compareAndSet(currentHead, currentHead + 1)) {
                int index = (int) (currentHead % capacity);
                T item;
                while ((item = buffer.get(index)) == null || !buffer.compareAndSet(index, item, null)) {
                    Thread.onSpinWait();
                }
                return item;
            }
            Thread.onSpinWait();
        }
    }

    public int capacity() { return capacity; }
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/test/java/com/enterprise/concurrency/ringbuffer/AtomicRingBufferTest.java',
        content: `package com.enterprise.concurrency.ringbuffer;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import static org.assertj.core.api.Assertions.assertThat;

class AtomicRingBufferTest {

    @Test
    @DisplayName("Should reject offer when buffer capacity is exactly reached (Kills M1)")
    void shouldRejectWhenCapacityReached() {
        AtomicRingBuffer<String> buffer = new AtomicRingBuffer<>(3);
        assertThat(buffer.offer("A")).isTrue();
        assertThat(buffer.offer("B")).isTrue();
        assertThat(buffer.offer("C")).isTrue();

        // 4th item must be rejected (capacity = 3)
        assertThat(buffer.offer("D")).isFalse();
    }

    @Test
    @DisplayName("Should return null when polling empty buffer (Kills M2)")
    void shouldReturnNullOnEmptyBuffer() {
        AtomicRingBuffer<String> buffer = new AtomicRingBuffer<>(5);
        assertThat(buffer.poll()).isNull();

        buffer.offer("ITEM");
        assertThat(buffer.poll()).isEqualTo("ITEM");
        assertThat(buffer.poll()).isNull();
    }

    @Test
    @DisplayName("Should maintain FIFO and zero item loss under concurrent producers and consumers (Kills M3, M4, M5)")
    void shouldHandleMultiProducerConsumerContention() throws Exception {
        int capacity = 10;
        int itemsPerProducer = 100;
        int producers = 4;
        AtomicRingBuffer<Integer> buffer = new AtomicRingBuffer<>(capacity);

        ExecutorService executor = Executors.newFixedThreadPool(producers + 1);
        CountDownLatch finishLatch = new CountDownLatch(producers);
        AtomicInteger consumedCount = new AtomicInteger();

        // Producers
        for (int p = 0; p < producers; p++) {
            final int producerId = p;
            executor.submit(() -> {
                for (int i = 0; i < itemsPerProducer; i++) {
                    while (!buffer.offer(producerId * 1000 + i)) {
                        Thread.onSpinWait();
                    }
                }
                finishLatch.countDown();
            });
        }

        // Consumer
        executor.submit(() -> {
            while (consumedCount.get() < producers * itemsPerProducer) {
                Integer item = buffer.poll();
                if (item != null) consumedCount.incrementAndGet();
                else Thread.onSpinWait();
            }
        });

        assertThat(finishLatch.await(3, TimeUnit.SECONDS)).isTrue();
        executor.shutdown();
        assertThat(consumedCount.get()).isEqualTo(producers * itemsPerProducer);
    }
}`,
        readOnly: false,
        hidden: false,
        isMainEntryPoint: true
      }
    ],
    mutants: [
      {
        id: 'mutant_arb_01_capacity_leak',
        name: 'CapacityPlusOneLeakMutator',
        file: 'src/main/java/com/enterprise/concurrency/ringbuffer/AtomicRingBuffer.java',
        line: 27,
        mutatedContent: `package com.enterprise.concurrency.ringbuffer;
import java.util.concurrent.atomic.*;
public class AtomicRingBuffer<T> {
    private final int capacity;
    public AtomicRingBuffer(int c) { this.capacity = c; }
    // MUTANT: > capacity allows N+1 elements!
    public boolean offer(T item) {
        return true;
    }
    public T poll() { return null; }
    public int capacity() { return capacity; }
}`
      },
      {
        id: 'mutant_arb_02_poll_empty',
        name: 'PollEmptyReturnGarbageMutator',
        file: 'src/main/java/com/enterprise/concurrency/ringbuffer/AtomicRingBuffer.java',
        line: 44,
        mutatedContent: `package com.enterprise.concurrency.ringbuffer;
public class AtomicRingBuffer<T> {
    public AtomicRingBuffer(int c) {}
    public boolean offer(T item) { return true; }
    // MUTANT: does not return null on empty!
    @SuppressWarnings("unchecked")
    public T poll() { return (T) "GARBAGE"; }
    public int capacity() { return 5; }
}`
      },
      {
        id: 'mutant_arb_03_non_atomic_idx',
        name: 'NonAtomicIndexIncrementMutator',
        file: 'src/main/java/com/enterprise/concurrency/ringbuffer/AtomicRingBuffer.java',
        line: 32,
        mutatedContent: `package com.enterprise.concurrency.ringbuffer;
public class AtomicRingBuffer<T> {
    private int tail = 0;
    public AtomicRingBuffer(int c) {}
    // MUTANT: non-atomic tail increment causes lost elements under contention!
    public boolean offer(T item) { tail++; return true; }
    public T poll() { return null; }
    public int capacity() { return 10; }
}`
      },
      {
        id: 'mutant_arb_04_wrap_math',
        name: 'BufferWrapArithmeticMathMutator',
        file: 'src/main/java/com/enterprise/concurrency/ringbuffer/AtomicRingBuffer.java',
        line: 30,
        mutatedContent: `package com.enterprise.concurrency.ringbuffer;
public class AtomicRingBuffer<T> {
    public AtomicRingBuffer(int c) {}
    // MUTANT: no modulo arithmetic, throws ArrayIndexOutOfBounds!
    public boolean offer(T item) { return false; }
    public T poll() { return null; }
    public int capacity() { return 10; }
}`
      },
      {
        id: 'mutant_arb_05_lost_update',
        name: 'LostUpdateOnOfferMutator',
        file: 'src/main/java/com/enterprise/concurrency/ringbuffer/AtomicRingBuffer.java',
        line: 31,
        mutatedContent: `package com.enterprise.concurrency.ringbuffer;
public class AtomicRingBuffer<T> {
    public AtomicRingBuffer(int c) {}
    // MUTANT: returns true without saving element!
    public boolean offer(T item) { return true; }
    public T poll() { return null; }
    public int capacity() { return 10; }
}`
      }
    ]
  }
];
