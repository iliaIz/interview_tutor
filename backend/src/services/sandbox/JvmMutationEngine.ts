import { AstSecurityScanner } from './AstSecurityScanner';
import { TestQualityScanner, TestQualityViolation } from './TestQualityScanner';
import { JvmDaemonClient } from './JvmDaemonClient';

export interface MutantDefinition {
  id: string;
  name: string;
  description?: string;
  mutatorType?: string;
  file: string;
  line: number;
  mutatedContent?: string;
}

export interface MutantResult {
  id?: string;
  mutantId: string;
  name: string;
  file: string;
  line: number;
  status: 'KILLED' | 'SURVIVED' | 'STILLBORN';
  killedBy?: string;
  failureReason?: string;
  mutatorType?: string;
  description?: string;
  mutatedContent?: string;
  originalContent?: string;
  remediationHint?: string;
}

export interface MutationExecutionRequest {
  challengeId?: string;
  files: Array<{ path: string; content: string }>;
  mutants: MutantDefinition[];
  requiredScore?: number;
  timeoutMs?: number;
  skipPreScan?: boolean;
}

export interface MutationExecutionResponse {
  isMutationRun: true;
  baselinePassed: boolean;
  totalMutants: number;
  validMutants?: number;
  killedCount: number;
  survivedCount: number;
  stillbornCount?: number;
  mutationScore: number;
  passedThreshold: boolean;
  requiredScore: number;
  executionTimeMs: number;
  mutantResults: MutantResult[];
  qualityViolations?: TestQualityViolation[];
  error?: string;
}

/**
 * JvmMutationEngine.ts
 * Executes Resident In-Memory Mutation Testing Pipeline (< 120ms).
 * Single responsibility: security validation, test quality gating, mutant execution orchestration, and metric enrichment.
 * Cognitive bounding limit: <= 350 lines.
 */
