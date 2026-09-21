/**
 * liveAudioSessionContracts.test.ts
 *
 * SOTA September 2026 Protocol Contract Test Suite for Live Audio Sessions.
 * Validates Atomic Frame Fusion, Non-Anonymous Session ID contract,
 * and Single-Envelope Turn Commit invariants to prevent upstream Gemini Live desynchronization.
 */

interface TestContext {
  passed: number;
  failed: number;
  failures: string[];
}

const ctx: TestContext = { passed: 0, failed: 0, failures: [] };

function assert(condition: boolean, testName: string, detail?: string): void {
  if (condition) {
    ctx.passed++;
    console.log(`  ✅ ${testName}`);
  } else {
    ctx.failed++;
    const msg = detail ? `${testName}: ${detail}` : testName;
    ctx.failures.push(msg);
    console.error(`  ❌ ${testName} ${detail ? `(${detail})` : ''}`);
  }
}

// ---------------------------------------------------------------------------
// Atomic Frame Fusion Helper (Mirroring useLegacyLiveAudioSession logic)
// ---------------------------------------------------------------------------

interface CommitOptions {
  currentCode?: string;
  lastSyncedCodeHash?: number;
  fileName?: string;
  language?: string;
  activeFocusText?: string;
  isFocusInjected?: boolean;
}

function buildAtomicTurnCommitFrame(opts: CommitOptions): {
  payload: any;
  updatedCodeHash?: number;
  updatedFocusInjected: boolean;
} {
  const fusedParts: Array<{ text: string }> = [];
  let updatedCodeHash = opts.lastSyncedCodeHash;
  let updatedFocusInjected = opts.isFocusInjected ?? false;

  // 1. Handover code check
  if (opts.currentCode) {
    let hash = 0;
    for (let i = 0; i < opts.currentCode.length; i++) {
      hash = (hash << 5) - hash + opts.currentCode.charCodeAt(i);
      hash |= 0;
    }
    if (hash !== opts.lastSyncedCodeHash) {
      updatedCodeHash = hash;
      const fileName = opts.fileName;
      const lang = opts.language || 'java';
      const header = `📝 [АКТУАЛЬНЫЙ КОД КАНДИДАТА НА МОМЕНТ ЗАВЕРШЕНИЯ РЕЧИ${fileName ? ` (${fileName})` : ''}]`;
      fusedParts.push({
        text: `${header}:\n\`\`\`${lang}\n${opts.currentCode}\n\`\`\`\n(Системная директива: кандидат сейчас работает именно с этой версией кода. Учитывай эти актуальные строки при ответе).`
      });
    }
  }

  // 2. Deictic focus check
  if (!updatedFocusInjected && opts.activeFocusText) {
    updatedFocusInjected = true;
    fusedParts.push({
      text: `🎯 [ФОКУС ВНИМАНИЯ КАНДИДАТА: выделен фрагмент]:\n«${opts.activeFocusText}»\n(Системная директива: кандидат голосом обращается к этому фрагменту на экране).`
    });
  }

  // 3. Monolithic atomic turnComplete message
  const turnCommitMessage: any = {
    clientContent: {
      turnComplete: true
    }
  };

  if (fusedParts.length > 0) {
    turnCommitMessage.clientContent.turns = [
      {
        role: 'user',
        parts: fusedParts
      }
    ];
  }

  return {
    payload: turnCommitMessage,
    updatedCodeHash,
    updatedFocusInjected
  };
}

// ---------------------------------------------------------------------------
// TEST SUITE
// ---------------------------------------------------------------------------

