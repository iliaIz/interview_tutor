import { CodingChallenge } from '../challengeSeedData';

export const L1_REVERSE_PART1: CodingChallenge[] = [
  // 1. REV-01: Spot the Fake Assertion (Line Hitter Smell)
  {
    id: 'kata_rev_01_fake_assertion',
    slug: 'kata-rev-01-fake-assertion',
    title: 'REV-01: Spot the Fake Assertion (Line Hitter)',
    category: 'testing_mutation',
    track: 'testing_mutation',
    badge: '🟡 L1: Reverse Testing',
    difficulty: 'Middle',
    targetStack: 'Java 21 LTS, AssertJ, PITest Gregor',
    timeLimitMinutes: 20,
    shortDescription: 'Тест дает 100% Line Coverage, но пропускает фатальный дефект. Добавьте убивающее утверждение.',
    instructionsMarkdown: `### 🎯 Инженерная ситуация (Code Defenders)
Перед вами тест, написанный недобросовестным разработчиком:
- Он дает **100% Line Coverage** в JaCoCo.
- Однако он содержит псевдо-оракул: \`assertNotNull(user)\` вместо проверки полей.
- В результате **Mutant 1** выживает!

### 🧪 Ваша цель:
Изучите выжившего мутанта и добавьте точное утверждение на поле \`status\`, чтобы уничтожить его.`,
    workspaceFiles: [
      {
        path: 'src/main/java/com/curriculum/reverse/UserAccount.java',
        content: `package com.curriculum.reverse;

public record UserAccount(String id, String email, String status) {}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/main/java/com/curriculum/reverse/AccountActivationService.java',
        content: `package com.curriculum.reverse;

public class AccountActivationService {
    public UserAccount activate(String id, String email) {
        // Корректная логика: статус обязан быть ACTIVE
        return new UserAccount(id, email, "ACTIVE");
    }
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/test/java/com/curriculum/reverse/AccountActivationTest.java',
        content: `package com.curriculum.reverse;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import static org.assertj.core.api.Assertions.assertThat;

public class AccountActivationTest {

    private final AccountActivationService service = new AccountActivationService();

    @Test
    @DisplayName("Should activate user account")
    public void shouldActivateAccount() {
        UserAccount account = service.activate("USR-1", "test@domain.com");

        // Слабый оракул (Line Hitter): покрывает строку, но не проверяет статус!
        assertThat(account).isNotNull();
        // Убивающее утверждение
        assertThat(account.status()).isEqualTo("ACTIVE");
    }
}`,
        readOnly: false,
        hidden: false
      }
    ],
    mutants: [
      {
        id: 'mutant_rev_01_corrupt_status',
        name: 'ReturnValsMutator (Corrupted status)',
        description: 'Возврат статуса PENDING вместо ACTIVE',
        file: 'src/main/java/com/curriculum/reverse/AccountActivationService.java',
        line: 6,
        mutatedContent: `package com.curriculum.reverse;

public class AccountActivationService {
    public UserAccount activate(String id, String email) {
        return new UserAccount(id, email, "PENDING");
    }
}`
      }
    ]
  },

  // 2. REV-02: Survived Conditionals Boundary (< vs <=)
  {
    id: 'kata_rev_02_survived_boundary',
    slug: 'kata-rev-02-survived-boundary',
    title: 'REV-02: Survived Conditionals Boundary (< vs <=)',
    category: 'testing_mutation',
    track: 'testing_mutation',
    badge: '🟡 L1: Reverse Testing',
    difficulty: 'Middle',
    targetStack: 'Java 21 LTS, JUnit 5, AssertJ',
    timeLimitMinutes: 20,
    shortDescription: 'Найдите пропущенную граничную точку в существующем сьюте и уничтожьте мутанта.',
    instructionsMarkdown: `### 🎯 Инженерная ситуация
Существующий тест проверяет балансы $50$ и $500$, но пропускает точную границу кредитного лимита $0.00$.
Мутатор заменил \`balance.compareTo(BigDecimal.ZERO) < 0\` на \`<= 0\`.
Счет с балансом ровно $0.00$ стал считаться заблокированным!

### 🧪 Ваша цель:
Добавьте тест на нулевой баланс, чтобы убить **ConditionalsBoundaryMutator**.`,
    workspaceFiles: [
      {
        path: 'src/main/java/com/curriculum/reverse/CreditService.java',
        content: `package com.curriculum.reverse;

import java.math.BigDecimal;

public class CreditService {
    public boolean canWithdraw(BigDecimal currentBalance, BigDecimal amount) {
        BigDecimal remaining = currentBalance.subtract(amount);
        // Разрешено, если остаток строго >= 0.00 (т.е. remaining < 0 запрещено)
        if (remaining.compareTo(BigDecimal.ZERO) < 0) {
            return false;
        }
        return true;
    }
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/test/java/com/curriculum/reverse/CreditServiceTest.java',
        content: `package com.curriculum.reverse;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import java.math.BigDecimal;
import static org.assertj.core.api.Assertions.assertThat;

public class CreditServiceTest {

    private final CreditService creditService = new CreditService();

    @Test
    @DisplayName("Should allow withdrawal when funds are sufficient")
    public void shouldAllowWithdrawal() {
        boolean allowed = creditService.canWithdraw(new BigDecimal("100.00"), new BigDecimal("50.00"));
        assertThat(allowed).isTrue();
    }

    @Test
    @DisplayName("Should allow withdrawal to exact zero balance")
    public void shouldAllowExactZeroBalance() {
        // Убивает мутацию < на <= при нулевом остатке
        boolean allowed = creditService.canWithdraw(new BigDecimal("100.00"), new BigDecimal("100.00"));
        assertThat(allowed).isTrue();
    }
}`,
        readOnly: false,
        hidden: false
      }
    ],
    mutants: [
      {
        id: 'mutant_rev_02_boundary',
        name: 'ConditionalsBoundaryMutator (< to <=)',
        description: 'Замена remaining.compareTo(ZERO) < 0 на <= 0',
        file: 'src/main/java/com/curriculum/reverse/CreditService.java',
        line: 9,
        mutatedContent: `package com.curriculum.reverse;

import java.math.BigDecimal;

public class CreditService {
    public boolean canWithdraw(BigDecimal currentBalance, BigDecimal amount) {
        BigDecimal remaining = currentBalance.subtract(amount);
        if (remaining.compareTo(BigDecimal.ZERO) <= 0) {
            return false;
        }
        return true;
    }
}`
      }
    ]
  },

  // 3. REV-03: The Over-Mocked Ghost Test
  {
    id: 'kata_rev_03_over_mocking_trap',
    slug: 'kata-rev-03-over-mocking-trap',
    title: 'REV-03: The Over-Mocked Ghost Test',
    category: 'testing_mutation',
    track: 'testing_mutation',
    badge: '🟡 L1: Reverse Testing',
    difficulty: 'Middle',
    targetStack: 'Java 21 LTS, Mockito 5, AssertJ',
    timeLimitMinutes: 25,
    shortDescription: 'Устраните хрупкость теста: замените избыточное мокирование внутренних вызовов проверкой результата.',
    instructionsMarkdown: `### 🎯 Инженерная ситуация
Тест мокает чистый внутренний хелпер \`TaxCalculator\`. 
При смене алгоритма округления тест ломается, хотя публичный контракт не нарушен!
Перепишите тест, используя реальный экземпляр хелпера, проверяя конечное состояние.`,
    workspaceFiles: [
      {
        path: 'src/main/java/com/curriculum/reverse/TaxHelper.java',
        content: `package com.curriculum.reverse;

import java.math.BigDecimal;
import java.math.RoundingMode;

public class TaxHelper {
    public BigDecimal calculateVat(BigDecimal amount) {
        return amount.multiply(new BigDecimal("0.20")).setScale(2, RoundingMode.HALF_UP);
    }
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/main/java/com/curriculum/reverse/InvoiceService.java',
        content: `package com.curriculum.reverse;

import java.math.BigDecimal;

public class InvoiceService {
    private final TaxHelper taxHelper;

    public InvoiceService(TaxHelper taxHelper) {
        this.taxHelper = taxHelper;
    }

    public BigDecimal calculateTotal(BigDecimal netAmount) {
        BigDecimal vat = taxHelper.calculateVat(netAmount);
        return netAmount.add(vat);
    }
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/test/java/com/curriculum/reverse/InvoiceServiceTest.java',
        content: `package com.curriculum.reverse;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import java.math.BigDecimal;
import static org.assertj.core.api.Assertions.assertThat;

public class InvoiceServiceTest {

    // Тестируем с реальным хелпером (State Testing вместо Over-Mocking)
    private final TaxHelper realTaxHelper = new TaxHelper();
    private final InvoiceService invoiceService = new InvoiceService(realTaxHelper);

    @Test
    @DisplayName("Should correctly calculate total with 20 percent VAT")
    public void shouldCalculateTotalWithVat() {
        BigDecimal total = invoiceService.calculateTotal(new BigDecimal("100.00"));

        // 100.00 + 20.00 = 120.00
        assertThat(total).isEqualByComparingTo(new BigDecimal("120.00"));
    }
}`,
        readOnly: false,
        hidden: false
      }
    ],
    mutants: [
      {
        id: 'mutant_rev_03_vat_rate',
        name: 'TaxRateMutator (0.10 instead of 0.20)',
        description: 'Подмена ставки НДС в TaxHelper',
        file: 'src/main/java/com/curriculum/reverse/TaxHelper.java',
        line: 8,
        mutatedContent: `package com.curriculum.reverse;

import java.math.BigDecimal;
import java.math.RoundingMode;

public class TaxHelper {
    public BigDecimal calculateVat(BigDecimal amount) {
        return amount.multiply(new BigDecimal("0.10")).setScale(2, RoundingMode.HALF_UP);
    }
}`
      }
    ]
  }
];
