import { CodingChallenge } from '../challengeSeedData';

export const FSM_CHALLENGES: CodingChallenge[] = [
  // =========================================================================
  // 1. Order State Machine Transition Guards
  // =========================================================================
  {
    id: 'kata_test_order_state_machine_dynamic',
    slug: 'kata-test-order-state-machine-dynamic',
    title: 'KATA-TEST-05: Order State Machine Transitions (Finite Automata)',
    category: 'testing_mutation',
    track: 'testing_mutation',
    badge: '🧬 State Machine Guard',
    difficulty: 'Senior',
    targetStack: 'Java 21 LTS, JUnit 5',
    timeLimitMinutes: 40,
    shortDescription: 'Тестирование графа переходов состояний заказа: CREATED -> PAID -> SHIPPED -> DELIVERED.',
    instructionsMarkdown: `### 🎯 Инженерная задача
Класс **OrderStateMachine** управляет жизненным циклом заказа:
- Допустимые переходы:
  - \`CREATED\` $\\to$ \`PAID\` или \`CANCELLED\`
  - \`PAID\` $\\to$ \`SHIPPED\` или \`CANCELLED\`
  - \`SHIPPED\` $\\to$ \`DELIVERED\` (после отгрузки отмена заказа строго запрещена!)
  - Любой другой переход обязан выбрасывать \`IllegalStateException\`.

### 🧪 Ваша цель
Напишите тесты в \`OrderStateMachineTest.java\`, уничтожающие всех 3 мутантов:
1. **Mutant 1 (AllowCancelAfterShipped):** Разрешение отмены после отгрузки.
2. **Mutant 2 (AllowBackwardsTransition):** Разрешение обратного перехода PAID $\\to$ CREATED.
3. **Mutant 3 (DeliveredPermitsTransition):** Разрешение переходов из финального DELIVERED.`,
    workspaceFiles: [
      {
        path: 'src/main/java/com/assessment/statemachine/OrderStatus.java',
        content: `package com.assessment.statemachine;

public enum OrderStatus {
    CREATED,
    PAID,
    SHIPPED,
    DELIVERED,
    CANCELLED
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/main/java/com/assessment/statemachine/OrderStateMachine.java',
        content: `package com.assessment.statemachine;

public class OrderStateMachine {
    private OrderStatus status = OrderStatus.CREATED;

    public OrderStatus getStatus() {
        return status;
    }

    public void transitionTo(OrderStatus next) {
        if (status == OrderStatus.CREATED) {
            if (next == OrderStatus.PAID || next == OrderStatus.CANCELLED) {
                status = next;
                return;
            }
        } else if (status == OrderStatus.PAID) {
            if (next == OrderStatus.SHIPPED || next == OrderStatus.CANCELLED) {
                status = next;
                return;
            }
        } else if (status == OrderStatus.SHIPPED) {
            if (next == OrderStatus.DELIVERED) {
                status = next;
                return;
            }
        }
        throw new IllegalStateException("Illegal transition from " + status + " to " + next);
    }
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/test/java/com/assessment/statemachine/OrderStateMachineTest.java',
        content: `package com.assessment.statemachine;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import static org.junit.jupiter.api.Assertions.*;

public class OrderStateMachineTest {

    @Test
    @DisplayName("Should start in CREATED status and transition to PAID")
    public void testCreatedToPaid() {
        OrderStateMachine sm = new OrderStateMachine();
        assertEquals(OrderStatus.CREATED, sm.getStatus());
        sm.transitionTo(OrderStatus.PAID);
        assertEquals(OrderStatus.PAID, sm.getStatus());
    }

    @Test
    @DisplayName("Should forbid cancellation after SHIPPED (Kills M1)")
    public void testForbidCancelAfterShipped() {
        OrderStateMachine sm = new OrderStateMachine();
        sm.transitionTo(OrderStatus.PAID);
        sm.transitionTo(OrderStatus.SHIPPED);
        assertThrows(IllegalStateException.class, () -> sm.transitionTo(OrderStatus.CANCELLED));
    }

    @Test
    @DisplayName("Should forbid backwards transition from PAID to CREATED (Kills M2)")
    public void testForbidBackwardsToCreated() {
        OrderStateMachine sm = new OrderStateMachine();
        sm.transitionTo(OrderStatus.PAID);
        assertThrows(IllegalStateException.class, () -> sm.transitionTo(OrderStatus.CREATED));
    }

    @Test
    @DisplayName("Should forbid any transition from DELIVERED (Kills M3)")
    public void testForbidTransitionFromDelivered() {
        OrderStateMachine sm = new OrderStateMachine();
        sm.transitionTo(OrderStatus.PAID);
        sm.transitionTo(OrderStatus.SHIPPED);
        sm.transitionTo(OrderStatus.DELIVERED);
        assertThrows(IllegalStateException.class, () -> sm.transitionTo(OrderStatus.CANCELLED));
    }
}`,
        readOnly: false,
        hidden: false,
        isMainEntryPoint: true
      }
    ],
    mutants: [
      {
        id: 'mutant_sm_01_cancel_after_shipped',
        name: 'CancelAfterShippedMutator',
        file: 'src/main/java/com/assessment/statemachine/OrderStateMachine.java',
        line: 22,
        mutatedContent: `package com.assessment.statemachine;

public class OrderStateMachine {
    private OrderStatus status = OrderStatus.CREATED;
    public OrderStatus getStatus() { return status; }

    public void transitionTo(OrderStatus next) {
        if (status == OrderStatus.SHIPPED) {
            if (next == OrderStatus.DELIVERED || next == OrderStatus.CANCELLED) { // MUTANT: allows CANCELLED after SHIPPED!
                status = next;
                return;
            }
        } else if (status == OrderStatus.CREATED && (next == OrderStatus.PAID || next == OrderStatus.CANCELLED)) {
            status = next; return;
        } else if (status == OrderStatus.PAID && (next == OrderStatus.SHIPPED || next == OrderStatus.CANCELLED)) {
            status = next; return;
        }
        throw new IllegalStateException("Illegal transition");
    }
}`
      },
      {
        id: 'mutant_sm_02_backwards_transition',
        name: 'BackwardsTransitionMutator',
        file: 'src/main/java/com/assessment/statemachine/OrderStateMachine.java',
        line: 17,
        mutatedContent: `package com.assessment.statemachine;

public class OrderStateMachine {
    private OrderStatus status = OrderStatus.CREATED;
    public OrderStatus getStatus() { return status; }

    public void transitionTo(OrderStatus next) {
        if (status == OrderStatus.PAID) {
            if (next == OrderStatus.CREATED) { // MUTANT: allows backwards transition to CREATED!
                status = next;
                return;
            }
        }
        if (status == OrderStatus.CREATED && (next == OrderStatus.PAID || next == OrderStatus.CANCELLED)) { status = next; return; }
        if (status == OrderStatus.PAID && (next == OrderStatus.SHIPPED || next == OrderStatus.CANCELLED)) { status = next; return; }
        if (status == OrderStatus.SHIPPED && next == OrderStatus.DELIVERED) { status = next; return; }
        throw new IllegalStateException("Illegal transition");
    }
}`
      },
      {
        id: 'mutant_sm_03_delivered_permits',
        name: 'DeliveredPermitsTransitionMutator',
        file: 'src/main/java/com/assessment/statemachine/OrderStateMachine.java',
        line: 26,
        mutatedContent: `package com.assessment.statemachine;

public class OrderStateMachine {
    private OrderStatus status = OrderStatus.CREATED;
    public OrderStatus getStatus() { return status; }

    public void transitionTo(OrderStatus next) {
        if (status == OrderStatus.DELIVERED) {
            status = next; // MUTANT: permits transition from final DELIVERED state!
            return;
        }
        if (status == OrderStatus.CREATED && (next == OrderStatus.PAID || next == OrderStatus.CANCELLED)) { status = next; return; }
        if (status == OrderStatus.PAID && (next == OrderStatus.SHIPPED || next == OrderStatus.CANCELLED)) { status = next; return; }
        if (status == OrderStatus.SHIPPED && next == OrderStatus.DELIVERED) { status = next; return; }
        throw new IllegalStateException("Illegal transition");
    }
}`
      }
    ]
  },

  // =========================================================================
  // 2. Idempotent Account Service (Double-Spending Guard)
  // =========================================================================
  {
    id: 'kata_test_idempotent_account_service',
    slug: 'kata-test-idempotent-account-service',
    title: 'KATA-TEST-10: Idempotent Account Service (Double-Spending Guard)',
    category: 'testing_mutation',
    track: 'testing_mutation',
    badge: '🧬 Idempotency Guard',
    difficulty: 'Senior',
    targetStack: 'Java 21 LTS, JUnit 5, ConcurrentHashMap',
    timeLimitMinutes: 45,
    shortDescription: 'Тестирование защиты от двойного списания по ключу идемпотентности при повторных запросах.',
    instructionsMarkdown: `### 🎯 Инженерная задача
Сервис **IdempotentAccountService** гарантирует идемпотентность финансовых транзакций:
- Каждый запрос сопровождается уникальным \`idempotencyKey\`.
- Если запрос с таким ключом уже был обработан, сервис обязан вернуть сохраненный результат первичного списания без повторного изменения баланса.
- Если транзакция падает из-за недостатка средств, запись об успешной транзакции не должна сохраняться.

### 🧪 Ваша цель
В файле \`IdempotentAccountServiceTest.java\` напишите тесты, убивающие всех 4 мутантов:
1. **Mutant 1 (IgnoreIdempotencyKey):** Игнорирование проверки ключа (повторное списание).
2. **Mutant 2 (SaveOnFailure):** Сохранение ключа даже при падении из-за нехватки баланса.
3. **Mutant 3 (DoubleDebitMath):** Списание двойной суммы.
4. **Mutant 4 (NegativeBalanceAllowed):** Разрешение ухода в отрицательный баланс.`,
    workspaceFiles: [
      {
        path: 'src/main/java/com/assessment/idempotent/AccountResponse.java',
        content: `package com.assessment.idempotent;
import java.math.BigDecimal;

public record AccountResponse(boolean success, BigDecimal newBalance, String txId) {}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/main/java/com/assessment/idempotent/IdempotentAccountService.java',
        content: `package com.assessment.idempotent;

import java.math.BigDecimal;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicReference;

public class IdempotentAccountService {
    private final AtomicReference<BigDecimal> balance;
    private final Map<String, AccountResponse> processedKeys = new ConcurrentHashMap<>();

    public IdempotentAccountService(BigDecimal initialBalance) {
        this.balance = new AtomicReference<>(initialBalance);
    }

    public synchronized AccountResponse debit(String idempotencyKey, BigDecimal amount) {
        if (processedKeys.containsKey(idempotencyKey)) {
            return processedKeys.get(idempotencyKey);
        }

        BigDecimal current = balance.get();
        if (current.compareTo(amount) < 0) {
            return new AccountResponse(false, current, null);
        }

        BigDecimal updated = current.subtract(amount);
        balance.set(updated);

        AccountResponse response = new AccountResponse(true, updated, "TX-" + idempotencyKey);
        processedKeys.put(idempotencyKey, response);
        return response;
    }

    public BigDecimal getBalance() {
        return balance.get();
    }
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/test/java/com/assessment/idempotent/IdempotentAccountServiceTest.java',
        content: `package com.assessment.idempotent;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import java.math.BigDecimal;
import static org.junit.jupiter.api.Assertions.*;

public class IdempotentAccountServiceTest {

    @Test
    @DisplayName("Should execute first debit successfully")
    public void shouldExecuteFirstDebit() {
        IdempotentAccountService service = new IdempotentAccountService(new BigDecimal("100.00"));
        AccountResponse res = service.debit("key-1", new BigDecimal("40.00"));

        assertTrue(res.success());
        assertEquals(0, new BigDecimal("60.00").compareTo(res.newBalance()));
    }

    @Test
    @DisplayName("Should return cached response without second debit on repeated key (Kills M1)")
    public void shouldReturnCachedResponseOnDuplicateKey() {
        IdempotentAccountService service = new IdempotentAccountService(new BigDecimal("100.00"));
        AccountResponse res1 = service.debit("key-dup", new BigDecimal("40.00"));
        AccountResponse res2 = service.debit("key-dup", new BigDecimal("40.00"));

        assertSame(res1, res2);
        assertEquals(0, new BigDecimal("60.00").compareTo(service.getBalance()));
    }

    @Test
    @DisplayName("Should not store key if transaction failed due to insufficient funds (Kills M2)")
    public void shouldNotSaveFailedKey() {
        IdempotentAccountService service = new IdempotentAccountService(new BigDecimal("10.00"));
        AccountResponse resFailed = service.debit("key-fail", new BigDecimal("50.00"));
        assertFalse(resFailed.success());

        // Top up and retry with same key
        service.debit("dummy", new BigDecimal("0.00"));
        AccountResponse resRetry = service.debit("key-fail", new BigDecimal("5.00"));
        assertTrue(resRetry.success());
    }

    @Test
    @DisplayName("Should subtract exact amount without doubling (Kills M3)")
    public void shouldSubtractExactAmount() {
        IdempotentAccountService service = new IdempotentAccountService(new BigDecimal("100.00"));
        AccountResponse res = service.debit("key-exact", new BigDecimal("30.00"));
        assertEquals(0, new BigDecimal("70.00").compareTo(res.newBalance()));
    }

    @Test
    @DisplayName("Should reject debit if amount exceeds balance (Kills M4)")
    public void shouldRejectOverdraft() {
        IdempotentAccountService service = new IdempotentAccountService(new BigDecimal("100.00"));
        AccountResponse res = service.debit("key-overdraft", new BigDecimal("100.01"));
        assertFalse(res.success());
        assertEquals(0, new BigDecimal("100.00").compareTo(service.getBalance()));
    }
}`,
        readOnly: false,
        hidden: false,
        isMainEntryPoint: true
      }
    ],
    mutants: [
      {
        id: 'mutant_idemp_01_ignore_key',
        name: 'IgnoreKeyMutator',
        file: 'src/main/java/com/assessment/idempotent/IdempotentAccountService.java',
        line: 16,
        mutatedContent: `package com.assessment.idempotent;
import java.math.BigDecimal;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicReference;

public class IdempotentAccountService {
    private final AtomicReference<BigDecimal> balance;
    private final Map<String, AccountResponse> processedKeys = new ConcurrentHashMap<>();

    public IdempotentAccountService(BigDecimal initialBalance) { this.balance = new AtomicReference<>(initialBalance); }

    public synchronized AccountResponse debit(String idempotencyKey, BigDecimal amount) {
        // MUTANT: processedKeys check omitted, debits again!
        BigDecimal current = balance.get();
        if (current.compareTo(amount) < 0) return new AccountResponse(false, current, null);
        BigDecimal updated = current.subtract(amount);
        balance.set(updated);
        AccountResponse response = new AccountResponse(true, updated, "TX-" + idempotencyKey);
        processedKeys.put(idempotencyKey, response);
        return response;
    }
    public BigDecimal getBalance() { return balance.get(); }
}`
      },
      {
        id: 'mutant_idemp_02_save_on_failure',
        name: 'SaveOnFailureMutator',
        file: 'src/main/java/com/assessment/idempotent/IdempotentAccountService.java',
        line: 22,
        mutatedContent: `package com.assessment.idempotent;
import java.math.BigDecimal;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicReference;

public class IdempotentAccountService {
    private final AtomicReference<BigDecimal> balance;
    private final Map<String, AccountResponse> processedKeys = new ConcurrentHashMap<>();

    public IdempotentAccountService(BigDecimal initialBalance) { this.balance = new AtomicReference<>(initialBalance); }

    public synchronized AccountResponse debit(String idempotencyKey, BigDecimal amount) {
        if (processedKeys.containsKey(idempotencyKey)) return processedKeys.get(idempotencyKey);
        BigDecimal current = balance.get();
        if (current.compareTo(amount) < 0) {
            AccountResponse failedResp = new AccountResponse(false, current, null);
            processedKeys.put(idempotencyKey, failedResp); // MUTANT: stores failed key!
            return failedResp;
        }
        BigDecimal updated = current.subtract(amount);
        balance.set(updated);
        AccountResponse response = new AccountResponse(true, updated, "TX-" + idempotencyKey);
        processedKeys.put(idempotencyKey, response);
        return response;
    }
    public BigDecimal getBalance() { return balance.get(); }
}`
      },
      {
        id: 'mutant_idemp_03_double_debit',
        name: 'DoubleDebitMathMutator',
        file: 'src/main/java/com/assessment/idempotent/IdempotentAccountService.java',
        line: 25,
        mutatedContent: `package com.assessment.idempotent;
import java.math.BigDecimal;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicReference;

public class IdempotentAccountService {
    private final AtomicReference<BigDecimal> balance;
    private final Map<String, AccountResponse> processedKeys = new ConcurrentHashMap<>();

    public IdempotentAccountService(BigDecimal initialBalance) { this.balance = new AtomicReference<>(initialBalance); }

    public synchronized AccountResponse debit(String idempotencyKey, BigDecimal amount) {
        if (processedKeys.containsKey(idempotencyKey)) return processedKeys.get(idempotencyKey);
        BigDecimal current = balance.get();
        if (current.compareTo(amount) < 0) return new AccountResponse(false, current, null);
        BigDecimal updated = current.subtract(amount.multiply(new BigDecimal("2.0"))); // MUTANT: debits 2x!
        balance.set(updated);
        AccountResponse response = new AccountResponse(true, updated, "TX-" + idempotencyKey);
        processedKeys.put(idempotencyKey, response);
        return response;
    }
    public BigDecimal getBalance() { return balance.get(); }
}`
      },
      {
        id: 'mutant_idemp_04_negative_balance',
        name: 'NegativeBalanceAllowedMutator',
        file: 'src/main/java/com/assessment/idempotent/IdempotentAccountService.java',
        line: 21,
        mutatedContent: `package com.assessment.idempotent;
import java.math.BigDecimal;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicReference;

public class IdempotentAccountService {
    private final AtomicReference<BigDecimal> balance;
    private final Map<String, AccountResponse> processedKeys = new ConcurrentHashMap<>();

    public IdempotentAccountService(BigDecimal initialBalance) { this.balance = new AtomicReference<>(initialBalance); }

    public synchronized AccountResponse debit(String idempotencyKey, BigDecimal amount) {
        if (processedKeys.containsKey(idempotencyKey)) return processedKeys.get(idempotencyKey);
        BigDecimal current = balance.get();
        // MUTANT: does not check for overdraft!
        BigDecimal updated = current.subtract(amount);
        balance.set(updated);
        AccountResponse response = new AccountResponse(true, updated, "TX-" + idempotencyKey);
        processedKeys.put(idempotencyKey, response);
        return response;
    }
    public BigDecimal getBalance() { return balance.get(); }
}`
      }
    ]
  },

  // =========================================================================
  // 3. Resilient Circuit Breaker (CLOSED -> OPEN -> HALF_OPEN)
  // =========================================================================
  {
    id: 'kata_test_resilience_circuit_breaker',
    slug: 'kata-test-resilience-circuit-breaker',
    title: 'KATA-TEST-17: Resilience4j Circuit Breaker State Transition',
    category: 'testing_mutation',
    track: 'testing_mutation',
    badge: '🧬 State Transition',
    difficulty: 'Senior',
    targetStack: 'Java 21 LTS, JUnit 5, Concurrency',
    timeLimitMinutes: 45,
    shortDescription: 'Тестирование автомата состояний Circuit Breaker: CLOSED -> OPEN -> HALF_OPEN -> CLOSED.',
    instructionsMarkdown: `### 🎯 Инженерная задача
Компонент **SimpleCircuitBreaker** защищает микросервисную систему от каскадных сбоев:
- Начальное состояние: \`CLOSED\` (все запросы разрешены).
- Если в скользящем окне из 10 запросов количество сбоев превышает $5$ ($> 5$), автомат переходит в состояние \`OPEN\`.
- В состоянии \`OPEN\` все входящие запросы немедленно отклоняются без вызова нижележащего сервиса.
- По истечении таймаута автомат переходит в \`HALF_OPEN\` (пробный режим). Если пробный запрос успешен — возвращается в \`CLOSED\`.

### 🧪 Ваша цель
В файле \`SimpleCircuitBreakerTest.java\` напишите тесты, убивающие всех 4 мутантов:
1. **Mutant 1 (ThresholdBoundary):** Переход в OPEN при $> 6$ сбоев вместо $> 5$.
2. **Mutant 2 (OpenPermitsExecution):** В состоянии OPEN вызовы ошибочно пропускаются.
3. **Mutant 3 (HalfOpenNeverResets):** При успехе в HALF_OPEN автомат не сбрасывается в CLOSED.
4. **Mutant 4 (InitialStateOpen):** Начальное состояние ошибочно установлено в OPEN.`,
    workspaceFiles: [
      {
        path: 'src/main/java/com/assessment/resilience/CircuitState.java',
        content: `package com.assessment.resilience;

public enum CircuitState {
    CLOSED,
    OPEN,
    HALF_OPEN
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/main/java/com/assessment/resilience/SimpleCircuitBreaker.java',
        content: `package com.assessment.resilience;

public class SimpleCircuitBreaker {
    private CircuitState state = CircuitState.CLOSED;
    private int failureCount = 0;
    private int successCount = 0;
    private final int failureThreshold = 5;

    public synchronized boolean allowExecution() {
        return state != CircuitState.OPEN;
    }

    public synchronized void recordSuccess() {
        if (state == CircuitState.HALF_OPEN) {
            state = CircuitState.CLOSED;
            failureCount = 0;
            successCount = 0;
        } else if (state == CircuitState.CLOSED) {
            successCount++;
        }
    }

    public synchronized void recordFailure() {
        failureCount++;
        if (state == CircuitState.CLOSED && failureCount > failureThreshold) {
            state = CircuitState.OPEN;
        } else if (state == CircuitState.HALF_OPEN) {
            state = CircuitState.OPEN;
        }
    }

    public synchronized void transitionToHalfOpen() {
        this.state = CircuitState.HALF_OPEN;
    }

    public synchronized CircuitState getState() {
        return state;
    }
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/test/java/com/assessment/resilience/SimpleCircuitBreakerTest.java',
        content: `package com.assessment.resilience;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import static org.junit.jupiter.api.Assertions.*;

public class SimpleCircuitBreakerTest {

    @Test
    @DisplayName("Initial state must be CLOSED and allow execution")
    public void testInitialStateClosed() {
        SimpleCircuitBreaker cb = new SimpleCircuitBreaker();
        assertEquals(CircuitState.CLOSED, cb.getState());
        assertTrue(cb.allowExecution());
    }

    @Test
    @DisplayName("Should trip to OPEN when failure count exceeds threshold (Kills M1)")
    public void shouldTripToOpenOnSixFailures() {
        SimpleCircuitBreaker cb = new SimpleCircuitBreaker();
        for (int i = 0; i < 5; i++) cb.recordFailure();
        assertEquals(CircuitState.CLOSED, cb.getState());

        cb.recordFailure(); // 6th failure > 5
        assertEquals(CircuitState.OPEN, cb.getState());
    }

    @Test
    @DisplayName("Should reject execution when state is OPEN (Kills M2)")
    public void shouldRejectExecutionWhenOpen() {
        SimpleCircuitBreaker cb = new SimpleCircuitBreaker();
        for (int i = 0; i < 6; i++) cb.recordFailure();

        assertEquals(CircuitState.OPEN, cb.getState());
        assertFalse(cb.allowExecution());
    }

    @Test
    @DisplayName("Should reset from HALF_OPEN to CLOSED on success (Kills M3)")
    public void shouldResetToClosedOnHalfOpenSuccess() {
        SimpleCircuitBreaker cb = new SimpleCircuitBreaker();
        for (int i = 0; i < 6; i++) cb.recordFailure();
        cb.transitionToHalfOpen();
        assertEquals(CircuitState.HALF_OPEN, cb.getState());

        cb.recordSuccess();
        assertEquals(CircuitState.CLOSED, cb.getState());
        assertTrue(cb.allowExecution());
    }
}`,
        readOnly: false,
        hidden: false,
        isMainEntryPoint: true
      }
    ],
    mutants: [
      {
        id: 'mutant_cb_01_threshold_boundary',
        name: 'ThresholdBoundaryMutator',
        file: 'src/main/java/com/assessment/resilience/SimpleCircuitBreaker.java',
        line: 25,
        mutatedContent: `package com.assessment.resilience;

public class SimpleCircuitBreaker {
    private CircuitState state = CircuitState.CLOSED;
    private int failureCount = 0;
    private int successCount = 0;
    private final int failureThreshold = 6; // MUTANT: threshold changed from 5 to 6!

    public synchronized boolean allowExecution() { return state != CircuitState.OPEN; }
    public synchronized void recordSuccess() {
        if (state == CircuitState.HALF_OPEN) { state = CircuitState.CLOSED; failureCount = 0; successCount = 0; }
        else if (state == CircuitState.CLOSED) successCount++;
    }
    public synchronized void recordFailure() {
        failureCount++;
        if (state == CircuitState.CLOSED && failureCount > failureThreshold) state = CircuitState.OPEN;
        else if (state == CircuitState.HALF_OPEN) state = CircuitState.OPEN;
    }
    public synchronized void transitionToHalfOpen() { this.state = CircuitState.HALF_OPEN; }
    public synchronized CircuitState getState() { return state; }
}`
      },
      {
        id: 'mutant_cb_02_open_permits',
        name: 'OpenPermitsExecutionMutator',
        file: 'src/main/java/com/assessment/resilience/SimpleCircuitBreaker.java',
        line: 11,
        mutatedContent: `package com.assessment.resilience;

public class SimpleCircuitBreaker {
    private CircuitState state = CircuitState.CLOSED;
    private int failureCount = 0;
    private final int failureThreshold = 5;

    public synchronized boolean allowExecution() {
        return true; // MUTANT: allows execution even in OPEN state!
    }
    public synchronized void recordSuccess() { if (state == CircuitState.HALF_OPEN) state = CircuitState.CLOSED; }
    public synchronized void recordFailure() {
        failureCount++;
        if (failureCount > failureThreshold) state = CircuitState.OPEN;
    }
    public synchronized void transitionToHalfOpen() { this.state = CircuitState.HALF_OPEN; }
    public synchronized CircuitState getState() { return state; }
}`
      },
      {
        id: 'mutant_cb_03_half_open_never_resets',
        name: 'HalfOpenNeverResetsMutator',
        file: 'src/main/java/com/assessment/resilience/SimpleCircuitBreaker.java',
        line: 16,
        mutatedContent: `package com.assessment.resilience;

public class SimpleCircuitBreaker {
    private CircuitState state = CircuitState.CLOSED;
    private int failureCount = 0;
    private final int failureThreshold = 5;

    public synchronized boolean allowExecution() { return state != CircuitState.OPEN; }
    public synchronized void recordSuccess() {
        // MUTANT: does not reset from HALF_OPEN to CLOSED!
    }
    public synchronized void recordFailure() {
        failureCount++;
        if (failureCount > failureThreshold) state = CircuitState.OPEN;
    }
    public synchronized void transitionToHalfOpen() { this.state = CircuitState.HALF_OPEN; }
    public synchronized CircuitState getState() { return state; }
}`
      },
      {
        id: 'mutant_cb_04_initial_open',
        name: 'InitialStateOpenMutator',
        file: 'src/main/java/com/assessment/resilience/SimpleCircuitBreaker.java',
        line: 5,
        mutatedContent: `package com.assessment.resilience;

public class SimpleCircuitBreaker {
    private CircuitState state = CircuitState.OPEN; // MUTANT: initially OPEN!
    public synchronized boolean allowExecution() { return state != CircuitState.OPEN; }
    public synchronized void recordSuccess() { if (state == CircuitState.HALF_OPEN) state = CircuitState.CLOSED; }
    public synchronized void recordFailure() {}
    public synchronized void transitionToHalfOpen() { this.state = CircuitState.HALF_OPEN; }
    public synchronized CircuitState getState() { return state; }
}`
      }
    ]
  },

  // =========================================================================
  // 4. High-Throughput Sliding Window Rate Limiter Finite Automaton
  // =========================================================================
  {
    id: 'kata_test_sliding_window_rate_limiter',
    slug: 'kata-test-sliding-window-rate-limiter',
    title: 'KATA-TEST-23: Sliding Window Rate Limiter Automaton (Lock-Free CAS)',
    category: 'testing_mutation',
    track: 'testing_mutation',
    badge: '🧬 Rate Limiter FSM',
    difficulty: 'Senior',
    targetStack: 'Java 21 LTS, AtomicReference, Duration',
    timeLimitMinutes: 45,
    shortDescription: 'Потокобезопасный конечный автомат лимитера: Allowed -> Throttled -> Rejected -> CooldownReset.',
    instructionsMarkdown: `### 🎯 Инженерная задача
Класс **SlidingWindowRateLimiter** реализует неблокирующий конечный автомат на \`AtomicReference.updateAndGet()\`:
- Запечатанные состояния: \`AllowedState\`, \`ThrottledState\`, \`RejectedState\`, \`CooldownResetState\`.
- Базовый лимит $Q$, буфер всплеска $B$.
- Запросы $k \\le Q$ переходят в \`AllowedState\`.
- Запросы $Q < k \\le Q + B$ переводят автомат в \`ThrottledState\` с линейным бэкоффом.
- Ровно запрос $Q + B + 1$ переводит автомат в \`RejectedState\` с расчетом времени \`retryAfter\`.
- При истечении окна скольжения $\\Delta t \\ge \\text{windowDuration}$ автомат сбрасывает лимиты.

### 🧪 Ваша цель
В \`SlidingWindowRateLimiterTest.java\` протестируйте переходы автомата, уничтожив всех 5 мутантов:
1. **Mutant 1 (WindowBoundaryCondition):** Замена $\\ge 0$ на $> 0$ на миллисекундной границе сброса окна.
2. **Mutant 2 (BurstCapacityThreshold):** Замена $\\le Q+B$ на $< Q+B$ в буфере всплеска.
3. **Mutant 3 (RejectedCounterMath):** Замена \`+ 1\` на \`+ 0\` при подсчете попыток в RejectedState.
4. **Mutant 4 (BypassRejectedWithoutCooldown):** Разрешение ручного перехода из RejectedState до истечения окна.
5. **Mutant 5 (RemainingQuotaMath):** Замена вычитания на сложение при расчете \`remainingQuota\`.`,
    workspaceFiles: [
      {
        path: 'src/main/java/com/distributed/ratelimiter/SlidingWindowRateLimiter.java',
        content: `package com.distributed.ratelimiter;

import java.time.Duration;
import java.time.Instant;
import java.util.Objects;
import java.util.concurrent.atomic.AtomicReference;

public final class SlidingWindowRateLimiter {

    public sealed interface RateLimiterState permits 
            RateLimiterState.AllowedState,
            RateLimiterState.ThrottledState,
            RateLimiterState.RejectedState,
            RateLimiterState.CooldownResetState {

        long currentCount();
        Instant windowStart();
        boolean isPermitted();

        record AllowedState(long currentCount, long remainingQuota, Instant windowStart) implements RateLimiterState {
            @Override public boolean isPermitted() { return true; }
        }
        record ThrottledState(long currentCount, long burstRemaining, Duration suggestedBackoff, Instant windowStart) implements RateLimiterState {
            @Override public boolean isPermitted() { return true; }
        }
        record RejectedState(long currentCount, Duration retryAfter, Instant windowStart) implements RateLimiterState {
            @Override public boolean isPermitted() { return false; }
        }
        record CooldownResetState(long replenishedQuota, Instant windowStart) implements RateLimiterState {
            @Override public long currentCount() { return 0L; }
            @Override public boolean isPermitted() { return true; }
        }
    }

    private final long baseQuota;
    private final long burstCapacity;
    private final Duration windowDuration;
    private final Duration baseBackoff;
    private final AtomicReference<RateLimiterState> stateReference;
    private final AtomicReference<Instant> lastRequestTime;

    public SlidingWindowRateLimiter(long baseQuota, long burstCapacity, Duration windowDuration, Duration baseBackoff, Instant initialTime) {
        if (baseQuota <= 0 || burstCapacity < 0 || windowDuration.isNegative() || windowDuration.isZero()) {
            throw new IllegalArgumentException("Invalid config");
        }
        this.baseQuota = baseQuota;
        this.burstCapacity = burstCapacity;
        this.windowDuration = windowDuration;
        this.baseBackoff = baseBackoff;
        this.lastRequestTime = new AtomicReference<>(Objects.requireNonNull(initialTime));
        this.stateReference = new AtomicReference<>(new RateLimiterState.AllowedState(0, baseQuota, initialTime));
    }

    public RateLimiterState evaluate(Instant requestTime) {
        Objects.requireNonNull(requestTime);
        Instant last = lastRequestTime.get();
        if (requestTime.isBefore(last)) {
            throw new IllegalArgumentException("Monotonic clock violation");
        }
        lastRequestTime.set(requestTime);
        return stateReference.updateAndGet(current -> computeNextState(current, requestTime));
    }

    private RateLimiterState computeNextState(RateLimiterState current, Instant requestTime) {
        if (requestTime.isBefore(current.windowStart())) {
            throw new IllegalArgumentException("Monotonic clock violation");
        }

        boolean windowExpired = requestTime.compareTo(current.windowStart().plus(windowDuration)) >= 0;
        if (windowExpired) {
            return new RateLimiterState.AllowedState(1, baseQuota - 1, requestTime);
        }

        return switch (current) {
            case RateLimiterState.AllowedState allowed -> {
                long nextCount = allowed.currentCount() + 1;
                if (nextCount <= baseQuota) {
                    yield new RateLimiterState.AllowedState(nextCount, baseQuota - nextCount, allowed.windowStart());
                } else if (burstCapacity > 0) {
                    long burstUsed = nextCount - baseQuota;
                    Duration backoff = baseBackoff.multipliedBy(burstUsed);
                    yield new RateLimiterState.ThrottledState(nextCount, burstCapacity - burstUsed, backoff, allowed.windowStart());
                } else {
                    Duration retryAfter = Duration.between(requestTime, allowed.windowStart().plus(windowDuration));
                    yield new RateLimiterState.RejectedState(nextCount, retryAfter, allowed.windowStart());
                }
            }
            case RateLimiterState.ThrottledState throttled -> {
                long nextCount = throttled.currentCount() + 1;
                if (nextCount <= baseQuota + burstCapacity) {
                    long burstUsed = nextCount - baseQuota;
                    Duration backoff = baseBackoff.multipliedBy(burstUsed);
                    yield new RateLimiterState.ThrottledState(nextCount, (baseQuota + burstCapacity) - nextCount, backoff, throttled.windowStart());
                } else {
                    Duration retryAfter = Duration.between(requestTime, throttled.windowStart().plus(windowDuration));
                    yield new RateLimiterState.RejectedState(nextCount, retryAfter, throttled.windowStart());
                }
            }
            case RateLimiterState.RejectedState rejected -> {
                long nextCount = rejected.currentCount() + 1;
                Duration retryAfter = Duration.between(requestTime, rejected.windowStart().plus(windowDuration));
                yield new RateLimiterState.RejectedState(nextCount, retryAfter, rejected.windowStart());
            }
            case RateLimiterState.CooldownResetState reset -> 
                new RateLimiterState.AllowedState(1, baseQuota - 1, reset.windowStart());
        };
    }

    public RateLimiterState getCurrentState() { return stateReference.get(); }
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/test/java/com/distributed/ratelimiter/SlidingWindowRateLimiterTest.java',
        content: `package com.distributed.ratelimiter;

import com.distributed.ratelimiter.SlidingWindowRateLimiter.*;
import com.distributed.ratelimiter.SlidingWindowRateLimiter.RateLimiterState.*;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import java.time.Duration;
import java.time.Instant;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SlidingWindowRateLimiterTest {

    private static final Instant T0 = Instant.parse("2026-04-01T10:00:00.000Z");
    private static final Duration WINDOW = Duration.ofSeconds(1);
    private static final Duration BASE_BACKOFF = Duration.ofMillis(50);
    private static final long BASE_QUOTA = 3;
    private static final long BURST_CAPACITY = 2;

    @Test
    @DisplayName("Should maintain AllowedState and compute remaining quota within base quota (Kills M5)")
    void shouldPermitRequestsWithinBaseQuota() {
        var limiter = new SlidingWindowRateLimiter(BASE_QUOTA, BURST_CAPACITY, WINDOW, BASE_BACKOFF, T0);
        RateLimiterState s1 = limiter.evaluate(T0.plusMillis(100));

        assertThat(s1).isInstanceOf(AllowedState.class);
        AllowedState a1 = (AllowedState) s1;
        assertThat(a1.currentCount()).isEqualTo(1);
        assertThat(a1.remainingQuota()).isEqualTo(2);
    }

    @Test
    @DisplayName("Should enter burst buffer and transition to ThrottledState (Kills M2)")
    void shouldEnterBurstBuffer() {
        var limiter = new SlidingWindowRateLimiter(BASE_QUOTA, BURST_CAPACITY, WINDOW, BASE_BACKOFF, T0);
        for (int i = 0; i < BASE_QUOTA; i++) limiter.evaluate(T0.plusMillis(10 * i));

        // Request 4 (first burst)
        RateLimiterState s4 = limiter.evaluate(T0.plusMillis(100));
        assertThat(s4).isInstanceOf(ThrottledState.class);
        assertThat(((ThrottledState) s4).burstRemaining()).isEqualTo(1);

        // Request 5 (final burst boundary)
        RateLimiterState s5 = limiter.evaluate(T0.plusMillis(150));
        assertThat(s5).isInstanceOf(ThrottledState.class);
        assertThat(((ThrottledState) s5).burstRemaining()).isZero();
    }

    @Test
    @DisplayName("Should reject and increment counter on burst exhaustion (Kills M3)")
    void shouldRejectOnBurstExhaustion() {
        var limiter = new SlidingWindowRateLimiter(BASE_QUOTA, BURST_CAPACITY, WINDOW, BASE_BACKOFF, T0);
        for (int i = 0; i < BASE_QUOTA + BURST_CAPACITY; i++) limiter.evaluate(T0.plusMillis(10 * i));

        // Request 6: Rejected
        RateLimiterState s6 = limiter.evaluate(T0.plusMillis(500));
        assertThat(s6).isInstanceOf(RejectedState.class);
        assertThat(s6.currentCount()).isEqualTo(6);

        // Request 7: Rejected counter incremented
        RateLimiterState s7 = limiter.evaluate(T0.plusMillis(550));
        assertThat(s7.currentCount()).isEqualTo(7);
    }

    @Test
    @DisplayName("Should reset quota on exact window duration millisecond boundary (Kills M1)")
    void shouldResetAtExactWindowBoundary() {
        var limiter = new SlidingWindowRateLimiter(BASE_QUOTA, BURST_CAPACITY, WINDOW, BASE_BACKOFF, T0);
        for (int i = 0; i < BASE_QUOTA + BURST_CAPACITY + 1; i++) limiter.evaluate(T0.plusMillis(10 * i));

        Instant exactBoundary = T0.plus(WINDOW);
        RateLimiterState reset = limiter.evaluate(exactBoundary);

        assertThat(reset).isInstanceOf(AllowedState.class);
        assertThat(reset.currentCount()).isEqualTo(1);
    }

    @Test
    @DisplayName("Should enforce monotonic clock progression (Kills M4)")
    void shouldEnforceMonotonicClock() {
        var limiter = new SlidingWindowRateLimiter(BASE_QUOTA, BURST_CAPACITY, WINDOW, BASE_BACKOFF, T0);
        limiter.evaluate(T0.plusMillis(200));

        assertThatThrownBy(() -> limiter.evaluate(T0.plusMillis(100)))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Monotonic clock violation");
    }
}`,
        readOnly: false,
        hidden: false,
        isMainEntryPoint: true
      }
    ],
    mutants: [
      {
        id: 'mutant_swr_01_window_boundary',
        name: 'WindowBoundaryConditionMutator',
        file: 'src/main/java/com/distributed/ratelimiter/SlidingWindowRateLimiter.java',
        line: 52,
        mutatedContent: `package com.distributed.ratelimiter;
import java.time.*; import java.util.concurrent.atomic.AtomicReference;
public final class SlidingWindowRateLimiter {
    public sealed interface RateLimiterState permits RateLimiterState.AllowedState, RateLimiterState.ThrottledState, RateLimiterState.RejectedState, RateLimiterState.CooldownResetState {
        long currentCount(); Instant windowStart(); boolean isPermitted();
        record AllowedState(long currentCount, long remainingQuota, Instant windowStart) implements RateLimiterState { public boolean isPermitted() { return true; } }
        record ThrottledState(long currentCount, long burstRemaining, Duration suggestedBackoff, Instant windowStart) implements RateLimiterState { public boolean isPermitted() { return true; } }
        record RejectedState(long currentCount, Duration retryAfter, Instant windowStart) implements RateLimiterState { public boolean isPermitted() { return false; } }
        record CooldownResetState(long replenishedQuota, Instant windowStart) implements RateLimiterState { public long currentCount() { return 0; } public boolean isPermitted() { return true; } }
    }
    private final long baseQuota; private final AtomicReference<RateLimiterState> stateReference;
    public SlidingWindowRateLimiter(long bq, long bc, Duration wd, Duration bb, Instant t0) {
        this.baseQuota = bq;
        this.stateReference = new AtomicReference<>(new RateLimiterState.AllowedState(0, bq, t0));
    }
    public RateLimiterState evaluate(Instant t) {
        RateLimiterState cur = stateReference.get();
        // MUTANT: > 0 instead of >= 0! Does not reset at exact boundary!
        boolean expired = t.compareTo(cur.windowStart().plusSeconds(1)) > 0;
        if (expired) return new RateLimiterState.AllowedState(1, baseQuota - 1, t);
        return new RateLimiterState.RejectedState(cur.currentCount() + 1, Duration.ZERO, cur.windowStart());
    }
}`
      },
      {
        id: 'mutant_swr_02_burst_threshold',
        name: 'BurstCapacityThresholdMutator',
        file: 'src/main/java/com/distributed/ratelimiter/SlidingWindowRateLimiter.java',
        line: 73,
        mutatedContent: `package com.distributed.ratelimiter;
import java.time.*; import java.util.concurrent.atomic.AtomicReference;
public final class SlidingWindowRateLimiter {
    public sealed interface RateLimiterState permits RateLimiterState.AllowedState, RateLimiterState.ThrottledState, RateLimiterState.RejectedState, RateLimiterState.CooldownResetState {
        long currentCount(); Instant windowStart(); boolean isPermitted();
        record AllowedState(long currentCount, long remainingQuota, Instant windowStart) implements RateLimiterState { public boolean isPermitted() { return true; } }
        record ThrottledState(long currentCount, long burstRemaining, Duration suggestedBackoff, Instant windowStart) implements RateLimiterState { public boolean isPermitted() { return true; } }
        record RejectedState(long currentCount, Duration retryAfter, Instant windowStart) implements RateLimiterState { public boolean isPermitted() { return false; } }
        record CooldownResetState(long replenishedQuota, Instant windowStart) implements RateLimiterState { public long currentCount() { return 0; } public boolean isPermitted() { return true; } }
    }
    public SlidingWindowRateLimiter(long bq, long bc, Duration wd, Duration bb, Instant t0) {}
    public RateLimiterState evaluate(Instant t) {
        // MUTANT: request 5 rejected prematurely!
        return new RateLimiterState.RejectedState(5, Duration.ZERO, t);
    }
}`
      },
      {
        id: 'mutant_swr_03_rejected_counter',
        name: 'RejectedCounterMathMutator',
        file: 'src/main/java/com/distributed/ratelimiter/SlidingWindowRateLimiter.java',
        line: 82,
        mutatedContent: `package com.distributed.ratelimiter;
import java.time.*;
public final class SlidingWindowRateLimiter {
    public sealed interface RateLimiterState permits RateLimiterState.AllowedState, RateLimiterState.ThrottledState, RateLimiterState.RejectedState, RateLimiterState.CooldownResetState {
        long currentCount(); Instant windowStart(); boolean isPermitted();
        record AllowedState(long currentCount, long remainingQuota, Instant windowStart) implements RateLimiterState { public boolean isPermitted() { return true; } }
        record ThrottledState(long currentCount, long burstRemaining, Duration suggestedBackoff, Instant windowStart) implements RateLimiterState { public boolean isPermitted() { return true; } }
        record RejectedState(long currentCount, Duration retryAfter, Instant windowStart) implements RateLimiterState { public boolean isPermitted() { return false; } }
        record CooldownResetState(long replenishedQuota, Instant windowStart) implements RateLimiterState { public long currentCount() { return 0; } public boolean isPermitted() { return true; } }
    }
    public SlidingWindowRateLimiter(long bq, long bc, Duration wd, Duration bb, Instant t0) {}
    public RateLimiterState evaluate(Instant t) {
        // MUTANT: returns count 6 without incrementing!
        return new RateLimiterState.RejectedState(6, Duration.ZERO, t);
    }
}`
      },
      {
        id: 'mutant_swr_04_monotonic_violation',
        name: 'MonotonicViolationOmissionMutator',
        file: 'src/main/java/com/distributed/ratelimiter/SlidingWindowRateLimiter.java',
        line: 47,
        mutatedContent: `package com.distributed.ratelimiter;
import java.time.*;
public final class SlidingWindowRateLimiter {
    public sealed interface RateLimiterState permits RateLimiterState.AllowedState, RateLimiterState.ThrottledState, RateLimiterState.RejectedState, RateLimiterState.CooldownResetState {
        long currentCount(); Instant windowStart(); boolean isPermitted();
        record AllowedState(long currentCount, long remainingQuota, Instant windowStart) implements RateLimiterState { public boolean isPermitted() { return true; } }
        record ThrottledState(long currentCount, long burstRemaining, Duration suggestedBackoff, Instant windowStart) implements RateLimiterState { public boolean isPermitted() { return true; } }
        record RejectedState(long currentCount, Duration retryAfter, Instant windowStart) implements RateLimiterState { public boolean isPermitted() { return false; } }
        record CooldownResetState(long replenishedQuota, Instant windowStart) implements RateLimiterState { public long currentCount() { return 0; } public boolean isPermitted() { return true; } }
    }
    public SlidingWindowRateLimiter(long bq, long bc, Duration wd, Duration bb, Instant t0) {}
    public RateLimiterState evaluate(Instant t) {
        // MUTANT: does not check monotonic progression!
        return new RateLimiterState.AllowedState(1, 2, t);
    }
}`
      },
      {
        id: 'mutant_swr_05_remaining_quota_math',
        name: 'RemainingQuotaMathMutator',
        file: 'src/main/java/com/distributed/ratelimiter/SlidingWindowRateLimiter.java',
        line: 59,
        mutatedContent: `package com.distributed.ratelimiter;
import java.time.*;
public final class SlidingWindowRateLimiter {
    public sealed interface RateLimiterState permits RateLimiterState.AllowedState, RateLimiterState.ThrottledState, RateLimiterState.RejectedState, RateLimiterState.CooldownResetState {
        long currentCount(); Instant windowStart(); boolean isPermitted();
        record AllowedState(long currentCount, long remainingQuota, Instant windowStart) implements RateLimiterState { public boolean isPermitted() { return true; } }
        record ThrottledState(long currentCount, long burstRemaining, Duration suggestedBackoff, Instant windowStart) implements RateLimiterState { public boolean isPermitted() { return true; } }
        record RejectedState(long currentCount, Duration retryAfter, Instant windowStart) implements RateLimiterState { public boolean isPermitted() { return false; } }
        record CooldownResetState(long replenishedQuota, Instant windowStart) implements RateLimiterState { public long currentCount() { return 0; } public boolean isPermitted() { return true; } }
    }
    public SlidingWindowRateLimiter(long bq, long bc, Duration wd, Duration bb, Instant t0) {}
    public RateLimiterState evaluate(Instant t) {
        // MUTANT: adds count to quota!
        return new RateLimiterState.AllowedState(1, 4, t);
    }
}`
      }
    ]
  },

  // =========================================================================
  // 5. Distributed Checkout Saga Orchestrator & Compensating Transactions
  // =========================================================================
  {
    id: 'kata_test_distributed_saga_orchestrator',
    slug: 'kata-test-distributed-saga-orchestrator',
    title: 'KATA-TEST-24: Distributed Saga Orchestrator (LIFO Compensations)',
    category: 'testing_mutation',
    track: 'testing_mutation',
    badge: '🧬 Saga Orchestrator',
    difficulty: 'Senior',
    targetStack: 'Java 21 LTS, Mockito 5 InOrder, Deque',
    timeLimitMinutes: 45,
    shortDescription: 'Тестирование отката распределенной транзакции в строгом LIFO-порядке с гарантией идемпотентности.',
    instructionsMarkdown: `### 🎯 Инженерная задача
Оркестратор распределенной саги оформления заказа **OrderSagaOrchestrator** выполняет цепочку шагов:
1. Авторизация платежа (\`PaymentService.authorize\`) $\\to$ \`PaymentAuthorizedState\`
2. Резервирование товаров (\`InventoryService.reserve\`) $\\to$ \`InventoryReservedState\`
3. Бронирование доставки (\`ShipmentService.book\`) $\\to$ \`ShipmentBookedState\`
4. Завершение саги $\\to$ \`Completed\`

**Инварианты компенсации (Rollback):**
- При сбое на любом шаге сага переходит в \`CompensatingState\` и откатывает успешно выполненные шаги в **строго обратном порядке (LIFO)**.
- Каждый шаг компенсации снабжен детерминированным ключом идемпотентности (\`orderId:compensate:step\`).
- Если один из шагов компенсации бросает ошибку, оркестратор обязан подавить её и **не прекращать откат остальных сервисов** (\`CompensationFailedState\`).

### 🧪 Ваша цель
В \`OrderSagaOrchestratorTest.java\` протестируйте сценарии саги, уничтожив всех 5 мутантов:
1. **Mutant 1 (FifoCompensationOrder):** Изменение порядка отката с LIFO на FIFO.
2. **Mutant 2 (OmitPaymentCompensation):** Пропуск отката платежа при сбое резервирования склада.
3. **Mutant 3 (IdempotencyCheckNegate):** Повторный вызов уже скомпенсированного сервиса.
4. **Mutant 4 (AbandonCompensationsOnError):** Прекращение отката остальных систем при ошибке в одной из них.
5. **Mutant 5 (TerminalCancelledStateOmission):** Возврат \`null\` вместо \`CancelledWithCompensation\`.`,
    workspaceFiles: [
      {
        path: 'src/main/java/com/distributed/saga/OrderSagaOrchestrator.java',
        content: `package com.distributed.saga;

import java.math.BigDecimal;
import java.util.*;

public final class OrderSagaOrchestrator {

    public record OrderItem(String sku, int quantity) {}
    public record OrderContext(String orderId, BigDecimal amount, List<OrderItem> items, String address) {}
    public record PaymentAuth(String txId) {}
    public record Reservation(String resId) {}
    public record ShipmentBooking(String trackingNo) {}

    public sealed interface SagaState permits 
            SagaState.PendingPayment,
            SagaState.PaymentAuthorizedState,
            SagaState.InventoryReservedState,
            SagaState.Completed,
            SagaState.CancelledWithCompensation,
            SagaState.CompensationFailedState {

        record PendingPayment(OrderContext context) implements SagaState {}
        record PaymentAuthorizedState(OrderContext context, PaymentAuth auth) implements SagaState {}
        record InventoryReservedState(OrderContext context, PaymentAuth auth, Reservation res) implements SagaState {}
        record Completed(OrderContext context) implements SagaState {}
        record CancelledWithCompensation(OrderContext context, String reason, List<String> compensations) implements SagaState {}
        record CompensationFailedState(OrderContext context, String reason, List<String> compensations, List<Throwable> errors) implements SagaState {}
    }

    public interface PaymentService {
        PaymentAuth authorize(String orderId, BigDecimal amount);
        void refund(String orderId, String txId, String idempotencyKey);
    }
    public interface InventoryService {
        Reservation reserve(String orderId, List<OrderItem> items);
        void release(String orderId, String resId, String idempotencyKey);
    }
    public interface ShipmentService {
        ShipmentBooking book(String orderId, String address);
        void cancel(String orderId, String trackingNo, String idempotencyKey);
    }

    @FunctionalInterface
    public interface CompensationAction { void execute() throws Exception; }
    public record CompensationStep(String stepKey, CompensationAction action) {}

    private final PaymentService paymentService;
    private final InventoryService inventoryService;
    private final ShipmentService shipmentService;
    private final Set<String> executedKeys = Collections.synchronizedSet(new HashSet<>());

    public OrderSagaOrchestrator(PaymentService p, InventoryService i, ShipmentService s) {
        this.paymentService = Objects.requireNonNull(p);
        this.inventoryService = Objects.requireNonNull(i);
        this.shipmentService = Objects.requireNonNull(s);
    }

    public SagaState execute(OrderContext context) {
        Deque<CompensationStep> stack = new ArrayDeque<>();
        try {
            PaymentAuth auth = paymentService.authorize(context.orderId(), context.amount());
            stack.push(new CompensationStep(context.orderId() + ":compensate:payment", () -> paymentService.refund(context.orderId(), auth.txId(), context.orderId() + ":compensate:payment")));

            Reservation res = inventoryService.reserve(context.orderId(), context.items());
            stack.push(new CompensationStep(context.orderId() + ":compensate:inventory", () -> inventoryService.release(context.orderId(), res.resId(), context.orderId() + ":compensate:inventory")));

            ShipmentBooking shipment = shipmentService.book(context.orderId(), context.address());
            stack.push(new CompensationStep(context.orderId() + ":compensate:shipment", () -> shipmentService.cancel(context.orderId(), shipment.trackingNo(), context.orderId() + ":compensate:shipment")));

            return new SagaState.Completed(context);
        } catch (Exception e) {
            return runCompensations(context, stack, e.getMessage());
        }
    }

    public SagaState runCompensations(OrderContext ctx, Deque<CompensationStep> stack, String reason) {
        List<String> executed = new ArrayList<>();
        List<Throwable> errors = new ArrayList<>();

        while (!stack.isEmpty()) {
            CompensationStep step = stack.pop(); // LIFO
            if (executedKeys.contains(step.stepKey())) continue;

            try {
                step.action().execute();
                executedKeys.add(step.stepKey());
                executed.add(step.stepKey());
            } catch (Exception ex) {
                errors.add(ex);
            }
        }

        if (!errors.isEmpty()) {
            return new SagaState.CompensationFailedState(ctx, reason, executed, errors);
        }
        return new SagaState.CancelledWithCompensation(ctx, reason, executed);
    }
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/test/java/com/distributed/saga/OrderSagaOrchestratorTest.java',
        content: `package com.distributed.saga;

import com.distributed.saga.OrderSagaOrchestrator.*;
import com.distributed.saga.OrderSagaOrchestrator.SagaState.*;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import java.math.BigDecimal;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.List;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OrderSagaOrchestratorTest {

    @Mock private PaymentService paymentService;
    @Mock private InventoryService inventoryService;
    @Mock private ShipmentService shipmentService;

    @Test
    @DisplayName("Should invoke reverse compensations in strict LIFO order on shipment failure (Kills M1, M5)")
    void shouldCompensateInReverseOrder() {
        when(paymentService.authorize(anyString(), any())).thenReturn(new PaymentAuth("tx-1"));
        when(inventoryService.reserve(anyString(), any())).thenReturn(new Reservation("res-1"));
        when(shipmentService.book(anyString(), any())).thenThrow(new RuntimeException("Courier offline"));

        var orchestrator = new OrderSagaOrchestrator(paymentService, inventoryService, shipmentService);
        var ctx = new OrderContext("ord-1", new BigDecimal("100.00"), List.of(), "Addr");

        SagaState res = orchestrator.execute(ctx);
        assertThat(res).isInstanceOf(CancelledWithCompensation.class);

        InOrder inOrder = inOrder(shipmentService, inventoryService, paymentService);
        inOrder.verify(inventoryService).release(eq("ord-1"), eq("res-1"), anyString());
        inOrder.verify(paymentService).refund(eq("ord-1"), eq("tx-1"), anyString());
        inOrder.verifyNoMoreInteractions();
    }

    @Test
    @DisplayName("Should compensate payment when inventory fails (Kills M2)")
    void shouldCompensatePaymentWhenInventoryFails() {
        when(paymentService.authorize(anyString(), any())).thenReturn(new PaymentAuth("tx-2"));
        when(inventoryService.reserve(anyString(), any())).thenThrow(new RuntimeException("Out of stock"));

        var orchestrator = new OrderSagaOrchestrator(paymentService, inventoryService, shipmentService);
        var ctx = new OrderContext("ord-2", new BigDecimal("50.00"), List.of(), "Addr");

        SagaState res = orchestrator.execute(ctx);
        assertThat(res).isInstanceOf(CancelledWithCompensation.class);
        verify(paymentService, times(1)).refund(eq("ord-2"), eq("tx-2"), anyString());
        verifyNoInteractions(shipmentService);
    }

    @Test
    @DisplayName("Should enforce idempotent compensation execution across retries (Kills M3)")
    void shouldEnforceIdempotency() {
        var orchestrator = new OrderSagaOrchestrator(paymentService, inventoryService, shipmentService);
        var ctx = new OrderContext("ord-3", new BigDecimal("50.00"), List.of(), "Addr");

        Deque<CompensationStep> stack1 = new ArrayDeque<>();
        stack1.push(new CompensationStep("ord-3:compensate:payment", () -> paymentService.refund("ord-3", "t3", "ord-3:compensate:payment")));
        orchestrator.runCompensations(ctx, stack1, "Err");

        Deque<CompensationStep> stack2 = new ArrayDeque<>();
        stack2.push(new CompensationStep("ord-3:compensate:payment", () -> paymentService.refund("ord-3", "t3", "ord-3:compensate:payment")));
        orchestrator.runCompensations(ctx, stack2, "Err");

        verify(paymentService, times(1)).refund(anyString(), anyString(), anyString());
    }

    @Test
    @DisplayName("Should not abandon remaining compensations when one step fails (Kills M4)")
    void shouldNotAbandonCompensationsOnError() {
        doThrow(new RuntimeException("Inventory release failed")).when(inventoryService).release(anyString(), anyString(), anyString());

        var orchestrator = new OrderSagaOrchestrator(paymentService, inventoryService, shipmentService);
        var ctx = new OrderContext("ord-4", new BigDecimal("10.00"), List.of(), "Addr");

        Deque<CompensationStep> stack = new ArrayDeque<>();
        stack.push(new CompensationStep("ord-4:compensate:payment", () -> paymentService.refund("ord-4", "t4", "k-pay")));
        stack.push(new CompensationStep("ord-4:compensate:inventory", () -> inventoryService.release("ord-4", "r4", "k-inv")));

        SagaState res = orchestrator.runCompensations(ctx, stack, "Failure");
        assertThat(res).isInstanceOf(CompensationFailedState.class);

        // Payment refund must have been executed even though inventory release threw an exception!
        verify(paymentService, times(1)).refund(anyString(), anyString(), anyString());
    }
}`,
        readOnly: false,
        hidden: false,
        isMainEntryPoint: true
      }
    ],
    mutants: [
      {
        id: 'mutant_sgo_01_fifo_order',
        name: 'FifoCompensationOrderMutator',
        file: 'src/main/java/com/distributed/saga/OrderSagaOrchestrator.java',
        line: 69,
        mutatedContent: `package com.distributed.saga;
import java.math.BigDecimal; import java.util.*;
public final class OrderSagaOrchestrator {
    public record OrderItem(String s, int q) {} public record OrderContext(String orderId, BigDecimal a, List<OrderItem> items, String ad) {}
    public record PaymentAuth(String txId) {} public record Reservation(String resId) {} public record ShipmentBooking(String t) {}
    public sealed interface SagaState permits SagaState.Completed, SagaState.CancelledWithCompensation, SagaState.CompensationFailedState {
        record Completed() implements SagaState {}
        record CancelledWithCompensation(List<String> c) implements SagaState {}
        record CompensationFailedState() implements SagaState {}
    }
    public interface PaymentService { PaymentAuth authorize(String o, BigDecimal a); void refund(String o, String t, String k); }
    public interface InventoryService { Reservation reserve(String o, List<OrderItem> i); void release(String o, String r, String k); }
    public interface ShipmentService { ShipmentBooking book(String o, String a); void cancel(String o, String t, String k); }
    private final PaymentService paymentService; private final InventoryService inventoryService; private final ShipmentService shipmentService;
    public OrderSagaOrchestrator(PaymentService p, InventoryService i, ShipmentService s) { this.paymentService = p; this.inventoryService = i; this.shipmentService = s; }
    public SagaState execute(OrderContext ctx) {
        // MUTANT: executes FIFO (payment first, then inventory)!
        paymentService.refund("ord-1", "tx-1", "k");
        inventoryService.release("ord-1", "res-1", "k");
        return new SagaState.CancelledWithCompensation(List.of());
    }
}`
      },
      {
        id: 'mutant_sgo_02_omit_payment',
        name: 'OmitPaymentCompensationMutator',
        file: 'src/main/java/com/distributed/saga/OrderSagaOrchestrator.java',
        line: 55,
        mutatedContent: `package com.distributed.saga;
import java.math.BigDecimal; import java.util.*;
public final class OrderSagaOrchestrator {
    public record OrderItem(String s, int q) {} public record OrderContext(String orderId, BigDecimal a, List<OrderItem> items, String ad) {}
    public record PaymentAuth(String txId) {} public record Reservation(String resId) {} public record ShipmentBooking(String t) {}
    public sealed interface SagaState permits SagaState.Completed, SagaState.CancelledWithCompensation, SagaState.CompensationFailedState {
        record Completed() implements SagaState {}
        record CancelledWithCompensation() implements SagaState {}
        record CompensationFailedState() implements SagaState {}
    }
    public interface PaymentService { PaymentAuth authorize(String o, BigDecimal a); void refund(String o, String t, String k); }
    public interface InventoryService { Reservation reserve(String o, List<OrderItem> i); void release(String o, String r, String k); }
    public interface ShipmentService { ShipmentBooking book(String o, String a); void cancel(String o, String t, String k); }
    public OrderSagaOrchestrator(PaymentService p, InventoryService i, ShipmentService s) {}
    public SagaState execute(OrderContext ctx) {
        // MUTANT: does not refund payment on inventory error!
        return new SagaState.CancelledWithCompensation();
    }
}`
      },
      {
        id: 'mutant_sgo_03_idempotency_negate',
        name: 'IdempotencyCheckNegateMutator',
        file: 'src/main/java/com/distributed/saga/OrderSagaOrchestrator.java',
        line: 70,
        mutatedContent: `package com.distributed.saga;
import java.math.BigDecimal; import java.util.*;
public final class OrderSagaOrchestrator {
    public record OrderItem(String s, int q) {} public record OrderContext(String orderId, BigDecimal a, List<OrderItem> items, String ad) {}
    public record PaymentAuth(String txId) {} public record Reservation(String resId) {} public record ShipmentBooking(String t) {}
    public sealed interface SagaState permits SagaState.Completed, SagaState.CancelledWithCompensation, SagaState.CompensationFailedState {
        record Completed() implements SagaState {}
        record CancelledWithCompensation() implements SagaState {}
        record CompensationFailedState() implements SagaState {}
    }
    public interface PaymentService { PaymentAuth authorize(String o, BigDecimal a); void refund(String o, String t, String k); }
    public interface InventoryService { Reservation reserve(String o, List<OrderItem> i); void release(String o, String r, String k); }
    public interface ShipmentService { ShipmentBooking book(String o, String a); void cancel(String o, String t, String k); }
    @FunctionalInterface public interface CompensationAction { void execute() throws Exception; }
    public record CompensationStep(String stepKey, CompensationAction action) {}
    public OrderSagaOrchestrator(PaymentService p, InventoryService i, ShipmentService s) {}
    public SagaState runCompensations(OrderContext ctx, Deque<CompensationStep> stack, String r) {
        // MUTANT: executes action unconditionally without idempotency check!
        while (!stack.isEmpty()) {
            try { stack.pop().action().execute(); } catch (Exception ignored) {}
        }
        return new SagaState.CancelledWithCompensation();
    }
}`
      },
      {
        id: 'mutant_sgo_04_abandon_on_error',
        name: 'AbandonCompensationsOnErrorMutator',
        file: 'src/main/java/com/distributed/saga/OrderSagaOrchestrator.java',
        line: 77,
        mutatedContent: `package com.distributed.saga;
import java.math.BigDecimal; import java.util.*;
public final class OrderSagaOrchestrator {
    public record OrderItem(String s, int q) {} public record OrderContext(String orderId, BigDecimal a, List<OrderItem> items, String ad) {}
    public record PaymentAuth(String txId) {} public record Reservation(String resId) {} public record ShipmentBooking(String t) {}
    public sealed interface SagaState permits SagaState.Completed, SagaState.CancelledWithCompensation, SagaState.CompensationFailedState {
        record Completed() implements SagaState {}
        record CancelledWithCompensation() implements SagaState {}
        record CompensationFailedState(OrderContext ctx, String reason, List<String> c, List<Throwable> e) implements SagaState {}
    }
    public interface PaymentService { PaymentAuth authorize(String o, BigDecimal a); void refund(String o, String t, String k); }
    public interface InventoryService { Reservation reserve(String o, List<OrderItem> i); void release(String o, String r, String k); }
    public interface ShipmentService { ShipmentBooking book(String o, String a); void cancel(String o, String t, String k); }
    @FunctionalInterface public interface CompensationAction { void execute() throws Exception; }
    public record CompensationStep(String stepKey, CompensationAction action) {}
    public OrderSagaOrchestrator(PaymentService p, InventoryService i, ShipmentService s) {}
    public SagaState runCompensations(OrderContext ctx, Deque<CompensationStep> stack, String reason) {
        // MUTANT: stops loop on first error, abandoning remaining steps!
        while (!stack.isEmpty()) {
            try { stack.pop().action().execute(); }
            catch (Exception ex) { return new SagaState.CompensationFailedState(ctx, reason, List.of(), List.of(ex)); }
        }
        return new SagaState.CompensationFailedState(ctx, reason, List.of(), List.of());
    }
}`
      },
      {
        id: 'mutant_sgo_05_return_null',
        name: 'TerminalCancelledStateOmissionMutator',
        file: 'src/main/java/com/distributed/saga/OrderSagaOrchestrator.java',
        line: 85,
        mutatedContent: `package com.distributed.saga;
import java.math.BigDecimal; import java.util.*;
public final class OrderSagaOrchestrator {
    public record OrderItem(String s, int q) {} public record OrderContext(String orderId, BigDecimal a, List<OrderItem> items, String ad) {}
    public record PaymentAuth(String txId) {} public record Reservation(String resId) {} public record ShipmentBooking(String t) {}
    public sealed interface SagaState permits SagaState.Completed, SagaState.CancelledWithCompensation, SagaState.CompensationFailedState {
        record Completed() implements SagaState {}
        record CancelledWithCompensation() implements SagaState {}
        record CompensationFailedState() implements SagaState {}
    }
    public interface PaymentService { PaymentAuth authorize(String o, BigDecimal a); void refund(String o, String t, String k); }
    public interface InventoryService { Reservation reserve(String o, List<OrderItem> i); void release(String o, String r, String k); }
    public interface ShipmentService { ShipmentBooking book(String o, String a); void cancel(String o, String t, String k); }
    public OrderSagaOrchestrator(PaymentService p, InventoryService i, ShipmentService s) {}
    public SagaState execute(OrderContext ctx) {
        // MUTANT: returns null on rollback!
        return null;
    }
}`
      }
    ]
  }
];
