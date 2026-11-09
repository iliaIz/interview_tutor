import { CodingChallenge } from '../challengeSeedData';

export const MOCKITO_CHALLENGES: CodingChallenge[] = [
  // =========================================================================
  // 1. Strict Audit Trail InOrder Verification
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
import static org.assertj.core.api.Assertions.assertThat;

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

    @Test
    @DisplayName("Should not execute audit or notification if debit fails (Kills M3)")
    public void shouldAbortOnDebitFailure() {
        // TODO: Реализуйте проверки для метода shouldAbortOnDebitFailure для уничтожения целевых мутантов
        assertThat(true).isTrue();
    }
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
    private final LedgerPort ledger; private final AuditLoggerPort auditLogger; private final NotificationPort notification;
    public PaymentProcessingService(LedgerPort l, AuditLoggerPort a, NotificationPort n) { this.ledger = l; this.auditLogger = a; this.notification = n; }
    public void processPayment(String userId, BigDecimal amount) {
        auditLogger.logEvent(userId, "DEBIT", amount); // MUTANT: audit before debit!
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
    private final LedgerPort ledger; private final AuditLoggerPort auditLogger; private final NotificationPort notification;
    public PaymentProcessingService(LedgerPort l, AuditLoggerPort a, NotificationPort n) { this.ledger = l; this.auditLogger = a; this.notification = n; }
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
    private final LedgerPort ledger; private final AuditLoggerPort auditLogger; private final NotificationPort notification;
    public PaymentProcessingService(LedgerPort l, AuditLoggerPort a, NotificationPort n) { this.ledger = l; this.auditLogger = a; this.notification = n; }
    public void processPayment(String userId, BigDecimal amount) {
        try { ledger.debit(userId, amount); auditLogger.logEvent(userId, "DEBIT", amount); } catch (Exception ignored) {}
        notification.sendSms(userId, "Payment successful: " + amount); // MUTANT: sends SMS even on failure!
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
    private final LedgerPort ledger; private final AuditLoggerPort auditLogger; private final NotificationPort notification;
    public PaymentProcessingService(LedgerPort l, AuditLoggerPort a, NotificationPort n) { this.ledger = l; this.auditLogger = a; this.notification = n; }
    public void processPayment(String userId, BigDecimal amount) {
        ledger.debit(userId, amount);
        // MUTANT: audit log call omitted!
        notification.sendSms(userId, "Payment successful: " + amount);
    }
}`
      }
    ]
  },

  // =========================================================================
  // 2. Asynchronous Event Publishing & Deep DTO Capturing (ArgumentCaptor)
  // =========================================================================
  {
    id: 'kata_test_async_event_dto_captor',
    slug: 'kata-test-async-event-dto-captor',
    title: 'KATA-TEST-15: Async Event DTO Captor & PII Masking (ArgumentCaptor)',
    category: 'testing_mutation',
    track: 'testing_mutation',
    badge: '🧬 ArgumentCaptor',
    difficulty: 'Senior',
    targetStack: 'Java 21 LTS, Mockito 5, AssertJ, CompletableFuture',
    timeLimitMinutes: 45,
    shortDescription: 'Глубокий захват DTO в CompletableFuture, аудит маскирования PAN по PCI-DSS и защита от утечки PII.',
    instructionsMarkdown: `### 🎯 Инженерная задача
Сервис **PaymentNotificationOrchestrator** преобразует доменные события в защищенные конверты \`EventEnvelope<NotificationPayload>\` для Kafka:
- Добавляет W3C TraceContext (\`traceparent\`, \`X-Correlation-ID\`). Если correlationId пуст — генерирует UUID.
- Маскирует номер карты: оставляет только последние 4 цифры (\`****-****-****-1234\`).
- **Строгий аудит PII:** сырой PAN, CVV и секретные ключи мерчанта никогда не должны попадать в брокер.

### 🧪 Ваша цель
В \`PaymentNotificationOrchestratorTest.java\` используйте \`ArgumentCaptor\` и \`verifyNoMoreInteractions()\`, уничтожив всех 5 мутантов:
1. **Mutant 1 (UnmaskedPanLeak):** Утечка незамаскированного PAN в конверт сообщения.
2. **Mutant 2 (MissingCorrelationIdFallback):** Отсутствие генерации UUID при пустом correlationId.
3. **Mutant 3 (CvvSerializationLeak):** Утечка CVV-кода в полезную нагрузку.
4. **Mutant 4 (TraceparentHeaderOmission):** Пропуск заголовка \`traceparent\`.
5. **Mutant 5 (ShortPanBoundary):** Ошибка маскирования при граничной длине карты (10 символов).`,
    workspaceFiles: [
      {
        path: 'src/main/java/com/enterprise/orchestrator/event/PaymentNotificationOrchestrator.java',
        content: `package com.enterprise.orchestrator.event;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.CompletableFuture;

public class PaymentNotificationOrchestrator {

    public interface EventPublisher {
        CompletableFuture<Boolean> publish(EventEnvelope<NotificationPayload> envelope);
    }

    public record FinancialDetails(long amountInCents, String currency, String rawCardNumber, String cvv, String secretKey) {}
    public record PaymentEvent(String paymentId, String recipientId, String tenantId, String correlationId, FinancialDetails financial) {}
    public record MaskedSummary(long amountInCents, String currency, String maskedPan) {}
    public record NotificationPayload(String paymentId, String recipientId, MaskedSummary summary) {}
    public record EnvelopeMetadata(UUID eventId, Instant timestamp, String correlationId, Map<String, String> headers) {}
    public record EventEnvelope<T>(EnvelopeMetadata metadata, T payload) {}

    private final EventPublisher publisher;

    public PaymentNotificationOrchestrator(EventPublisher publisher) {
        this.publisher = Objects.requireNonNull(publisher);
    }

    public CompletableFuture<Boolean> orchestrate(PaymentEvent event) {
        Objects.requireNonNull(event);
        String corrId = (event.correlationId() != null && !event.correlationId().isBlank())
                ? event.correlationId() : UUID.randomUUID().toString();

        Map<String, String> headers = new HashMap<>();
        headers.put("X-Correlation-ID", corrId);
        headers.put("traceparent", "00-" + corrId.replace("-", "") + "-0000000000000001-01");
        headers.put("X-Tenant-ID", event.tenantId());

        EnvelopeMetadata meta = new EnvelopeMetadata(UUID.randomUUID(), Instant.now(), corrId, Collections.unmodifiableMap(headers));
        NotificationPayload payload = new NotificationPayload(
                event.paymentId(),
                event.recipientId(),
                new MaskedSummary(event.financial().amountInCents(), event.financial().currency(), maskCardNumber(event.financial().rawCardNumber()))
        );

        return publisher.publish(new EventEnvelope<>(meta, payload));
    }

    private String maskCardNumber(String raw) {
        if (raw == null || raw.length() < 10) return "****";
        String clean = raw.replaceAll("\\\\s+", "");
        return "****-****-****-" + clean.substring(clean.length() - 4);
    }
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/test/java/com/enterprise/orchestrator/event/PaymentNotificationOrchestratorTest.java',
        content: `package com.enterprise.orchestrator.event;

import com.enterprise.orchestrator.event.PaymentNotificationOrchestrator.*;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import java.util.concurrent.CompletableFuture;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PaymentNotificationOrchestratorTest {

    @Mock private EventPublisher publisher;
    @Captor private ArgumentCaptor<EventEnvelope<NotificationPayload>> captor;

    @Test
    @DisplayName("Should capture async DTO, mask PAN and verify W3C headers (Kills M1, M3, M4)")
    void shouldCaptureAndAuditDto() {
        when(publisher.publish(any())).thenReturn(CompletableFuture.completedFuture(true));
        PaymentNotificationOrchestrator orchestrator = new PaymentNotificationOrchestrator(publisher);

        var fin = new FinancialDetails(5000L, "USD", "4111222233334444", "123", "secret-vault-key");
        var event = new PaymentEvent("PAY-1", "REC-1", "TENANT-1", "corr-123", fin);

        orchestrator.orchestrate(event);

        verify(publisher).publish(captor.capture());
        verifyNoMoreInteractions(publisher);

        EventEnvelope<NotificationPayload> envelope = captor.getValue();
        assertThat(envelope.payload().summary().maskedPan()).isEqualTo("****-****-****-4444");
        assertThat(envelope.payload().toString()).doesNotContain("123").doesNotContain("secret-vault-key");
        assertThat(envelope.metadata().headers()).containsKey("traceparent");
    }

    @Test
    @DisplayName("Should generate UUID correlationId when missing or blank (Kills M2)")
    void shouldGenerateFallbackCorrelationId() {
        // TODO: Реализуйте проверки для метода shouldGenerateFallbackCorrelationId для уничтожения целевых мутантов
        assertThat(true).isTrue();
    }

    @Test
    @DisplayName("Should correctly mask 10-char boundary card number (Kills M5)")
    void shouldMaskTenCharCardNumber() {
        // TODO: Реализуйте проверки для метода shouldMaskTenCharCardNumber для уничтожения целевых мутантов
        assertThat(true).isTrue();
    }
}`,
        readOnly: false,
        hidden: false,
        isMainEntryPoint: true
      }
    ],
    mutants: [
      {
        id: 'mutant_pno_01_unmasked_pan',
        name: 'UnmaskedPanLeakMutator',
        file: 'src/main/java/com/enterprise/orchestrator/event/PaymentNotificationOrchestrator.java',
        line: 39,
        mutatedContent: `package com.enterprise.orchestrator.event;
import java.time.Instant; import java.util.*; import java.util.concurrent.CompletableFuture;
public class PaymentNotificationOrchestrator {
    public interface EventPublisher { CompletableFuture<Boolean> publish(EventEnvelope<NotificationPayload> e); }
    public record FinancialDetails(long amountInCents, String currency, String rawCardNumber, String cvv, String secretKey) {}
    public record PaymentEvent(String paymentId, String recipientId, String tenantId, String correlationId, FinancialDetails financial) {}
    public record MaskedSummary(long amountInCents, String currency, String maskedPan) {}
    public record NotificationPayload(String paymentId, String recipientId, MaskedSummary summary) {}
    public record EnvelopeMetadata(UUID eventId, Instant timestamp, String correlationId, Map<String, String> headers) {}
    public record EventEnvelope<T>(EnvelopeMetadata metadata, T payload) {}
    private final EventPublisher publisher;
    public PaymentNotificationOrchestrator(EventPublisher p) { this.publisher = p; }
    public CompletableFuture<Boolean> orchestrate(PaymentEvent event) {
        // MUTANT: leaks raw card number!
        NotificationPayload payload = new NotificationPayload(event.paymentId(), event.recipientId(), new MaskedSummary(event.financial().amountInCents(), event.financial().currency(), event.financial().rawCardNumber()));
        return publisher.publish(new EventEnvelope<>(new EnvelopeMetadata(UUID.randomUUID(), Instant.now(), "c", Map.of()), payload));
    }
}`
      },
      {
        id: 'mutant_pno_02_missing_fallback_uuid',
        name: 'MissingCorrelationIdFallbackMutator',
        file: 'src/main/java/com/enterprise/orchestrator/event/PaymentNotificationOrchestrator.java',
        line: 28,
        mutatedContent: `package com.enterprise.orchestrator.event;
import java.time.Instant; import java.util.*; import java.util.concurrent.CompletableFuture;
public class PaymentNotificationOrchestrator {
    public interface EventPublisher { CompletableFuture<Boolean> publish(EventEnvelope<NotificationPayload> e); }
    public record FinancialDetails(long amountInCents, String currency, String rawCardNumber, String cvv, String secretKey) {}
    public record PaymentEvent(String paymentId, String recipientId, String tenantId, String correlationId, FinancialDetails financial) {}
    public record MaskedSummary(long amountInCents, String currency, String maskedPan) {}
    public record NotificationPayload(String paymentId, String recipientId, MaskedSummary summary) {}
    public record EnvelopeMetadata(UUID eventId, Instant timestamp, String correlationId, Map<String, String> headers) {}
    public record EventEnvelope<T>(EnvelopeMetadata metadata, T payload) {}
    private final EventPublisher publisher;
    public PaymentNotificationOrchestrator(EventPublisher p) { this.publisher = p; }
    public CompletableFuture<Boolean> orchestrate(PaymentEvent event) {
        // MUTANT: keeps blank correlationId!
        String corrId = event.correlationId();
        NotificationPayload payload = new NotificationPayload(event.paymentId(), event.recipientId(), new MaskedSummary(100L, "USD", "****-****-****-4444"));
        return publisher.publish(new EventEnvelope<>(new EnvelopeMetadata(UUID.randomUUID(), Instant.now(), corrId, Map.of()), payload));
    }
}`
      },
      {
        id: 'mutant_pno_03_cvv_leak',
        name: 'CvvSerializationLeakMutator',
        file: 'src/main/java/com/enterprise/orchestrator/event/PaymentNotificationOrchestrator.java',
        line: 38,
        mutatedContent: `package com.enterprise.orchestrator.event;
import java.time.Instant; import java.util.*; import java.util.concurrent.CompletableFuture;
public class PaymentNotificationOrchestrator {
    public interface EventPublisher { CompletableFuture<Boolean> publish(EventEnvelope<NotificationPayload> e); }
    public record FinancialDetails(long amountInCents, String currency, String rawCardNumber, String cvv, String secretKey) {}
    public record PaymentEvent(String paymentId, String recipientId, String tenantId, String correlationId, FinancialDetails financial) {}
    public record MaskedSummary(long amountInCents, String currency, String maskedPan) {}
    // MUTANT: NotificationPayload includes CVV!
    public record NotificationPayload(String paymentId, String recipientId, MaskedSummary summary, String cvv) {}
    public record EnvelopeMetadata(UUID eventId, Instant timestamp, String correlationId, Map<String, String> headers) {}
    public record EventEnvelope<T>(EnvelopeMetadata metadata, T payload) {}
    private final EventPublisher publisher;
    public PaymentNotificationOrchestrator(EventPublisher p) { this.publisher = p; }
    public CompletableFuture<Boolean> orchestrate(PaymentEvent event) {
        NotificationPayload payload = new NotificationPayload(event.paymentId(), event.recipientId(), new MaskedSummary(100L, "USD", "****-****-****-4444"), event.financial().cvv());
        return publisher.publish(new EventEnvelope<>(new EnvelopeMetadata(UUID.randomUUID(), Instant.now(), "corr", Map.of("traceparent", "00-1")), payload));
    }
}`
      },
      {
        id: 'mutant_pno_04_traceparent_omission',
        name: 'TraceparentHeaderOmissionMutator',
        file: 'src/main/java/com/enterprise/orchestrator/event/PaymentNotificationOrchestrator.java',
        line: 32,
        mutatedContent: `package com.enterprise.orchestrator.event;
import java.time.Instant; import java.util.*; import java.util.concurrent.CompletableFuture;
public class PaymentNotificationOrchestrator {
    public interface EventPublisher { CompletableFuture<Boolean> publish(EventEnvelope<NotificationPayload> e); }
    public record FinancialDetails(long amountInCents, String currency, String rawCardNumber, String cvv, String secretKey) {}
    public record PaymentEvent(String paymentId, String recipientId, String tenantId, String correlationId, FinancialDetails financial) {}
    public record MaskedSummary(long amountInCents, String currency, String maskedPan) {}
    public record NotificationPayload(String paymentId, String recipientId, MaskedSummary summary) {}
    public record EnvelopeMetadata(UUID eventId, Instant timestamp, String correlationId, Map<String, String> headers) {}
    public record EventEnvelope<T>(EnvelopeMetadata metadata, T payload) {}
    private final EventPublisher publisher;
    public PaymentNotificationOrchestrator(EventPublisher p) { this.publisher = p; }
    public CompletableFuture<Boolean> orchestrate(PaymentEvent event) {
        // MUTANT: headers map without traceparent!
        Map<String, String> headers = Map.of("X-Correlation-ID", "corr");
        NotificationPayload payload = new NotificationPayload(event.paymentId(), event.recipientId(), new MaskedSummary(100L, "USD", "****-****-****-4444"));
        return publisher.publish(new EventEnvelope<>(new EnvelopeMetadata(UUID.randomUUID(), Instant.now(), "corr", headers), payload));
    }
}`
      },
      {
        id: 'mutant_pno_05_short_pan',
        name: 'ShortPanBoundaryMutator',
        file: 'src/main/java/com/enterprise/orchestrator/event/PaymentNotificationOrchestrator.java',
        line: 45,
        mutatedContent: `package com.enterprise.orchestrator.event;
import java.time.Instant; import java.util.*; import java.util.concurrent.CompletableFuture;
public class PaymentNotificationOrchestrator {
    public interface EventPublisher { CompletableFuture<Boolean> publish(EventEnvelope<NotificationPayload> e); }
    public record FinancialDetails(long amountInCents, String currency, String rawCardNumber, String cvv, String secretKey) {}
    public record PaymentEvent(String paymentId, String recipientId, String tenantId, String correlationId, FinancialDetails financial) {}
    public record MaskedSummary(long amountInCents, String currency, String maskedPan) {}
    public record NotificationPayload(String paymentId, String recipientId, MaskedSummary summary) {}
    public record EnvelopeMetadata(UUID eventId, Instant timestamp, String correlationId, Map<String, String> headers) {}
    public record EventEnvelope<T>(EnvelopeMetadata metadata, T payload) {}
    private final EventPublisher publisher;
    public PaymentNotificationOrchestrator(EventPublisher p) { this.publisher = p; }
    public CompletableFuture<Boolean> orchestrate(PaymentEvent event) {
        // MUTANT: boundary <= 10 causes 10-char PAN to return ****!
        String pan = event.financial().rawCardNumber().length() <= 10 ? "****" : "****-****-****-1234";
        NotificationPayload payload = new NotificationPayload(event.paymentId(), event.recipientId(), new MaskedSummary(100L, "USD", pan));
        return publisher.publish(new EventEnvelope<>(new EnvelopeMetadata(UUID.randomUUID(), Instant.now(), "c", Map.of("traceparent", "00-1")), payload));
    }
}`
      }
    ]
  },

  // =========================================================================
  // 3. Partial Mocking with @Spy: doReturn vs when
  // =========================================================================
  {
    id: 'kata_test_spy_partial_mocking_var',
    slug: 'kata-test-spy-partial-mocking-var',
    title: 'KATA-TEST-16: Partial Mocking @Spy (doReturn vs when Bytecode Trap)',
    category: 'testing_mutation',
    track: 'testing_mutation',
    badge: '🧬 @Spy doReturn Trap',
    difficulty: 'Senior',
    targetStack: 'Java 21 LTS, Mockito 5 @Spy, AssertJ',
    timeLimitMinutes: 45,
    shortDescription: 'Изоляция физического аппаратного HSM через @Spy и преодоление ловушки when() в байткоде JVM.',
    instructionsMarkdown: `### 🎯 Инженерная задача
Сервис квантильного риск-менеджмента **RiskValuationEngine** вычисляет Value-at-Risk (VaR):
- Вычисления чистые, но требуют валидации лицензии через физический HSM-модуль (\`/dev/hsm0\`), бросающий \`HardwareSecurityTokenException\` в среде CI.
- Применение конструкции \`when(spy.validateHsm()).thenReturn(...)\` приводит к **краху JVM**, поскольку аргумент метода вычисляется рантаймом Java до вызова \`when()\`.
- Корректный паттерн: \`doReturn(token).when(spy).validateHsm()\`.

### 🧪 Ваша цель
В \`RiskValuationEngineTest.java\` протестируйте математический расчет VaR с частичным мокированием через \`doReturn()\`, уничтожив всех 5 мутантов:
1. **Mutant 1 (VaRMultiplierMath):** Ошибка расчета коэффициента $1.645$ (95% доверительный интервал).
2. **Mutant 2 (HsmCheckOmission):** Пропуск проверки HSM-токена перед началом расчетов.
3. **Mutant 3 (NegativeExposureAllowed):** Допуск отрицательного размера позиции.
4. **Mutant 4 (ConfidenceLevelClamp):** Игнорирование валидации уровня достоверности.
5. **Mutant 5 (SquareRootMath):** Отсутствие взятия квадратного корня от времени горизонта.`,
    workspaceFiles: [
      {
        path: 'src/main/java/com/enterprise/finance/risk/RiskValuationEngine.java',
        content: `package com.enterprise.finance.risk;

class HardwareSecurityTokenException extends RuntimeException {
    public HardwareSecurityTokenException(String message) { super(message); }
}

public class RiskValuationEngine {

    public String validateHardwareEntitlement(String licenseKey) {
        // Interacts with physical HSM /dev/hsm0
        throw new HardwareSecurityTokenException("FATAL: /dev/hsm0 physical token absent");
    }

    public double calculateValueAtRisk(double portfolioExposure, double dailyVolatility, int horizonDays, String licenseKey) {
        if (portfolioExposure <= 0) throw new IllegalArgumentException("Exposure must be strictly positive");
        if (dailyVolatility <= 0 || dailyVolatility > 1.0) throw new IllegalArgumentException("Volatility must be in (0, 1]");
        if (horizonDays <= 0) throw new IllegalArgumentException("Horizon must be positive");

        String token = validateHardwareEntitlement(licenseKey);
        if (token == null || token.isBlank()) throw new SecurityException("Invalid HSM entitlement token");

        // Parametric VaR (95% normal confidence = 1.645 * sigma * sqrt(t))
        double zScore = 1.645;
        return portfolioExposure * dailyVolatility * Math.sqrt(horizonDays) * zScore;
    }
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/test/java/com/enterprise/finance/risk/RiskValuationEngineTest.java',
        content: `package com.enterprise.finance.risk;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.assertj.core.data.Offset;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doReturn;

@ExtendWith(MockitoExtension.class)
class RiskValuationEngineTest {

    @Spy
    private RiskValuationEngine engine;

    @Test
    @DisplayName("Should use doReturn to stub HSM call and calculate VaR with precision (Kills M1, M5)")
    void shouldCalculateValueAtRiskWithMockedHsm() {
        // doReturn prevents JVM from evaluating real validateHardwareEntitlement() call!
        doReturn("VALID-HSM-TOKEN-2026").when(engine).validateHardwareEntitlement(anyString());

        double var = engine.calculateValueAtRisk(1_000_000.0, 0.02, 10, "lic-99");

        // 1_000_000 * 0.02 * sqrt(10) * 1.645 = 104038.94
        assertThat(var).isCloseTo(104038.94, Offset.offset(0.1));
    }

    @Test
    @DisplayName("Should reject negative or zero exposure (Kills M3)")
    void shouldRejectInvalidExposure() {
        // TODO: Реализуйте проверки для метода shouldRejectInvalidExposure для уничтожения целевых мутантов
        assertThat(true).isTrue();
    }

    @Test
    @DisplayName("Should fail when HSM token validation fails (Kills M2)")
    void shouldFailOnEmptyHsmToken() {
        // TODO: Реализуйте проверки для метода shouldFailOnEmptyHsmToken для уничтожения целевых мутантов
        assertThat(true).isTrue();
    }
}`,
        readOnly: false,
        hidden: false,
        isMainEntryPoint: true
      }
    ],
    mutants: [
      {
        id: 'mutant_rve_01_var_multiplier',
        name: 'VaRMultiplierMathMutator',
        file: 'src/main/java/com/enterprise/finance/risk/RiskValuationEngine.java',
        line: 20,
        mutatedContent: `package com.enterprise.finance.risk;
public class RiskValuationEngine {
    public String validateHardwareEntitlement(String k) { throw new HardwareSecurityTokenException("HSM"); }
    public double calculateValueAtRisk(double exp, double vol, int h, String k) {
        validateHardwareEntitlement(k);
        // MUTANT: 2.0 instead of 1.645!
        return exp * vol * Math.sqrt(h) * 2.0;
    }
}`
      },
      {
        id: 'mutant_rve_02_hsm_omission',
        name: 'HsmCheckOmissionMutator',
        file: 'src/main/java/com/enterprise/finance/risk/RiskValuationEngine.java',
        line: 16,
        mutatedContent: `package com.enterprise.finance.risk;
public class RiskValuationEngine {
    public String validateHardwareEntitlement(String k) { throw new HardwareSecurityTokenException("HSM"); }
    public double calculateValueAtRisk(double exp, double vol, int h, String k) {
        // MUTANT: token validation omitted!
        return exp * vol * Math.sqrt(h) * 1.645;
    }
}`
      },
      {
        id: 'mutant_rve_03_negative_exposure',
        name: 'NegativeExposureAllowedMutator',
        file: 'src/main/java/com/enterprise/finance/risk/RiskValuationEngine.java',
        line: 12,
        mutatedContent: `package com.enterprise.finance.risk;
public class RiskValuationEngine {
    public String validateHardwareEntitlement(String k) { throw new HardwareSecurityTokenException("HSM"); }
    public double calculateValueAtRisk(double exp, double vol, int h, String k) {
        validateHardwareEntitlement(k);
        // MUTANT: allows zero or negative exposure!
        return exp * vol * Math.sqrt(h) * 1.645;
    }
}`
      },
      {
        id: 'mutant_rve_04_volatility_boundary',
        name: 'VolatilityBoundaryMutator',
        file: 'src/main/java/com/enterprise/finance/risk/RiskValuationEngine.java',
        line: 13,
        mutatedContent: `package com.enterprise.finance.risk;
public class RiskValuationEngine {
    public String validateHardwareEntitlement(String k) { throw new HardwareSecurityTokenException("HSM"); }
    public double calculateValueAtRisk(double exp, double vol, int h, String k) {
        validateHardwareEntitlement(k);
        // MUTANT: ignores volatility range check!
        return exp * vol * Math.sqrt(h) * 1.645;
    }
}`
      },
      {
        id: 'mutant_rve_05_sqrt_omission',
        name: 'SquareRootMathMutator',
        file: 'src/main/java/com/enterprise/finance/risk/RiskValuationEngine.java',
        line: 20,
        mutatedContent: `package com.enterprise.finance.risk;
public class RiskValuationEngine {
    public String validateHardwareEntitlement(String k) { throw new HardwareSecurityTokenException("HSM"); }
    public double calculateValueAtRisk(double exp, double vol, int h, String k) {
        validateHardwareEntitlement(k);
        // MUTANT: multiplies by h instead of sqrt(h)!
        return exp * vol * h * 1.645;
    }
}`
      }
    ]
  },

  // =========================================================================
  // 4. Network Resilience & Cascading Retry (InOrder Backoff Verification)
  // =========================================================================
  {
    id: 'kata_test_resilient_cascading_retry',
    slug: 'kata-test-resilient-cascading-retry',
    title: 'KATA-TEST-18: Resilient Cascading Retry & Backoff (InOrder & Sleeper)',
    category: 'testing_mutation',
    track: 'testing_mutation',
    badge: '🧬 InOrder Retry',
    difficulty: 'Senior',
    targetStack: 'Java 21 LTS, Mockito 5, InOrder',
    timeLimitMinutes: 45,
    shortDescription: 'Верификация каскадных сетевых сбоев: Timeout -> 503 -> 200 OK, изоляция времени через Sleeper.',
    instructionsMarkdown: `### 🎯 Инженерная задача
Банковский клиент **ResilientSettlementClient** выполняет расчеты с автоматическим повтором при транзиентных сбоях:
- Обрабатывает последовательность сбоев: \`SocketTimeout\` $\\to$ \`Http503\` $\\to$ \`200 OK\`.
- Применяет экспоненциальный бэкофф: $100\\text{ms} \\to 200\\text{ms} \\to 400\\text{ms}$.
- Время изолировано через интерфейс \`Sleeper\` (запрет прямого вызова \`Thread.sleep()\`).
- При исчерпании 3 попыток обращается к аварийному шлюзу \`FallbackHandler\`.

### 🧪 Ваша цель
В \`ResilientSettlementClientTest.java\` напишите тесты с использованием \`thenThrow().thenReturn()\` и \`InOrder\`, уничтожающие всех 5 мутантов:
1. **Mutant 1 (MaxAttemptsOffByOne):** Прекращение попыток после 2-й итерации.
2. **Mutant 2 (ExponentialBackoffMath):** Линейный бэкофф вместо экспоненциального.
3. **Mutant 3 (FallbackOmissionOnExhaustion):** Отсутствие вызова fallback при исчерпании попыток.
4. **Mutant 4 (SleepOnSuccess):** Засыпание после успешного ответа.
5. **Mutant 5 (FallbackOnSuccess):** Вызов fallback при успешном выполнении.`,
    workspaceFiles: [
      {
        path: 'src/main/java/com/enterprise/resilience/banking/ResilientSettlementClient.java',
        content: `package com.enterprise.resilience.banking;

import java.util.Objects;

public class ResilientSettlementClient {

    public interface RemoteGateway {
        String settle(String txId);
    }

    public interface Sleeper {
        void sleep(long millis);
    }

    public interface FallbackHandler {
        String fallback(String txId, Exception lastError);
    }

    private final RemoteGateway gateway;
    private final Sleeper sleeper;
    private final FallbackHandler fallback;

    public ResilientSettlementClient(RemoteGateway gateway, Sleeper sleeper, FallbackHandler fallback) {
        this.gateway = Objects.requireNonNull(gateway);
        this.sleeper = Objects.requireNonNull(sleeper);
        this.fallback = Objects.requireNonNull(fallback);
    }

    public String executeWithRetry(String txId) {
        int maxAttempts = 3;
        long backoff = 100L;
        Exception lastErr = null;

        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return gateway.settle(txId);
            } catch (Exception ex) {
                lastErr = ex;
                if (attempt < maxAttempts) {
                    sleeper.sleep(backoff);
                    backoff *= 2;
                }
            }
        }
        return fallback.fallback(txId, lastErr);
    }
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/test/java/com/enterprise/resilience/banking/ResilientSettlementClientTest.java',
        content: `package com.enterprise.resilience.banking;

import com.enterprise.resilience.banking.ResilientSettlementClient.*;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ResilientSettlementClientTest {

    @Mock private RemoteGateway gateway;
    @Mock private Sleeper sleeper;
    @Mock private FallbackHandler fallback;

    @Test
    @DisplayName("Should succeed on 3rd attempt with exponential backoff (Kills M1, M2, M4, M5)")
    void shouldSucceedOnThirdAttempt() {
        when(gateway.settle("TX-1"))
            .thenThrow(new RuntimeException("Timeout"))
            .thenThrow(new RuntimeException("503 Unavailable"))
            .thenReturn("SUCCESS-OK");

        ResilientSettlementClient client = new ResilientSettlementClient(gateway, sleeper, fallback);
        String res = client.executeWithRetry("TX-1");

        assertThat(res).isEqualTo("SUCCESS-OK");

        InOrder order = inOrder(gateway, sleeper, fallback);
        order.verify(gateway).settle("TX-1");
        order.verify(sleeper).sleep(100L);
        order.verify(gateway).settle("TX-1");
        order.verify(sleeper).sleep(200L);
        order.verify(gateway).settle("TX-1");
        order.verifyNoMoreInteractions();
        verifyNoInteractions(fallback);
    }

    @Test
    @DisplayName("Should call fallback when all attempts are exhausted (Kills M3)")
    void shouldCallFallbackOnExhaustion() {
        // TODO: Реализуйте проверки для метода shouldCallFallbackOnExhaustion для уничтожения целевых мутантов
        assertThat(true).isTrue();
    }
}`,
        readOnly: false,
        hidden: false,
        isMainEntryPoint: true
      }
    ],
    mutants: [
      {
        id: 'mutant_rsc_01_max_attempts',
        name: 'MaxAttemptsOffByOneMutator',
        file: 'src/main/java/com/enterprise/resilience/banking/ResilientSettlementClient.java',
        line: 30,
        mutatedContent: `package com.enterprise.resilience.banking;
public class ResilientSettlementClient {
    public interface RemoteGateway { String settle(String tx); }
    public interface Sleeper { void sleep(long m); }
    public interface FallbackHandler { String fallback(String tx, Exception e); }
    private final RemoteGateway gateway; private final Sleeper sleeper; private final FallbackHandler fallback;
    public ResilientSettlementClient(RemoteGateway g, Sleeper s, FallbackHandler f) { this.gateway = g; this.sleeper = s; this.fallback = f; }
    public String executeWithRetry(String tx) {
        // MUTANT: maxAttempts = 2 instead of 3!
        for (int i = 1; i <= 2; i++) {
            try { return gateway.settle(tx); } catch (Exception e) { if (i < 2) sleeper.sleep(100L); }
        }
        return fallback.fallback(tx, null);
    }
}`
      },
      {
        id: 'mutant_rsc_02_backoff_math',
        name: 'ExponentialBackoffMathMutator',
        file: 'src/main/java/com/enterprise/resilience/banking/ResilientSettlementClient.java',
        line: 38,
        mutatedContent: `package com.enterprise.resilience.banking;
public class ResilientSettlementClient {
    public interface RemoteGateway { String settle(String tx); }
    public interface Sleeper { void sleep(long m); }
    public interface FallbackHandler { String fallback(String tx, Exception e); }
    private final RemoteGateway gateway; private final Sleeper sleeper; private final FallbackHandler fallback;
    public ResilientSettlementClient(RemoteGateway g, Sleeper s, FallbackHandler f) { this.gateway = g; this.sleeper = s; this.fallback = f; }
    public String executeWithRetry(String tx) {
        long backoff = 100L;
        for (int i = 1; i <= 3; i++) {
            try { return gateway.settle(tx); } catch (Exception e) {
                if (i < 3) {
                    sleeper.sleep(backoff);
                    // MUTANT: linear addition instead of exponential multiply!
                    backoff += 10L;
                }
            }
        }
        return fallback.fallback(tx, null);
    }
}`
      },
      {
        id: 'mutant_rsc_03_fallback_omission',
        name: 'FallbackOmissionOnExhaustionMutator',
        file: 'src/main/java/com/enterprise/resilience/banking/ResilientSettlementClient.java',
        line: 41,
        mutatedContent: `package com.enterprise.resilience.banking;
public class ResilientSettlementClient {
    public interface RemoteGateway { String settle(String tx); }
    public interface Sleeper { void sleep(long m); }
    public interface FallbackHandler { String fallback(String tx, Exception e); }
    private final RemoteGateway gateway; private final Sleeper sleeper; private final FallbackHandler fallback;
    public ResilientSettlementClient(RemoteGateway g, Sleeper s, FallbackHandler f) { this.gateway = g; this.sleeper = s; this.fallback = f; }
    public String executeWithRetry(String tx) {
        for (int i = 1; i <= 3; i++) {
            try { return gateway.settle(tx); } catch (Exception ignored) {}
        }
        // MUTANT: returns null without invoking fallback!
        return null;
    }
}`
      },
      {
        id: 'mutant_rsc_04_sleep_on_success',
        name: 'SleepOnSuccessMutator',
        file: 'src/main/java/com/enterprise/resilience/banking/ResilientSettlementClient.java',
        line: 32,
        mutatedContent: `package com.enterprise.resilience.banking;
public class ResilientSettlementClient {
    public interface RemoteGateway { String settle(String tx); }
    public interface Sleeper { void sleep(long m); }
    public interface FallbackHandler { String fallback(String tx, Exception e); }
    private final RemoteGateway gateway; private final Sleeper sleeper; private final FallbackHandler fallback;
    public ResilientSettlementClient(RemoteGateway g, Sleeper s, FallbackHandler f) { this.gateway = g; this.sleeper = s; this.fallback = f; }
    public String executeWithRetry(String tx) {
        for (int i = 1; i <= 3; i++) {
            try {
                String r = gateway.settle(tx);
                sleeper.sleep(500L); // MUTANT: sleeps on success!
                return r;
            } catch (Exception ignored) {}
        }
        return fallback.fallback(tx, null);
    }
}`
      },
      {
        id: 'mutant_rsc_05_fallback_on_success',
        name: 'FallbackOnSuccessMutator',
        file: 'src/main/java/com/enterprise/resilience/banking/ResilientSettlementClient.java',
        line: 33,
        mutatedContent: `package com.enterprise.resilience.banking;
public class ResilientSettlementClient {
    public interface RemoteGateway { String settle(String tx); }
    public interface Sleeper { void sleep(long m); }
    public interface FallbackHandler { String fallback(String tx, Exception e); }
    private final RemoteGateway gateway; private final Sleeper sleeper; private final FallbackHandler fallback;
    public ResilientSettlementClient(RemoteGateway g, Sleeper s, FallbackHandler f) { this.gateway = g; this.sleeper = s; this.fallback = f; }
    public String executeWithRetry(String tx) {
        for (int i = 1; i <= 3; i++) {
            try {
                gateway.settle(tx);
                return fallback.fallback(tx, null); // MUTANT: calls fallback on success!
            } catch (Exception ignored) {}
        }
        return fallback.fallback(tx, null);
    }
}`
      }
    ]
  },

  // =========================================================================
  // 5. Deterministic Time & Cryptographic UUID with mockStatic
  // =========================================================================
  {
    id: 'kata_test_deterministic_time_mockstatic_uuid',
    slug: 'kata-test-deterministic-time-mockstatic-uuid',
    title: 'KATA-TEST-19: Deterministic Time & UUID with mockStatic (JDK 21 Trap)',
    category: 'testing_mutation',
    track: 'testing_mutation',
    badge: '🧬 mockStatic RealMethods',
    difficulty: 'Senior',
    targetStack: 'Java 21 LTS, Mockito 5 mockStatic, AssertJ',
    timeLimitMinutes: 45,
    shortDescription: 'Мокирование статических Instant.now() и UUID с использованием CALLS_REAL_METHODS в JDK 21.',
    instructionsMarkdown: `### 🎯 Инженерная задача
Сервис финансового аудита **LegacyComplianceTokenService** генерирует криптографические токены:
- Токен состоит из: SHA-256(\`userId + ":" + uuid + ":" + instant.toEpochMilli() + ":" + expiry.toEpochMilli()\`).
- Использует прямое обращение к статикам: \`UUID.randomUUID()\` и \`Instant.now()\`.
- В JDK 21 вызов \`Instant.now().plusSeconds(...)\` внутренне вызывает \`Instant.ofEpochSecond()\`.
- Если сделать наивный \`mockStatic(Instant.class)\`, то \`plusSeconds()\` превратится в no-op и вернет \`null\`, вызвав **NullPointerException**!
- Единственное верное решение: \`mockStatic(Instant.class, Mockito.CALLS_REAL_METHODS)\` строго в \`try-with-resources\`.

### 🧪 Ваша цель
В \`LegacyComplianceTokenServiceTest.java\` детерминированно замокируйте статики, уничтожив всех 5 мутантов:
1. **Mutant 1 (ExpiryPlusSecondsMath):** Срок действия токена рассчитывается как 300 секунд вместо 3600.
2. **Mutant 2 (OmitUuidInHash):** Исключение UUID из хэш-сигнатуры токена.
3. **Mutant 3 (InstantNowRegressed):** Время создания берется из системной эпохи вместо текущего Instant.
4. **Mutant 4 (Sha256AlgorithmNegate):** Подмена алгоритма хэширования на MD5.
5. **Mutant 5 (StaticLeakRisk):** Утечка мока статика за пределы тестового блока.`,
    workspaceFiles: [
      {
        path: 'src/main/java/com/enterprise/compliance/token/LegacyComplianceTokenService.java',
        content: `package com.enterprise.compliance.token;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.HexFormat;
import java.util.UUID;

public class LegacyComplianceTokenService {

    public record ComplianceToken(String tokenString, String userId, Instant createdAt, Instant expiresAt) {}

    public ComplianceToken generateToken(String userId) {
        if (userId == null || userId.isBlank()) throw new IllegalArgumentException("User ID cannot be blank");

        UUID uuid = UUID.randomUUID();
        Instant now = Instant.now();
        Instant expiresAt = now.plusSeconds(3600); // 1 hour validity

        String raw = userId + ":" + uuid + ":" + now.toEpochMilli() + ":" + expiresAt.toEpochMilli();
        String hash = computeSha256(raw);

        return new ComplianceToken(hash, userId, now, expiresAt);
    }

    private String computeSha256(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] encoded = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(encoded);
        } catch (Exception e) {
            throw new IllegalStateException("Crypto failure", e);
        }
    }
}`,
        readOnly: true,
        hidden: false
      },
      {
        path: 'src/test/java/com/enterprise/compliance/token/LegacyComplianceTokenServiceTest.java',
        content: `package com.enterprise.compliance.token;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import java.time.Instant;
import java.util.UUID;
import static org.assertj.core.api.Assertions.assertThat;

class LegacyComplianceTokenServiceTest {

    private final LegacyComplianceTokenService service = new LegacyComplianceTokenService();

    @Test
    @DisplayName("Should mock UUID and Instant with CALLS_REAL_METHODS deterministically (Kills M1, M2, M3, M4, M5)")
    void shouldGenerateDeterministicToken() {
        UUID fixedUuid = UUID.fromString("00000000-0000-0000-0000-000000000001");
        Instant fixedInstant = Instant.parse("2026-04-01T10:00:00Z");

        // CALLS_REAL_METHODS is mandatory in JDK 21 to prevent plusSeconds from returning null!
        try (MockedStatic<UUID> uuidMock = Mockito.mockStatic(UUID.class, Mockito.CALLS_REAL_METHODS);
             MockedStatic<Instant> instantMock = Mockito.mockStatic(Instant.class, Mockito.CALLS_REAL_METHODS)) {

            uuidMock.when(UUID::randomUUID).thenReturn(fixedUuid);
            instantMock.when(Instant::now).thenReturn(fixedInstant);

            var token = service.generateToken("user-42");

            assertThat(token.userId()).isEqualTo("user-42");
            assertThat(token.createdAt()).isEqualTo(fixedInstant);
            assertThat(token.expiresAt()).isEqualTo(fixedInstant.plusSeconds(3600));

            // SHA-256 of "user-42:00000000-0000-0000-0000-000000000001:1775037600000:1775041200000"
            assertThat(token.tokenString()).isNotBlank().hasSize(64);
        }

        // Verify clean isolation outside try-with-resources
        assertThat(UUID.randomUUID()).isNotEqualTo(fixedUuid);
    
        // TODO: Добавьте проверки граничных условий для уничтожения мутантов
        assertThat(true).isTrue();
    }
}`,
        readOnly: false,
        hidden: false,
        isMainEntryPoint: true
      }
    ],
    mutants: [
      {
        id: 'mutant_lct_01_expiry_math',
        name: 'ExpiryPlusSecondsMathMutator',
        file: 'src/main/java/com/enterprise/compliance/token/LegacyComplianceTokenService.java',
        line: 16,
        mutatedContent: `package com.enterprise.compliance.token;
import java.time.Instant; import java.util.UUID;
public class LegacyComplianceTokenService {
    public record ComplianceToken(String tokenString, String userId, Instant createdAt, Instant expiresAt) {}
    public ComplianceToken generateToken(String userId) {
        UUID uuid = UUID.randomUUID();
        Instant now = Instant.now();
        // MUTANT: 300 seconds instead of 3600!
        Instant expiresAt = now.plusSeconds(300);
        return new ComplianceToken("hash", userId, now, expiresAt);
    }
}`
      },
      {
        id: 'mutant_lct_02_omit_uuid',
        name: 'OmitUuidInHashMutator',
        file: 'src/main/java/com/enterprise/compliance/token/LegacyComplianceTokenService.java',
        line: 18,
        mutatedContent: `package com.enterprise.compliance.token;
import java.time.Instant; import java.util.UUID;
public class LegacyComplianceTokenService {
    public record ComplianceToken(String tokenString, String userId, Instant createdAt, Instant expiresAt) {}
    public ComplianceToken generateToken(String userId) {
        UUID uuid = UUID.randomUUID();
        Instant now = Instant.now();
        Instant expiresAt = now.plusSeconds(3600);
        // MUTANT: omits UUID from raw input to hash!
        String raw = userId + ":NO_UUID:" + now.toEpochMilli() + ":" + expiresAt.toEpochMilli();
        return new ComplianceToken(raw, userId, now, expiresAt);
    }
}`
      },
      {
        id: 'mutant_lct_03_epoch_now',
        name: 'InstantNowRegressedMutator',
        file: 'src/main/java/com/enterprise/compliance/token/LegacyComplianceTokenService.java',
        line: 15,
        mutatedContent: `package com.enterprise.compliance.token;
import java.time.Instant; import java.util.UUID;
public class LegacyComplianceTokenService {
    public record ComplianceToken(String tokenString, String userId, Instant createdAt, Instant expiresAt) {}
    public ComplianceToken generateToken(String userId) {
        UUID uuid = UUID.randomUUID();
        // MUTANT: uses Instant.EPOCH instead of Instant.now()!
        Instant now = Instant.EPOCH;
        Instant expiresAt = now.plusSeconds(3600);
        return new ComplianceToken("hash", userId, now, expiresAt);
    }
}`
      },
      {
        id: 'mutant_lct_04_md5_hash',
        name: 'Sha256AlgorithmNegateMutator',
        file: 'src/main/java/com/enterprise/compliance/token/LegacyComplianceTokenService.java',
        line: 25,
        mutatedContent: `package com.enterprise.compliance.token;
import java.time.Instant; import java.util.UUID;
public class LegacyComplianceTokenService {
    public record ComplianceToken(String tokenString, String userId, Instant createdAt, Instant expiresAt) {}
    public ComplianceToken generateToken(String userId) {
        UUID uuid = UUID.randomUUID();
        Instant now = Instant.now();
        Instant expiresAt = now.plusSeconds(3600);
        // MUTANT: 32-char string (MD5 length) instead of 64-char SHA-256!
        return new ComplianceToken("0123456789abcdef0123456789abcdef", userId, now, expiresAt);
    }
}`
      },
      {
        id: 'mutant_lct_05_static_leak',
        name: 'StaticLeakRiskMutator',
        file: 'src/main/java/com/enterprise/compliance/token/LegacyComplianceTokenService.java',
        line: 14,
        mutatedContent: `package com.enterprise.compliance.token;
import java.time.Instant; import java.util.UUID;
public class LegacyComplianceTokenService {
    public record ComplianceToken(String tokenString, String userId, Instant createdAt, Instant expiresAt) {}
    public ComplianceToken generateToken(String userId) {
        // MUTANT: fixed hardcoded UUID returned!
        UUID uuid = UUID.fromString("00000000-0000-0000-0000-000000000001");
        Instant now = Instant.now();
        return new ComplianceToken("hash", userId, now, now.plusSeconds(3600));
    }
}`
      }
    ]
  }
];
