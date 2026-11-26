/**
 * tutorTransportStore.test.ts
 * Spec 58 Contract Test Suite:
 * - FakeTutorTransportPort injection & persona / assistanceLevel propagation (no hardcoded middle_scaffold/2)
 * - AbortSignal cancellation across sendMessage, requestHint, and groundRule
 * - initChallengeContext clearing stale activeContext & company_interviewer persona
 * - normalizePracticeContext & CompanyTrackContextAdapter canonical contracts
 */

import assert from 'assert';
import {
  normalizeCompanyContext,
  normalizePracticeContext,
  type CompanyProfile,
  type TutorActiveContext,
  type TutorPersona
} from '@interview-prep/shared';
import { CompanyTrackContextAdapter } from '../src/services/CompanyTrackContextAdapter';
import {
  formatTutorRequestBody,
  type TutorHintResponse,
  type TutorRuleGroundingResponse,
  type TutorStreamChatRequest,
  type TutorTransportPort
} from '../src/store/tutorTransport';
import { createPracticeTutorStore } from '../src/store/usePracticeTutorStore';

interface RecordedCall {
  kind: 'chat' | 'hint' | 'groundRule';
  persona: TutorPersona;
  assistanceLevel: number;
  context?: TutorActiveContext;
  ruleId?: string;
  signal?: AbortSignal;
  wasAborted: boolean;
}

class FakeTutorTransportPort implements TutorTransportPort {
  public calls: RecordedCall[] = [];
  public holdAbortableTurn = false;
  public replyText = 'Socratic reply';

  public async streamChat(opts: TutorStreamChatRequest) {
    const record: RecordedCall = {
      kind: 'chat',
      persona: opts.persona,
      assistanceLevel: opts.assistanceLevel,
      context: opts.context,
      signal: opts.signal,
      wasAborted: Boolean(opts.signal?.aborted)
    };
    this.calls.push(record);
    if (this.holdAbortableTurn) {
      return this.waitForAbort(opts.signal, record);
    }
    opts.onChunk(this.replyText);
    opts.onDone?.({ leakDetected: false, maxSimilarity: 0.1 });
    return { fullText: this.replyText, leakDetected: false, similarity: 0.1 };
  }

  public async fetchHint(
    context: TutorActiveContext,
    persona: TutorPersona,
    assistanceLevel: number,
    signal?: AbortSignal
  ): Promise<TutorHintResponse> {
    const record: RecordedCall = {
      kind: 'hint',
      persona,
      assistanceLevel,
      context,
      signal,
      wasAborted: Boolean(signal?.aborted)
    };
    this.calls.push(record);
    if (this.holdAbortableTurn) {
      return this.waitForAbort(signal, record);
    }
    return { hintTier: context.hintTier ?? 1, content: `Hint L${assistanceLevel}`, leakDetected: false };
  }

  public async groundRule(
    ruleId: string,
    context: TutorActiveContext,
    persona: TutorPersona,
    assistanceLevel: number,
    signal?: AbortSignal
  ): Promise<TutorRuleGroundingResponse> {
    const record: RecordedCall = {
      kind: 'groundRule',
      persona,
      assistanceLevel,
      context,
      ruleId,
      signal,
      wasAborted: Boolean(signal?.aborted)
    };
    this.calls.push(record);
    if (this.holdAbortableTurn) {
      return this.waitForAbort(signal, record);
    }
    return { ruleId, ruleName: ruleId, content: `Rule ${ruleId}`, leakDetected: false };
  }

  private waitForAbort<T>(signal: AbortSignal | undefined, record: RecordedCall): Promise<T> {
    return new Promise((_, reject) => {
      if (signal?.aborted) {
        record.wasAborted = true;
        const err = new Error('Aborted');
        err.name = 'AbortError';
        reject(err);
        return;
      }
      signal?.addEventListener('abort', () => {
        record.wasAborted = true;
        const err = new Error('Aborted');
        err.name = 'AbortError';
        reject(err);
      });
    });
  }
}

