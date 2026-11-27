/**
 * practiceWorkspaceState.test.ts
 * Spec 60 Contract Test Suite:
 * - resolveInitialWorkspaceFileIndex & mergePhaseFiles (practiceSlice)
 * - filterActiveAstViolations (astRules)
 * - resolveEvaluationPassStatus & formatEvaluationTestRatio (evaluationReportBuilder)
 * - usePracticeTutorStore Copilot Dock & Stealth Mode state transitions
 */

import assert from 'assert';
import {
  resolveInitialWorkspaceFileIndex,
  mergePhaseFiles
} from '../src/store/slices/practiceSlice';
import {
  evaluateAstRules,
  filterActiveAstViolations
} from '../src/utils/astRules';
import {
  resolveEvaluationPassStatus,
  formatEvaluationTestRatio
} from '../src/components/practice/evaluationReportBuilder';
import { createPracticeTutorStore } from '../src/store/usePracticeTutorStore';
import type { TutorTransportPort } from '../src/store/tutorTransport';
import type { EvaluationResult, FileNode } from '../src/types/practice';

const noopTransport: TutorTransportPort = {
  streamChat: async () => ({ fullText: 'ok', leakDetected: false, similarity: 0 }),
  fetchHint: async () => ({ hintTier: 1, content: 'hint', leakDetected: false }),
  groundRule: async (ruleId) => ({ ruleId, ruleName: ruleId, content: 'rule', leakDetected: false })
};

function makeEvalResult(overrides: Partial<EvaluationResult> = {}): EvaluationResult {
  return {
    compilationStatus: { isCompilable: true, syntaxErrors: [] },
    virtualExecutionResult: { passCount: 4, failCount: 0, testCases: [] },
    concurrencyAnalysis: {
      hasRaceConditions: false,
      hasJmmVisibilityIssues: false,
      hasCarrierThreadPinning: false,
      findings: []
    },
    architecturalCompliance: {
      isSolidCompliant: true,
      springBootBestPracticesViolations: [],
      modernJava21IdiomAdoption: []
    },
    scoreBreakdown: {
      correctnessScore: 100,
      concurrencyScore: 95,
      architectureScore: 90,
      modernIdiomsScore: 90,
      overallScore: 92,
      summaryReview: 'Solid'
    },
    evaluationTimestamp: new Date().toISOString(),
    astSignalsSummary: [],
    ...overrides
  };
}

