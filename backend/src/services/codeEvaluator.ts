import { preProcessWorkspaceFiles } from './astAnalyzer';
import { CodingChallenge } from './challengeSeedData';
import { recordNewErrorGap } from './vectorMemoryService';
import { envConfig } from '../config/env';

export interface EvaluationRequest {
  challenge: CodingChallenge;
  files: { path: string; content: string }[];
  activePhase: number;
  timeSpentSeconds?: number;
}

export interface TestCaseResult {
  testName: string;
  status: 'PASSED' | 'FAILED' | 'EXECUTION_ERROR';
  inputData: string;
  expectedOutput: string;
  actualVirtualOutput: string;
  failureReason?: string;
}

export interface ConcurrencyFinding {
  category: 'RACE_CONDITION' | 'NON_ATOMIC_COMPOUND' | 'JMM_VISIBILITY' | 'CARRIER_THREAD_PINNING' | 'DEADLOCK_RISK';
  location: string;
  description: string;
  remediation: string;
}

export interface EvaluationResult {
  compilationStatus: {
    isCompilable: boolean;
    syntaxErrors: { lineNumber: number; errorMessage: string }[];
  };
  virtualExecutionResult: {
    passCount: number;
    failCount: number;
    testCases: TestCaseResult[];
  };
  concurrencyAnalysis: {
    hasRaceConditions: boolean;
    hasJmmVisibilityIssues: boolean;
    hasCarrierThreadPinning: boolean;
    findings: ConcurrencyFinding[];
  };
  architecturalCompliance: {
    isSolidCompliant: boolean;
    springBootBestPracticesViolations: string[];
    modernJava21IdiomAdoption: string[];
  };
  scoreBreakdown: {
    correctnessScore: number;
    concurrencyScore: number;
    architectureScore: number;
    modernIdiomsScore: number;
    overallScore: number;
    summaryReview: string;
  };
  evaluationTimestamp: string;
  astSignalsSummary: string[];
}

const EVALUATION_JSON_SCHEMA = {
  type: 'object',
  properties: {
    compilationStatus: {
      type: 'object',
      properties: {
        isCompilable: { type: 'boolean' },
        syntaxErrors: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              lineNumber: { type: 'integer' },
              errorMessage: { type: 'string' }
            },
            required: ['lineNumber', 'errorMessage']
          }
        }
      },
      required: ['isCompilable', 'syntaxErrors']
    },
    virtualExecutionResult: {
      type: 'object',
      properties: {
        passCount: { type: 'integer' },
        failCount: { type: 'integer' },
        testCases: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              testName: { type: 'string' },
              status: { type: 'string', enum: ['PASSED', 'FAILED', 'EXECUTION_ERROR'] },
              inputData: { type: 'string' },
              expectedOutput: { type: 'string' },
              actualVirtualOutput: { type: 'string' },
              failureReason: { type: 'string' }
            },
            required: ['testName', 'status', 'inputData', 'expectedOutput', 'actualVirtualOutput']
          }
        }
      },
      required: ['passCount', 'failCount', 'testCases']
    },
    concurrencyAnalysis: {
      type: 'object',
      properties: {
        hasRaceConditions: { type: 'boolean' },
        hasJmmVisibilityIssues: { type: 'boolean' },
        hasCarrierThreadPinning: { type: 'boolean' },
        findings: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              category: {
                type: 'string',
                enum: ['RACE_CONDITION', 'NON_ATOMIC_COMPOUND', 'JMM_VISIBILITY', 'CARRIER_THREAD_PINNING', 'DEADLOCK_RISK']
              },
              location: { type: 'string' },
              description: { type: 'string' },
              remediation: { type: 'string' }
            },
            required: ['category', 'location', 'description', 'remediation']
          }
        }
      },
      required: ['hasRaceConditions', 'hasJmmVisibilityIssues', 'hasCarrierThreadPinning', 'findings']
    },
    architecturalCompliance: {
      type: 'object',
      properties: {
        isSolidCompliant: { type: 'boolean' },
        springBootBestPracticesViolations: {
          type: 'array',
          items: { type: 'string' }
        },
        modernJava21IdiomAdoption: {
          type: 'array',
          items: { type: 'string' }
        }
      },
      required: ['isSolidCompliant', 'springBootBestPracticesViolations', 'modernJava21IdiomAdoption']
    },
    scoreBreakdown: {
      type: 'object',
      properties: {
        correctnessScore: { type: 'number' },
        concurrencyScore: { type: 'number' },
        architectureScore: { type: 'number' },
        modernIdiomsScore: { type: 'number' },
        overallScore: { type: 'number' },
        summaryReview: { type: 'string' }
      },
      required: [
        'correctnessScore',
        'concurrencyScore',
        'architectureScore',
        'modernIdiomsScore',
        'overallScore',
        'summaryReview'
      ]
    }
  },
  required: [
    'compilationStatus',
    'virtualExecutionResult',
    'concurrencyAnalysis',
    'architecturalCompliance',
    'scoreBreakdown'
  ]
};

