/**
 * usePracticeVoiceTelemetrySync.ts
 * Reactive telemetry synchronization for practice test runs, PITest mutations, and Transaction Lab evaluation.
 * Decoupled from PracticeVoiceContext to maintain cognitive bounding (Rule 8: <= 350 lines).
 */

import { useEffect, useRef } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { MutantResult } from '../../../types/practice';

interface LiveVoiceFrameSender {
  isConnected: boolean;
  sendCustomFrame?: (frame: any) => void;
}

export function usePracticeVoiceTelemetrySync(session: LiveVoiceFrameSender): void {
  const {
    latestSandboxResult,
    latestMutationResult,
    latestTxEvaluation
  } = useAppStore();

  // Reactive test execution telemetry sync into Live Voice WebSocket
  const lastSandboxSyncTimeRef = useRef<number>(0);
  useEffect(() => {
    if (!session.isConnected || !latestSandboxResult) return;
    const now = Date.now();
    if (now - lastSandboxSyncTimeRef.current < 1000) return;
    lastSandboxSyncTimeRef.current = now;

    let telemetryText = '';
    if (!latestSandboxResult.isCompilable) {
      const err = latestSandboxResult.syntaxErrors?.[0]?.errorMessage || latestSandboxResult.error || 'Ошибка компиляции';
      telemetryText = `❌ [ОШИБКА КОМПИЛЯЦИИ]: ${err}`;
    } else {
      const failed = latestSandboxResult.testResults?.filter((t) => t.status !== 'PASSED') || [];
      if (failed.length > 0) {
        telemetryText =
          `❌ [ТЕСТЫ ПРОВАЛЕНЫ (${failed.length}/${latestSandboxResult.testResults.length})]:\n` +
          failed.slice(0, 3).map((t) => `• [${t.testName}] ${t.failureReason || 'провален'}`).join('\n');
      } else {
        telemetryText = `✅ [ВСЕ UNIT-ТЕСТЫ ПРОШЛИ УСПЕШНО] (${latestSandboxResult.testResults.length}/${latestSandboxResult.testResults.length})`;
      }
      if (latestSandboxResult.concurrencyHarness?.deadlockDetected) {
        telemetryText += '\n⚠️ [КРИТИЧЕСКАЯ ОШИБКА]: Обнаружен взаимный дедлок потоков (Deadlock Detected).';
      }
      if (latestSandboxResult.concurrencyHarness?.raceConditionDetected) {
        telemetryText += '\n⚠️ [ВНИМАНИЕ]: Обнаружено состояние гонки данных (Race Condition).';
      }
    }

    if (telemetryText) {
      session.sendCustomFrame?.({
        type: 'screen_context_sync',
        clientContent: {
          turns: [
            {
              role: 'user',
              parts: [{ text: telemetryText }]
            }
          ],
          turnComplete: false
        }
      });
    }
  }, [session, latestSandboxResult]);

  // Reactive PITest mutation results sync
  const lastMutationSyncTimeRef = useRef<number>(0);
  useEffect(() => {
    if (!session.isConnected || !latestMutationResult) return;
    const now = Date.now();
    if (now - lastMutationSyncTimeRef.current < 1000) return;
    lastMutationSyncTimeRef.current = now;

    let mutationText = '';
    if (!latestMutationResult.baselinePassed) {
      mutationText = `⚠️ [PITest Baseline Failed]: Тесты не прошли на исходном коде: ${latestMutationResult.error || 'ошибка'}`;
    } else if (!latestMutationResult.passedThreshold) {
      mutationText = `⚠️ [РЕЗУЛЬТАТЫ PITest]: Скор ${latestMutationResult.mutationScore.toFixed(0)}% (порог >= ${latestMutationResult.requiredScore}%). Выжило мутантов: ${latestMutationResult.survivedCount} из ${latestMutationResult.totalMutants}.`;
      if (latestMutationResult.mutantResults && latestMutationResult.mutantResults.length > 0) {
        const survived = latestMutationResult.mutantResults.filter((m: MutantResult) => m.status === 'SURVIVED').slice(0, 3);
        if (survived.length > 0) {
          mutationText +=
            '\nВыжившие мутанты:\n' +
            survived.map((m: MutantResult) => `• Строка ${m.line}: ${m.name} (${m.description || m.mutatorType || 'мутация'})`).join('\n');
        }
      }
    } else {
      mutationText = `🏆 [PITest: ВСЕ МУТАНТЫ УНИЧТОЖЕНЫ!]: Скор 100%, порог пройден.`;
    }

    if (mutationText) {
      session.sendCustomFrame?.({
        type: 'screen_context_sync',
        clientContent: {
          turns: [
            {
              role: 'user',
              parts: [{ text: mutationText }]
            }
          ],
          turnComplete: false
        }
      });
    }
  }, [session, latestMutationResult]);

  // Reactive Transaction Lab evaluation sync
  const lastTxSyncTimeRef = useRef<number>(0);
  useEffect(() => {
    if (!session.isConnected || !latestTxEvaluation) return;
    const now = Date.now();
    if (now - lastTxSyncTimeRef.current < 1000) return;
    lastTxSyncTimeRef.current = now;

    let txText = '';
    if (latestTxEvaluation.isPassed) {
      txText = `🏆 [ТРАНЗАКЦИИ: READY FOR PRODUCTION]: Оценка ${latestTxEvaluation.overallScore}/100. Все аномалии устранены.`;
    } else {
      txText = `⚠️ [ДЕФЕКТЫ ТРАНЗАКЦИЙ (${latestTxEvaluation.overallScore}/100)]:\n${latestTxEvaluation.summary}`;
      const methodViolations = Object.values(latestTxEvaluation.methodResults || {}).flatMap((m) =>
        m.violations.map((v) => `• Метод ${m.methodId}: ${v}`)
      ).slice(0, 3);
      if (methodViolations.length > 0) {
        txText += '\n' + methodViolations.join('\n');
      }
    }

    if (txText) {
      session.sendCustomFrame?.({
        type: 'screen_context_sync',
        clientContent: {
          turns: [
            {
              role: 'user',
              parts: [{ text: txText }]
            }
          ],
          turnComplete: false
        }
      });
    }
  }, [session, latestTxEvaluation]);
}