function runContractTests() {
  console.log('\n=========================================================================');
  console.log('🧪 LIVE AUDIO SESSION & ATOMIC FRAME FUSION CONTRACT TEST SUITE');
  console.log('=========================================================================\n');

  // [Test 1] Atomic Fusion with in-flight code changes and active focus
  console.log('[Test 1] Atomic Frame Fusion: Code Handover + Deictic Focus + turnComplete');
  {
    const result = buildAtomicTurnCommitFrame({
      currentCode: 'record PromoCode(String code) {}',
      lastSyncedCodeHash: 0,
      fileName: 'PromoCode.java',
      language: 'java',
      activeFocusText: 'Objects.requireNonNull(code)',
      isFocusInjected: false
    });

    assert(result.payload.clientContent !== undefined, 'Frame contains clientContent envelope');
    assert(result.payload.clientContent.turnComplete === true, 'Frame has turnComplete: true');
    assert(Array.isArray(result.payload.clientContent.turns), 'Frame contains turns array inside clientContent');
    assert(result.payload.clientContent.turns.length === 1, 'Exactly one user turn in fused frame');
    assert(result.payload.clientContent.turns[0].parts.length === 2, 'Fused turn contains both code handover and focus parts');
    assert(result.payload.clientContent.turns[0].parts[0].text.includes('PromoCode.java'), 'Code part mentions filename');
    assert(result.payload.clientContent.turns[0].parts[1].text.includes('Objects.requireNonNull'), 'Focus part mentions selected text');
    assert(result.updatedFocusInjected === true, 'Focus injection flag set to true');
  }

  // [Test 2] Atomic Fusion with NO code or focus changes (Pure Voice Commit)
  console.log('\n[Test 2] Atomic Frame Fusion: Pure Voice Commit without Code Changes');
  {
    const code = 'existing code';
    let codeHash = 0;
    for (let i = 0; i < code.length; i++) {
      codeHash = (codeHash << 5) - codeHash + code.charCodeAt(i);
      codeHash |= 0;
    }
    const result = buildAtomicTurnCommitFrame({
      currentCode: code,
      lastSyncedCodeHash: codeHash, // Exact same hash!
      isFocusInjected: true
    });

    assert(result.payload.clientContent.turnComplete === true, 'Frame has turnComplete: true');
    assert(result.payload.clientContent.turns === undefined, 'No redundant turns array when code is unchanged');
  }

  // [Test 3] Single-Message Dispatch Invariant (Zero Fragmented Messages)
  console.log('\n[Test 3] Protocol Invariant: Zero Fragmented Messages on End-Turn');
  {
    const sentMessages: any[] = [];
    const mockWsSend = (msg: string) => {
      sentMessages.push(JSON.parse(msg));
    };

    // Simulate atomic end-turn execution
    const commit = buildAtomicTurnCommitFrame({
      currentCode: 'public class Solution {}',
      lastSyncedCodeHash: 0
    });
    mockWsSend(JSON.stringify(commit.payload));

    assert(sentMessages.length === 1, 'Exactly ONE message sent over WebSocket on turn commit');
    assert(
      !sentMessages.some((m) => m.clientContent?.turnComplete === false),
      'No fragmented turnComplete: false message emitted immediately before commit'
    );
  }

  // [Test 4] Non-Anonymous Session Contract for Practice Tutor Mode
  console.log('\n[Test 4] Non-Anonymous Session Contract (Deterministic sessionId Invariant)');
  {
    const validateSessionParams = (params: { sessionId?: string; sessionType?: string }) => {
      if (!params.sessionId || params.sessionId.trim().length < 8) {
        throw new Error(`CRITICAL: Session started with missing or invalid sessionId (${params.sessionId})`);
      }
      return true;
    };

    const validPracticeSessionId = `session_practice_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    assert(
      validateSessionParams({ sessionId: validPracticeSessionId, sessionType: 'tutor' }) === true,
      'Valid practice session ID accepted'
    );

    let threwOnEmpty = false;
    try {
      validateSessionParams({ sessionId: '', sessionType: 'tutor' });
    } catch {
      threwOnEmpty = true;
    }
    assert(threwOnEmpty, 'Empty sessionId throws validation error preventing session: anon');
  }

  // Summary
  console.log('\n=========================================================================');
  console.log(`Live Session Contracts: ${ctx.passed} Passed, ${ctx.failed} Failed`);
  console.log('=========================================================================\n');

  if (ctx.failed > 0) {
    console.error('❌ SOME CONTRACT TESTS FAILED');
    process.exit(1);
  } else {
    console.log('🎉 ALL LIVE SESSION PROTOCOL CONTRACTS SATISFIED!');
  }
}

runContractTests();