export async function evaluateChallengeSubmission(req: EvaluationRequest): Promise<EvaluationResult> {
  const { challenge, files, activePhase } = req;

  // 1. Phase 1: Static AST Analysis and Fact Extraction
  const preProcess = preProcessWorkspaceFiles(files);

  // Build candidate code blocks wrapped in CDATA
  let codeXml = '<candidate_workspace>\n';
  for (const f of preProcess.sanitizedFiles) {
    codeXml += `  <file path="${f.path}">\n<![CDATA[\n${f.content}\n]]>\n  </file>\n`;
  }
  codeXml += '</candidate_workspace>';

  // System instruction for Gemini 3.7 Flash
  const systemInstruction = `You are a Principal Java 21 & Spring Architect, Lead Concurrency Specialist, and Technical Interview Judge.
Your task is to evaluate the candidate's Java code workspace submission against the task specification, acceptance criteria, and static AST signals.

EVALUATION RULES:
1. Virtual Execution Tracing: Evaluate the candidate's code step-by-step against functional requirements and edge cases. Check loops, null handling, and state mutation.
2. Concurrency & Java Memory Model (JMM):
   - Check for non-atomic compound mutations on shared state (e.g. count++ without Atomic/Lock).
   - Check for memory visibility defects (missing volatile or memory barriers).
   - CRITICAL PROJECT LOOM CHECK: Check for Carrier Thread Pinning when Virtual Threads execute blocking operations (I/O, Thread.sleep) inside 'synchronized' blocks. Recommend 'ReentrantLock'.
3. Architecture, SOLID & Clean Code:
   - Check Single Responsibility, Open-Closed Principle (especially for Phase 2 extensions), and Interface Segregation.
   - For Refactoring Katas: Verify that public API contracts remain backwards-compatible and seams (protected methods) are cleanly isolated.
4. Java 21 Modern Idioms:
   - Check for idiomatic adoption of Records, Pattern Matching, Sealed Interfaces, and Sequenced Collections instead of legacy Java 8 boilerplate.
5. Score Weighting:
   - Calculate sub-scores (0-100) for correctness, concurrency, architecture, and idioms.
   - Compute overallScore as: (0.35 * correctness) + (0.25 * concurrency) + (0.25 * architecture) + (0.15 * idioms).

OUTPUT FORMAT:
Generate ONLY valid JSON adhering strictly to this JSON format:
{
  "compilationStatus": { "isCompilable": true, "syntaxErrors": [] },
  "virtualExecutionResult": {
    "passCount": 2, "failCount": 0,
    "testCases": [
      { "testName": "TC1", "status": "PASSED", "inputData": "Input", "expectedOutput": "Expected", "actualVirtualOutput": "Actual", "failureReason": "" }
    ]
  },
  "concurrencyAnalysis": {
    "hasRaceConditions": false,
    "hasJmmVisibilityIssues": false,
    "hasCarrierThreadPinning": false,
    "findings": [
      { "category": "CARRIER_THREAD_PINNING", "location": "Service.java:Line 42", "description": "synchronized block wraps I/O", "remediation": "Replace with ReentrantLock" }
    ]
  },
  "architecturalCompliance": {
    "isSolidCompliant": true,
    "springBootBestPracticesViolations": [],
    "modernJava21IdiomAdoption": ["Records"]
  },
  "scoreBreakdown": {
    "correctnessScore": 90,
    "concurrencyScore": 85,
    "architectureScore": 90,
    "modernIdiomsScore": 80,
    "overallScore": 87,
    "summaryReview": "Concise review of the solution in Russian language."
  }
}`;

  const phaseInfo = challenge.phasedRequirements?.find(p => p.phase === activePhase);
  const phaseText = phaseInfo ? `Phase ${activePhase} Objective: ${phaseInfo.title}\n${phaseInfo.descriptionMarkdown}` : '';

  const userPrompt = `<evaluation_request>
<task_specification>
Title: ${challenge.title}
Category: ${challenge.category}
Target Stack: ${challenge.targetStack}
Active Phase: ${activePhase}
Summary: ${challenge.shortDescription}
${phaseText}
Scoring Weights: Correctness ${challenge.scoringWeights.functionalCorrectness * 100}%, Concurrency ${challenge.scoringWeights.concurrencySafety * 100}%, Architecture ${challenge.scoringWeights.architectureAndCleanCode * 100}%, Modern Idioms ${challenge.scoringWeights.modernIdioms * 100}%
</task_specification>

${preProcess.summaryFactsXml}

${codeXml}
</evaluation_request>`;

  const chatUrl = envConfig.proxy.chatUrl;
  const apiKey = envConfig.proxy.apiKey;
  const model = envConfig.models.text || 'gemini-smart';

  console.log(`🤖 Starting practice code evaluation via LiteLLM (${chatUrl}) [${model}]...`);

  const response = await fetch(chatUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      max_tokens: 4096,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: userPrompt }
      ]
    })
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`LiteLLM Proxy evaluation failed [${response.status}]: ${errText}`);
  }

  const rawJson = await response.json();
  const contentStr = rawJson.choices?.[0]?.message?.content;
  if (!contentStr) {
    throw new Error('LiteLLM returned empty completion response');
  }

  let evalData: any;
  try {
    evalData = JSON.parse(contentStr);
  } catch (err: any) {
    console.error('Failed to parse evaluation JSON from Gemini 3.7 Flash:', contentStr);
    throw new Error(`Invalid JSON evaluation response from AI Gateway: ${err.message}`);
  }

  const result: EvaluationResult = {
    compilationStatus: evalData.compilationStatus || { isCompilable: true, syntaxErrors: [] },
    virtualExecutionResult: evalData.virtualExecutionResult || { passCount: 0, failCount: 0, testCases: [] },
    concurrencyAnalysis: evalData.concurrencyAnalysis || { hasRaceConditions: false, hasJmmVisibilityIssues: false, hasCarrierThreadPinning: false, findings: [] },
    architecturalCompliance: evalData.architecturalCompliance || { isSolidCompliant: true, springBootBestPracticesViolations: [], modernJava21IdiomAdoption: [] },
    scoreBreakdown: evalData.scoreBreakdown || {
      correctnessScore: 0,
      concurrencyScore: 0,
      architectureScore: 0,
      modernIdiomsScore: 0,
      overallScore: 0,
      summaryReview: 'Evaluation completed.'
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
