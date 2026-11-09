/**
 * testSystemDesignNormalizer.ts
 * Headless verification for normalizeSystemDesignContext and Studio 1 Forensic bug check logic.
 * Enforces SPEC-13 (§4.2.1, §6.3).
 */

import assert from 'node:assert/strict';
import { normalizeSystemDesignContext } from '@interview-prep/shared';

function checkIsFixed(
  currentCode: string,
  defaultContent: string,
  fadedBug?: { line_number: number; description: string; bug_pattern: string }
): boolean {
  if (!fadedBug) return false;
  // 1. Initial unmodified baseline code is NEVER considered fixed
  if (currentCode.trim() === defaultContent.trim()) {
    return false;
  }
  // 2. Unimplemented placeholders or bug markers disqualify the fix
  if (currentCode.includes('// BUG:') || currentCode.includes('// BUG 2:') || currentCode.includes('return null;')) {
    return false;
  }
  // 3. If bug_pattern exists in code as a literal string or symbol, ensure it was eliminated
  if (fadedBug.bug_pattern && currentCode.includes(fadedBug.bug_pattern)) {
    return false;
  }
  // 4. Candidate must have added substantive logic beyond the original template
  return currentCode.trim().length > 100;
}

function runTests() {
  console.log('[TEST] 1. Verifying normalizeSystemDesignContext contract...');

  const sampleContext = normalizeSystemDesignContext({
    scenarioId: 'SD-ATM-HARDWARE-DISPENSER',
    scenarioTitle: 'ATM Hardware Cash Dispenser & Bounded Knapsack Allocation',
    targetLevel: 'L5_SENIOR',
    activeStudioTab: 'runtime',
    activeCodeSnippet: 'public class AtmDispenserService { ... }',
    activeFilePath: 'src/main/java/com/bank/atm/AtmDispenserService.java',
    fadedBug: {
      lineNumber: 15,
      description: 'Greedy bill selection fails when smaller combinations can fulfill the request.',
      bugPattern: 'GREEDY_FALLACY_AND_NON_ATOMIC_HARDWARE'
    },
    topologySummary: 'atm_controller -> hardware_dispenser -> core_banking_ledger',
    capacityMathSummary: '1000 tx/sec peak, 250MB/sec bandwidth',
    companyContextName: 'Raiffeisen DGTL Product Engineer'
  });

  assert.equal(sampleContext.arena, 'system_design');
  assert.equal(sampleContext.entityId, 'SD-ATM-HARDWARE-DISPENSER');
  assert.equal(sampleContext.domain, 'Distributed System Design & High-Load Architecture');
  assert.equal(sampleContext.persona, 'faang_interviewer');
  assert.equal(sampleContext.assistanceLevel, 3);
  assert.equal(sampleContext.quickActionChips.length, 4);

  const chipIds = sampleContext.quickActionChips.map(c => c.id);
  assert.ok(chipIds.includes('hld_tradeoffs'));
  assert.ok(chipIds.includes('hld_bottlenecks'));
  assert.ok(chipIds.includes('hld_runtime_bug'));
  assert.ok(chipIds.includes('hld_math_verify'));

  const instructions = sampleContext.instructions || '';
  assert.ok(instructions.includes('[АКТИВНАЯ ВКЛАДКА / РЕЖИМ]: RUNTIME'));
  assert.ok(instructions.includes('GREEDY_FALLACY_AND_NON_ATOMIC_HARDWARE'));
  assert.ok(instructions.includes('atm_controller -> hardware_dispenser'));

  console.log('✓ normalizeSystemDesignContext contract passed.');

  console.log('[TEST] 2. Verifying Studio 1 Runtime Defect Verification Invariant...');

  const initialBaselineCode = `package com.bank.atm;

import java.math.BigDecimal;
import java.util.*;

public class AtmDispenserService {
    private final HardwareHardwareDriver hardware;
    private final CoreLedgerClient ledger;

    public AtmDispenserService(HardwareHardwareDriver hardware, CoreLedgerClient ledger) {
        this.hardware = hardware;
        this.ledger = ledger;
    }

    public DispenseResult withdraw(long accountId, BigDecimal amount, Map<Integer, Integer> cassetteQuantities) {
        // BUG: Greedy algorithm fails on 600 from (500, 200) bills
        // BUG 2: Must hold funds in ledger before physical motor trigger and compensate on HardwareJamException
        return null;
    }
}`;

  const fadedBug = {
    line_number: 15,
    description: 'Greedy bill selection fails when smaller combinations can fulfill the request.',
    bug_pattern: 'GREEDY_FALLACY_AND_NON_ATOMIC_HARDWARE'
  };

  // Condition 1: Initial load MUST NOT be marked as fixed
  const initialFixed = checkIsFixed(initialBaselineCode, initialBaselineCode, fadedBug);
  assert.equal(initialFixed, false, 'Initial unmodified baseline code must strictly evaluate to false!');

  // Condition 2: Candidate changes whitespace only
  const whitespaceChangedCode = initialBaselineCode + '   \n\n  ';
  assert.equal(checkIsFixed(whitespaceChangedCode, initialBaselineCode, fadedBug), false, 'Whitespace modification must not count as fixed!');

  // Condition 3: Candidate leaves placeholder return null;
  const partialCode = initialBaselineCode.replace('// BUG: Greedy algorithm fails on 600 from (500, 200) bills', '// Attempted fix');
  assert.equal(checkIsFixed(partialCode, initialBaselineCode, fadedBug), false, 'Placeholder return null or bug comments must evaluate to false!');

  // Condition 4: Genuine refactoring with knapsack and 2-phase coordination
  const validFixedCode = `package com.bank.atm;

import java.math.BigDecimal;
import java.util.*;

public class AtmDispenserService {
    private final HardwareHardwareDriver hardware;
    private final CoreLedgerClient ledger;

    public AtmDispenserService(HardwareHardwareDriver hardware, CoreLedgerClient ledger) {
        this.hardware = hardware;
        this.ledger = ledger;
    }

    public DispenseResult withdraw(long accountId, BigDecimal amount, Map<Integer, Integer> cassetteQuantities) {
        Map<Integer, Integer> plan = calculateBoundedKnapsack(amount.intValue(), cassetteQuantities);
        String holdId = ledger.holdFunds(accountId, amount);
        try {
            hardware.dispense(plan);
            ledger.commitHold(holdId);
            return new DispenseResult(true, plan);
        } catch (HardwareJamException jam) {
            ledger.compensateHold(holdId, jam.getDispensedAmount());
            throw jam;
        }
    }
}`;

  assert.equal(checkIsFixed(validFixedCode, initialBaselineCode, fadedBug), true, 'Valid fixed code must evaluate to true!');

  console.log('✓ Studio 1 Runtime Defect Verification Invariant passed.');
  console.log('[ALL TESTS PASSED]');
}

runTests();
