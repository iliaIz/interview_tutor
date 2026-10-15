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

export interface ConcurrencyFinding {
  category: 'RACE_CONDITION' | 'NON_ATOMIC_COMPOUND' | 'JMM_VISIBILITY' | 'CARRIER_THREAD_PINNING' | 'DEADLOCK_RISK';
  location: string;
  description: string;
  remediation: string;
}

export function normalizeConcurrencyFindings(
  rawFindings: unknown,
  hasRaceConditions: boolean,
  hasCarrierThreadPinning: boolean,
  hasJmmVisibilityIssues: boolean
): ConcurrencyFinding[] {
  if (!Array.isArray(rawFindings)) {
    return [];
  }

  const validCategories: Set<ConcurrencyFinding['category']> = new Set([
    'RACE_CONDITION',
    'NON_ATOMIC_COMPOUND',
    'JMM_VISIBILITY',
    'CARRIER_THREAD_PINNING',
    'DEADLOCK_RISK'
  ]);

  const normalized: ConcurrencyFinding[] = [];

  for (const item of rawFindings) {
    if (!item) continue;

    if (typeof item === 'object') {
      const obj = item as Record<string, any>;
      const desc = String(obj.description || obj.finding || obj.message || '').trim();
      if (!desc) continue;

      let category: ConcurrencyFinding['category'] = 'NON_ATOMIC_COMPOUND';
      if (validCategories.has(obj.category)) {
        category = obj.category;
      } else if (/pinning|carrier/i.test(desc) || /pinning|carrier/i.test(String(obj.category))) {
        category = 'CARRIER_THREAD_PINNING';
      } else if (/deadlock/i.test(desc) || /deadlock/i.test(String(obj.category))) {
        category = 'DEADLOCK_RISK';
      } else if (/visibility|volatile|barrier|jmm/i.test(desc) || /visibility|volatile/i.test(String(obj.category))) {
        category = 'JMM_VISIBILITY';
      } else if (/race/i.test(desc) || /race/i.test(String(obj.category))) {
        category = 'RACE_CONDITION';
      }

      normalized.push({
        category,
        location: String(obj.location || 'Shared State / Concurrency Logic').trim(),
        description: desc,
        remediation: String(obj.remediation || 'Обеспечьте синхронизацию или использование потокобезопасных структур (Atomic/Concurrent)').trim()
      });
    } else if (typeof item === 'string') {
      const text = item.trim();
      if (!text) continue;

      // Filter out praises/compliments erroneously placed in findings if no real issues flagged
      const isPositivePraise = /used correctly|manage thread-safe|thread safe|properly synchronized|корректно|правильно|безопасно|без гонок/i.test(text)
        && !/vulnerability|leak|hazard|race condition|deadlock|pinning|риск|гонк|утечк|ошибк/i.test(text);

      if (isPositivePraise && !hasRaceConditions && !hasCarrierThreadPinning && !hasJmmVisibilityIssues) {
        continue;
      }

      let category: ConcurrencyFinding['category'] = 'NON_ATOMIC_COMPOUND';
      if (/pinning|carrier/i.test(text)) {
        category = 'CARRIER_THREAD_PINNING';
      } else if (/deadlock/i.test(text)) {
        category = 'DEADLOCK_RISK';
      } else if (/visibility|volatile|barrier|jmm/i.test(text)) {
        category = 'JMM_VISIBILITY';
      } else if (/race condition|гонк/i.test(text)) {
        category = 'RACE_CONDITION';
      }

      normalized.push({
        category,
        location: 'Shared State / Concurrency Logic',
        description: text,
        remediation: 'Обеспечьте синхронизацию или использование потокобезопасных структур данных.'
      });
    }
  }

  return normalized;
}

