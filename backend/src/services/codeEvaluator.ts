/**
 * codeEvaluator.ts
 * Practice Code Evaluation Judge (SOTA Late 2026).
 * Conducts Gate 4 Senior AI audit via LlmGatewayClient.
 * Enforces Invariant 1 (LiteLLM Proxy Centralization) and Invariant 5 (Zero-Phantom Full-Jitter Retry).
 * Cognitive Bounding Limit: <= 350 lines (Rule 8 compliant).
 */

import { preProcessWorkspaceFiles } from './astAnalyzer';
import { CodingChallenge } from './challengeSeedData';
import { recordNewErrorGap } from './vectorMemoryService';
import { SandboxExecutionResponse } from './sandbox/JvmExecutionService';
import { llmGateway } from './LlmGatewayClient';
import { EVALUATION_JSON_SCHEMA, ConcurrencyFinding, normalizeConcurrencyFindings } from './codeEvaluatorSchema';
import { EvaluationRequest, TestCaseResult, EvaluationResult } from './codeEvaluatorTypes';
import { wrapUntrustedContext, PROMPT_INJECTION_DEFENSE_DIRECTIVE } from '../prompts/core/sandboxDirectives';
import { ANTI_SYCOPHANCY_DIRECTIVES, EPISTEMIC_BENEVOLENCE_AXIOM } from '../prompts/core/antiSycophancy';
import { LANGUAGE_LOCK_INVARIANT } from '../prompts/core/languageDirectives';

export { EVALUATION_JSON_SCHEMA, ConcurrencyFinding, EvaluationRequest, TestCaseResult, EvaluationResult };

export function buildCodeEvaluatorSystemInstruction(dpContext?: any): string {
  const patternDirective = dpContext ? `
7. ДИРЕКТИВА OVERENGINEERING SENTINEL (ДЛЯ ПАТТЕРНОВ ПРОЕКТИРОВАНИЯ):
   - Целевой паттерн задачи: ${dpContext.targetPattern}
   - Устраняемый антипаттерн / code smell: ${dpContext.antiPatternSmell?.name || 'Anti-Pattern'} (${dpContext.antiPatternSmell?.description || ''})
   - Оцени, избавился ли кандидат от исходного запаха кода (мутабельный Singleton, процедурный switch, жесткое связывание).
   - ШТРАФ ЗА ИЗБЫТОЧНОСТЬ (OVERENGINEERING): Если кандидат написал избыточный бойлерплейт из десятка классов там, где в Java 21 достаточно sealed interface + pattern matching switch, или где Strategy элегантно заменяется на Function<T, R> / лямбду, снижай architectureScore и объясняй это в summaryReview.
   - СОКРАТИЧЕСКИЕ ВОПРОСЫ ПО ТРЕЙД-ОФФАМ: ${dpContext.socraticProbes?.map((p: any) => p.question).join('; ') || ''}
` : '';

  return `${LANGUAGE_LOCK_INVARIANT}

Ты — Principal Java 21 & Spring Architect, Lead Concurrency Specialist и Главный технический судья практических задач.
${PROMPT_INJECTION_DEFENSE_DIRECTIVE}
${ANTI_SYCOPHANCY_DIRECTIVES}

Твоя задача — провести глубокий профессиональный аудит решения кандидата (Java 21) по спецификации задачи, критериям приемки и сигналам статического анализа.

${EPISTEMIC_BENEVOLENCE_AXIOM}

АКСИОМА ЭПИСТЕМИЧЕСКОЙ ЗАБОТЫ И ПРАВИЛА РЕВЬЮ:
1. НИКАКОЙ ЛЕСТИ И «СЭНДВИЧ-ФИДБЕКА»: категорически запрещено начинать ревью с шаблонных комплиментов.
2. ИНВАРИАНТ summaryReview (Verdict-First): первое предложение summaryReview ОБЯЗАНО сразу фиксировать инженерный статус надежности кода и перечень критических угроз.
3. ИНВАРИАНТ findings (Zero-Fluff): включай ТОЛЬКО реальные, верифицируемые дефекты (нарушения JMM/Concurrency, утечки ресурсов, проблемы транзакционности, уязвимости).
4. СТРОГИЙ ГРОССБУХ ОЦЕНКИ (Zero-Phantom-Deductions): итоговый балл должен строго вытекать из тяжести зафиксированных дефектов.

ПРАВИЛА ОЦЕНКИ И ЯЗЫКОВОЙ ИНВАРИАНТ:
1. ЯЗЫК РЕЦЕНЗИИ — СТРОГО РУССКИЙ (100% RUSSIAN REVIEW). Имена классов/методов/аннотаций сохраняй в оригинале.
2. Виртуальное исполнение и тесты: уважай реальные результаты песочницы JVM. При упавших тестах correctnessScore <= 60, overallScore <= 68.
3. Многопоточность и JMM: проверяй неатомарные операции, видимость, Carrier Thread Pinning в Project Loom (synchronized над I/O).
4. Архитектура и SOLID: проверяй SRP, OCP, ISP.
5. Идиомы Java 21: Records, Pattern Matching, Sealed Interfaces, Sequenced Collections.
6. Веса: overallScore = (0.35 * correctness) + (0.25 * concurrency) + (0.25 * architecture) + (0.15 * idioms).
${patternDirective}

OUTPUT FORMAT:
Generate ONLY valid JSON adhering strictly to this JSON format:
{
  "compilationStatus": { "isCompilable": true, "syntaxErrors": [] },
  "virtualExecutionResult": {
    "passCount": 2, "failCount": 0,
    "testCases": [
      { "testName": "test_name", "status": "PASSED", "inputData": "input", "expectedOutput": "expected", "actualVirtualOutput": "actual" }
    ]
  },
  "concurrencyAnalysis": {
    "hasRaceConditions": false,
    "hasJmmVisibilityIssues": false,
    "hasCarrierThreadPinning": false,
    "findings": [
      { "category": "NON_ATOMIC_COMPOUND", "location": "Service.method()", "description": "описание", "remediation": "исправление" }
    ]
  },
  "architecturalCompliance": {
    "isSolidCompliant": true,
    "springBootBestPracticesViolations": [],
    "modernJava21IdiomAdoption": []
  },
  "scoreBreakdown": {
    "correctnessScore": 95, "concurrencyScore": 90, "architectureScore": 85, "modernIdiomsScore": 90, "overallScore": 90,
    "summaryReview": "Код готов к продакшену: инварианты соблюдены."
  }
}`;
}

