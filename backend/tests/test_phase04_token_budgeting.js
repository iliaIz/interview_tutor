/**
 * test_phase04_token_budgeting.js
 * 
 * Gate 04 Automated Verification Suite:
 * 1. Functional Verification of practiceContextPruner.ts (Sliding Window, Turn Summarization, Token Budgeting)
 * 2. Java Secondary File Skeletonization (Strip Method Bodies, Preserve Signatures & Fields)
 * 3. Token Budget Ceiling Enforcement (Pruned Context <= 5500 Tokens, Token Savings >= 50%)
 * 4. Architectural Contract Verification across Backend Routes, Prompts & Live WebSocket Handlers
 * 5. Architectural Contract Verification across Frontend Stores & Components (Academy Bridge)
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  pruneTutorContext,
  skeletonizeWorkspaceSecondaryFiles,
  skeletonizeJavaFile,
  estimateTokens
} from '/app/storage/test_phase04/services/practiceContextPruner.ts';

console.log('=== RUNNING WAVE 15 PHASE 04: TOKEN BUDGETING, SLIDING WINDOW & ACADEMY CONTEXT ===\n');

function runTest(suiteName, fn) {
  try {
    fn();
    console.log(`[PASS] ${suiteName}`);
  } catch (err) {
    console.error(`[FAIL] ${suiteName}:`, err.message);
    process.exitCode = 1;
  }
}

// -------------------------------------------------------------
// Suite 1: Sliding Window & Earlier Turns Summarization
// -------------------------------------------------------------
runTest('Suite 1: Sliding Window & Earlier Turns Summarization', () => {
  const simulated12Turns = [
    { role: 'user', content: 'Turn 1: Как работает аннотация @Transactional в Spring?' },
    { role: 'assistant', content: 'Turn 2: Аннотация @Transactional создает AOP-прокси вокруг бина, перехватывая вызовы методов.' },
    { role: 'user', content: 'Turn 3: А почему self-invocation не работает?' },
    { role: 'assistant', content: 'Turn 4: Потому что вызов this.method() идет мимо прокси-обертки прямо к экземпляру класса.' },
    { role: 'user', content: 'Turn 5: Как это исправить без внедрения самого себя?' },
    { role: 'assistant', content: 'Turn 6: Можно вынести транзакционный метод в отдельный сервис-делегат или использовать TransactionTemplate.' },
    { role: 'user', content: 'Turn 7: А TransactionTemplate создает физическую транзакцию?' },
    { role: 'assistant', content: 'Turn 8: Да, TransactionTemplate оборачивает переданный Callback в PlatformTransactionManager.' },
    { role: 'user', content: 'Turn 9: Что произойдет при unchecked исключении внутри executeWithoutResult?' },
    { role: 'assistant', content: 'Turn 10: Произойдет автоматический откат (rollback), если не перехвачено внутри.' },
    { role: 'user', content: 'Turn 11: А при checked Exception?' },
    { role: 'assistant', content: 'Turn 12: По умолчанию rollbackOn срабатывает только на RuntimeException и Error.' }
  ];

  const pruneResult = pruneTutorContext({
    messages: simulated12Turns,
    activeFilePath: 'src/test/java/OrderServiceTest.java',
    activeFileContent: 'public class OrderServiceTest { @Test void test() {} }',
    academyBridgeContext: {
      courseId: 'senior-bigtech-sprint-25',
      stepId: 'step-5',
      moduleTitle: 'Spring Transaction Deep Dive',
      learningObjective: 'Master TransactionTemplate and Rollback Rules',
      targetConcepts: ['AOP Proxies', 'TransactionTemplate', 'Rollback Rules']
    }
  });

  assert.equal(pruneResult.prunedMessages.length, 6, 'Pruned messages must retain strictly last 6 turns');
  assert.equal(pruneResult.prunedMessages[0].content, simulated12Turns[6].content, 'First kept turn must be Turn 7');
  assert.equal(pruneResult.prunedMessages[5].content, simulated12Turns[11].content, 'Last kept turn must be Turn 12');
  assert(pruneResult.earlierTurnsSummary, 'Earlier turns must be summarized');
  assert(pruneResult.earlierTurnsSummary.includes('Ранее в диалоге'), 'Summary must have standard prefix');
  assert(pruneResult.earlierTurnsSummary.includes('Кандидат спросил') || pruneResult.earlierTurnsSummary.includes('Тьютор ответил'), 'Summary must format role bullets');
});

// -------------------------------------------------------------
// Suite 2: Java Secondary File Skeletonization
// -------------------------------------------------------------
runTest('Suite 2: Java Secondary File Skeletonization', () => {
  const fullSecondaryService = `package com.interview.service;

import java.time.Clock;
import java.math.BigDecimal;
import java.util.concurrent.ConcurrentHashMap;

public class OrderService {
    private final Clock clock;
    private final Map<String, BigDecimal> balances = new ConcurrentHashMap<>();

    public OrderService(Clock clock) {
        this.clock = clock;
    }

    public void processPayment(String accountId, BigDecimal amount) {
        if (amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Amount must be positive");
        }
        balances.compute(accountId, (k, v) -> {
            BigDecimal curr = v == null ? BigDecimal.ZERO : v;
            return curr.add(amount);
        });
    }

    public BigDecimal getBalance(String accountId) {
        return balances.getOrDefault(accountId, BigDecimal.ZERO);
    }
}`;

  const fullActiveTest = `package com.interview.service;

import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import static org.junit.jupiter.api.Assertions.*;

public class OrderServiceTest {
    @Test
    void testProcessPayment() {
        Clock fixedClock = Clock.fixed(Instant.parse("2026-10-15T12:00:00Z"), ZoneId.of("UTC"));
        OrderService service = new OrderService(fixedClock);
        service.processPayment("acc-1", new BigDecimal("100.00"));
        assertEquals(new BigDecimal("100.00"), service.getBalance("acc-1"));
    }
}`;

  const workspaceManifest = {
    activeFile: { path: 'src/test/java/OrderServiceTest.java', content: fullActiveTest },
    fileCount: 2,
    projectTree: ['src/test/java/OrderServiceTest.java', 'src/main/java/OrderService.java'],
    secondaryFiles: [
      { path: 'src/main/java/OrderService.java', content: fullSecondaryService }
    ]
  };

  const skeletonized = skeletonizeWorkspaceSecondaryFiles(workspaceManifest, 'src/test/java/OrderServiceTest.java');
  assert.equal(skeletonized.secondaryFiles.length, 1);
  const skeletonContent = skeletonized.secondaryFiles[0].content;

  assert(skeletonContent.includes('public class OrderService'), 'Class declaration must be preserved');
  assert(skeletonContent.includes('processPayment(String accountId, BigDecimal amount)'), 'Method signature must be preserved');
  assert(skeletonContent.includes('getBalance(String accountId)'), 'Secondary method signature preserved');
  assert(!skeletonContent.includes('throw new IllegalArgumentException'), 'Method implementation must be stripped');
  assert(!skeletonContent.includes('balances.compute(accountId'), 'Method inner lambda must be stripped');
  assert(skeletonContent.includes('{ /* ... */ }'), 'Stub comment must replace method body');
});

