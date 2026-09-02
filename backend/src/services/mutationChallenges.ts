import { CodingChallenge } from './challengeSeedData';

export const MUTATION_TESTING_CHALLENGES: CodingChallenge[] = [
  // =========================================================================
  // АРХЕТИП 1: Legacy Seams & Approval Testing
  // =========================================================================
  {
    id: 'kata_test_trip_service_seam',
    slug: 'kata-test-trip-service-seam',
    title: 'KATA-TEST-01: TripService Decoupling (Subclass & Override Seam)',
    category: 'testing_mutation',
    track: 'testing_mutation',
    badge: '🧬 Seam Decoupling',
    difficulty: 'Senior',
    targetStack: 'Java 21 LTS, JUnit 5, AssertJ',
    timeLimitMinutes: 45,
    shortDescription: 'Изоляция статического UserSession и TripDAO через Subclass and Override без изменения публичного API.',
    instructionsMarkdown: `### 🎯 Инженерная задача
Перед вами канонический класс **TripService** (Sandro Mancuso). 
Код сервиса **зафиксирован и доступен только для чтения**. В нём присутствуют две скрытые статические зависимости:
- \`UserSession.getInstance().getLoggedUser()\` — выбрасывает \`CollaboratorCallException\`, если вызывается вне веб-контейнера.
- \`TripDAO.findTripsByUser(user)\` — выбрасывает \`CollaboratorCallException\`, если вызывается без подключения к БД.

### 🧪 Ваша цель
В файле \`TripServiceTest.java\` напишите тесты на JUnit 5, создав локальный класс-наследник (шов *Subclass and Override*), переопределяющий \`getLoggedUser()\` и \`findTrips()\`.

Уничтожьте **все 5 скрытых мутантов** (Целевой Mutation Score: **100%**, минимум $\\ge 85\\%$):
1. **Mutant 1 (NegateSessionCheck):** Инверсия проверки авторизации.
2. **Mutant 2 (FriendLoopBreak):** Пропуск поиска друзей в цикле.
3. **Mutant 3 (ReturnEmptyOnFriend):** Возврат пустого списка вместо вызова DAO при совпадении друга.
4. **Mutant 4 (CollaboratorOmission):** Удаление вызова DAO.
5. **Mutant 5 (AlwaysThrowNotLoggedIn):** Выброс исключения независимо от сессии.`,
    workspaceFiles: [
      {
        path: 'src/main/java/com/assessment/legacy/User.java',
        content: `package com.assessment.legacy;
import java.util.ArrayList;
import java.util.List;

public class User {
    private final String name;
    private final List<User> friends = new ArrayList<>();

    public User(String name) {
        this.name = name;
    }

    public String getName() {
        return name;
    }

    public List<User> getFriends() {
        return friends;
    }

    public void addFriend(User friend) {
        friends.add(friend);
    }
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/main/java/com/assessment/legacy/Trip.java',
        content: `package com.assessment.legacy;

public record Trip(String destination) {}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/main/java/com/assessment/legacy/CollaboratorCallException.java',
        content: `package com.assessment.legacy;

public class CollaboratorCallException extends RuntimeException {
    public CollaboratorCallException(String message) {
        super(message);
    }
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/main/java/com/assessment/legacy/UserSession.java',
        content: `package com.assessment.legacy;

public class UserSession {
    private static final UserSession INSTANCE = new UserSession();

    private UserSession() {}

    public static UserSession getInstance() {
        return INSTANCE;
    }

    public User getLoggedUser() {
        throw new CollaboratorCallException("UserSession.getLoggedUser() cannot be called in unit tests!");
    }
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/main/java/com/assessment/legacy/TripDAO.java',
        content: `package com.assessment.legacy;
import java.util.List;

public class TripDAO {
    public static List<Trip> findTripsByUser(User user) {
        throw new CollaboratorCallException("TripDAO.findTripsByUser() cannot be called in unit tests!");
    }
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/main/java/com/assessment/legacy/TripService.java',
        content: `package com.assessment.legacy;
import java.util.ArrayList;
import java.util.List;

public class TripService {

    public List<Trip> getTripsByUser(User user) {
        User loggedUser = getLoggedUser();
        boolean isFriend = false;

        if (loggedUser != null) {
            for (User friend : user.getFriends()) {
                if (friend.equals(loggedUser)) {
                    isFriend = true;
                    break;
                }
            }
            if (isFriend) {
                return findTrips(user);
            }
            return new ArrayList<>();
        } else {
            throw new CollaboratorCallException("User not logged in");
        }
    }

    // Seams to be overridden in tests
    protected User getLoggedUser() {
        return UserSession.getInstance().getLoggedUser();
    }

    protected List<Trip> findTrips(User user) {
        return TripDAO.findTripsByUser(user);
    }
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/test/java/com/assessment/legacy/TripServiceTest.java',
        content: `package com.assessment.legacy;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import java.util.ArrayList;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

public class TripServiceTest {

    // TODO: Implement Subclass and Override test class and write tests to kill all 5 mutants!

    @Test
    @DisplayName("Should throw exception when user is not logged in")
    public void shouldThrowExceptionWhenUserNotLoggedIn() {
        TestableTripService service = new TestableTripService(null, new ArrayList<>());
        User target = new User("TargetUser");

        assertThrows(CollaboratorCallException.class, () -> {
            service.getTripsByUser(target);
        });
    }

    static class TestableTripService extends TripService {
        private final User loggedUser;
        private final List<Trip> trips;

        public TestableTripService(User loggedUser, List<Trip> trips) {
            this.loggedUser = loggedUser;
            this.trips = trips;
        }

        @Override
        protected User getLoggedUser() {
            return loggedUser;
        }

        @Override
        protected List<Trip> findTrips(User user) {
            return trips;
        }
    }
}`,
        readOnly: false,
        hidden: false,
        isMainEntryPoint: true
      }
    ],
    mutants: [
      {
        id: 'mutant_trip_01_negate_session',
        name: 'NegateSessionCheckMutator',
        file: 'src/main/java/com/assessment/legacy/TripService.java',
        line: 11,
        mutatedContent: `package com.assessment.legacy;
import java.util.ArrayList;
import java.util.List;

public class TripService {
    public List<Trip> getTripsByUser(User user) {
        User loggedUser = getLoggedUser();
        boolean isFriend = false;
        if (loggedUser == null) { // MUTANT: == instead of !=
            for (User friend : user.getFriends()) {
                if (friend.equals(loggedUser)) { isFriend = true; break; }
            }
            if (isFriend) return findTrips(user);
            return new ArrayList<>();
        } else {
            throw new CollaboratorCallException("User not logged in");
        }
    }
    protected User getLoggedUser() { return UserSession.getInstance().getLoggedUser(); }
    protected List<Trip> findTrips(User user) { return TripDAO.findTripsByUser(user); }
}`
      },
      {
        id: 'mutant_trip_02_friend_loop',
        name: 'FriendLoopBreakMutator',
        file: 'src/main/java/com/assessment/legacy/TripService.java',
        line: 13,
        mutatedContent: `package com.assessment.legacy;
import java.util.ArrayList;
import java.util.List;

public class TripService {
    public List<Trip> getTripsByUser(User user) {
        User loggedUser = getLoggedUser();
        boolean isFriend = false;
        if (loggedUser != null) {
            // MUTANT: Loop bypassed, isFriend remains false
            if (isFriend) return findTrips(user);
            return new ArrayList<>();
        } else {
            throw new CollaboratorCallException("User not logged in");
        }
    }
    protected User getLoggedUser() { return UserSession.getInstance().getLoggedUser(); }
    protected List<Trip> findTrips(User user) { return TripDAO.findTripsByUser(user); }
}`
      },
      {
        id: 'mutant_trip_03_return_empty',
        name: 'ReturnEmptyOnFriendMutator',
        file: 'src/main/java/com/assessment/legacy/TripService.java',
        line: 20,
        mutatedContent: `package com.assessment.legacy;
import java.util.ArrayList;
import java.util.List;

public class TripService {
    public List<Trip> getTripsByUser(User user) {
        User loggedUser = getLoggedUser();
        boolean isFriend = false;
        if (loggedUser != null) {
            for (User friend : user.getFriends()) {
                if (friend.equals(loggedUser)) { isFriend = true; break; }
            }
            return new ArrayList<>(); // MUTANT: returns empty even for friends
        } else {
            throw new CollaboratorCallException("User not logged in");
        }
    }
    protected User getLoggedUser() { return UserSession.getInstance().getLoggedUser(); }
    protected List<Trip> findTrips(User user) { return TripDAO.findTripsByUser(user); }
}`
      },
      {
        id: 'mutant_trip_04_dao_omission',
        name: 'VoidDaoCallMutator',
        file: 'src/main/java/com/assessment/legacy/TripService.java',
        line: 21,
        mutatedContent: `package com.assessment.legacy;
import java.util.ArrayList;
import java.util.List;

public class TripService {
    public List<Trip> getTripsByUser(User user) {
        User loggedUser = getLoggedUser();
        boolean isFriend = false;
        if (loggedUser != null) {
            for (User friend : user.getFriends()) {
                if (friend.equals(loggedUser)) { isFriend = true; break; }
            }
            if (isFriend) return List.of(new Trip("FakeMutantCity")); // MUTANT: wrong trips
            return new ArrayList<>();
        } else {
            throw new CollaboratorCallException("User not logged in");
        }
    }
    protected User getLoggedUser() { return UserSession.getInstance().getLoggedUser(); }
    protected List<Trip> findTrips(User user) { return TripDAO.findTripsByUser(user); }
}`
      },
      {
        id: 'mutant_trip_05_always_throw',
        name: 'AlwaysThrowMutator',
        file: 'src/main/java/com/assessment/legacy/TripService.java',
        line: 25,
        mutatedContent: `package com.assessment.legacy;
import java.util.ArrayList;
import java.util.List;

public class TripService {
    public List<Trip> getTripsByUser(User user) {
        throw new CollaboratorCallException("User not logged in"); // MUTANT: always throws
    }
    protected User getLoggedUser() { return UserSession.getInstance().getLoggedUser(); }
    protected List<Trip> findTrips(User user) { return TripDAO.findTripsByUser(user); }
}`
      }
    ]
  },

  // =========================================================================
  // АРХЕТИП 2: Advanced JUnit 5 & Parametric Testing
  // =========================================================================
  {
    id: 'kata_test_financial_tx_validator',
    slug: 'kata-test-financial-tx-validator',
    title: 'KATA-TEST-04: Financial Transaction Validator (@ParameterizedTest)',
    category: 'testing_mutation',
    track: 'testing_mutation',
    badge: '🧬 Parameterized',
    difficulty: 'Senior',
    targetStack: 'Java 21 LTS, JUnit 5, AssertJ, BigDecimal',
    timeLimitMinutes: 40,
    shortDescription: 'Параметризованное тестирование граничных условий финансовых переводов на BigDecimal.',
    instructionsMarkdown: `### 🎯 Инженерная задача
Банковский сервис валидации транзакций **TransactionValidator** проверяет правила переводов:
- Сумма перевода обязана быть строго $> 0.00$.
- Максимальный разовый лимит составляет ровно $10000.00$ включительно.
- Валюта обязана быть одной из поддерживаемых (\`RUB\`, \`USD\`, \`EUR\`).
- Баланс отправителя после списания комиссии (1%) не может быть отрицательным.

### 🧪 Ваша цель
В файле \`TransactionValidatorTest.java\` напишите параметризованный тест-сьют, уничтожающий всех 5 мутантов:
1. **Mutant 1 (ZeroBoundary):** Замена строгого $> 0$ на $\ge 0$ (пропуск нулевой суммы).
2. **Mutant 2 (MaxLimitBoundary):** Замена $\le 10000$ на $< 10000$ (отказ на сумме ровно 10000.00).
3. **Mutant 3 (FeeMath):** Расчет комиссии $0.05$ вместо $0.01$.
4. **Mutant 4 (CurrencyNegate):** Инверсия валидации валюты.
5. **Mutant 5 (BalanceCheckOmission):** Пропуск проверки остатка баланса.`,
    workspaceFiles: [
      {
        path: 'src/main/java/com/assessment/fintech/ValidationResult.java',
        content: `package com.assessment.fintech;

public record ValidationResult(boolean isValid, String reason) {
    public static ValidationResult valid() {
        return new ValidationResult(true, "OK");
    }
    public static ValidationResult invalid(String reason) {
        return new ValidationResult(false, reason);
    }
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/main/java/com/assessment/fintech/TransactionValidator.java',
        content: `package com.assessment.fintech;

import java.math.BigDecimal;
import java.util.Set;

public class TransactionValidator {
    private static final BigDecimal MAX_LIMIT = new BigDecimal("10000.00");
    private static final BigDecimal FEE_RATE = new BigDecimal("0.01");
    private static final Set<String> ALLOWED_CURRENCIES = Set.of("RUB", "USD", "EUR");

    public ValidationResult validate(BigDecimal amount, String currency, BigDecimal senderBalance) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            return ValidationResult.invalid("Amount must be strictly positive");
        }
        if (amount.compareTo(MAX_LIMIT) > 0) {
            return ValidationResult.invalid("Amount exceeds single transaction limit");
        }
        if (currency == null || !ALLOWED_CURRENCIES.contains(currency)) {
            return ValidationResult.invalid("Unsupported currency: " + currency);
        }
        BigDecimal fee = amount.multiply(FEE_RATE);
        BigDecimal totalRequired = amount.add(fee);
        if (senderBalance == null || senderBalance.compareTo(totalRequired) < 0) {
            return ValidationResult.invalid("Insufficient funds including fee");
        }
        return ValidationResult.valid();
    }
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/test/java/com/assessment/fintech/TransactionValidatorTest.java',
        content: `package com.assessment.fintech;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import java.math.BigDecimal;
import static org.junit.jupiter.api.Assertions.*;

public class TransactionValidatorTest {

    private final TransactionValidator validator = new TransactionValidator();

    @Test
    @DisplayName("Should accept valid transaction")
    public void shouldAcceptValidTransaction() {
        ValidationResult res = validator.validate(new BigDecimal("100.00"), "RUB", new BigDecimal("500.00"));
        assertTrue(res.isValid());
    }

    // TODO: Write boundary tests to kill all 5 mutants!
}`,
        readOnly: false,
        hidden: false,
        isMainEntryPoint: true
      }
    ],
    mutants: [
      {
        id: 'mutant_tx_01_zero_boundary',
        name: 'ZeroBoundaryMutator',
        file: 'src/main/java/com/assessment/fintech/TransactionValidator.java',
        line: 12,
        mutatedContent: `package com.assessment.fintech;
import java.math.BigDecimal;
import java.util.Set;

public class TransactionValidator {
    private static final BigDecimal MAX_LIMIT = new BigDecimal("10000.00");
    private static final BigDecimal FEE_RATE = new BigDecimal("0.01");
    private static final Set<String> ALLOWED_CURRENCIES = Set.of("RUB", "USD", "EUR");

    public ValidationResult validate(BigDecimal amount, String currency, BigDecimal senderBalance) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) < 0) { // MUTANT: < 0 allows 0.00!
            return ValidationResult.invalid("Amount must be strictly positive");
        }
        if (amount.compareTo(MAX_LIMIT) > 0) return ValidationResult.invalid("Amount exceeds limit");
        if (currency == null || !ALLOWED_CURRENCIES.contains(currency)) return ValidationResult.invalid("Bad currency");
        BigDecimal fee = amount.multiply(FEE_RATE);
        BigDecimal totalRequired = amount.add(fee);
        if (senderBalance == null || senderBalance.compareTo(totalRequired) < 0) return ValidationResult.invalid("No funds");
        return ValidationResult.valid();
    }
}`
      },
      {
        id: 'mutant_tx_02_max_limit_boundary',
        name: 'MaxLimitBoundaryMutator',
        file: 'src/main/java/com/assessment/fintech/TransactionValidator.java',
        line: 15,
        mutatedContent: `package com.assessment.fintech;
import java.math.BigDecimal;
import java.util.Set;

public class TransactionValidator {
    private static final BigDecimal MAX_LIMIT = new BigDecimal("10000.00");
    private static final BigDecimal FEE_RATE = new BigDecimal("0.01");
    private static final Set<String> ALLOWED_CURRENCIES = Set.of("RUB", "USD", "EUR");

    public ValidationResult validate(BigDecimal amount, String currency, BigDecimal senderBalance) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) return ValidationResult.invalid("Bad amount");
        if (amount.compareTo(MAX_LIMIT) >= 0) { // MUTANT: rejects 10000.00 exactly!
            return ValidationResult.invalid("Amount exceeds single transaction limit");
        }
        if (currency == null || !ALLOWED_CURRENCIES.contains(currency)) return ValidationResult.invalid("Bad currency");
        BigDecimal fee = amount.multiply(FEE_RATE);
        BigDecimal totalRequired = amount.add(fee);
        if (senderBalance == null || senderBalance.compareTo(totalRequired) < 0) return ValidationResult.invalid("No funds");
        return ValidationResult.valid();
    }
}`
      },
      {
        id: 'mutant_tx_03_fee_math',
        name: 'FeeRateMathMutator',
        file: 'src/main/java/com/assessment/fintech/TransactionValidator.java',
        line: 21,
        mutatedContent: `package com.assessment.fintech;
import java.math.BigDecimal;
import java.util.Set;

public class TransactionValidator {
    private static final BigDecimal MAX_LIMIT = new BigDecimal("10000.00");
    private static final BigDecimal FEE_RATE = new BigDecimal("0.05"); // MUTANT: 5% fee instead of 1%
    private static final Set<String> ALLOWED_CURRENCIES = Set.of("RUB", "USD", "EUR");

    public ValidationResult validate(BigDecimal amount, String currency, BigDecimal senderBalance) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) return ValidationResult.invalid("Bad amount");
        if (amount.compareTo(MAX_LIMIT) > 0) return ValidationResult.invalid("Exceeds limit");
        if (currency == null || !ALLOWED_CURRENCIES.contains(currency)) return ValidationResult.invalid("Bad currency");
        BigDecimal fee = amount.multiply(FEE_RATE);
        BigDecimal totalRequired = amount.add(fee);
        if (senderBalance == null || senderBalance.compareTo(totalRequired) < 0) return ValidationResult.invalid("No funds");
        return ValidationResult.valid();
    }
}`
      },
      {
        id: 'mutant_tx_04_currency_negate',
        name: 'CurrencyNegateMutator',
        file: 'src/main/java/com/assessment/fintech/TransactionValidator.java',
        line: 18,
        mutatedContent: `package com.assessment.fintech;
import java.math.BigDecimal;
import java.util.Set;

public class TransactionValidator {
    private static final BigDecimal MAX_LIMIT = new BigDecimal("10000.00");
    private static final BigDecimal FEE_RATE = new BigDecimal("0.01");
    private static final Set<String> ALLOWED_CURRENCIES = Set.of("RUB", "USD", "EUR");

    public ValidationResult validate(BigDecimal amount, String currency, BigDecimal senderBalance) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) return ValidationResult.invalid("Bad amount");
        if (amount.compareTo(MAX_LIMIT) > 0) return ValidationResult.invalid("Exceeds limit");
        if (currency != null && ALLOWED_CURRENCIES.contains(currency)) { // MUTANT: inverted! rejects valid currencies
            return ValidationResult.invalid("Unsupported currency: " + currency);
        }
        BigDecimal fee = amount.multiply(FEE_RATE);
        BigDecimal totalRequired = amount.add(fee);
        if (senderBalance == null || senderBalance.compareTo(totalRequired) < 0) return ValidationResult.invalid("No funds");
        return ValidationResult.valid();
    }
}`
      },
      {
        id: 'mutant_tx_05_balance_omission',
        name: 'BalanceCheckOmissionMutator',
        file: 'src/main/java/com/assessment/fintech/TransactionValidator.java',
        line: 23,
        mutatedContent: `package com.assessment.fintech;
import java.math.BigDecimal;
import java.util.Set;

public class TransactionValidator {
    private static final BigDecimal MAX_LIMIT = new BigDecimal("10000.00");
    private static final BigDecimal FEE_RATE = new BigDecimal("0.01");
    private static final Set<String> ALLOWED_CURRENCIES = Set.of("RUB", "USD", "EUR");

    public ValidationResult validate(BigDecimal amount, String currency, BigDecimal senderBalance) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) return ValidationResult.invalid("Bad amount");
        if (amount.compareTo(MAX_LIMIT) > 0) return ValidationResult.invalid("Exceeds limit");
        if (currency == null || !ALLOWED_CURRENCIES.contains(currency)) return ValidationResult.invalid("Bad currency");
        // MUTANT: Balance check completely omitted!
        return ValidationResult.valid();
    }
}`
      }
    ]
  },

  // =========================================================================
  // АРХЕТИП 3: Modern Mockito & Strict InOrder Verification
  // =========================================================================
  {
    id: 'kata_test_strict_in_order_audit',
    slug: 'kata-test-strict-in-order-audit',
    title: 'KATA-TEST-07: Strict Audit Trail Verification (InOrder Verification)',
    category: 'testing_mutation',
    track: 'testing_mutation',
    badge: '🧬 Strict Chronology',
    difficulty: 'Senior',
    targetStack: 'Java 21 LTS, JUnit 5, InOrder',
    timeLimitMinutes: 40,
    shortDescription: 'Проверка строгой хронологии финансового пайплайна: Списание -> Аудит -> SMS-нотификация.',
    instructionsMarkdown: `### 🎯 Инженерная задача
Сервис обработки платежей **PaymentProcessingService** реализует критический финансовый инвариант:
1. Сначала вызывается списание со счета клиента: \`ledger.debit(userId, amount)\`.
2. Если списание успешно, немедленно создается запись в защищенном аудит-логе: \`auditLogger.logEvent(userId, "DEBIT", amount)\`.
3. Только после успешной фиксации в аудите клиенту отправляется SMS-нотификация: \`notificationService.sendSms(userId, ...)\`.
4. Если списание падает с исключением — аудит и SMS ни при каких обстоятельствах **не должны вызываться**!

### 🧪 Ваша цель
В файле \`PaymentProcessingServiceTest.java\` напишите строгий тест-сьют, уничтожающий всех 4 мутантов:
1. **Mutant 1 (OutOfOrderAudit):** Аудит вызывается до списания.
2. **Mutant 2 (SmsBeforeAudit):** SMS отправляется до записи в аудит.
3. **Mutant 3 (SmsOnDebitFailure):** SMS отправляется даже при падении списания.
4. **Mutant 4 (AuditOmission):** Запись в аудит пропущена.`,
    workspaceFiles: [
      {
        path: 'src/main/java/com/assessment/audit/LedgerPort.java',
        content: `package com.assessment.audit;
import java.math.BigDecimal;

public interface LedgerPort {
    void debit(String userId, BigDecimal amount);
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/main/java/com/assessment/audit/AuditLoggerPort.java',
        content: `package com.assessment.audit;
import java.math.BigDecimal;

public interface AuditLoggerPort {
    void logEvent(String userId, String action, BigDecimal amount);
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/main/java/com/assessment/audit/NotificationPort.java',
        content: `package com.assessment.audit;

public interface NotificationPort {
    void sendSms(String userId, String message);
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/main/java/com/assessment/audit/PaymentProcessingService.java',
        content: `package com.assessment.audit;
import java.math.BigDecimal;

public class PaymentProcessingService {
    private final LedgerPort ledger;
    private final AuditLoggerPort auditLogger;
    private final NotificationPort notification;

    public PaymentProcessingService(LedgerPort ledger, AuditLoggerPort auditLogger, NotificationPort notification) {
        this.ledger = ledger;
        this.auditLogger = auditLogger;
        this.notification = notification;
    }

    public void processPayment(String userId, BigDecimal amount) {
        ledger.debit(userId, amount);
        auditLogger.logEvent(userId, "DEBIT", amount);
        notification.sendSms(userId, "Payment successful: " + amount);
    }
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/test/java/com/assessment/audit/PaymentProcessingServiceTest.java',
        content: `package com.assessment.audit;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

public class PaymentProcessingServiceTest {

    @Test
    @DisplayName("Should execute debit, audit and notification in strict sequence")
    public void shouldExecuteInStrictSequence() {
        List<String> calls = new ArrayList<>();

        LedgerPort mockLedger = (u, a) -> calls.add("DEBIT");
        AuditLoggerPort mockAudit = (u, action, a) -> calls.add("AUDIT");
        NotificationPort mockNotification = (u, m) -> calls.add("SMS");

        PaymentProcessingService service = new PaymentProcessingService(mockLedger, mockAudit, mockNotification);
        service.processPayment("user-1", new BigDecimal("100.00"));

        assertEquals(List.of("DEBIT", "AUDIT", "SMS"), calls, "Sequence must be strictly DEBIT -> AUDIT -> SMS");
    }

    // TODO: Write additional tests (e.g. exception handling) to kill all 4 mutants!
}`,
        readOnly: false,
        hidden: false,
        isMainEntryPoint: true
      }
    ],
    mutants: [
      {
        id: 'mutant_audit_01_out_of_order',
        name: 'OutOfOrderAuditMutator',
        file: 'src/main/java/com/assessment/audit/PaymentProcessingService.java',
        line: 18,
        mutatedContent: `package com.assessment.audit;
import java.math.BigDecimal;

public class PaymentProcessingService {
    private final LedgerPort ledger;
    private final AuditLoggerPort auditLogger;
    private final NotificationPort notification;

    public PaymentProcessingService(LedgerPort ledger, AuditLoggerPort auditLogger, NotificationPort notification) {
        this.ledger = ledger; this.auditLogger = auditLogger; this.notification = notification;
    }

    public void processPayment(String userId, BigDecimal amount) {
        auditLogger.logEvent(userId, "DEBIT", amount); // MUTANT: Audit logged BEFORE debit!
        ledger.debit(userId, amount);
        notification.sendSms(userId, "Payment successful: " + amount);
    }
}`
      },
      {
        id: 'mutant_audit_02_sms_before_audit',
        name: 'SmsBeforeAuditMutator',
        file: 'src/main/java/com/assessment/audit/PaymentProcessingService.java',
        line: 19,
        mutatedContent: `package com.assessment.audit;
import java.math.BigDecimal;

public class PaymentProcessingService {
    private final LedgerPort ledger;
    private final AuditLoggerPort auditLogger;
    private final NotificationPort notification;

    public PaymentProcessingService(LedgerPort ledger, AuditLoggerPort auditLogger, NotificationPort notification) {
        this.ledger = ledger; this.auditLogger = auditLogger; this.notification = notification;
    }

    public void processPayment(String userId, BigDecimal amount) {
        ledger.debit(userId, amount);
        notification.sendSms(userId, "Payment successful: " + amount); // MUTANT: SMS before audit!
        auditLogger.logEvent(userId, "DEBIT", amount);
    }
}`
      },
      {
        id: 'mutant_audit_03_sms_on_failure',
        name: 'SmsOnFailureMutator',
        file: 'src/main/java/com/assessment/audit/PaymentProcessingService.java',
        line: 18,
        mutatedContent: `package com.assessment.audit;
import java.math.BigDecimal;

public class PaymentProcessingService {
    private final LedgerPort ledger;
    private final AuditLoggerPort auditLogger;
    private final NotificationPort notification;

    public PaymentProcessingService(LedgerPort ledger, AuditLoggerPort auditLogger, NotificationPort notification) {
        this.ledger = ledger; this.auditLogger = auditLogger; this.notification = notification;
    }

    public void processPayment(String userId, BigDecimal amount) {
        try {
            ledger.debit(userId, amount);
            auditLogger.logEvent(userId, "DEBIT", amount);
        } catch (Exception ignored) {}
        notification.sendSms(userId, "Payment successful: " + amount); // MUTANT: SMS sent even on error!
    }
}`
      },
      {
        id: 'mutant_audit_04_omission',
        name: 'AuditOmissionMutator',
        file: 'src/main/java/com/assessment/audit/PaymentProcessingService.java',
        line: 19,
        mutatedContent: `package com.assessment.audit;
import java.math.BigDecimal;

public class PaymentProcessingService {
    private final LedgerPort ledger;
    private final AuditLoggerPort auditLogger;
    private final NotificationPort notification;

    public PaymentProcessingService(LedgerPort ledger, AuditLoggerPort auditLogger, NotificationPort notification) {
        this.ledger = ledger; this.auditLogger = auditLogger; this.notification = notification;
    }

    public void processPayment(String userId, BigDecimal amount) {
        ledger.debit(userId, amount);
        // MUTANT: Audit completely skipped!
        notification.sendSms(userId, "Payment successful: " + amount);
    }
}`
      }
    ]
  },

  // =========================================================================
  // АРХЕТИП 4: Testcontainers & Infrastructure Idempotency
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

    // TODO: Write idempotency duplicate checks to kill all 4 mutants!
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
            AccountResponse failed = new AccountResponse(false, current, null);
            processedKeys.put(idempotencyKey, failed); // MUTANT: saves failure permanently!
            return failed;
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
        line: 26,
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
        BigDecimal updated = current.subtract(amount.multiply(new BigDecimal("2.0"))); // MUTANT: subtracts 2x amount!
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
        // MUTANT: Insufficient funds check completely removed!
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
  // АРХЕТИП 6: Concurrency & Asynchronous Testing (Circuit Breaker)
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
- Если в скользящем окне из 10 запросов процент ошибок превышает $50\\%$ ($> 5$ сбоев), автомат переходит в состояние \`OPEN\`.
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

    // TODO: Write state transition tests to kill all 4 mutants!
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
        else if (state == CircuitState.CLOSED) { successCount++; }
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
    private int successCount = 0;
    private final int failureThreshold = 5;

    public synchronized boolean allowExecution() {
        return true; // MUTANT: always allows execution even when OPEN!
    }
    public synchronized void recordSuccess() {
        if (state == CircuitState.HALF_OPEN) { state = CircuitState.CLOSED; failureCount = 0; successCount = 0; }
        else if (state == CircuitState.CLOSED) { successCount++; }
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
        id: 'mutant_cb_03_half_open_never_resets',
        name: 'HalfOpenNeverResetsMutator',
        file: 'src/main/java/com/assessment/resilience/SimpleCircuitBreaker.java',
        line: 16,
        mutatedContent: `package com.assessment.resilience;

public class SimpleCircuitBreaker {
    private CircuitState state = CircuitState.CLOSED;
    private int failureCount = 0;
    private int successCount = 0;
    private final int failureThreshold = 5;

    public synchronized boolean allowExecution() { return state != CircuitState.OPEN; }
    public synchronized void recordSuccess() {
        // MUTANT: Half-open success reset completely removed!
        if (state == CircuitState.CLOSED) { successCount++; }
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
        id: 'mutant_cb_04_initial_open',
        name: 'InitialStateOpenMutator',
        file: 'src/main/java/com/assessment/resilience/SimpleCircuitBreaker.java',
        line: 4,
        mutatedContent: `package com.assessment.resilience;

public class SimpleCircuitBreaker {
    private CircuitState state = CircuitState.OPEN; // MUTANT: starts in OPEN state!
    private int failureCount = 0;
    private int successCount = 0;
    private final int failureThreshold = 5;

    public synchronized boolean allowExecution() { return state != CircuitState.OPEN; }
    public synchronized void recordSuccess() {
        if (state == CircuitState.HALF_OPEN) { state = CircuitState.CLOSED; failureCount = 0; successCount = 0; }
        else if (state == CircuitState.CLOSED) { successCount++; }
    }
    public synchronized void recordFailure() {
        failureCount++;
        if (state == CircuitState.CLOSED && failureCount > failureThreshold) state = CircuitState.OPEN;
        else if (state == CircuitState.HALF_OPEN) state = CircuitState.OPEN;
    }
    public synchronized void transitionToHalfOpen() { this.state = CircuitState.HALF_OPEN; }
    public synchronized CircuitState getState() { return state; }
}`
      }
    ]
  }
];