function runTests(): void {
  console.log('🧪 Running Spec 60 Practice Workspace State Contract Tests...\n');

  // 1. resolveInitialWorkspaceFileIndex
  {
    const filesWithMain: FileNode[] = [
      { path: 'src/RateLimiter.java', content: 'interface RateLimiter {}', readOnly: true, hidden: false },
      { path: 'src/TokenBucket.java', content: 'class TokenBucket {}', readOnly: false, hidden: false, isMainEntryPoint: true },
      { path: 'src/Test.java', content: 'class Test {}', readOnly: false, hidden: false }
    ];
    assert.strictEqual(resolveInitialWorkspaceFileIndex(filesWithMain), 1, 'Focuses explicit isMainEntryPoint');

    const filesWithoutMain: FileNode[] = [
      { path: 'src/Api.java', content: 'interface Api {}', readOnly: true, hidden: false },
      { path: 'src/Impl.java', content: 'class Impl {}', readOnly: false, hidden: false }
    ];
    assert.strictEqual(resolveInitialWorkspaceFileIndex(filesWithoutMain), 1, 'Falls back to first editable file');

    const readOnlyFiles: FileNode[] = [
      { path: 'src/Api.java', content: 'interface Api {}', readOnly: true, hidden: false }
    ];
    assert.strictEqual(resolveInitialWorkspaceFileIndex(readOnlyFiles), 0, 'Falls back to 0 when all readOnly');
    assert.strictEqual(resolveInitialWorkspaceFileIndex([]), 0, 'Empty array returns 0');
    console.log('  ✅ Passed: resolveInitialWorkspaceFileIndex');
  }

  // 2. mergePhaseFiles
  {
    const base: FileNode[] = [
      { path: 'src/Main.java', content: 'class Main {}', readOnly: false, hidden: false }
    ];
    const added: FileNode[] = [
      { path: 'src/Main.java', content: 'duplicate', readOnly: false, hidden: false },
      { path: 'src/Phase2.java', content: 'class Phase2 {}', readOnly: false, hidden: false }
    ];
    const merged = mergePhaseFiles(base, added);
    assert.strictEqual(base.length, 1, 'Does not mutate base files array');
    assert.strictEqual(merged.length, 2, 'Appends only non-duplicate phase file paths');
    assert.strictEqual(merged[1].path, 'src/Phase2.java');
    console.log('  ✅ Passed: mergePhaseFiles');
  }

  // 3. filterActiveAstViolations
  {
    const cleanItems = evaluateAstRules('public final class CleanService { public int add(int a, int b) { return a + b; } }');
    assert.strictEqual(cleanItems.length, 1, 'evaluateAstRules preserves clean sentinel for BugChallengeCard');
    assert.strictEqual(cleanItems[0].isViolation, false);
    assert.deepStrictEqual(filterActiveAstViolations(cleanItems), [], 'filterActiveAstViolations returns [] on clean code');

    const dirtyItems = evaluateAstRules('public synchronized void run() {}');
    const activeDirty = filterActiveAstViolations(dirtyItems);
    assert.strictEqual(activeDirty.length, 1);
    assert.strictEqual(activeDirty[0].id, 'carrier-thread-pinning');
    console.log('  ✅ Passed: filterActiveAstViolations');
  }

  // 4. resolveEvaluationPassStatus & formatEvaluationTestRatio
  {
    assert.strictEqual(resolveEvaluationPassStatus(makeEvalResult()), true, 'Clean high score passes');
    assert.strictEqual(
      resolveEvaluationPassStatus(
        makeEvalResult({ virtualExecutionResult: { passCount: 3, failCount: 1, testCases: [] } })
      ),
      false,
      'failCount > 0 blocks pass even if score >= 70'
    );
    assert.strictEqual(
      resolveEvaluationPassStatus(
        makeEvalResult({ compilationStatus: { isCompilable: false, syntaxErrors: [{ lineNumber: 1, errorMessage: 'err' }] } })
      ),
      false,
      'Non-compilable submission blocks pass'
    );
    assert.strictEqual(
      resolveEvaluationPassStatus(
        makeEvalResult({
          concurrencyAnalysis: {
            hasRaceConditions: true,
            hasJmmVisibilityIssues: false,
            hasCarrierThreadPinning: false,
            findings: []
          }
        })
      ),
      false,
      'Race conditions block pass'
    );

    const ratio = formatEvaluationTestRatio(
      makeEvalResult({ virtualExecutionResult: { passCount: 3, failCount: 2, testCases: [] } })
    );
    assert.deepStrictEqual(ratio, { passed: 3, total: 5 }, 'Denominator uses passCount + failCount when testCases empty');
    console.log('  ✅ Passed: resolveEvaluationPassStatus & formatEvaluationTestRatio');
  }

  // 5. usePracticeTutorStore dock & stealth transitions
  {
    const store = createPracticeTutorStore(noopTransport);
    assert.strictEqual(store.getState().rightDockTab, 'tutor');
    assert.strictEqual(store.getState().isCopilotStealth, false);

    store.getState().toggleOpen(true);
    store.getState().setRightDockTab('whiteboard');
    assert.strictEqual(store.getState().isOpen, true);
    assert.strictEqual(store.getState().rightDockTab, 'whiteboard');

    const initialMsgCount = store.getState().messages.length;
    store.getState().enterStealthMode();
    assert.strictEqual(store.getState().isOpen, false, 'enterStealthMode hides dock');
    assert.strictEqual(store.getState().isCopilotStealth, true, 'enterStealthMode activates stealth');
    assert.strictEqual(store.getState().messages.length, initialMsgCount, 'enterStealthMode preserves messages');

    store.getState().exitStealthMode('tutor');
    assert.strictEqual(store.getState().isCopilotStealth, false, 'exitStealthMode clears stealth');
    assert.strictEqual(store.getState().isOpen, true, 'exitStealthMode reopens dock');
    assert.strictEqual(store.getState().rightDockTab, 'tutor', 'exitStealthMode switches to requested tab');
    console.log('  ✅ Passed: usePracticeTutorStore dock & stealth transitions');
  }

  console.log('\n🎉 ALL SPEC 60 PRACTICE WORKSPACE STATE TESTS PASSED!');
}

runTests();
