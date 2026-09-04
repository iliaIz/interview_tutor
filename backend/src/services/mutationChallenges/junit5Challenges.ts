import { CodingChallenge } from '../challengeSeedData';

export const JUNIT5_CHALLENGES: CodingChallenge[] = [
  // =========================================================================
  // 1. Financial Transaction Validator (@ParameterizedTest)
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
1. **Mutant 1 (ZeroBoundary):** Замена строгого $> 0$ на $\\ge 0$ (пропуск нулевой суммы).
2. **Mutant 2 (MaxLimitBoundary):** Замена $\\le 10000$ на $< 10000$ (отказ на сумме ровно 10000.00).
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

    @Test
    @DisplayName("Should reject zero and negative amounts (Kills M1)")
    public void shouldRejectZeroAmount() {
        ValidationResult resZero = validator.validate(new BigDecimal("0.00"), "RUB", new BigDecimal("500.00"));
        assertFalse(resZero.isValid());
    }

    @Test
    @DisplayName("Should allow exact 10000.00 limit (Kills M2)")
    public void shouldAllowExactMaxLimit() {
        // 10000 + 100 fee = 10100 required
        ValidationResult res = validator.validate(new BigDecimal("10000.00"), "USD", new BigDecimal("10100.00"));
        assertTrue(res.isValid());
    }

    @Test
    @DisplayName("Should correctly calculate 1% fee (Kills M3)")
    public void shouldVerifyExactFeeMath() {
        // 100 + 1 fee = 101 required. If balance is 102 -> OK. If fee was 5% -> required 105 -> fail!
        ValidationResult res = validator.validate(new BigDecimal("100.00"), "EUR", new BigDecimal("102.00"));
        assertTrue(res.isValid());
    }

    @Test
    @DisplayName("Should reject unsupported currency (Kills M4)")
    public void shouldRejectUnsupportedCurrency() {
        ValidationResult res = validator.validate(new BigDecimal("50.00"), "GBP", new BigDecimal("500.00"));
        assertFalse(res.isValid());
    }

    @Test
    @DisplayName("Should reject when balance is insufficient for amount + fee (Kills M5)")
    public void shouldRejectInsufficientBalance() {
        ValidationResult res = validator.validate(new BigDecimal("100.00"), "RUB", new BigDecimal("100.50"));
        assertFalse(res.isValid());
    }
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
  // 2. Combinatorial Promotional Pricing & Discount Engine
  // =========================================================================
  {
    id: 'kata_test_combinatorial_pricing_discounts',
    slug: 'kata-test-combinatorial-pricing-discounts',
    title: 'KATA-TEST-11: Combinatorial Pricing Engine (@ParameterizedTest)',
    category: 'testing_mutation',
    track: 'testing_mutation',
    badge: '🧬 Pricing Matrix',
    difficulty: 'Senior',
    targetStack: 'Java 21 LTS, JUnit 5, AssertJ, BigDecimal',
    timeLimitMinutes: 45,
    shortDescription: 'Параметризованное тестирование ценообразования с @CsvSource и кастомным конвертером Money.',
    instructionsMarkdown: `### 🎯 Инженерная задача
Сервис **PricingService** вычисляет итоговую стоимость корзины покупок:
- Проверяет однородность валюты корзины (иначе \`CurrencyMismatchException\`).
- Применяет скидки последовательно: сначала процентную скидку к субтоталу, затем фиксированную скидку.
- Проверяет порог минимальной суммы заказа и окно действия купона (\`validFrom\` / \`validUntil\`).
- Баланс корзины не может опускаться ниже нуля (прижимается к \`0.00\`).
- Округление выполняется по стандарту \`RoundingMode.HALF_EVEN\`.

### 🧪 Ваша цель
В \`PricingServiceTest.java\` напишите параметризованные тесты, уничтожающие всех 5 мутантов:
1. **Mutant 1 (PercentageValidation):** Разрешение скидок $\\le 0\\%$.
2. **Mutant 2 (CouponValidityWindow):** Игнорирование проверки окна времени купона.
3. **Mutant 3 (MinBasketThreshold):** Смещение границы минимального порога корзины ($<$ на $\\le$).
4. **Mutant 4 (CurrencyMismatchOmission):** Допуск смешивания валют без исключения.
5. **Mutant 5 (FloorClampZeroOmission):** Итоговый баланс уходит в отрицательные значения.`,
    workspaceFiles: [
      {
        path: 'src/main/java/com/bigtech/billing/pricing/PricingModels.java',
        content: `package com.bigtech.billing.pricing;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.Currency;
import java.util.Objects;

class CurrencyMismatchException extends RuntimeException {
    public CurrencyMismatchException(String message) { super(message); }
}

class InvalidCouponException extends RuntimeException {
    public InvalidCouponException(String message) { super(message); }
}

public class PricingModels {
    public record Money(BigDecimal amount, Currency currency) implements Comparable<Money> {
        public Money {
            Objects.requireNonNull(amount);
            Objects.requireNonNull(currency);
            amount = amount.setScale(2, RoundingMode.HALF_EVEN);
        }
        public static Money of(String str, String curr) {
            return new Money(new BigDecimal(str), Currency.getInstance(curr));
        }
        public Money add(Money o) {
            assertCurr(o);
            return new Money(this.amount.add(o.amount), this.currency);
        }
        public Money subtract(Money o) {
            assertCurr(o);
            return new Money(this.amount.subtract(o.amount), this.currency);
        }
        private void assertCurr(Money o) {
            if (!this.currency.equals(o.currency)) throw new CurrencyMismatchException("Currency mismatch");
        }
        @Override
        public int compareTo(Money o) {
            assertCurr(o);
            return this.amount.compareTo(o.amount);
        }
    }

    public record CartItem(String sku, Money unitPrice, int quantity) {
        public CartItem {
            if (quantity <= 0) throw new IllegalArgumentException("Quantity must be positive");
        }
        public Money total() {
            return new Money(unitPrice.amount().multiply(BigDecimal.valueOf(quantity)), unitPrice.currency());
        }
    }
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/main/java/com/bigtech/billing/pricing/PricingService.java',
        content: `package com.bigtech.billing.pricing;

import com.bigtech.billing.pricing.PricingModels.CartItem;
import com.bigtech.billing.pricing.PricingModels.Money;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.Currency;
import java.util.List;

public class PricingService {

    public sealed interface DiscountPolicy permits PercentageDiscount, FixedAmountDiscount {
        Money minThreshold();
        Instant validFrom();
        Instant validUntil();
        default void validate(Money subtotal, Instant time) {
            if (time.isBefore(validFrom()) || time.isAfter(validUntil())) {
                throw new InvalidCouponException("Coupon outside validity window");
            }
            if (subtotal.compareTo(minThreshold()) < 0) {
                throw new InvalidCouponException("Subtotal does not meet threshold");
            }
        }
    }

    public record PercentageDiscount(BigDecimal percent, Money minThreshold, Instant validFrom, Instant validUntil) implements DiscountPolicy {
        public PercentageDiscount {
            if (percent.compareTo(BigDecimal.ZERO) <= 0 || percent.compareTo(BigDecimal.valueOf(100)) > 0) {
                throw new IllegalArgumentException("Percent must be in (0, 100]");
            }
        }
    }

    public record FixedAmountDiscount(Money reduction, Money minThreshold, Instant validFrom, Instant validUntil) implements DiscountPolicy {}

    public Money calculateTotal(List<CartItem> items, List<DiscountPolicy> discounts, Instant evalTime) {
        if (items == null || items.isEmpty()) throw new IllegalArgumentException("Cart cannot be empty");
        Currency curr = items.get(0).unitPrice().currency();
        Money subtotal = new Money(BigDecimal.ZERO, curr);

        for (CartItem item : items) {
            if (!item.unitPrice().currency().equals(curr)) {
                throw new CurrencyMismatchException("Mixed currencies in cart");
            }
            subtotal = subtotal.add(item.total());
        }

        Money current = subtotal;
        if (discounts != null) {
            for (DiscountPolicy d : discounts) {
                d.validate(subtotal, evalTime);
                if (d instanceof PercentageDiscount pd) {
                    BigDecimal factor = pd.percent().divide(BigDecimal.valueOf(100), 4, RoundingMode.HALF_EVEN);
                    BigDecimal cut = subtotal.amount().multiply(factor);
                    current = current.subtract(new Money(cut, curr));
                } else if (d instanceof FixedAmountDiscount fd) {
                    current = current.subtract(fd.reduction());
                }
            }
        }

        if (current.amount().compareTo(BigDecimal.ZERO) < 0) {
            return new Money(BigDecimal.ZERO, curr);
        }
        return current;
    }
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/test/java/com/bigtech/billing/pricing/PricingServiceTest.java',
        content: `package com.bigtech.billing.pricing;

import com.bigtech.billing.pricing.PricingModels.CartItem;
import com.bigtech.billing.pricing.PricingModels.Money;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PricingServiceTest {

    private final PricingService service = new PricingService();
    private static final Instant T0 = Instant.parse("2026-06-01T12:00:00Z");

    @Test
    @DisplayName("Should reject invalid zero or negative percentage discount (Kills M1)")
    void shouldRejectInvalidPercentage() {
        Money threshold = Money.of("50.00", "USD");
        assertThatThrownBy(() -> new PricingService.PercentageDiscount(BigDecimal.ZERO, threshold, T0, T0.plusSeconds(3600)))
            .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("Should validate coupon temporal window boundaries (Kills M2)")
    void shouldRejectExpiredCoupon() {
        Money threshold = Money.of("10.00", "USD");
        var discount = new PricingService.FixedAmountDiscount(Money.of("5.00", "USD"), threshold, T0, T0.plusSeconds(3600));
        var items = List.of(new CartItem("SKU-1", Money.of("20.00", "USD"), 1));

        assertThatThrownBy(() -> service.calculateTotal(items, List.of(discount), T0.plusSeconds(7200)))
            .isInstanceOf(InvalidCouponException.class);
    }

    @Test
    @DisplayName("Should accept coupon when subtotal equals exact threshold (Kills M3)")
    void shouldAllowExactThreshold() {
        Money threshold = Money.of("100.00", "USD");
        var discount = new PricingService.FixedAmountDiscount(Money.of("10.00", "USD"), threshold, T0, T0.plusSeconds(3600));
        var items = List.of(new CartItem("SKU-1", Money.of("100.00", "USD"), 1));

        Money total = service.calculateTotal(items, List.of(discount), T0.plusSeconds(100));
        assertThat(total.amount()).isEqualByComparingTo("90.00");
    }

    @Test
    @DisplayName("Should reject mixed currencies in cart items (Kills M4)")
    void shouldRejectMixedCurrencies() {
        var items = List.of(
            new CartItem("SKU-1", Money.of("10.00", "USD"), 1),
            new CartItem("SKU-2", Money.of("10.00", "EUR"), 1)
        );
        assertThatThrownBy(() -> service.calculateTotal(items, List.of(), T0))
            .isInstanceOf(CurrencyMismatchException.class);
    }

    @Test
    @DisplayName("Should clamp total to zero when discount exceeds subtotal (Kills M5)")
    void shouldClampNegativeTotalToZero() {
        Money threshold = Money.of("10.00", "USD");
        var discount = new PricingService.FixedAmountDiscount(Money.of("100.00", "USD"), threshold, T0, T0.plusSeconds(3600));
        var items = List.of(new CartItem("SKU-1", Money.of("20.00", "USD"), 1));

        Money total = service.calculateTotal(items, List.of(discount), T0.plusSeconds(100));
        assertThat(total.amount()).isEqualByComparingTo("0.00");
    }
}`,
        readOnly: false,
        hidden: false,
        isMainEntryPoint: true
      }
    ],
    mutants: [
      {
        id: 'mutant_psp_01_percentage_check',
        name: 'PercentageValidationMutator',
        file: 'src/main/java/com/bigtech/billing/pricing/PricingService.java',
        line: 28,
        mutatedContent: `package com.bigtech.billing.pricing;
import java.math.BigDecimal;
import java.time.Instant;
public class PricingService {
    public sealed interface DiscountPolicy permits PercentageDiscount, FixedAmountDiscount {
        PricingModels.Money minThreshold(); Instant validFrom(); Instant validUntil();
    }
    public record PercentageDiscount(BigDecimal percent, PricingModels.Money minThreshold, Instant validFrom, Instant validUntil) implements DiscountPolicy {
        public PercentageDiscount {
            // MUTANT: < 0 instead of <= 0 permits 0% discount
            if (percent.compareTo(BigDecimal.ZERO) < 0) throw new IllegalArgumentException("Bad percent");
        }
    }
    public record FixedAmountDiscount(PricingModels.Money reduction, PricingModels.Money minThreshold, Instant validFrom, Instant validUntil) implements DiscountPolicy {}
    public PricingModels.Money calculateTotal(java.util.List<PricingModels.CartItem> items, java.util.List<DiscountPolicy> discounts, Instant evalTime) {
        return items.get(0).unitPrice();
    }
}`
      },
      {
        id: 'mutant_psp_02_coupon_window',
        name: 'CouponValidityWindowMutator',
        file: 'src/main/java/com/bigtech/billing/pricing/PricingService.java',
        line: 18,
        mutatedContent: `package com.bigtech.billing.pricing;
import java.time.Instant;
public class PricingService {
    public sealed interface DiscountPolicy permits PercentageDiscount, FixedAmountDiscount {
        PricingModels.Money minThreshold(); Instant validFrom(); Instant validUntil();
        default void validate(PricingModels.Money subtotal, Instant time) {
            // MUTANT: window check omitted!
        }
    }
    public record PercentageDiscount(java.math.BigDecimal percent, PricingModels.Money minThreshold, Instant validFrom, Instant validUntil) implements DiscountPolicy {}
    public record FixedAmountDiscount(PricingModels.Money reduction, PricingModels.Money minThreshold, Instant validFrom, Instant validUntil) implements DiscountPolicy {}
    public PricingModels.Money calculateTotal(java.util.List<PricingModels.CartItem> items, java.util.List<DiscountPolicy> discounts, Instant evalTime) {
        if (discounts != null) for (DiscountPolicy d : discounts) d.validate(items.get(0).total(), evalTime);
        return items.get(0).unitPrice();
    }
}`
      },
      {
        id: 'mutant_psp_03_min_threshold',
        name: 'MinBasketThresholdMutator',
        file: 'src/main/java/com/bigtech/billing/pricing/PricingService.java',
        line: 22,
        mutatedContent: `package com.bigtech.billing.pricing;
import java.time.Instant;
public class PricingService {
    public sealed interface DiscountPolicy permits PercentageDiscount, FixedAmountDiscount {
        PricingModels.Money minThreshold(); Instant validFrom(); Instant validUntil();
        default void validate(PricingModels.Money subtotal, Instant time) {
            // MUTANT: <= 0 rejects exact threshold match!
            if (subtotal.compareTo(minThreshold()) <= 0) throw new InvalidCouponException("Too small");
        }
    }
    public record PercentageDiscount(java.math.BigDecimal percent, PricingModels.Money minThreshold, Instant validFrom, Instant validUntil) implements DiscountPolicy {}
    public record FixedAmountDiscount(PricingModels.Money reduction, PricingModels.Money minThreshold, Instant validFrom, Instant validUntil) implements DiscountPolicy {}
    public PricingModels.Money calculateTotal(java.util.List<PricingModels.CartItem> items, java.util.List<DiscountPolicy> discounts, Instant evalTime) {
        if (discounts != null) for (DiscountPolicy d : discounts) d.validate(items.get(0).total(), evalTime);
        return items.get(0).unitPrice();
    }
}`
      },
      {
        id: 'mutant_psp_04_currency_mismatch',
        name: 'CurrencyMismatchOmissionMutator',
        file: 'src/main/java/com/bigtech/billing/pricing/PricingService.java',
        line: 41,
        mutatedContent: `package com.bigtech.billing.pricing;
import java.time.Instant;
import java.util.List;
public class PricingService {
    public sealed interface DiscountPolicy permits PercentageDiscount, FixedAmountDiscount {}
    public record PercentageDiscount(java.math.BigDecimal percent) implements DiscountPolicy {}
    public record FixedAmountDiscount(PricingModels.Money reduction) implements DiscountPolicy {}
    public PricingModels.Money calculateTotal(List<PricingModels.CartItem> items, List<DiscountPolicy> discounts, Instant evalTime) {
        // MUTANT: does not check for mismatched currencies!
        return items.get(0).total();
    }
}`
      },
      {
        id: 'mutant_psp_05_clamp_zero',
        name: 'FloorClampZeroOmissionMutator',
        file: 'src/main/java/com/bigtech/billing/pricing/PricingService.java',
        line: 63,
        mutatedContent: `package com.bigtech.billing.pricing;
import java.time.Instant;
import java.util.List;
public class PricingService {
    public sealed interface DiscountPolicy permits PercentageDiscount, FixedAmountDiscount {}
    public record PercentageDiscount(java.math.BigDecimal percent) implements DiscountPolicy {}
    public record FixedAmountDiscount(PricingModels.Money reduction) implements DiscountPolicy {}
    public PricingModels.Money calculateTotal(List<PricingModels.CartItem> items, List<DiscountPolicy> discounts, Instant evalTime) {
        PricingModels.Money current = items.get(0).total();
        if (discounts != null && !discounts.isEmpty()) {
            FixedAmountDiscount fd = (FixedAmountDiscount) discounts.get(0);
            current = current.subtract(fd.reduction());
        }
        // MUTANT: returns negative without clamping to zero!
        return current;
    }
}`
      }
    ]
  },

  // =========================================================================
  // 3. Dynamic RBAC Matrix via @TestFactory (72 States Cartesian Tree)
  // =========================================================================
  {
    id: 'kata_test_dynamic_rbac_matrix_testfactory',
    slug: 'kata-test-dynamic-rbac-matrix-testfactory',
    title: 'KATA-TEST-12: Dynamic RBAC Matrix via @TestFactory (72 Permutations)',
    category: 'testing_mutation',
    track: 'testing_mutation',
    badge: '🧬 @TestFactory Tree',
    difficulty: 'Senior',
    targetStack: 'Java 21 LTS, JUnit 5 Jupiter, DynamicNode',
    timeLimitMinutes: 45,
    shortDescription: 'Генерация динамического дерева DynamicContainer для проверки 72 комбинаций матрицы доступа RBAC.',
    instructionsMarkdown: `### 🎯 Инженерная задача
Сервис **RbacPolicyEngine** реализует проверку прав для 4 ролей, 3 ресурсов и 3 операций:
- Роли: \`ADMIN\`, \`AUDITOR\`, \`SUPPORT\`, \`BUYER\`.
- Ресурсы: \`ORDERS\`, \`REFUNDS\`, \`SENSITIVE_PII\`.
- Операции: \`READ\`, \`WRITE\`, \`DELETE\`.
- Флаг владения: \`isResourceOwner\`.

Правила:
1. \`ADMIN\` имеет полный доступ ко всем ресурсам и действиям.
2. \`AUDITOR\` имеет доступ только на чтение (\`READ\`) ко всем ресурсам. Любые \`WRITE\` или \`DELETE\` строго запрещены.
3. \`SUPPORT\` имеет \`READ\` и \`WRITE\` для \`ORDERS\` и \`REFUNDS\`, но не имеет доступа к \`SENSITIVE_PII\` и не может вызывать \`DELETE\`.
4. \`BUYER\` может читать, менять и удалять **только свои** заказы (\`isResourceOwner = true\`), запрашивать возврат, но не может напрямую менять PII.

### 🧪 Ваша цель
В файле \`RbacPolicyEngineTest.java\` используйте \`@TestFactory\` для генерации структурированного дерева \`DynamicContainer\`, уничтожающего всех 5 мутантов:
1. **Mutant 1 (AdminPiiDenial):** Ограничение прав ADMIN на PII.
2. **Mutant 2 (AuditorWriteAllowed):** Разрешение AUDITOR выполнять запись.
3. **Mutant 3 (SupportPiiAllowed):** Разрешение SUPPORT читать PII.
4. **Mutant 4 (BuyerForeignOrderAllowed):** Разрешение BUYER изменять чужие заказы.
5. **Mutant 5 (BuyerDeleteRefundAllowed):** Разрешение BUYER удалять заявки на возврат.`,
    workspaceFiles: [
      {
        path: 'src/main/java/com/bigtech/identity/rbac/RbacPolicyEngine.java',
        content: `package com.bigtech.identity.rbac;

import java.util.Objects;

public class RbacPolicyEngine {

    public enum Role { ADMIN, AUDITOR, SUPPORT, BUYER }
    public enum Resource { ORDERS, REFUNDS, SENSITIVE_PII }
    public enum Operation { READ, WRITE, DELETE }

    public record AccessRequest(Role role, Resource resource, Operation operation, boolean isResourceOwner) {}

    public record AccessDecision(boolean isAllowed, String reason) {
        public static AccessDecision allow() { return new AccessDecision(true, "ACCESS_GRANTED"); }
        public static AccessDecision deny(String reason) { return new AccessDecision(false, reason); }
    }

    public AccessDecision evaluate(AccessRequest request) {
        Objects.requireNonNull(request);

        if (request.role() == Role.ADMIN) {
            return AccessDecision.allow();
        }

        if (request.role() == Role.AUDITOR) {
            if (request.operation() == Operation.READ) return AccessDecision.allow();
            return AccessDecision.deny("Auditors are restricted to read-only access");
        }

        if (request.role() == Role.SUPPORT) {
            if (request.resource() == Resource.SENSITIVE_PII) {
                return AccessDecision.deny("Support staff cannot access sensitive PII");
            }
            if (request.operation() == Operation.DELETE) {
                return AccessDecision.deny("Support staff cannot perform deletions");
            }
            return AccessDecision.allow();
        }

        if (request.role() == Role.BUYER) {
            if (!request.isResourceOwner()) {
                return AccessDecision.deny("Buyers can only access their own resources");
            }
            if (request.resource() == Resource.ORDERS) {
                return AccessDecision.allow();
            }
            if (request.resource() == Resource.REFUNDS) {
                if (request.operation() == Operation.DELETE) {
                    return AccessDecision.deny("Buyers cannot delete refund requests");
                }
                return AccessDecision.allow();
            }
            if (request.resource() == Resource.SENSITIVE_PII) {
                if (request.operation() == Operation.WRITE) {
                    return AccessDecision.deny("Buyers cannot directly overwrite PII records");
                }
                return AccessDecision.allow();
            }
        }

        return AccessDecision.deny("Default deny");
    }
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/test/java/com/bigtech/identity/rbac/RbacPolicyEngineTest.java',
        content: `package com.bigtech.identity.rbac;

import com.bigtech.identity.rbac.RbacPolicyEngine.*;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.DynamicContainer;
import org.junit.jupiter.api.DynamicTest;
import org.junit.jupiter.api.TestFactory;
import java.util.stream.Stream;
import static org.assertj.core.api.Assertions.assertThat;

class RbacPolicyEngineTest {

    private final RbacPolicyEngine engine = new RbacPolicyEngine();

    @TestFactory
    @DisplayName("Dynamic Verification of Complete RBAC Matrix")
    Stream<DynamicContainer> verifyRbacCartesianMatrix() {
        return Stream.of(Role.values()).map(role -> {
            var tests = Stream.of(Resource.values()).flatMap(resource ->
                Stream.of(Operation.values()).flatMap(op ->
                    Stream.of(true, false).map(owner -> {
                        AccessRequest req = new AccessRequest(role, resource, op, owner);
                        String testName = String.format("%s on %s (owner=%s)", op, resource, owner);
                        return DynamicTest.dynamicTest(testName, () -> {
                            AccessDecision decision = engine.evaluate(req);
                            if (role == Role.ADMIN) {
                                assertThat(decision.isAllowed()).isTrue();
                            } else if (role == Role.AUDITOR) {
                                if (op == Operation.READ) assertThat(decision.isAllowed()).isTrue();
                                else assertThat(decision.isAllowed()).isFalse();
                            } else if (role == Role.SUPPORT) {
                                if (resource == Resource.SENSITIVE_PII || op == Operation.DELETE) {
                                    assertThat(decision.isAllowed()).isFalse();
                                } else {
                                    assertThat(decision.isAllowed()).isTrue();
                                }
                            } else if (role == Role.BUYER) {
                                if (!owner) {
                                    assertThat(decision.isAllowed()).isFalse();
                                } else if (resource == Resource.REFUNDS && op == Operation.DELETE) {
                                    assertThat(decision.isAllowed()).isFalse();
                                } else if (resource == Resource.SENSITIVE_PII && op == Operation.WRITE) {
                                    assertThat(decision.isAllowed()).isFalse();
                                } else {
                                    assertThat(decision.isAllowed()).isTrue();
                                }
                            }
                        });
                    })
                )
            );
            return DynamicContainer.dynamicContainer("Role: " + role, tests);
        });
    }
}`,
        readOnly: false,
        hidden: false,
        isMainEntryPoint: true
      }
    ],
    mutants: [
      {
        id: 'mutant_rbac_01_admin_pii',
        name: 'AdminPiiDenialMutator',
        file: 'src/main/java/com/bigtech/identity/rbac/RbacPolicyEngine.java',
        line: 22,
        mutatedContent: `package com.bigtech.identity.rbac;
public class RbacPolicyEngine {
    public enum Role { ADMIN, AUDITOR, SUPPORT, BUYER }
    public enum Resource { ORDERS, REFUNDS, SENSITIVE_PII }
    public enum Operation { READ, WRITE, DELETE }
    public record AccessRequest(Role role, Resource resource, Operation operation, boolean isResourceOwner) {}
    public record AccessDecision(boolean isAllowed, String reason) {
        public static AccessDecision allow() { return new AccessDecision(true, "OK"); }
        public static AccessDecision deny(String r) { return new AccessDecision(false, r); }
    }
    public AccessDecision evaluate(AccessRequest req) {
        // MUTANT: Admin denied on PII!
        if (req.role() == Role.ADMIN) {
            if (req.resource() == Resource.SENSITIVE_PII) return AccessDecision.deny("Denied");
            return AccessDecision.allow();
        }
        return AccessDecision.deny("Denied");
    }
}`
      },
      {
        id: 'mutant_rbac_02_auditor_write',
        name: 'AuditorWriteAllowedMutator',
        file: 'src/main/java/com/bigtech/identity/rbac/RbacPolicyEngine.java',
        line: 26,
        mutatedContent: `package com.bigtech.identity.rbac;
public class RbacPolicyEngine {
    public enum Role { ADMIN, AUDITOR, SUPPORT, BUYER }
    public enum Resource { ORDERS, REFUNDS, SENSITIVE_PII }
    public enum Operation { READ, WRITE, DELETE }
    public record AccessRequest(Role role, Resource resource, Operation operation, boolean isResourceOwner) {}
    public record AccessDecision(boolean isAllowed, String reason) {
        public static AccessDecision allow() { return new AccessDecision(true, "OK"); }
        public static AccessDecision deny(String r) { return new AccessDecision(false, r); }
    }
    public AccessDecision evaluate(AccessRequest req) {
        if (req.role() == Role.ADMIN) return AccessDecision.allow();
        // MUTANT: Auditor allowed WRITE!
        if (req.role() == Role.AUDITOR) {
            if (req.operation() == Operation.READ || req.operation() == Operation.WRITE) return AccessDecision.allow();
            return AccessDecision.deny("Denied");
        }
        return AccessDecision.deny("Denied");
    }
}`
      },
      {
        id: 'mutant_rbac_03_support_pii',
        name: 'SupportPiiAllowedMutator',
        file: 'src/main/java/com/bigtech/identity/rbac/RbacPolicyEngine.java',
        line: 32,
        mutatedContent: `package com.bigtech.identity.rbac;
public class RbacPolicyEngine {
    public enum Role { ADMIN, AUDITOR, SUPPORT, BUYER }
    public enum Resource { ORDERS, REFUNDS, SENSITIVE_PII }
    public enum Operation { READ, WRITE, DELETE }
    public record AccessRequest(Role role, Resource resource, Operation operation, boolean isResourceOwner) {}
    public record AccessDecision(boolean isAllowed, String reason) {
        public static AccessDecision allow() { return new AccessDecision(true, "OK"); }
        public static AccessDecision deny(String r) { return new AccessDecision(false, r); }
    }
    public AccessDecision evaluate(AccessRequest req) {
        if (req.role() == Role.ADMIN) return AccessDecision.allow();
        // MUTANT: Support allowed PII read!
        if (req.role() == Role.SUPPORT) {
            if (req.operation() == Operation.DELETE) return AccessDecision.deny("Denied");
            return AccessDecision.allow();
        }
        return AccessDecision.deny("Denied");
    }
}`
      },
      {
        id: 'mutant_rbac_04_buyer_foreign',
        name: 'BuyerForeignOrderAllowedMutator',
        file: 'src/main/java/com/bigtech/identity/rbac/RbacPolicyEngine.java',
        line: 41,
        mutatedContent: `package com.bigtech.identity.rbac;
public class RbacPolicyEngine {
    public enum Role { ADMIN, AUDITOR, SUPPORT, BUYER }
    public enum Resource { ORDERS, REFUNDS, SENSITIVE_PII }
    public enum Operation { READ, WRITE, DELETE }
    public record AccessRequest(Role role, Resource resource, Operation operation, boolean isResourceOwner) {}
    public record AccessDecision(boolean isAllowed, String reason) {
        public static AccessDecision allow() { return new AccessDecision(true, "OK"); }
        public static AccessDecision deny(String r) { return new AccessDecision(false, r); }
    }
    public AccessDecision evaluate(AccessRequest req) {
        if (req.role() == Role.ADMIN) return AccessDecision.allow();
        // MUTANT: Foreign buyer allowed!
        if (req.role() == Role.BUYER) {
            return AccessDecision.allow();
        }
        return AccessDecision.deny("Denied");
    }
}`
      },
      {
        id: 'mutant_rbac_05_buyer_delete_refund',
        name: 'BuyerDeleteRefundAllowedMutator',
        file: 'src/main/java/com/bigtech/identity/rbac/RbacPolicyEngine.java',
        line: 49,
        mutatedContent: `package com.bigtech.identity.rbac;
public class RbacPolicyEngine {
    public enum Role { ADMIN, AUDITOR, SUPPORT, BUYER }
    public enum Resource { ORDERS, REFUNDS, SENSITIVE_PII }
    public enum Operation { READ, WRITE, DELETE }
    public record AccessRequest(Role role, Resource resource, Operation operation, boolean isResourceOwner) {}
    public record AccessDecision(boolean isAllowed, String reason) {
        public static AccessDecision allow() { return new AccessDecision(true, "OK"); }
        public static AccessDecision deny(String r) { return new AccessDecision(false, r); }
    }
    public AccessDecision evaluate(AccessRequest req) {
        if (req.role() == Role.ADMIN) return AccessDecision.allow();
        if (req.role() == Role.BUYER) {
            if (!req.isResourceOwner()) return AccessDecision.deny("Denied");
            // MUTANT: allows delete on refunds!
            if (req.resource() == Resource.REFUNDS) return AccessDecision.allow();
            return AccessDecision.allow();
        }
        return AccessDecision.deny("Denied");
    }
}`
      }
    ]
  },

  // =========================================================================
  // 4. Multi-Tier Banking Account Lifecycle BDD Hierarchy (@Nested)
  // =========================================================================
  {
    id: 'kata_test_banking_account_lifecycle_nested',
    slug: 'kata-test-banking-account-lifecycle-nested',
    title: 'KATA-TEST-13: Banking Lifecycle BDD Hierarchy (@Nested)',
    category: 'testing_mutation',
    track: 'testing_mutation',
    badge: '🧬 @Nested Lifecycle',
    difficulty: 'Senior',
    targetStack: 'Java 21 LTS, JUnit 5 @Nested, AssertJ',
    timeLimitMinutes: 45,
    shortDescription: 'Построение Given-When-Then иерархии тестов для запечатанных состояний банковского счета.',
    instructionsMarkdown: `### 🎯 Инженерная задача
Сервис **AccountLifecycleService** управляет жизненным циклом банковского аккаунта:
\`PendingKyc -> Active -> Frozen -> Closed\`:
- \`PendingKyc\`: запрещены депозиты, снятия и заморозка. Переход в \`Active\` возможен только после верификации compliance officer.
- \`Active\`: разрешены депозиты и снятия в пределах баланса (овердрафт запрещен). Возможен переход в \`Frozen\` или \`Closed\`.
- \`Frozen\`: запрещены снятия и закрытие, но разрешены депозиты и разморозка.
- \`Closed\`: терминальное состояние. Закрытие возможно **только при строго нулевом балансе** ($0.00$).

### 🧪 Ваша цель
В \`AccountLifecycleServiceTest.java\` постройте чистую Given-When-Then иерархию с \`@Nested\`, уничтожающую всех 5 мутантов:
1. **Mutant 1 (PendingKycDepositAllowed):** Разрешение депозитов до верификации KYC.
2. **Mutant 2 (OverdraftAllowed):** Допуск отрицательного баланса при снятии.
3. **Mutant 3 (FrozenWithdrawAllowed):** Снятие средств с замороженного счета.
4. **Mutant 4 (NonZeroClosureAllowed):** Закрытие счета с положительным балансом.
5. **Mutant 5 (TerminalStateReactivation):** Разрешение переходов из закрытого счета.`,
    workspaceFiles: [
      {
        path: 'src/main/java/com/bigtech/banking/lifecycle/AccountLifecycleService.java',
        content: `package com.bigtech.banking.lifecycle;

import java.math.BigDecimal;
import java.util.Objects;

public class AccountLifecycleService {

    public sealed interface AccountState permits PendingKycState, ActiveState, FrozenState, ClosedState {
        String accountId();
        BigDecimal balance();
    }

    public record PendingKycState(String accountId, BigDecimal balance) implements AccountState {}
    public record ActiveState(String accountId, BigDecimal balance) implements AccountState {}
    public record FrozenState(String accountId, BigDecimal balance) implements AccountState {}
    public record ClosedState(String accountId, BigDecimal balance) implements AccountState {}

    public AccountState create(String id) {
        return new PendingKycState(Objects.requireNonNull(id), BigDecimal.ZERO);
    }

    public AccountState verifyKyc(AccountState state) {
        if (!(state instanceof PendingKycState)) throw new IllegalStateException("Only PendingKyc can be verified");
        return new ActiveState(state.accountId(), state.balance());
    }

    public AccountState deposit(AccountState state, BigDecimal amount) {
        Objects.requireNonNull(amount);
        if (amount.compareTo(BigDecimal.ZERO) <= 0) throw new IllegalArgumentException("Amount must be positive");
        return switch (state) {
            case PendingKycState s -> throw new IllegalStateException("Cannot deposit in PendingKyc");
            case ActiveState s -> new ActiveState(s.accountId(), s.balance().add(amount));
            case FrozenState s -> new FrozenState(s.accountId(), s.balance().add(amount));
            case ClosedState s -> throw new IllegalStateException("Account is closed");
        };
    }

    public AccountState withdraw(AccountState state, BigDecimal amount) {
        Objects.requireNonNull(amount);
        if (amount.compareTo(BigDecimal.ZERO) <= 0) throw new IllegalArgumentException("Amount must be positive");
        return switch (state) {
            case ActiveState s -> {
                if (s.balance().compareTo(amount) < 0) throw new IllegalStateException("Insufficient funds");
                yield new ActiveState(s.accountId(), s.balance().subtract(amount));
            }
            case FrozenState s -> throw new IllegalStateException("Account is frozen");
            default -> throw new IllegalStateException("Withdrawal not permitted");
        };
    }

    public AccountState freeze(AccountState state) {
        if (!(state instanceof ActiveState)) throw new IllegalStateException("Only Active account can be frozen");
        return new FrozenState(state.accountId(), state.balance());
    }

    public AccountState unfreeze(AccountState state) {
        if (!(state instanceof FrozenState)) throw new IllegalStateException("Only Frozen account can be unfrozen");
        return new ActiveState(state.accountId(), state.balance());
    }

    public AccountState close(AccountState state) {
        if (!(state instanceof ActiveState)) throw new IllegalStateException("Only Active account can be closed");
        if (state.balance().compareTo(BigDecimal.ZERO) != 0) throw new IllegalStateException("Balance must be zero to close");
        return new ClosedState(state.accountId(), BigDecimal.ZERO);
    }
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/test/java/com/bigtech/banking/lifecycle/AccountLifecycleServiceTest.java',
        content: `package com.bigtech.banking.lifecycle;

import com.bigtech.banking.lifecycle.AccountLifecycleService.*;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AccountLifecycleServiceTest {

    private final AccountLifecycleService service = new AccountLifecycleService();

    @Nested
    @DisplayName("Given a PendingKyc Account")
    class GivenPendingKyc {
        @Test
        @DisplayName("Should reject deposits before KYC verification (Kills M1)")
        void shouldRejectDepositInPendingKyc() {
            AccountState state = service.create("ACC-1");
            assertThatThrownBy(() -> service.deposit(state, new BigDecimal("100.00")))
                .isInstanceOf(IllegalStateException.class);
        }
    }

    @Nested
    @DisplayName("Given an Active Account")
    class GivenActiveAccount {
        @Test
        @DisplayName("Should reject withdrawal exceeding available balance (Kills M2)")
        void shouldRejectOverdraft() {
            AccountState state = service.verifyKyc(service.create("ACC-2"));
            AccountState funded = service.deposit(state, new BigDecimal("50.00"));

            assertThatThrownBy(() -> service.withdraw(funded, new BigDecimal("50.01")))
                .isInstanceOf(IllegalStateException.class);
        }

        @Test
        @DisplayName("Should reject closure when balance is non-zero (Kills M4)")
        void shouldRejectClosureWithNonZeroBalance() {
            AccountState state = service.verifyKyc(service.create("ACC-3"));
            AccountState funded = service.deposit(state, new BigDecimal("10.00"));

            assertThatThrownBy(() -> service.close(funded))
                .isInstanceOf(IllegalStateException.class);
        }
    }

    @Nested
    @DisplayName("Given a Frozen Account")
    class GivenFrozenAccount {
        @Test
        @DisplayName("Should reject withdrawals when frozen (Kills M3)")
        void shouldRejectWithdrawalWhenFrozen() {
            AccountState state = service.verifyKyc(service.create("ACC-4"));
            AccountState funded = service.deposit(state, new BigDecimal("100.00"));
            AccountState frozen = service.freeze(funded);

            assertThatThrownBy(() -> service.withdraw(frozen, new BigDecimal("10.00")))
                .isInstanceOf(IllegalStateException.class);
        }
    }

    @Nested
    @DisplayName("Given a Closed Account")
    class GivenClosedAccount {
        @Test
        @DisplayName("Should reject any operations in terminal Closed state (Kills M5)")
        void shouldRejectOperationsOnClosed() {
            AccountState state = service.verifyKyc(service.create("ACC-5"));
            AccountState closed = service.close(state);

            assertThatThrownBy(() -> service.deposit(closed, new BigDecimal("10.00")))
                .isInstanceOf(IllegalStateException.class);
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
        id: 'mutant_als_01_pending_deposit',
        name: 'PendingKycDepositAllowedMutator',
        file: 'src/main/java/com/bigtech/banking/lifecycle/AccountLifecycleService.java',
        line: 27,
        mutatedContent: `package com.bigtech.banking.lifecycle;
import java.math.BigDecimal;
public class AccountLifecycleService {
    public sealed interface AccountState permits PendingKycState, ActiveState, FrozenState, ClosedState {
        String accountId(); BigDecimal balance();
    }
    public record PendingKycState(String accountId, BigDecimal balance) implements AccountState {}
    public record ActiveState(String accountId, BigDecimal balance) implements AccountState {}
    public record FrozenState(String accountId, BigDecimal balance) implements AccountState {}
    public record ClosedState(String accountId, BigDecimal balance) implements AccountState {}
    public AccountState create(String id) { return new PendingKycState(id, BigDecimal.ZERO); }
    public AccountState verifyKyc(AccountState s) { return new ActiveState(s.accountId(), s.balance()); }
    public AccountState deposit(AccountState state, BigDecimal amt) {
        // MUTANT: allows deposit in PendingKyc!
        if (state instanceof PendingKycState s) return new PendingKycState(s.accountId(), s.balance().add(amt));
        return state;
    }
    public AccountState withdraw(AccountState s, BigDecimal a) { return s; }
    public AccountState freeze(AccountState s) { return s; }
    public AccountState unfreeze(AccountState s) { return s; }
    public AccountState close(AccountState s) { return s; }
}`
      },
      {
        id: 'mutant_als_02_overdraft_allowed',
        name: 'OverdraftAllowedMutator',
        file: 'src/main/java/com/bigtech/banking/lifecycle/AccountLifecycleService.java',
        line: 38,
        mutatedContent: `package com.bigtech.banking.lifecycle;
import java.math.BigDecimal;
public class AccountLifecycleService {
    public sealed interface AccountState permits PendingKycState, ActiveState, FrozenState, ClosedState {
        String accountId(); BigDecimal balance();
    }
    public record PendingKycState(String accountId, BigDecimal balance) implements AccountState {}
    public record ActiveState(String accountId, BigDecimal balance) implements AccountState {}
    public record FrozenState(String accountId, BigDecimal balance) implements AccountState {}
    public record ClosedState(String accountId, BigDecimal balance) implements AccountState {}
    public AccountState create(String id) { return new PendingKycState(id, BigDecimal.ZERO); }
    public AccountState verifyKyc(AccountState s) { return new ActiveState(s.accountId(), s.balance()); }
    public AccountState deposit(AccountState s, BigDecimal a) { return new ActiveState(s.accountId(), s.balance().add(a)); }
    public AccountState withdraw(AccountState state, BigDecimal amt) {
        // MUTANT: no balance check, allows overdraft!
        if (state instanceof ActiveState s) return new ActiveState(s.accountId(), s.balance().subtract(amt));
        throw new IllegalStateException("Bad");
    }
    public AccountState freeze(AccountState s) { return s; }
    public AccountState unfreeze(AccountState s) { return s; }
    public AccountState close(AccountState s) { return s; }
}`
      },
      {
        id: 'mutant_als_03_frozen_withdraw',
        name: 'FrozenWithdrawAllowedMutator',
        file: 'src/main/java/com/bigtech/banking/lifecycle/AccountLifecycleService.java',
        line: 42,
        mutatedContent: `package com.bigtech.banking.lifecycle;
import java.math.BigDecimal;
public class AccountLifecycleService {
    public sealed interface AccountState permits PendingKycState, ActiveState, FrozenState, ClosedState {
        String accountId(); BigDecimal balance();
    }
    public record PendingKycState(String accountId, BigDecimal balance) implements AccountState {}
    public record ActiveState(String accountId, BigDecimal balance) implements AccountState {}
    public record FrozenState(String accountId, BigDecimal balance) implements AccountState {}
    public record ClosedState(String accountId, BigDecimal balance) implements AccountState {}
    public AccountState create(String id) { return new PendingKycState(id, BigDecimal.ZERO); }
    public AccountState verifyKyc(AccountState s) { return new ActiveState(s.accountId(), s.balance()); }
    public AccountState deposit(AccountState s, BigDecimal a) { return new ActiveState(s.accountId(), s.balance().add(a)); }
    public AccountState withdraw(AccountState state, BigDecimal amt) {
        // MUTANT: allows withdrawal from FrozenState!
        if (state instanceof FrozenState s) return new FrozenState(s.accountId(), s.balance().subtract(amt));
        if (state instanceof ActiveState s) return new ActiveState(s.accountId(), s.balance().subtract(amt));
        throw new IllegalStateException("Bad");
    }
    public AccountState freeze(AccountState s) { return new FrozenState(s.accountId(), s.balance()); }
    public AccountState unfreeze(AccountState s) { return new ActiveState(s.accountId(), s.balance()); }
    public AccountState close(AccountState s) { return s; }
}`
      },
      {
        id: 'mutant_als_04_non_zero_closure',
        name: 'NonZeroClosureAllowedMutator',
        file: 'src/main/java/com/bigtech/banking/lifecycle/AccountLifecycleService.java',
        line: 58,
        mutatedContent: `package com.bigtech.banking.lifecycle;
import java.math.BigDecimal;
public class AccountLifecycleService {
    public sealed interface AccountState permits PendingKycState, ActiveState, FrozenState, ClosedState {
        String accountId(); BigDecimal balance();
    }
    public record PendingKycState(String accountId, BigDecimal balance) implements AccountState {}
    public record ActiveState(String accountId, BigDecimal balance) implements AccountState {}
    public record FrozenState(String accountId, BigDecimal balance) implements AccountState {}
    public record ClosedState(String accountId, BigDecimal balance) implements AccountState {}
    public AccountState create(String id) { return new PendingKycState(id, BigDecimal.ZERO); }
    public AccountState verifyKyc(AccountState s) { return new ActiveState(s.accountId(), s.balance()); }
    public AccountState deposit(AccountState s, BigDecimal a) { return new ActiveState(s.accountId(), s.balance().add(a)); }
    public AccountState withdraw(AccountState s, BigDecimal a) { return s; }
    public AccountState freeze(AccountState s) { return s; }
    public AccountState unfreeze(AccountState s) { return s; }
    public AccountState close(AccountState state) {
        // MUTANT: allows closing non-zero accounts!
        return new ClosedState(state.accountId(), BigDecimal.ZERO);
    }
}`
      },
      {
        id: 'mutant_als_05_terminal_reactivation',
        name: 'TerminalStateReactivationMutator',
        file: 'src/main/java/com/bigtech/banking/lifecycle/AccountLifecycleService.java',
        line: 31,
        mutatedContent: `package com.bigtech.banking.lifecycle;
import java.math.BigDecimal;
public class AccountLifecycleService {
    public sealed interface AccountState permits PendingKycState, ActiveState, FrozenState, ClosedState {
        String accountId(); BigDecimal balance();
    }
    public record PendingKycState(String accountId, BigDecimal balance) implements AccountState {}
    public record ActiveState(String accountId, BigDecimal balance) implements AccountState {}
    public record FrozenState(String accountId, BigDecimal balance) implements AccountState {}
    public record ClosedState(String accountId, BigDecimal balance) implements AccountState {}
    public AccountState create(String id) { return new PendingKycState(id, BigDecimal.ZERO); }
    public AccountState verifyKyc(AccountState s) { return new ActiveState(s.accountId(), s.balance()); }
    public AccountState deposit(AccountState state, BigDecimal amt) {
        // MUTANT: allows deposit on ClosedState!
        if (state instanceof ClosedState s) return new ActiveState(s.accountId(), amt);
        return state;
    }
    public AccountState withdraw(AccountState s, BigDecimal a) { return s; }
    public AccountState freeze(AccountState s) { return s; }
    public AccountState unfreeze(AccountState s) { return s; }
    public AccountState close(AccountState s) { return s; }
}`
      }
    ]
  },

  // =========================================================================
  // 5. Custom JUnit 5 Extension for Context Cleanup & Security
  // =========================================================================
  {
    id: 'kata_test_security_context_cleanup_extension',
    slug: 'kata-test-security-context-cleanup-extension',
    title: 'KATA-TEST-14: Security Context JUnit 5 Extension (ThreadLocal Guard)',
    category: 'testing_mutation',
    track: 'testing_mutation',
    badge: '🧬 JUnit 5 Extension',
    difficulty: 'Senior',
    targetStack: 'Java 21 LTS, JUnit 5 Extensions, ThreadLocal',
    timeLimitMinutes: 45,
    shortDescription: 'Реализация BeforeEachCallback и AfterEachCallback для превентивного перехвата утечек ThreadLocal.',
    instructionsMarkdown: `### 🎯 Инженерная задача
В многопоточных средах пул потоков переиспользует воркеры. Если \`SecurityContextHolder\` или \`MdcHolder\` не очищаются после выполнения запроса, возникает **Cross-Tenant Leakage**:
- Следующий запрос на переиспользованном потоке унаследует права предыдущего пользователя.
- Неправильные traceId попадают в телеметрию.

### 🧪 Ваша цель
В \`SecurityContextExtensionTest.java\` напишите тесты жизненного цикла для расширения JUnit 5 (\`BeforeEachCallback\`, \`AfterEachCallback\`), уничтожающие всех 5 мутантов:
1. **Mutant 1 (OmitAfterEachClear):** Пропуск вызова \`SecurityContextHolder.clear()\` в \`afterEach\`.
2. **Mutant 2 (IgnoreMdcClear):** Пропуск очистки \`MdcHolder\` в \`afterEach\`.
3. **Mutant 3 (NegateLeakDetection):** Отключение детекции утечек при наличии неубранного контекста.
4. **Mutant 4 (BeforeEachOmission):** Пропуск инициализации пользователя перед тестом.
5. **Mutant 5 (RoleEscalationMutator):** Подмена роли обычного пользователя на ADMIN.`,
    workspaceFiles: [
      {
        path: 'src/main/java/com/bigtech/security/context/SecurityContext.java',
        content: `package com.bigtech.security.context;

public class SecurityContext {
    public record UserPrincipal(String username, String role) {}

    private static final ThreadLocal<UserPrincipal> PRINCIPAL = new ThreadLocal<>();
    private static final ThreadLocal<String> TRACE_ID = new ThreadLocal<>();

    public static void setPrincipal(UserPrincipal p) { PRINCIPAL.set(p); }
    public static UserPrincipal getPrincipal() { return PRINCIPAL.get(); }
    public static void clearPrincipal() { PRINCIPAL.remove(); }

    public static void setTraceId(String tid) { TRACE_ID.set(tid); }
    public static String getTraceId() { return TRACE_ID.get(); }
    public static void clearTraceId() { TRACE_ID.remove(); }

    public static boolean hasLeakedState() {
        return PRINCIPAL.get() != null || TRACE_ID.get() != null;
    }
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/main/java/com/bigtech/security/context/SecurityContextLifecycleExtension.java',
        content: `package com.bigtech.security.context;

import com.bigtech.security.context.SecurityContext.UserPrincipal;
import java.util.Objects;

public class SecurityContextLifecycleExtension {

    public void onBeforeEach(String username, String role, String traceId) {
        Objects.requireNonNull(username);
        SecurityContext.setPrincipal(new UserPrincipal(username, role));
        if (traceId != null) SecurityContext.setTraceId(traceId);
    }

    public void onAfterEach(boolean expectCleanState) {
        if (expectCleanState && SecurityContext.hasLeakedState()) {
            SecurityContext.clearPrincipal();
            SecurityContext.clearTraceId();
            throw new AssertionError("ThreadLocal state leaked across test boundary!");
        }
        SecurityContext.clearPrincipal();
        SecurityContext.clearTraceId();
    }
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/test/java/com/bigtech/security/context/SecurityContextExtensionTest.java',
        content: `package com.bigtech.security.context;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SecurityContextExtensionTest {

    private final SecurityContextLifecycleExtension extension = new SecurityContextLifecycleExtension();

    @Test
    @DisplayName("Should populate security context and trace ID before test (Kills M4, M5)")
    void shouldPopulateContextOnBeforeEach() {
        extension.onBeforeEach("bob", "USER", "trace-101");
        assertThat(SecurityContext.getPrincipal()).isNotNull();
        assertThat(SecurityContext.getPrincipal().username()).isEqualTo("bob");
        assertThat(SecurityContext.getPrincipal().role()).isEqualTo("USER");
        assertThat(SecurityContext.getTraceId()).isEqualTo("trace-101");
        extension.onAfterEach(false);
    }

    @Test
    @DisplayName("Should detect and fail if ThreadLocal leaks (Kills M3)")
    void shouldDetectStateLeak() {
        extension.onBeforeEach("alice", "STAFF", null);
        // Test finishes without cleaning ThreadLocal
        assertThatThrownBy(() -> extension.onAfterEach(true))
            .isInstanceOf(AssertionError.class)
            .hasMessageContaining("ThreadLocal state leaked");
    }

    @Test
    @DisplayName("Should purge context in afterEach to protect downstream tests (Kills M1, M2)")
    void shouldPurgeContextInAfterEach() {
        extension.onBeforeEach("charlie", "ADMIN", "trace-999");
        extension.onAfterEach(false);

        assertThat(SecurityContext.getPrincipal()).isNull();
        assertThat(SecurityContext.getTraceId()).isNull();
        assertThat(SecurityContext.hasLeakedState()).isFalse();
    }
}`,
        readOnly: false,
        hidden: false,
        isMainEntryPoint: true
      }
    ],
    mutants: [
      {
        id: 'mutant_scl_01_omit_principal_clear',
        name: 'OmitPrincipalClearMutator',
        file: 'src/main/java/com/bigtech/security/context/SecurityContextLifecycleExtension.java',
        line: 19,
        mutatedContent: `package com.bigtech.security.context;
public class SecurityContextLifecycleExtension {
    public void onBeforeEach(String u, String r, String t) { SecurityContext.setPrincipal(new SecurityContext.UserPrincipal(u, r)); }
    public void onAfterEach(boolean expectClean) {
        // MUTANT: clearPrincipal() omitted!
        SecurityContext.clearTraceId();
    }
}`
      },
      {
        id: 'mutant_scl_02_omit_trace_clear',
        name: 'OmitTraceClearMutator',
        file: 'src/main/java/com/bigtech/security/context/SecurityContextLifecycleExtension.java',
        line: 20,
        mutatedContent: `package com.bigtech.security.context;
public class SecurityContextLifecycleExtension {
    public void onBeforeEach(String u, String r, String t) { SecurityContext.setTraceId(t); }
    public void onAfterEach(boolean expectClean) {
        SecurityContext.clearPrincipal();
        // MUTANT: clearTraceId() omitted!
    }
}`
      },
      {
        id: 'mutant_scl_03_negate_leak',
        name: 'NegateLeakDetectionMutator',
        file: 'src/main/java/com/bigtech/security/context/SecurityContextLifecycleExtension.java',
        line: 15,
        mutatedContent: `package com.bigtech.security.context;
public class SecurityContextLifecycleExtension {
    public void onBeforeEach(String u, String r, String t) { SecurityContext.setPrincipal(new SecurityContext.UserPrincipal(u, r)); }
    public void onAfterEach(boolean expectClean) {
        // MUTANT: does not throw even if leaked!
        SecurityContext.clearPrincipal();
        SecurityContext.clearTraceId();
    }
}`
      },
      {
        id: 'mutant_scl_04_before_omission',
        name: 'BeforeEachOmissionMutator',
        file: 'src/main/java/com/bigtech/security/context/SecurityContextLifecycleExtension.java',
        line: 9,
        mutatedContent: `package com.bigtech.security.context;
public class SecurityContextLifecycleExtension {
    public void onBeforeEach(String u, String r, String t) {
        // MUTANT: does not set principal or trace!
    }
    public void onAfterEach(boolean expectClean) {
        SecurityContext.clearPrincipal();
        SecurityContext.clearTraceId();
    }
}`
      },
      {
        id: 'mutant_scl_05_role_escalation',
        name: 'RoleEscalationMutator',
        file: 'src/main/java/com/bigtech/security/context/SecurityContextLifecycleExtension.java',
        line: 11,
        mutatedContent: `package com.bigtech.security.context;
public class SecurityContextLifecycleExtension {
    public void onBeforeEach(String u, String r, String t) {
        // MUTANT: escalates role to ADMIN!
        SecurityContext.setPrincipal(new SecurityContext.UserPrincipal(u, "ADMIN"));
    }
    public void onAfterEach(boolean expectClean) {
        SecurityContext.clearPrincipal();
        SecurityContext.clearTraceId();
    }
}`
      }
    ]
  }
];
