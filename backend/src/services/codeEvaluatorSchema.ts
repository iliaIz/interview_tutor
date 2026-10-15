/**
 * codeEvaluatorSchema.ts
 * 
 * JSON Schema definition for candidate Java 21 workspace evaluation.
 * Decoupled from codeEvaluator.ts per File-Hygiene & Cognitive Bounding Invariant 8.
 */

export const EVALUATION_JSON_SCHEMA = {
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