export async function evaluateChallengeSubmission(req: EvaluationRequest): Promise<EvaluationResult> {
  const { challenge, files, activePhase, sandboxResult, abortSignal } = req;
  const preProcess = preProcessWorkspaceFiles(files);

  if (sandboxResult && !sandboxResult.isCompilable) {
    return {
      compilationStatus: {
        isCompilable: false,
        syntaxErrors: sandboxResult.syntaxErrors || []
      },
      virtualExecutionResult: {
        passCount: 0,
        failCount: 1,
        testCases: [{
          testName: 'CompilationCheck',
          status: 'EXECUTION_ERROR',
          inputData: 'javac src/**/*.java',
          expectedOutput: 'Clean javac compilation',
          actualVirtualOutput: sandboxResult.error || 'Compiler syntax errors detected',
          failureReason: sandboxResult.error || 'Код содержит синтаксические ошибки компиляции'
        }]
      },
      concurrencyAnalysis: {
        hasRaceConditions: false,
        hasJmmVisibilityIssues: false,
        hasCarrierThreadPinning: false,
        findings: []
      },
      architecturalCompliance: {
        isSolidCompliant: false,
        springBootBestPracticesViolations: ['Код не компилируется в песочнице Java 21'],
        modernJava21IdiomAdoption: []
      },
      scoreBreakdown: {
        correctnessScore: 0,
        concurrencyScore: 0,
        architectureScore: 0,
        modernIdiomsScore: 0,
        overallScore: 0,
        summaryReview: 'Решение не может быть принято: обнаружены ошибки компиляции в песочнице Java 21. Исправьте синтаксические ошибки и повторите сдачу.'
      },
      evaluationTimestamp: new Date().toISOString(),
      astSignalsSummary: preProcess.allSignals.map(s => `[${s.category}] ${s.description}`)
    };
  }

  const escapeXmlAttr = (str: string) => str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&apos;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  let codeXml = '<candidate_workspace>\n';
  for (const f of preProcess.sanitizedFiles) {
    const safePath = escapeXmlAttr((f.path || 'unknown').slice(0, 256));
    codeXml += `  <file path="${safePath}">\n${wrapUntrustedContext('candidate_source_code', f.content)}\n  </file>\n`;
  }
  codeXml += '</candidate_workspace>';

  const sandboxProofXml = sandboxResult ? `
<real_sandbox_execution_proof>
  <is_compilable>${sandboxResult.isCompilable}</is_compilable>
  <passed_tests_count>${sandboxResult.passedCount}</passed_tests_count>
  <failed_tests_count>${sandboxResult.failedCount}</failed_tests_count>
  <deadlock_detected>${sandboxResult.concurrencyHarness?.deadlockDetected ?? false}</deadlock_detected>
  <race_condition_detected>${sandboxResult.concurrencyHarness?.raceConditionDetected ?? false}</race_condition_detected>
  ${sandboxResult.securityViolations && sandboxResult.securityViolations.length > 0 ? `
  <ast_structural_violations>
${sandboxResult.securityViolations.map(v => `    <violation rule="${v.rule}" file="${v.file}" line="${v.lineNumber}" message="${v.message}" />`).join('\n')}
  </ast_structural_violations>` : ''}
  <test_runs>
${sandboxResult.testResults.map(t => `    <test name="${t.testName}" status="${t.status}" durationMs="${t.durationMs}" ${t.failureReason ? `failure="${t.failureReason}"` : ''} />`).join('\n')}
  </test_runs>
</real_sandbox_execution_proof>` : '';

  const systemInstruction = buildCodeEvaluatorSystemInstruction((challenge as any).designPatternContext);
  const phaseInfo = challenge.phasedRequirements?.find(p => p.phase === activePhase);
  const phaseText = phaseInfo ? `Phase ${activePhase} Objective: ${phaseInfo.title}\n${phaseInfo.descriptionMarkdown}` : '';

  const weights = challenge.scoringWeights || {
    functionalCorrectness: 0.40,
    concurrencySafety: 0.20,
    architectureAndCleanCode: 0.20,
    modernIdioms: 0.20
  };

  const userPrompt = `<evaluation_request>
<task_specification>
Title: ${challenge.title}
Category: ${challenge.category}
Target Stack: ${challenge.targetStack}
Active Phase: ${activePhase}
Summary: ${challenge.shortDescription}
${phaseText}
Scoring Weights: Correctness ${weights.functionalCorrectness * 100}%, Concurrency ${weights.concurrencySafety * 100}%, Architecture ${weights.architectureAndCleanCode * 100}%, Modern Idioms ${weights.modernIdioms * 100}%
</task_specification>

${preProcess.summaryFactsXml}

${sandboxProofXml}

${codeXml}
</evaluation_request>`;

  const evalData = await llmGateway.completeJson<any>({
    presetKey: 'codeAudit',
    systemPrompt: systemInstruction,
    userPrompt,
    abortSignal,
    timeoutMs: 40_000
  });

  const realTestCases: TestCaseResult[] = sandboxResult && sandboxResult.testResults.length > 0
    ? sandboxResult.testResults.map(tr => ({
        testName: tr.testName,
        status: (tr.status === 'PASSED' ? 'PASSED' : tr.status === 'FAILED' ? 'FAILED' : 'EXECUTION_ERROR') as any,
        inputData: 'Unit test execution',
        expectedOutput: 'PASSED',
        actualVirtualOutput: tr.status === 'PASSED' ? 'PASSED' : (tr.failureReason || 'FAILED'),
        failureReason: tr.failureReason
      }))
    : (Array.isArray(evalData.virtualExecutionResult?.testCases) ? evalData.virtualExecutionResult.testCases : []);

  const passCount = sandboxResult ? sandboxResult.passedCount : Number(evalData.virtualExecutionResult?.passCount || 0);
  const failCount = sandboxResult ? sandboxResult.failedCount : Number(evalData.virtualExecutionResult?.failCount || 0);

  const realCorrectnessScore = sandboxResult
    ? (passCount + failCount > 0 ? Math.round((passCount / (passCount + failCount)) * 100) : (sandboxResult.isCompilable ? 75 : 0))
    : Number(evalData.scoreBreakdown?.correctnessScore || 0);

  const concurrencyScore = Number(evalData.scoreBreakdown?.concurrencyScore || 0);
  const architectureScore = Number(evalData.scoreBreakdown?.architectureScore || 0);
  const modernIdiomsScore = Number(evalData.scoreBreakdown?.modernIdiomsScore || 0);

  const overallScore = Math.round(
    realCorrectnessScore * weights.functionalCorrectness +
    concurrencyScore * weights.concurrencySafety +
    architectureScore * weights.architectureAndCleanCode +
    modernIdiomsScore * weights.modernIdioms
  );

  const result: EvaluationResult = {
    compilationStatus: {
      isCompilable: sandboxResult ? sandboxResult.isCompilable : Boolean(evalData.compilationStatus?.isCompilable ?? true),
      syntaxErrors: sandboxResult?.syntaxErrors && sandboxResult.syntaxErrors.length > 0
        ? sandboxResult.syntaxErrors
        : (Array.isArray(evalData.compilationStatus?.syntaxErrors) ? evalData.compilationStatus.syntaxErrors : [])
    },
    virtualExecutionResult: {
      passCount,
      failCount,
      testCases: realTestCases
    },
    concurrencyAnalysis: {
      hasRaceConditions: Boolean(evalData.concurrencyAnalysis?.hasRaceConditions) || Boolean(sandboxResult?.concurrencyHarness?.raceConditionDetected),
      hasJmmVisibilityIssues: Boolean(evalData.concurrencyAnalysis?.hasJmmVisibilityIssues),
      hasCarrierThreadPinning: Boolean(evalData.concurrencyAnalysis?.hasCarrierThreadPinning),
      findings: normalizeConcurrencyFindings(
        evalData.concurrencyAnalysis?.findings,
        Boolean(evalData.concurrencyAnalysis?.hasRaceConditions) || Boolean(sandboxResult?.concurrencyHarness?.raceConditionDetected),
        Boolean(evalData.concurrencyAnalysis?.hasCarrierThreadPinning),
        Boolean(evalData.concurrencyAnalysis?.hasJmmVisibilityIssues)
      )
    },
    architecturalCompliance: {
      isSolidCompliant: Boolean(evalData.architecturalCompliance?.isSolidCompliant ?? true),
      springBootBestPracticesViolations: Array.isArray(evalData.architecturalCompliance?.springBootBestPracticesViolations)
        ? evalData.architecturalCompliance.springBootBestPracticesViolations
        : [],
      modernJava21IdiomAdoption: Array.isArray(evalData.architecturalCompliance?.modernJava21IdiomAdoption)
        ? evalData.architecturalCompliance.modernJava21IdiomAdoption
        : []
    },
    scoreBreakdown: {
      correctnessScore: realCorrectnessScore,
      concurrencyScore,
      architectureScore,
      modernIdiomsScore,
      overallScore,
      summaryReview: String(evalData.scoreBreakdown?.summaryReview || 'Оценка решения завершена.')
    },
    evaluationTimestamp: new Date().toISOString(),
    astSignalsSummary: preProcess.allSignals.map(s => `[${s.category}] ${s.description}`)
  };

  try {
    if (result.scoreBreakdown.overallScore < 75 || result.concurrencyAnalysis.hasCarrierThreadPinning || result.concurrencyAnalysis.hasRaceConditions) {
      const errorConcept = result.concurrencyAnalysis.hasCarrierThreadPinning
        ? 'Project Loom Virtual Thread Carrier Pinning (synchronized block over I/O)'
        : result.concurrencyAnalysis.hasRaceConditions
        ? 'Race condition in concurrent state mutation'
        : `Deficit in ${challenge.title} (${challenge.category})`;

      void recordNewErrorGap({
        userId: req.userId,
        questionId: challenge.id,
        topic: challenge.category,
        subtopic: challenge.title,
        errorConcept,
        initialDeficit: 1.0
      }).catch((e: any) => console.warn('Could not record practice deficit to vector memory:', e));
    }
  } catch {}

  return result;
}
