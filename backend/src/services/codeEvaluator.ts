import { preProcessWorkspaceFiles } from './astAnalyzer';
import { CodingChallenge } from './challengeSeedData';
import { recordNewErrorGap } from './vectorMemoryService';
import { envConfig } from '../config/env';
import { REASONING_PRESETS, buildReasoningExtraBody } from '../config/reasoning';
import { SandboxExecutionResponse } from './sandbox/JvmExecutionService';
import { fetchWithFullJitterRetry } from '../utils/httpRetry';
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
1. НИКАКОЙ ЛЕСТИ И «СЭНДВИЧ-ФИДБЕКА»: категорически запрещено начинать ревью с шаблонных комплиментов («Код написан аккуратно и чисто», «Хорошая структура», «Отличная попытка»).
2. ИНВАРИАНТ summaryReview (Verdict-First): первое предложение summaryReview ОБЯЗАНО сразу фиксировать инженерный статус надежности кода и перечень критических угроз.
   - Пример при наличии дефектов: «Код не готов к продакшену из-за 2 критических дефектов многопоточности (RACE_CONDITION, CARRIER_THREAD_PINNING), ведущих к деградации пула потоков и потере данных под нагрузкой.»
   - Пример для эталонного кода без дефектов: «Код готов к продакшену: инварианты потокобезопасности, транзакционности и управления ресурсами соблюдены.»
3. ИНВАРИАНТ findings (Zero-Fluff): включай ТОЛЬКО реальные, верифицируемые дефекты (нарушения JMM/Concurrency, утечки ресурсов, проблемы транзакционности и проксирования Spring/Hibernate, неоптимальная алгоритмическая сложность, уязвимости безопасности). Запрещено добавлять в findings похвалу или субъективные вкусовые придирки к форматированию.
4. СТРОГИЙ ГРОССБУХ ОЦЕНКИ (Zero-Phantom-Deductions): итоговый балл/статус прохождения должен однозначно и строго вытекать из тяжести (severity) зафиксированных в findings дефектов.

ПРАВИЛА ОЦЕНКИ И ЯЗЫКОВОЙ ИНВАРИАНТ:
1. ЯЗЫК РЕЦЕНЗИИ — СТРОГО РУССКИЙ (100% RUSSIAN REVIEW):
   - Все текстовые описания ("summaryReview", "findings[].description", "findings[].remediation", замечания по архитектуре и современным идиомам) пиши ИСКЛЮЧИТЕЛЬНО НА РУССКОМ ЯЗЫКЕ.
   - Имена классов, методов, аннотаций и библиотек (например: ConcurrentHashMap, updateAndGet, @Transactional, ReentrantLock) сохраняй в оригинальном виде (Code-Switching).
2. Виртуальное исполнение и тесты: Уважай реальные результаты песочницы JVM.
   - АНТИ-ПОДДАКИВАНИЕ (FACTUAL ANCHOR): При наличии ошибок компиляции или упавших тестов correctnessScore не может превышать 60, а overallScore — 68.
3. Многопоточность и Java Memory Model (JMM):
   - Проверяй неатомарные составные операции над общим стейтом (напр. count++, check-then-act без атомиков/блокировок).
   - Проверяй видимость памяти JMM (отсутствие volatile, барьеров памяти).
   - КРИТИЧЕСКИЙ АНАЛИЗ PROJECT LOOM: Проверяй Carrier Thread Pinning при блокирующих операциях (I/O, Thread.sleep) внутри synchronized-блоков. Рекомендуй ReentrantLock.
   - КОНТРАКТ ДЛЯ "findings": Массив findings должен содержать ТОЛЬКО реальные дефекты и риски многопоточности. Если код полностью потокобезопасен, массив findings ОБЯЗАН быть пустым []. Не помещай комплименты и похвалу в findings.
   - Каждый элемент findings обязан быть объектом: "category" (один из RACE_CONDITION, NON_ATOMIC_COMPOUND, JMM_VISIBILITY, CARRIER_THREAD_PINNING, DEADLOCK_RISK), "location", "description", "remediation".
4. Архитектура, SOLID и чистота кода:
   - Проверяй Single Responsibility, Open-Closed (особенно для расширений Фазы 2) и Interface Segregation.
   - Для рефакторинга: сохранение обратной совместимости публичных API и изоляцию швов (protected-методы).
