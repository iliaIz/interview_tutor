import React, { useState } from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Clock, 
  Cpu, 
  ChevronDown, 
  ChevronRight, 
  X, 
  ShieldAlert, 
  Terminal 
} from 'lucide-react';

export interface SandboxExecutionResponse {
  success: boolean;
  isCompilable: boolean;
  compilationTimeMs: number;
  executionTimeMs: number;
  totalDurationMs: number;
  passedCount: number;
  failedCount: number;
  testResults: Array<{
    testName: string;
    status: 'PASSED' | 'FAILED' | 'ERROR';
    durationMs: number;
    failureReason?: string;
  }>;
  concurrencyHarness?: {
    threadsRan: number;
    deadlockDetected: boolean;
    raceConditionDetected: boolean;
  };
  syntaxErrors?: Array<{ lineNumber: number; errorMessage: string }>;
  securityViolations?: Array<{
    rule: string;
    file: string;
    lineNumber: number;
    snippet: string;
    message: string;
  }>;
  error?: string;
}

import { MutationExecutionResponse } from '../../types/practice';
import { MutationRadarWidget } from './MutationRadarWidget';

interface SandboxTestConsoleProps {
  result: SandboxExecutionResponse | null;
  mutationResult?: MutationExecutionResponse | null;
  isRunning: boolean;
  onClose: () => void;
  requiredMutationScore?: number;
}

