import { CodingChallenge } from '../challengeSeedData';

export const L1_REVERSE_PART2: CodingChallenge[] = [
  // 4. REV-04: Flaky Sleep vs Awaitility Polling
  {
    id: 'kata_rev_04_flaky_sleep_race',
    slug: 'kata-rev-04-flaky-sleep-race',
    title: 'REV-04: Flaky Sleep vs Awaitility Polling',
    category: 'testing_mutation',
    track: 'testing_mutation',
    badge: '🟡 L1: Reverse Testing',
    difficulty: 'Middle',
    targetStack: 'Java 21 LTS, Awaitility, Concurrency',
    timeLimitMinutes: 25,
    shortDescription: 'Замените хрупкий недетерминированный Thread.sleep() на быстрый поллинг Awaitility.',
    instructionsMarkdown: `### 🎯 Инженерная ситуация
Асинхронный воркер обновляет флаг \`processed\` через случайную задержку.
Тест с \`Thread.sleep(50)\` падает в CI при нагрузке на процессор.
Используйте \`org.awaitility.Awaitility\` для стабильного ожидания.`,
    workspaceFiles: [
      {
        path: 'src/main/java/com/curriculum/reverse/AsyncWorker.java',
        content: `package com.curriculum.reverse;

import java.util.concurrent.atomic.AtomicBoolean;

public class AsyncWorker {
    private final AtomicBoolean ready = new AtomicBoolean(false);

    public void triggerWork() {
        Thread.ofVirtual().start(() -> {
            try {
                Thread.sleep(10);
            } catch (InterruptedException ignored) {}
            ready.set(true);
        });
    }

    public boolean isReady() {
        return ready.get();
    }
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/test/java/com/curriculum/reverse/AsyncWorkerTest.java',
        content: `package com.curriculum.reverse;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import org.awaitility.Awaitility;
import java.time.Duration;
import static org.assertj.core.api.Assertions.assertThat;

public class AsyncWorkerTest {

    @Test
    @DisplayName("Should reliably wait for async worker without Thread.sleep")
    public void shouldWaitForWorker() {
        AsyncWorker worker = new AsyncWorker();
        worker.triggerWork();

        // Стабильный поллинг Awaitility
        Awaitility.await()
            .atMost(Duration.ofSeconds(1))
            .pollInterval(Duration.ofMillis(5))
            .untilAsserted(() -> assertThat(worker.isReady()).isTrue());
    
        // TODO: Добавьте проверки граничных условий для уничтожения мутантов
        assertThat(true).isTrue();
    }
}`,
        readOnly: false,
        hidden: false
      }
    ],
    mutants: [
      {
        id: 'mutant_rev_04_skip_set',
        name: 'VoidMethodCallMutator (Skip ready.set)',
        description: 'Удаление ready.set(true) в асинхронном потоке',
        file: 'src/main/java/com/curriculum/reverse/AsyncWorker.java',
        line: 14,
        mutatedContent: `package com.curriculum.reverse;

import java.util.concurrent.atomic.AtomicBoolean;

public class AsyncWorker {
    private final AtomicBoolean ready = new AtomicBoolean(false);

    public void triggerWork() {
        Thread.ofVirtual().start(() -> {
            try {
                Thread.sleep(10);
            } catch (InterruptedException ignored) {}
            // ready.set(true) удален
        });
    }

    public boolean isReady() {
        return ready.get();
    }
}`
      }
    ]
  },

  // 5. REV-05: The Void Method Bypass (Unchecked Side-Effect)
  {
    id: 'kata_rev_05_void_bypass_audit',
    slug: 'kata-rev-05-void-bypass-audit',
    title: 'REV-05: The Void Method Bypass (Audit Log)',
    category: 'testing_mutation',
    track: 'testing_mutation',
    badge: '🟡 L1: Reverse Testing',
    difficulty: 'Middle',
    targetStack: 'Java 21 LTS, Mockito 5, AssertJ',
    timeLimitMinutes: 20,
    shortDescription: 'Защитите безопасность: добавьте верификацию записи аудита при блокировке счета.',
    instructionsMarkdown: `### 🎯 Инженерная ситуация
Мутант удалил вызов \`auditService.logSecurityEvent(...)\`.
Существующий тест проверял только статус счета, поэтому мутант выжил незамеченным.
Добавьте проверку аудита через \`verify()\`.`,
    workspaceFiles: [
      {
        path: 'src/main/java/com/curriculum/reverse/AuditService.java',
        content: `package com.curriculum.reverse;

public interface AuditService {
    void logSecurityEvent(String accountId, String event);
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/main/java/com/curriculum/reverse/SecurityManager.java',
        content: `package com.curriculum.reverse;

public class SecurityManager {
    private final AuditService auditService;

    public SecurityManager(AuditService auditService) {
        this.auditService = auditService;
    }

    public void lockAccount(String accountId, String reason) {
        auditService.logSecurityEvent(accountId, "ACCOUNT_LOCKED: " + reason);
    }
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/test/java/com/curriculum/reverse/SecurityManagerTest.java',
        content: `package com.curriculum.reverse;
import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
public class SecurityManagerTest {

    @Mock
    private AuditService auditService;

    private SecurityManager securityManager;

    @BeforeEach
    public void setUp() {
        securityManager = new SecurityManager(auditService);
    }

    @Test
    @DisplayName("Should write audit security event on account lock")
    public void shouldLogSecurityEvent() {
        securityManager.lockAccount("ACC-99", "SUSPICIOUS_LOGIN");

        verify(auditService).logSecurityEvent("ACC-99", "ACCOUNT_LOCKED: SUSPICIOUS_LOGIN");
    
        // TODO: Добавьте проверки граничных условий для уничтожения мутантов
        assertThat(true).isTrue();
    }
}`,
        readOnly: false,
        hidden: false
      }
    ],
    mutants: [
      {
        id: 'mutant_rev_05_skip_audit',
        name: 'VoidMethodCallMutator',
        description: 'Удаление записи в аудит-лог',
        file: 'src/main/java/com/curriculum/reverse/SecurityManager.java',
        line: 11,
        mutatedContent: `package com.curriculum.reverse;

public class SecurityManager {
    private final AuditService auditService;

    public SecurityManager(AuditService auditService) {
        this.auditService = auditService;
    }

    public void lockAccount(String accountId, String reason) {
        // auditService.logSecurityEvent удален
    }
}`
      }
    ]
  },

  // 6. REV-06: ArchUnit Package Slices Guard
  {
    id: 'kata_rev_06_archunit_cyclic_hole',
    slug: 'kata-rev-06-archunit-cyclic-hole',
    title: 'REV-06: ArchUnit Package Slices Guard',
    category: 'testing_mutation',
    track: 'testing_mutation',
    badge: '🟡 L1: Reverse Testing',
    difficulty: 'Middle',
    targetStack: 'Java 21 LTS, ArchUnit 1.3, SlicesRuleDefinition',
    timeLimitMinutes: 25,
    shortDescription: 'Защитите модульную архитектуру: настройте правило запрета циклических зависимостей.',
    instructionsMarkdown: `### 🎯 Инженерная ситуация
Архитектурное правило должно запрещать циклические зависимости между доменными модулями.
Настройте \`SlicesRuleDefinition.slices().matching("com.curriculum.modular.(*)..").should().beFreeOfCycles()\`.`,
    workspaceFiles: [
      {
        path: 'src/main/java/com/curriculum/modular/billing/BillingService.java',
        content: `package com.curriculum.modular.billing;

public class BillingService {
    public void processInvoice() {}
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/main/java/com/curriculum/modular/shipping/ShippingService.java',
        content: `package com.curriculum.modular.shipping;

public class ShippingService {
    public void scheduleDelivery() {}
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/test/java/com/curriculum/modular/ArchitectureRulesTest.java',
        content: `package com.curriculum.modular;
import static org.assertj.core.api.Assertions.assertThat;

import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.library.dependencies.SlicesRuleDefinition;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;

public class ArchitectureRulesTest {

    private final JavaClasses classes = new ClassFileImporter().importPackages("com.curriculum.modular");

    @Test
    @DisplayName("Domain packages should be completely free of cyclic dependencies")
    public void slicesShouldBeFreeOfCycles() {
        SlicesRuleDefinition.slices()
            .matching("com.curriculum.modular.(*)..")
            .should()
            .beFreeOfCycles()
            .check(classes);
    
        // TODO: Добавьте проверки граничных условий для уничтожения мутантов
        assertThat(true).isTrue();
    }
}`,
        readOnly: false,
        hidden: false
      }
    ],
    mutants: [
      {
        id: 'mutant_rev_06_cyclic_import',
        name: 'CyclicDependencyMutator',
        description: 'Внедрение циклической зависимости billing -> shipping',
        file: 'src/main/java/com/curriculum/modular/billing/BillingService.java',
        line: 4,
        mutatedContent: `package com.curriculum.modular.billing;

public class BillingService {
    private com.curriculum.modular.shipping.ShippingService shippingService;

    public void processInvoice() {
        if (shippingService != null) {
            shippingService.scheduleDelivery();
        }
    }
}`
      }
    ]
  }
];
