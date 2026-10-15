import React, { useRef, useEffect } from 'react';
import { 
  Shield, 
  Terminal, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  Clock, 
  X, 
  ChevronDown, 
  ChevronUp, 
  RefreshCw, 
  Cpu, 
  AlertTriangle 
} from 'lucide-react';
import { StepperState, ReviewLogEntry } from './useEvaluationPipeline';
import { ReviewProgressEvent } from '../../types/practice';

interface ReviewProgressConsoleProps {
  isOpen: boolean;
  isEvaluating: boolean;
  currentStage: ReviewProgressEvent;
  evaluationTimer: number;
  stepperState: StepperState;
  reviewLogs: ReviewLogEntry[];
  activeError: { message: string; canRetryAiOnly: boolean } | null;
  onClose: () => void;
  onAbort: () => void;
  onRetry: () => void;
}

export const ReviewProgressConsole: React.FC<ReviewProgressConsoleProps> = ({
  isOpen,
  isEvaluating,
  currentStage,
  evaluationTimer,
  stepperState,
  reviewLogs,
  activeError,
  onClose,
  onAbort,
  onRetry
}) => {
  const [isMinimized, setIsMinimized] = React.useState(false);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs to bottom
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [reviewLogs]);

  if (!isOpen && !isEvaluating) return null;

  return (
    <div className="border-t border-slate-800 bg-slate-950 text-slate-100 flex flex-col max-h-96 select-none shadow-2xl transition-all duration-300 z-20">
      {/* 1. Header Toolbar */}
      <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-3 text-xs sticky top-0 z-10">
        <div className="flex items-center gap-2 font-mono font-bold text-slate-200">
          <Shield className="w-4 h-4 text-pastel-accentRose" />
          <span>Senior AI Review Pipeline</span>
          {isEvaluating && (
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-pastel-accentRose/20 border border-pastel-accentRose/40 text-pastel-accentRose text-[10px] animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-pastel-accentRose" />
              В процессе ({evaluationTimer}с)
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 transition cursor-pointer"
            title={isMinimized ? 'Развернуть консоль' : 'Свернуть консоль'}
          >
            {isMinimized ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 transition cursor-pointer"
            title="Закрыть"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* 2. Visual 4-Stage Stepper */}
          <div className="px-4 py-3 bg-slate-900/60 border-b border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            {/* Step 1: Sandbox */}
            <div className={`p-2 rounded-xl border flex flex-col gap-1 transition ${
              stepperState.sandbox.status === 'running'
                ? 'bg-amber-950/20 border-amber-500/40 text-amber-200'
                : stepperState.sandbox.status === 'success'
                ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-200'
                : stepperState.sandbox.status === 'error'
                ? 'bg-rose-950/20 border-rose-500/40 text-rose-200'
                : 'bg-slate-900/40 border-slate-800 text-slate-400'
            }`}>
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span className="flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5" /> 1. Песочница JVM 21
                </span>
                {stepperState.sandbox.status === 'running' && <Loader2 className="w-3 h-3 animate-spin text-amber-400" />}
                {stepperState.sandbox.status === 'success' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                {stepperState.sandbox.status === 'error' && <XCircle className="w-3.5 h-3.5 text-rose-400" />}
              </div>
              <span className="text-[10px] font-mono truncate opacity-90">{stepperState.sandbox.label}</span>
            </div>

            {/* Step 2: AST Analysis */}
            <div className={`p-2 rounded-xl border flex flex-col gap-1 transition ${
              stepperState.ast.status === 'running'
                ? 'bg-amber-950/20 border-amber-500/40 text-amber-200'
                : stepperState.ast.status === 'success'
                ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-200'
                : stepperState.ast.status === 'error'
                ? 'bg-rose-950/20 border-rose-500/40 text-rose-200'
                : 'bg-slate-900/40 border-slate-800 text-slate-400'
            }`}>
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span>2. AST & Loom Safety</span>
                {stepperState.ast.status === 'running' && <Loader2 className="w-3 h-3 animate-spin text-amber-400" />}
                {stepperState.ast.status === 'success' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                {stepperState.ast.status === 'error' && <XCircle className="w-3.5 h-3.5 text-rose-400" />}
              </div>
              <span className="text-[10px] font-mono truncate opacity-90">{stepperState.ast.label}</span>
            </div>

            {/* Step 3: AI Reasoning */}
            <div className={`p-2 rounded-xl border flex flex-col gap-1 transition ${
              stepperState.ai.status === 'running'
                ? 'bg-purple-950/20 border-purple-500/40 text-purple-200 shadow-sm'
                : stepperState.ai.status === 'success'
                ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-200'
                : stepperState.ai.status === 'error'
                ? 'bg-rose-950/20 border-rose-500/40 text-rose-200'
                : 'bg-slate-900/40 border-slate-800 text-slate-400'
            }`}>
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span>3. Senior AI Архитектор</span>
                {stepperState.ai.status === 'running' && <Loader2 className="w-3 h-3 animate-spin text-purple-400" />}
                {stepperState.ai.status === 'success' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                {stepperState.ai.status === 'error' && <XCircle className="w-3.5 h-3.5 text-rose-400" />}
              </div>
              <span className="text-[10px] font-mono truncate opacity-90">{stepperState.ai.label}</span>
            </div>

            {/* Step 4: Final Synthesis */}
            <div className={`p-2 rounded-xl border flex flex-col gap-1 transition ${
              stepperState.report.status === 'running'
                ? 'bg-amber-950/20 border-amber-500/40 text-amber-200'
                : stepperState.report.status === 'success'
                ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-200'
                : 'bg-slate-900/40 border-slate-800 text-slate-400'
            }`}>
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span>4. Финализация</span>
                {stepperState.report.status === 'running' && <Loader2 className="w-3 h-3 animate-spin text-amber-400" />}
                {stepperState.report.status === 'success' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
              </div>
              <span className="text-[10px] font-mono truncate opacity-90">{stepperState.report.label}</span>
            </div>
          </div>

          {/* 3. Live Terminal Log Stream */}
          <div
            ref={logContainerRef}
            className="p-3 bg-slate-950 font-mono text-xs overflow-y-auto max-h-44 space-y-1 select-text scrollbar-thin scrollbar-thumb-slate-800"
          >
            {reviewLogs.length === 0 ? (
              <div className="text-slate-500 italic py-2 flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5" />
                Ожидание событий пайплайна...
              </div>
            ) : (
              reviewLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-2 leading-relaxed">
                  <span className="text-slate-500 shrink-0 text-[10px]">[{log.time}]</span>
                  <span className={`break-all ${
                    log.type === 'success' ? 'text-emerald-400 font-bold' :
                    log.type === 'error' ? 'text-rose-400 font-bold' :
                    log.type === 'warn' ? 'text-amber-400' :
                    'text-slate-300'
                  }`}>
                    {log.text}
                  </span>
                </div>
              ))
            )}
          </div>

          {/* 4. Action Footer & Recovery Card */}
          <div className="px-4 py-2.5 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-slate-400 truncate text-[11px]">
                {currentStage.label || 'Готов к запуску'}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {isEvaluating ? (
                <button
                  type="button"
                  onClick={onAbort}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-rose-950/60 text-rose-300 border border-rose-800 hover:bg-rose-900 transition font-bold text-xs cursor-pointer active:scale-95"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Прервать</span>
                </button>
              ) : activeError ? (
                <button
                  type="button"
                  onClick={onRetry}
                  className="flex items-center gap-1.5 px-3.5 py-1 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs transition cursor-pointer shadow-md active:scale-95"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Повторить AI-ревью</span>
                </button>
              ) : null}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