export const SandboxTestConsole: React.FC<SandboxTestConsoleProps> = ({
  result,
  mutationResult,
  isRunning,
  onClose,
  requiredMutationScore = 85
}) => {
  const [expandedTest, setExpandedTest] = useState<string | null>(null);

  if (!result && !mutationResult && !isRunning) return null;

  if (mutationResult) {
    return (
      <div className="border-t border-slate-800 bg-slate-950 text-slate-100 flex flex-col max-h-96 overflow-y-auto select-none shadow-2xl transition-all duration-300">
        <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-3 text-xs sticky top-0 z-10">
          <div className="flex items-center gap-2.5">
            <Terminal className="w-3.5 h-3.5 text-pink-400" />
            <span className="font-semibold text-slate-200">MUTATION TESTING ARENA (Java 21 & Defect Injection)</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть консоль мутационных тестов"
            className="touch-target-44 min-w-[28px] min-h-[28px] p-1.5 hover:bg-slate-800 rounded text-slate-300 hover:text-white flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-3">
          <MutationRadarWidget report={mutationResult} requiredScore={requiredMutationScore} />
        </div>
      </div>
    );
  }

  const isSuccess = result?.success && result?.isCompilable;
  const hasSyntaxError = result && !result.isCompilable;
  const hasSecurityViolation = Boolean(result?.securityViolations && result.securityViolations.length > 0);
  const deadlock = result?.concurrencyHarness?.deadlockDetected;

  return (
    <div className="border-t border-slate-800 bg-slate-950 text-slate-100 flex flex-col max-h-72 shadow-2xl transition-all duration-300">
      {/* Console Header Bar */}
      <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 font-mono font-semibold text-slate-300">
            <Terminal className="w-4 h-4 text-violet-400" />
            <span>Java 21 Sandbox</span>
          </div>

          {isRunning ? (
            <span className="flex items-center gap-1.5 text-amber-400 font-mono text-[11px] animate-pulse">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              Компиляция и прогон тестов...
            </span>
          ) : isSuccess ? (
            <span className="flex items-center gap-1 text-emerald-400 font-bold text-[11px]">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Все тесты пройдены ({result?.passedCount}/{result?.testResults.length})
            </span>
          ) : hasSecurityViolation ? (
            <span className="flex items-center gap-1 text-purple-400 font-bold text-[11px]">
              <ShieldAlert className="w-3.5 h-3.5" />
              Отклонено политикой безопасности
            </span>
          ) : hasSyntaxError ? (
            <span className="flex items-center gap-1 text-rose-400 font-bold text-[11px]">
              <XCircle className="w-3.5 h-3.5" />
              Ошибка компиляции
            </span>
          ) : (
            <span className="flex items-center gap-1 text-rose-400 font-bold text-[11px]">
              <XCircle className="w-3.5 h-3.5" />
              Провалено тестов: {result?.failedCount} из {result?.testResults.length}
            </span>
          )}
        </div>

        {/* Telemetry & Badges */}
        {result && !isRunning && (
          <div className="flex items-center gap-2">
            {/* Concurrency Harness Badge */}
            {result.concurrencyHarness && (
              <div className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono border ${
                deadlock 
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              }`}>
                <Cpu className="w-3 h-3" />
                <span>{deadlock ? '🚨 DEADLOCK DETECTED' : '100 потоков: Deadlock-Free'}</span>
              </div>
            )}

            {/* Timing Pills */}
            <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono">
              <Clock className="w-3 h-3" />
              <span>компиляция: {result.compilationTimeMs}мс</span>
              <span>•</span>
              <span>тесты: {result.executionTimeMs}мс</span>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Закрыть консоль песочницы"
              className="touch-target-44 min-w-[28px] min-h-[28px] p-1.5 rounded-md text-slate-300 hover:text-white hover:bg-slate-800 transition flex items-center justify-center cursor-pointer"
              title="Закрыть консоль"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Console Output Body */}
      <div className="p-3 overflow-y-auto space-y-2 font-mono text-xs" data-selection-zone="terminal">
        {/* Security Violations Banner */}
        {hasSecurityViolation && result && (
          <div className="p-2.5 rounded-xl bg-purple-950/40 border border-purple-800/60 space-y-1.5">
            <div className="font-semibold text-purple-300 flex items-center gap-1.5 text-xs">
              <ShieldAlert className="w-4 h-4" />
              <span>AST Security Pre-Scanner: Запрещенный вызов</span>
            </div>
            {result.securityViolations?.map((v, i) => (
              <div key={i} className="text-[11px] text-purple-200 space-y-0.5">
                <div>{v.message}</div>
                <div className="text-[10px] text-slate-400">
                  Файл: <span className="text-violet-300">{v.file}</span> (строка {v.lineNumber})
                </div>
                <div className="bg-purple-950 p-1 rounded text-purple-300 text-[10px] truncate">
                  {v.snippet}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Syntax Errors List */}
        {hasSyntaxError && result && (
          <div className="space-y-1.5">
            {result.syntaxErrors?.map((err, i) => (
              <div key={i} className="p-2 rounded-lg bg-rose-950/40 border border-rose-900/60 text-rose-300 text-[11px]">
                <span className="text-rose-400 font-bold mr-2">[Строка {err.lineNumber}]:</span>
                <span>{err.errorMessage}</span>
              </div>
            ))}
            {result.error && !result.syntaxErrors?.length && (
              <div className="p-2 rounded-lg bg-rose-950/40 border border-rose-900/60 text-rose-300 text-[11px]">
                {result.error}
              </div>
            )}
          </div>
        )}

        {/* Test Cases Results List */}
        {result?.testResults && result.testResults.length > 0 && (
          <div className="space-y-1">
            {result.testResults.map((t, idx) => {
              const isTestPassed = t.status === 'PASSED';
              const isExpanded = expandedTest === t.testName;

              return (
                <div
                  key={idx}
                  className={`rounded-lg border transition-colors ${
                    isTestPassed
                      ? 'bg-slate-900/60 border-slate-800'
                      : 'bg-rose-950/30 border-rose-900/50'
                  }`}
                >
                  {!isTestPassed ? (
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      onClick={() => setExpandedTest(isExpanded ? null : t.testName)}
                      className="w-full flex items-center justify-between p-2 text-left cursor-pointer hover:bg-rose-950/40"
                    >
                      <div className="flex items-center gap-2">
                        <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        <span className="text-[11px] font-bold text-rose-300">{t.testName}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-300">{t.durationMs}мс</span>
                        {isExpanded ? (
                          <ChevronDown className="w-3 h-3 text-rose-400" />
                        ) : (
                          <ChevronRight className="w-3 h-3 text-rose-400" />
                        )}
                      </div>
                    </button>
                  ) : (
                    <div className="flex items-center justify-between p-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="text-[11px] font-medium text-slate-200">{t.testName}</span>
                      </div>
                      <span className="text-[10px] text-slate-300">{t.durationMs}мс</span>
                    </div>
                  )}

                  {/* Failure reason details */}
                  {isExpanded && t.failureReason && (
                    <div className="p-2.5 pt-0 border-t border-rose-900/30 text-[10px] text-rose-200">
                      <div className="font-semibold text-rose-300 mb-1">Причина падения теста:</div>
                      <pre className="bg-slate-950 p-2 rounded border border-rose-900/40 text-rose-300 overflow-x-auto whitespace-pre-wrap">
                        {t.failureReason}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