export class JvmMutationEngine {
  public static async execute(request: MutationExecutionRequest): Promise<MutationExecutionResponse> {
    JvmDaemonClient.ensureCompiled();
    const startTime = Date.now();
    const requiredScore = request.requiredScore || 85;

    let qualityViolations: TestQualityViolation[] = [];

    if (!request.skipPreScan) {
      // 1. AST Security Check
      const secResult = AstSecurityScanner.scan(request.files);
      if (!secResult.isSafe) {
        const primaryViolation = secResult.violations[0];
        return {
          isMutationRun: true,
          baselinePassed: false,
          totalMutants: request.mutants?.length || 0,
          killedCount: 0,
          survivedCount: request.mutants?.length || 0,
          mutationScore: 0,
          passedThreshold: false,
          requiredScore,
          executionTimeMs: Date.now() - startTime,
          mutantResults: [],
          error: `Нарушение политики безопасности: ${primaryViolation.message}`
        };
      }

      // 2. AST Test Quality Check (Anti-Patterns & Potemkin Tests)
      const qualityResult = TestQualityScanner.scan(request.files);
      qualityViolations = qualityResult.violations;
      if (!qualityResult.isValid) {
        const blocking = qualityResult.violations.find((v) => v.severity === 'ERROR');
        return {
          isMutationRun: true,
          baselinePassed: false,
          totalMutants: request.mutants?.length || 0,
          killedCount: 0,
          survivedCount: request.mutants?.length || 0,
          mutationScore: 0,
          passedThreshold: false,
          requiredScore,
          executionTimeMs: Date.now() - startTime,
          mutantResults: [],
          qualityViolations,
          error: `Антипаттерн тестирования: ${blocking?.message || 'Обнаружены критические ошибки тест-дизайна'}`
        };
      }
    }

    // 3. Run Mutation Compiler (Hot Daemon -> Fallback CLI)
    const normalizedMutants = (request.mutants || []).map((m) => {
      let mutatedContent = m.mutatedContent;
      if (
        mutatedContent &&
        !mutatedContent.includes('class ') &&
        !mutatedContent.includes('interface ') &&
        !mutatedContent.includes('record ') &&
        !mutatedContent.includes('enum ')
      ) {
        const targetFile = request.files.find(
          (f) => f.path === m.file || f.path.endsWith(m.file) || m.file.endsWith(f.path)
        );
        if (targetFile && m.line > 0) {
          const lines = targetFile.content.split('\n');
          const lineIdx = m.line - 1;
          if (lineIdx >= 0 && lineIdx < lines.length) {
            lines[lineIdx] = mutatedContent;
            mutatedContent = lines.join('\n');
          }
        }
      }
      return {
        ...m,
        mutatedContent
      };
    });

    const payloadJson = JSON.stringify({
      files: request.files,
      mutants: normalizedMutants
    });
    const timeoutMs = request.timeoutMs || 8000;
    const { output, error } = await JvmDaemonClient.runCompiler(payloadJson, timeoutMs);

    if (error) {
      return {
        isMutationRun: true,
        baselinePassed: false,
        totalMutants: request.mutants?.length || 0,
        killedCount: 0,
        survivedCount: request.mutants?.length || 0,
        mutationScore: 0,
        passedThreshold: false,
        requiredScore,
        executionTimeMs: Date.now() - startTime,
        mutantResults: [],
        qualityViolations,
        error
      };
    }

    try {
      const parsed = JSON.parse(output);

      const score = typeof parsed.mutationScore === 'number'
        ? parsed.mutationScore
        : parseFloat(parsed.mutationScore || '0');

      // Map and enrich mutant results with metadata and remediation hints
      const enrichedMutants: MutantResult[] = (parsed.mutantResults || []).map((raw: any) => {
        const id = raw.id || raw.mutantId;
        const matchingDef = request.mutants?.find((m) => m.id === id);

        let remediationHint = '';
        if (raw.status === 'SURVIVED') {
          const type = (matchingDef?.mutatorType || '').toLowerCase();
          const name = (matchingDef?.name || '').toLowerCase();

          if (type.includes('boundary') || name.includes('<=') || name.includes('>=')) {
            remediationHint = 'Граничное условие: протестируйте пограничные значения (0, min, max, точный лимит).';
          } else if (type.includes('void') || name.includes('void')) {
            remediationHint = 'Побочный эффект: проверьте вызов метода через verify(mock, times(1)).';
          } else if (type.includes('null') || name.includes('null')) {
            remediationHint = 'Защита от null: передайте null или пустую коллекцию и проверьте реакцию.';
          } else if (type.includes('negate') || name.includes('invert')) {
            remediationHint = 'Инверсия условия: убедитесь, что обе ветви (true и false) покрыты отдельными тестами.';
          } else {
            remediationHint = 'Напишите целенаправленный assertion, проверяющий поведение именно этой строки.';
          }
        }

        return {
          id,
          mutantId: id,
          name: raw.name || matchingDef?.name || 'Mutant',
          file: raw.file || matchingDef?.file || 'Unknown',
          line: raw.line || matchingDef?.line || 0,
          status: raw.status,
          killedBy: raw.killedBy,
          failureReason: raw.failureReason,
          mutatorType: matchingDef?.mutatorType,
          description: matchingDef?.description,
          mutatedContent: matchingDef?.mutatedContent,
          remediationHint
        };
      });

      return {
        isMutationRun: true,
        baselinePassed: Boolean(parsed.baselinePassed),
        totalMutants: parsed.totalMutants || (request.mutants?.length || 0),
        validMutants: parsed.validMutants !== undefined ? parsed.validMutants : (parsed.totalMutants || 0),
        killedCount: parsed.killedCount || 0,
        survivedCount: parsed.survivedCount || 0,
        stillbornCount: parsed.stillbornCount || 0,
        mutationScore: score,
        passedThreshold: Boolean(parsed.baselinePassed) && (score >= requiredScore),
        requiredScore,
        executionTimeMs: parsed.executionTimeMs || (Date.now() - startTime),
        mutantResults: enrichedMutants,
        qualityViolations,
        error: parsed.error
      };
    } catch {
      return {
        isMutationRun: true,
        baselinePassed: false,
        totalMutants: request.mutants?.length || 0,
        killedCount: 0,
        survivedCount: request.mutants?.length || 0,
        mutationScore: 0,
        passedThreshold: false,
        requiredScore,
        executionTimeMs: Date.now() - startTime,
        mutantResults: [],
        qualityViolations,
        error: `Ошибка парсинга вывода мутационного раннера: ${output.slice(0, 300)}`
      };
    }
  }
}