async function runTutorTransportStoreTests(): Promise<void> {
  console.log('🧪 Running Spec 58 TutorTransportPort & ActiveContext Contract Tests...\n');

  // [Test 1] Persona & AssistanceLevel propagation across streamChat, fetchHint, groundRule
  console.log('[Test 1] Persona & AssistanceLevel propagation (no middle_scaffold/2 hardcode)');
  {
    const fake = new FakeTutorTransportPort();
    const store = createPracticeTutorStore(fake);
    store.getState().setAssistanceLevel(4);
    assert.strictEqual(store.getState().persona, 'faang_interviewer');

    const ctx = normalizePracticeContext({
      kataId: 'conc-01',
      kataTitle: 'StampedLock Lab',
      kataCategory: 'Concurrency Lab',
      activeFilePath: 'src/main/java/Cache.java',
      activeFileContent: 'class Cache {}',
      persona: 'faang_interviewer',
      assistanceLevel: 4
    });

    await store.getState().sendMessage('Проверь блокировки', ctx);
    await store.getState().requestHint(3, ctx);
    await store.getState().groundRule('STAMPED_LOCK_OPTIMISTIC', ctx);

    assert.strictEqual(fake.calls.length, 3, 'Dispatches chat, hint, and groundRule calls');
    for (const c of fake.calls) {
      assert.strictEqual(c.persona, 'faang_interviewer', `${c.kind} receives active persona`);
      assert.strictEqual(c.assistanceLevel, 4, `${c.kind} receives active assistanceLevel`);
    }
    assert.strictEqual(fake.calls[1].context?.hintTier, 3, 'requestHint preserves requested hintTier');
    assert.strictEqual(fake.calls[2].ruleId, 'STAMPED_LOCK_OPTIMISTIC', 'groundRule sends canonical ruleId');
    assert.strictEqual(
      fake.calls[2].context?.activeCompassRuleId,
      'STAMPED_LOCK_OPTIMISTIC',
      'groundRule updates context activeCompassRuleId'
    );
    console.log('  ✅ Passed: persona & assistanceLevel propagated to all 3 endpoints');
  }

  // [Test 2] abortGeneration propagates AbortSignal across chat, hint, and groundRule
  console.log('\n[Test 2] AbortSignal propagation & abortGeneration cleanup');
  {
    const fake = new FakeTutorTransportPort();
    fake.holdAbortableTurn = true;
    const store = createPracticeTutorStore(fake);

    const pChat = store.getState().sendMessage('slow chat');
    assert.strictEqual(store.getState().isLoading, true, 'isLoading true during chat');
    store.getState().abortGeneration();
    await pChat;
    assert.strictEqual(fake.calls[0].wasAborted, true, 'sendMessage AbortSignal aborted');
    assert.strictEqual(store.getState().isLoading, false, 'isLoading reset after abort');

    const msgCountBeforeHint = store.getState().messages.length;
    const pHint = store.getState().requestHint(2);
    store.getState().abortGeneration();
    await pHint;
    assert.strictEqual(fake.calls[1].wasAborted, true, 'requestHint AbortSignal aborted');
    assert.strictEqual(store.getState().messages.length, msgCountBeforeHint + 1, 'Aborted hint adds only user trigger, no error message');

    const msgCountBeforeRule = store.getState().messages.length;
    const pRule = store.getState().groundRule('SMELL_REMEDIATION');
    store.getState().abortGeneration();
    await pRule;
    assert.strictEqual(fake.calls[2].wasAborted, true, 'groundRule AbortSignal aborted');
    assert.strictEqual(store.getState().messages.length, msgCountBeforeRule + 1, 'Aborted groundRule appends no error message');
    console.log('  ✅ Passed: abortGeneration cleanly aborts chat, hint, and groundRule');
  }

  // [Test 3] initChallengeContext clears stale activeContext & resets company_interviewer persona
  console.log('\n[Test 3] initChallengeContext state hygiene & context switch persona sync');
  {
    const fake = new FakeTutorTransportPort();
    const store = createPracticeTutorStore(fake);
    const sampleCompany = {
      id: 'alfa_digital',
      name: 'Alfa Digital',
      stages: [{ id: 'stage-1', title: 'Live Coding', description: 'API Design', weight: 0.5 }],
      culture: { metricsFocus: ['TTM'], redFlags: ['global mutable state'], greenFlags: ['Clock injection'] }
    } as unknown as CompanyProfile;

    const companyCtx = normalizeCompanyContext({ profile: sampleCompany, activeStage: sampleCompany.stages[0] });
    store.getState().setActiveContext(companyCtx);
    store.getState().setActiveCompassRuleId('CLOCK_INJECTION');
    assert.strictEqual(store.getState().persona, 'company_interviewer');
    assert.strictEqual(store.getState().activeContext?.arena, 'companies');

    store.getState().initChallengeContext('lld', 'Rate Limiter');
    assert.strictEqual(store.getState().activeContext, null, 'initChallengeContext clears stale activeContext');
    assert.strictEqual(store.getState().activeCompassRuleId, null, 'initChallengeContext clears compass rule id');
    assert.strictEqual(store.getState().persona, 'middle_scaffold', 'initChallengeContext resets company_interviewer');
    assert.strictEqual(store.getState().assistanceLevel, 2, 'initChallengeContext resets assistanceLevel to 2');

    const theoryCtx = CompanyTrackContextAdapter.createTheoryQuestionContext(sampleCompany, {
      id: 'q1',
      question: 'Why avoid Thread.sleep?',
      topic: 'Concurrency',
      answer: 'Use java.time.Clock.'
    });
    assert.strictEqual(theoryCtx.arena, 'companies');
    assert.strictEqual(theoryCtx.entityId, 'alfa_digital:q1');
    assert.strictEqual(theoryCtx.companyContext?.companyName, 'Alfa Digital');
    assert.ok((theoryCtx.quickActionChips?.length || 0) >= 2);

    const body = formatTutorRequestBody('company_interviewer', 3, [], theoryCtx, false);
    assert.strictEqual('isPolymorphic' in body, false, 'formatTutorRequestBody omits legacy isPolymorphic flag');
    assert.strictEqual(body.arena, 'companies');
    console.log('  ✅ Passed: context clearing & CompanyTrackContextAdapter contracts verified');
  }

  console.log('\n🎉 ALL SPEC 58 TUTOR TRANSPORT & STORE CONTRACT TESTS PASSED!');
}

runTutorTransportStoreTests().catch((err) => {
  console.error('❌ tutorTransportStore.test.ts failed:', err);
  process.exit(1);
});