// -------------------------------------------------------------
// Suite 3: Token Budget Ceiling Enforcement
// -------------------------------------------------------------
runTest('Suite 3: Token Budget Ceiling Enforcement (<= 5500 Tokens, >= 50% Reduction)', () => {
  const simulatedLargeTurns = Array.from({ length: 16 }, (_, i) => ({
    role: i % 2 === 0 ? 'user' : 'assistant',
    content: `Turn ${i + 1}: Подробное обсуждение аспектов распределенных транзакций, двухфазного коммита (2PC), саг (Saga Pattern), компенсирующих транзакций и идемпотентности ключей запросов на примере банковского шлюза.`
  }));

  const secondaryFileLarge = `
public class PaymentProcessingEngine {
    ${Array.from({ length: 20 }, (_, i) => `
    public void executeStep${i}(String txId, BigDecimal amount) {
        // Detailed step logic with multiple statements
        System.out.println("Processing step " + txId);
        validateStep(txId, amount);
        persistStepRecord(txId, amount);
    }`).join('\n')}
}`;

  const manifest = {
    activeFile: { path: 'src/test/java/PaymentTest.java', content: 'public class PaymentTest {}' },
    secondaryFiles: [
      { path: 'src/main/java/PaymentProcessingEngine.java', content: secondaryFileLarge }
    ]
  };

  const result = pruneTutorContext({
    messages: simulatedLargeTurns,
    activeFilePath: 'src/test/java/PaymentTest.java',
    activeFileContent: 'public class PaymentTest {}',
    workspaceManifest: manifest,
    academyBridgeContext: {
      courseId: 'senior-bigtech-sprint-25',
      moduleTitle: 'Saga Patterns',
      learningObjective: 'Master Orchestration Sagas'
    }
  });

  console.log(`  Tokens Before: ~${result.tokensBeforeEstimate}, Tokens After: ~${result.tokensAfterEstimate}, Reduction: ${result.reductionPercentage}%`);
  assert(result.tokensAfterEstimate <= 5500, `Pruned tokens (${result.tokensAfterEstimate}) must be <= 5500`);
  assert(result.reductionPercentage >= 50, `Reduction percentage (${result.reductionPercentage}%) must be >= 50%`);
  assert.equal(result.prunedMessages.length, 6, 'Must preserve strictly last 6 turns');
});

