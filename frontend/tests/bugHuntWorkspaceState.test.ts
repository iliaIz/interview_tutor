/**
 * bugHuntWorkspaceState.test.ts
 * Spec 62 Automated Contract Test Suite:
 * - 2-Column Bug Hunt / Code Review workbench layout bounds (computeTwoColumnWorkbenchTracks)
 * - Cross-arena context hygiene & incidents store role / verifyBugDiagnosis transport flows
 * - Unified Bug Hunt Voice Session Params builder (code_review vs free_chat)
 * - Honest AST telemetry filtering via filterActiveAstViolations (Truth-in-Telemetry)
 */

import assert from 'assert';
import { normalizeIncidentsContext } from '@interview-prep/shared/tutor';
import {
  WORKBENCH_BOUNDS,
  computeTwoColumnWorkbenchTracks
} from '../src/components/practice/arena/workbenchLayoutKernel';
import {
  evaluateAstRules,
  filterActiveAstViolations
} from '../src/utils/astRules';
import { createPracticeTutorStore } from '../src/store/usePracticeTutorStore';
import type { TutorTransportPort } from '../src/store/tutorTransport';
import { buildBugHuntSessionParams } from '../src/components/practice/tutor/bugHuntSessionParamsBuilder';
import { useAppStore } from '../src/store/useAppStore';