5. Идиомы Java 21:
   - Проверяй использование Records, Pattern Matching, Sealed Interfaces, Sequenced Collections вместо устаревшего Java 8 boilerplate.
6. Веса и итоговый балл:
   - Вычисли под-баллы (0-100) для correctness, concurrency, architecture, idioms.
   - overallScore = (0.35 * correctness) + (0.25 * concurrency) + (0.25 * architecture) + (0.15 * idioms).
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
      {
        "category": "NON_ATOMIC_COMPOUND",
        "location": "ParkingLotManagerService.occupySlot()",
        "description": "Инкремент счетчика на неатомарном поле приводит к потере обновлений при параллельном доступе",
        "remediation": "Замените поле на AtomicInteger или защитите критическую секцию через ReentrantLock"
      }
    ]
  },
  "architecturalCompliance": {
    "isSolidCompliant": true,
    "springBootBestPracticesViolations": [],
    "modernJava21IdiomAdoption": []
  },
  "scoreBreakdown": {
    "correctnessScore": 95,
    "concurrencyScore": 90,
    "architectureScore": 85,
    "modernIdiomsScore": 90,
    "overallScore": 90,
    "summaryReview": "Код готов к продакшену: инварианты потокобезопасности, транзакционности и управления ресурсами соблюдены."
  }
}`;
}

export async function evaluateChallengeSubmission(req: EvaluationRequest): Promise<EvaluationResult> {
  const { challenge, files, activePhase, sandboxResult, abortSignal } = req;

  // 1. Phase 1: Static AST Analysis and Fact Extraction
  const preProcess = preProcessWorkspaceFiles(files);

  // If real JVM Sandbox execution failed compilation, return immediately with authoritative compiler diagnostics
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

  // Build candidate code blocks wrapped in untrusted sandbox container
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
</real_sandbox_execution_proof>
NOTE FOR JUDGE: The candidate's tests have ALREADY been executed in the authoritative in-memory Java 21 Sandbox. Do NOT contradict or hallucinate different functional test results. Base your evaluation on this proof and assess Architecture, SOLID, Concurrency, and whether AST structural violations were resolved.` : '';

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

  const chatUrl = envConfig.proxy.chatUrl;
  const apiKey = envConfig.proxy.apiKey;
  const model = envConfig.models.text || 'gemini-smart';

  console.log(`🤖 Starting practice code evaluation via LiteLLM (${chatUrl}) [${model}] with Full-Jitter retry...`);

  const response = await fetchWithFullJitterRetry(
    chatUrl,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        temperature: REASONING_PRESETS.codeAudit.temperature,
        max_tokens: REASONING_PRESETS.codeAudit.maxTokens,
        response_format: { type: 'json_object' },
        extra_body: buildReasoningExtraBody(REASONING_PRESETS.codeAudit),
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: userPrompt }
        ]
      })
    },
    2, // maxRetries = 2 (1 initial + 2 retries = 3 total attempts per invariant)
    abortSignal,
    40_000 // 40s per attempt timeout
  );

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`LiteLLM Proxy evaluation failed [${response.status}]: ${errText}`);
  }

  const rawJson = await response.json();
  const choice = rawJson.choices?.[0];
  const contentStr = choice?.message?.content || choice?.message?.reasoning_content || choice?.text;
  if (!contentStr) {
    throw new Error('LiteLLM returned empty completion response');
  }

  const cleanContentStr = contentStr
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();

  let evalData: any;
  try {
    evalData = JSON.parse(cleanContentStr);
  } catch (err: any) {
    console.error('Failed to parse evaluation JSON from Gemini 3.7 Flash:', cleanContentStr);
    throw new Error(`Invalid JSON evaluation response from AI Gateway: ${err.message}`);
  }

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

  // Asynchronously record deficit into Vector Radar if score is low or serious issues found
  try {
    if (result.scoreBreakdown.overallScore < 75 || result.concurrencyAnalysis.hasCarrierThreadPinning || result.concurrencyAnalysis.hasRaceConditions) {
      const errorConcept = result.concurrencyAnalysis.hasCarrierThreadPinning
        ? 'Project Loom Virtual Thread Carrier Pinning (synchronized block over I/O)'
        : result.concurrencyAnalysis.hasRaceConditions
        ? 'Race condition in concurrent state mutation'
        : `Deficit in ${challenge.title} (${challenge.category})`;

      void recordNewErrorGap({
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