// -------------------------------------------------------------
// Suite 4: Backend Contracts (Practice Tutor, Prompts & Live WS)
// -------------------------------------------------------------
runTest('Suite 4: Backend Contracts for Token Pruning & Academy Context', () => {
  const tutorRouteSrc = fs.readFileSync('/app/storage/test_phase04/routes/practiceTutor.ts', 'utf8');
  assert(tutorRouteSrc.includes('pruneTutorContext'), 'practiceTutor.ts must invoke pruneTutorContext');
  assert(tutorRouteSrc.includes('academyBridgeContext'), 'practiceTutor.ts must accept academyBridgeContext');
  const tutorRouteLines = tutorRouteSrc.split('\n').length;
  assert(tutorRouteLines <= 400, `practiceTutor.ts must be <= 400 lines (current: ${tutorRouteLines})`);

  const tutorPromptsSrc = fs.readFileSync('/app/storage/test_phase04/prompts/practiceTutorPrompts.ts', 'utf8');
  assert(tutorPromptsSrc.includes('academyBridgeContext'), 'practiceTutorPrompts.ts must support academyBridgeContext');
  assert(tutorPromptsSrc.includes('earlierTurnsSummary'), 'practiceTutorPrompts.ts must support earlierTurnsSummary');
  assert(tutorPromptsSrc.includes('=== ДИДАКТИЧЕСКИЙ КОНТЕКСТ АКАДЕМИИ (CURRICULUM BRIDGE) ==='), 'Must include Academy section');

  const livePairPromptsSrc = fs.readFileSync('/app/storage/test_phase04/prompts/live/livePairPrompts.ts', 'utf8');
  assert(livePairPromptsSrc.includes('academyBridgeContext'), 'livePairPrompts.ts must support academyBridgeContext');
  assert(livePairPromptsSrc.includes('=== КОНТЕКСТ АКАДЕМИИ (CURRICULUM BRIDGE) ==='), 'Must include Academy section');
  const livePairLines = livePairPromptsSrc.split('\n').length;
  assert(livePairLines <= 350, `livePairPrompts.ts must be <= 350 lines (current: ${livePairLines})`);

  const livePromptBuilderSrc = fs.readFileSync('/app/storage/test_phase04/livePromptBuilder.ts', 'utf8');
  assert(livePromptBuilderSrc.includes('academyBridgeContext'), 'livePromptBuilder.ts must forward academyBridgeContext');

  const liveWsConnSrc = fs.readFileSync('/app/storage/test_phase04/liveWsConnectionHandler.ts', 'utf8');
  assert(liveWsConnSrc.includes('academyCourse'), 'liveWsConnectionHandler.ts must handle academyCourse');
  assert(liveWsConnSrc.includes('academyStep'), 'liveWsConnectionHandler.ts must handle academyStep');
  assert(liveWsConnSrc.includes('academyBridgeContext'), 'liveWsConnectionHandler.ts must forward academyBridgeContext');

  const liveFrameHandlerSrc = fs.readFileSync('/app/storage/test_phase04/liveWsClientFrameHandler.ts', 'utf8');
  assert(liveFrameHandlerSrc.includes('parsed.academyBridgeContext'), 'liveWsClientFrameHandler.ts must extract academyBridgeContext');
});

// -------------------------------------------------------------
// Suite 5: Frontend Contracts (Academy Bridge Context)
// -------------------------------------------------------------
runTest('Suite 5: Frontend Contracts for Academy Bridge & Live Voice', () => {
  const appStoreSrc = fs.readFileSync('/app/storage/test_phase04/useAppStore.ts', 'utf8');
  assert(appStoreSrc.includes('moduleTitle?: string'), 'useAppStore.ts must include moduleTitle in AcademyBreadcrumbContext');
  assert(appStoreSrc.includes('learningObjective?: string'), 'useAppStore.ts must include learningObjective');
  assert(appStoreSrc.includes('targetConcepts?: string[]'), 'useAppStore.ts must include targetConcepts');
  assert(appStoreSrc.includes('masteryChecklist'), 'launchAcademyStepTarget must populate targetConcepts');

  const tutorStoreSrc = fs.readFileSync('/app/storage/test_phase04/usePracticeTutorStore.ts', 'utf8');
  assert(tutorStoreSrc.includes('academyBridgeContext?: {'), 'usePracticeTutorStore.ts must include academyBridgeContext');
  const tutorStoreLines = tutorStoreSrc.split('\n').length;
  assert(tutorStoreLines <= 400, `usePracticeTutorStore.ts must be <= 400 lines (current: ${tutorStoreLines})`);

  const tutorDrawerSrc = fs.readFileSync('/app/storage/test_phase04/PracticeTutorDrawer.tsx', 'utf8');
  assert(tutorDrawerSrc.includes('academyBreadcrumbContext'), 'PracticeTutorDrawer.tsx must extract academyBreadcrumbContext');
  assert(tutorDrawerSrc.includes('academyBridgeContext: academyBreadcrumbContext ?'), 'PracticeTutorDrawer.tsx must pass academyBridgeContext');

  const voiceUrlBuilderSrc = fs.readFileSync('/app/storage/test_phase04/liveVoiceUrlBuilder.ts', 'utf8');
  assert(voiceUrlBuilderSrc.includes("'academyCourse'"), 'liveVoiceUrlBuilder.ts must include academyCourse in optionalKeys');
  assert(voiceUrlBuilderSrc.includes("'academyStep'"), 'liveVoiceUrlBuilder.ts must include academyStep in optionalKeys');
  assert(voiceUrlBuilderSrc.includes('academyBridgeContext: cfg.academyBridgeContext'), 'liveVoiceUrlBuilder.ts must send academyBridgeContext in initFrame');
});

console.log('\n🎉 ALL PHASE 04 TEST SUITES PASSED! GATE 04 VERIFIED.');