async function runBugHuntContractTests(): Promise<void> {
  console.log('🧪 Running Spec 62 Bug Hunt Workbench & Co-Pilot Dock Contract Tests...');

  // 1. 2-Column Workbench Layout Kernel invariants across 1024px / 1440px & Stealth
  {
    const desk = computeTwoColumnWorkbenchTracks({
      viewportWidth: 1440,
      isDockVisible: true,
      rightDockTab: 'tutor',
      isWhiteboardExpanded: false,
      tutorWidthPx: 380,
      whiteboardWidthPx: 520
    });
    assert.strictEqual(desk.resolvedCopilotPx, 380);
    assert.ok(desk.primaryAvailablePx >= WORKBENCH_BOUNDS.MIN_EDITOR_WIDTH_PX);

    const wide = computeTwoColumnWorkbenchTracks({
      viewportWidth: 1440,
      isDockVisible: true,
      rightDockTab: 'whiteboard',
      isWhiteboardExpanded: true,
      tutorWidthPx: 380,
      whiteboardWidthPx: 520
    });
    assert.ok(wide.resolvedCopilotPx >= 520);
    assert.ok(wide.resolvedCopilotPx <= Math.floor(1440 * WORKBENCH_BOUNDS.MAX_COPILOT_VIEWPORT_RATIO));
    assert.ok(wide.primaryAvailablePx >= WORKBENCH_BOUNDS.HARD_MIN_EDITOR_WIDTH_PX);

    const compact = computeTwoColumnWorkbenchTracks({
      viewportWidth: 1024,
      isDockVisible: true,
      rightDockTab: 'whiteboard',
      isWhiteboardExpanded: false,
      tutorWidthPx: 380,
      whiteboardWidthPx: 920
    });
    assert.ok(compact.primaryAvailablePx >= WORKBENCH_BOUNDS.MIN_EDITOR_WIDTH_PX);

    const stealth = computeTwoColumnWorkbenchTracks({
      viewportWidth: 1440,
      isDockVisible: false,
      rightDockTab: 'tutor',
      isWhiteboardExpanded: false,
      tutorWidthPx: 420,
      whiteboardWidthPx: 520
    });
    assert.strictEqual(stealth.resolvedCopilotPx, 0);
    assert.strictEqual(stealth.copilotTrack, '0px');
    assert.strictEqual(stealth.primaryAvailablePx, 1440);
  }
  console.log('  ✅ [1/4] computeTwoColumnWorkbenchTracks invariants passed');

  // 2. Honest AST telemetry on logical vs syntactic bugs (no false emerald "clean" claim)
  {
    const logicBugSnippet = `
      public Value getOrCreate(String key) {
        if (!map.containsKey(key)) { map.put(key, load(key)); }
        return map.get(key);
      }
    `;
    const activeLogic = filterActiveAstViolations(evaluateAstRules(logicBugSnippet));
    assert.strictEqual(activeLogic.length, 0, 'Logical race yields 0 AST regex violations instead of false green card');

    const loomPinningSnippet = `
      public synchronized void handlePayment() {
        restClient.post();
      }
    `;
    const activeLoom = filterActiveAstViolations(evaluateAstRules(loomPinningSnippet));
    assert.ok(activeLoom.length >= 1 && activeLoom[0].id === 'carrier-thread-pinning');
  }
  console.log('  ✅ [2/4] Truth-in-Telemetry AST filtering passed');

  // 3. Bug Hunt Voice Session Params Builder (Unified PracticeVoiceProvider input)
  {
    const sampleChallenge = {
      id: 'bug-race-101',
      topicId: 'concurrency',
      topicName: 'Concurrency & Virtual Threads',
      title: 'Check-Then-Act Map Race',
      subtopic: 'ConcurrentHashMap Atomicity',
      language: 'java' as const,
      codeSnippet: 'if (!map.containsKey(k)) { map.put(k, v); }',
      bugExplanation: 'Non-atomic containsKey + put allows race condition.',
      fixedCode: 'return map.computeIfAbsent(k, key -> v);',
      hints: ['Check atomicity of map operations'],
      productionContext: {
        systemName: 'OrderGateway',
        architectureType: 'Spring Boot 3',
        incidentSymptoms: 'Duplicate Downstream Charges',
        businessImpact: 'Double billing',
        prReviewContext: 'Hotfix cache PR #42'
      }
    };

    const reviewParams = buildBugHuntSessionParams({
      challenge: sampleChallenge,
      tutorRole: 'code_review',
      interviewConfig: {
        voice: 'Kore',
        userGender: 'female',
        turnMode: 'auto',
        vadPauseMs: 1800,
        enableSilenceClarification: true,
        targetGrade: 'L5_SENIOR',
        strictness: 'standard',
        deepDive: false,
        liveCoaching: false,
        maxProbes: 3
      } as any,
      selectedCodeSnippet: 'if (!map.containsKey(k))',
      cursorLine: 1
    });
    assert.strictEqual(reviewParams.tutorMode, 'bug_hunt');
    assert.strictEqual(reviewParams.questionId, 'bug-race-101');
    assert.ok(reviewParams.initialUserMessage?.includes('строке 1'));
    assert.strictEqual(reviewParams.turnMode, 'auto');

    const chatParams = buildBugHuntSessionParams({
      challenge: sampleChallenge,
      tutorRole: 'free_chat',
      interviewConfig: { voice: 'Puck', turnMode: 'manual' } as any
    });
    assert.strictEqual(chatParams.tutorMode, 'free_chat');
  }
  console.log('  ✅ [3/4] buildBugHuntSessionParams (code_review + free_chat) passed');

  // 4. Unified Store: incidents role toggle, verifyBugDiagnosis & uiSlice cleanup
  {
    let verifiedCalls = 0;
    const fakeTransport: TutorTransportPort = {
      streamChat: async () => ({ fullText: 'ok', leakDetected: false, similarity: 0 }),
      fetchHint: async () => ({ hintTier: 1, content: 'hint', leakDetected: false }),
      groundRule: async () => ({ ruleId: 'R', ruleName: 'Rule', content: 'ok', leakDetected: false }),
      verifyBugDiagnosis: async (diagnosis, ctx) => {
        verifiedCalls++;
        assert.strictEqual(ctx.arena, 'incidents');
        assert.strictEqual(ctx.tutorRole, 'code_review');
        assert.ok(diagnosis.includes('containsKey'));
        return {
          verdict: 'solved',
          isCorrect: true,
          feedback: 'Точно: containsKey и put не атомарны.',
          revealedExplanation: 'Race condition in check-then-act.',
          fsrsRecorded: true
        };
      }
    };

    const store = createPracticeTutorStore(fakeTransport);
    store.getState().initChallengeContext('testing', 'Race Bug', 'incidents');
    assert.strictEqual(store.getState().tutorRole, 'code_review');
    assert.ok(store.getState().messages[0].content.includes('Senior Code Reviewer'));

    const ctx = normalizeIncidentsContext({
      bugId: 'bug-race-101',
      title: 'Race Bug',
      buggyCode: 'if (!map.containsKey(k)) { map.put(k, v); }',
      selectedCodeSnippet: 'if (!map.containsKey(k))',
      cursorLine: 1,
      tutorRole: 'code_review'
    });
    store.getState().setActiveContext(ctx);

    const runAsync = async () => {
      const res = await store.getState().verifyBugDiagnosis('containsKey и put не атомарны', ctx);
      assert.strictEqual(verifiedCalls, 1);
      assert.strictEqual(res?.verdict, 'solved');
      assert.strictEqual(store.getState().isVerifyingDiagnosis, false);
      assert.ok(store.getState().messages.some((m) => m.content.includes('Диагноз подтверждён')));

      store.getState().setTutorRole('free_chat');
      assert.strictEqual(store.getState().tutorRole, 'free_chat');
      assert.strictEqual(store.getState().activeContext?.tutorRole, 'free_chat');

      useAppStore.getState().openTopicBugHunt('concurrency', 'Concurrency');
      useAppStore.getState().setActiveBugHuntChallenge({
        id: 'bug-race-101',
        title: 'Race Bug',
        subtopic: 'Concurrency',
        language: 'java',
        codeSnippet: 'x',
        bugExplanation: 'y',
        fixedCode: 'z',
        hints: []
      });
      assert.strictEqual(useAppStore.getState().activeBugHuntChallenge?.id, 'bug-race-101');
      useAppStore.getState().closeTopicBugHunt();
      assert.strictEqual(useAppStore.getState().activeBugHuntChallenge, null);
    };

    await runAsync();
    console.log('  ✅ [4/4] Incidents store, diagnosis verification & uiSlice cleanup passed');
    console.log('🎉 ALL SPEC 62 BUG HUNT WORKBENCH & CO-PILOT DOCK TESTS PASSED!');
  }
}

runBugHuntContractTests().catch((err) => {
  console.error('❌ Spec 62 contract test failed:', err);
  process.exit(1);
});
