/**
 * practiceContextBuilder.ts
 * Pure feedback formatters and live TutorActiveContext assembler for PracticeTutorDrawer (Spec 58).
 * Reads store state lazily at dispatch time to avoid closed-drawer re-renders and stale closures.
 * File length limit: <= 350 lines (Rule 8).
 */

import {
  normalizePracticeContext,
  type TutorActiveContext,
  type TutorPersona
} from '@interview-prep/shared/tutor';
import { TRANSACTION_LAB_SCENARIOS } from '../../../data/transactionLabCatalog';
import { selectActiveWhiteboardArtifact, type AppState } from '../../../store/useAppStore';
import type {
  MutationExecutionResponse,
  SandboxExecutionResponse
} from '../../../types/practice';
import type { ScenarioEvaluationResult } from '../../../types/transactionLab';
import { buildWorkspaceManifest } from '../../../utils/workspaceManifest';
import type { TutorDomain } from './TutorDomain';

export interface PracticeFeedbackSummary {
  compilerError?: string;
  testFailureMessage?: string;
}

export function extractPracticeFeedbackSummary(
  latestSandboxResult: SandboxExecutionResponse | null,
  latestMutationResult: MutationExecutionResponse | null,
  latestTxEvaluation: ScenarioEvaluationResult | null
): PracticeFeedbackSummary {
  let compilerError: string | undefined;
  if (latestSandboxResult && !latestSandboxResult.isCompilable) {
    if (latestSandboxResult.syntaxErrors && latestSandboxResult.syntaxErrors.length > 0) {
      compilerError = latestSandboxResult.syntaxErrors
        .map((e) => `Строка ${e.lineNumber}: ${e.errorMessage}`)
        .join('\n');
    } else if (latestSandboxResult.error) {
      compilerError = latestSandboxResult.error;
    }
  }

  const failureParts: string[] = [];
  if (latestSandboxResult) {
    const failedTests = latestSandboxResult.testResults?.filter((t) => t.status !== 'PASSED') || [];
    if (failedTests.length > 0) {
      failureParts.push(
        `Упавшие тесты (${failedTests.length}/${latestSandboxResult.testResults.length}):\n` +
          failedTests.map((t) => `• [${t.testName}] ${t.failureReason || 'провален'}`).join('\n')
      );
    }
    if (latestSandboxResult.concurrencyHarness?.deadlockDetected) {
      failureParts.push('⚠️ КРИТИЧЕСКАЯ ОШИБКА: Обнаружен взаимный дедлок потоков (Deadlock Detected).');
    }
    if (latestSandboxResult.concurrencyHarness?.raceConditionDetected) {
      failureParts.push('⚠️ ВНИМАНИЕ: Обнаружено состояние гонки данных (Race Condition Detected).');
    }
  }

  if (latestMutationResult) {
    if (!latestMutationResult.baselinePassed) {
      failureParts.push(`⚠️ Baseline упал: ${latestMutationResult.error || 'Тесты не прошли даже на исходном сервисе'}`);
    } else if (!latestMutationResult.passedThreshold) {
      failureParts.push(
        `⚠️ Мутации выжили: скор ${latestMutationResult.mutationScore.toFixed(0)}% (требуется >= ${latestMutationResult.requiredScore}%). Выжило мутантов: ${latestMutationResult.survivedCount} из ${latestMutationResult.totalMutants}.`
      );
    }
  }

  if (latestTxEvaluation && !latestTxEvaluation.isPassed) {
    failureParts.push(
      `⚠️ Архитектурные дефекты транзакций (Оценка: ${latestTxEvaluation.overallScore}/100):\n${latestTxEvaluation.summary}`
    );
    const methodViolations = Object.values(latestTxEvaluation.methodResults || {}).flatMap((m) =>
      m.violations.map((v) => `• Метод ${m.methodId}: ${v}`)
    );
    if (methodViolations.length > 0) failureParts.push(methodViolations.join('\n'));
  }

  return {
    compilerError,
    testFailureMessage: failureParts.length > 0 ? failureParts.join('\n\n') : undefined
  };
}

export function buildLivePracticeContext(
  appState: AppState,
  domain: TutorDomain,
  persona: TutorPersona,
  assistanceLevel: number
): TutorActiveContext {
  const {
    activePracticeChallenge,
    practiceWorkspaceFiles,
    activeWorkspaceFileIndex,
    activeTransactionLabScenarioId,
    latestSandboxResult,
    latestMutationResult,
    latestTxEvaluation,
    academyBreadcrumbContext
  } = appState;

  const currentFile = practiceWorkspaceFiles[activeWorkspaceFileIndex] || practiceWorkspaceFiles[0];
  const txScenario = activeTransactionLabScenarioId
    ? TRANSACTION_LAB_SCENARIOS.find((s) => s.id === activeTransactionLabScenarioId) || TRANSACTION_LAB_SCENARIOS[0]
    : null;

  const feedback = extractPracticeFeedbackSummary(
    latestSandboxResult,
    latestMutationResult,
    latestTxEvaluation
  );
  const wb = selectActiveWhiteboardArtifact(appState);

  return normalizePracticeContext({
    kataId: txScenario?.id || activePracticeChallenge?.id || 'kata',
    kataTitle:
      txScenario?.title ||
      activePracticeChallenge?.title ||
      (domain === 'lld'
        ? 'LLD Architecture Challenge'
        : domain === 'transactions'
          ? 'Spring Transactions Challenge'
          : 'Testing Kata'),
    kataCategory: txScenario
      ? 'Spring Transactions'
      : activePracticeChallenge?.category ||
        (domain === 'lld'
          ? 'Low-Level Design (LLD)'
          : domain === 'transactions'
            ? 'Transactions'
            : 'Testing Kata'),
    kataInstructions:
      txScenario?.problemStatement ||
      activePracticeChallenge?.instructionsMarkdown ||
      activePracticeChallenge?.scenarioMarkdown ||
      activePracticeChallenge?.shortDescription ||
      '',
    activeFilePath: txScenario
      ? `${txScenario.services[0]?.className}.java`
      : currentFile?.path || (domain === 'lld' ? 'src/main/java/Service.java' : 'src/test/java/Test.java'),
    activeFileContent: txScenario
      ? txScenario.services
          .map((s) => `// ${s.className}\n` + s.methods.map((m) => m.codeSnippet).join('\n\n'))
          .join('\n\n')
      : currentFile?.content || '',
    survivingMutants: activePracticeChallenge?.mutants,
    compilerError: feedback.compilerError,
    testFailureMessage: feedback.testFailureMessage,
    activeWhiteboardSnippet:
      wb?.code && wb.code.trim().length > 0
        ? { title: wb.title, code: wb.code, language: wb.language }
        : undefined,
    workspaceManifest: buildWorkspaceManifest(practiceWorkspaceFiles, activeWorkspaceFileIndex),
    academyBridgeContext: academyBreadcrumbContext
      ? {
          courseId: academyBreadcrumbContext.courseId,
          stepId: `step-${academyBreadcrumbContext.stepNumber}`,
          moduleTitle: academyBreadcrumbContext.moduleTitle || academyBreadcrumbContext.stepTitle,
          learningObjective: academyBreadcrumbContext.learningObjective,
          targetConcepts: academyBreadcrumbContext.targetConcepts
        }
      : undefined,
    persona,
    assistanceLevel
  });
}
