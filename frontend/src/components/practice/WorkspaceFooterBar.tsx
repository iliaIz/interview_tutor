import React from 'react';
import {
  Play,
  RotateCcw,
  Save,
  Loader2,
  Shield,
  Bug,
  AlertTriangle,
  Sparkles
} from 'lucide-react';
import { EvaluationStageState } from './useWorkspaceRunner';

interface WorkspaceFooterBarProps {
  hasGoldenMaster: boolean;
  onOpenDiff: () => void;
  onSaveDraft: () => void;
  onResetWorkspace: () => void;
  isSavingDraft: boolean;
  isSandboxRunning: boolean;
  isPracticeEvaluating: boolean;
  isWriteTheTestsMode: boolean;
  liveAstViolations: Array<{ id: string; text: string }>;
  evaluationStage: EvaluationStageState;
  evaluationTimer: number;
  onRunSandbox: () => void;
  onStartEvaluation: () => void;
  onToggleReviewConsole?: () => void;
}

export const WorkspaceFooterBar: React.FC<WorkspaceFooterBarProps> = ({
  hasGoldenMaster,
  onOpenDiff,
  onSaveDraft,
  onResetWorkspace,
  isSavingDraft,
  isSandboxRunning,
  isPracticeEvaluating,
  isWriteTheTestsMode,
  liveAstViolations,
  evaluationStage,
  evaluationTimer,
  onRunSandbox,
  onStartEvaluation,
  onToggleReviewConsole
}) => {
  return (
    <div className="p-3 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-2 flex-wrap">
      {/* Left utility buttons */}
      <div className="flex items-center gap-2">
        {hasGoldenMaster && (
          <button
            type="button"
            onClick={onOpenDiff}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 text-xs font-bold transition border border-emerald-500/30 cursor-pointer"
          >
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span>Golden Master Diff</span>
          </button>
        )}

        <button
          type="button"
          onClick={onSaveDraft}
          disabled={isSavingDraft || isPracticeEvaluating || isSandboxRunning}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition border border-slate-700 cursor-pointer"
          title="Сохранить черновик"
        >
          {isSavingDraft ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          <span className="hidden sm:inline">Сохранить</span>
        </button>

        <button
          type="button"
          onClick={onResetWorkspace}
          disabled={isPracticeEvaluating || isSandboxRunning}
          className="p-1.5 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition cursor-pointer"
          title="Сбросить воркспейс к начальному состоянию"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Center AST live indicator */}
      <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-800/60 border border-slate-700/60 text-xs">
        {liveAstViolations.length === 0 ? (
          <span className="text-emerald-400 font-medium flex items-center gap-1.5 text-[11px]">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>Инварианты соблюдены (Clock, BigDecimal)</span>
          </span>
        ) : (
          <span
            className="text-amber-300 font-medium flex items-center gap-1.5 text-[11px]"
            title={liveAstViolations.map((v) => v.text).join('\n')}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            <span className="max-w-[240px] truncate">{liveAstViolations[0].text}</span>
            {liveAstViolations.length > 1 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-400/20 text-[10px]">
                +{liveAstViolations.length - 1}
              </span>
            )}
          </span>
        )}
      </div>

      {/* Right execution actions */}
      <div className="flex items-center gap-2">
        {/* Fast In-Memory Java 21 Sandbox / Mutation Run Button */}
        <button
          type="button"
          onClick={onRunSandbox}
          disabled={isSandboxRunning || isPracticeEvaluating}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-2xl font-bold text-xs transition shadow-md active:scale-95 cursor-pointer disabled:opacity-50 ${
            isWriteTheTestsMode
              ? 'bg-gradient-to-r from-rose-600 via-pink-600 to-purple-600 hover:from-rose-500 hover:to-purple-500 text-white shadow-rose-600/25'
              : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/25'
          }`}
          title={
            isWriteTheTestsMode
              ? 'Прогон тестов кандидата против мутантов байткода (Ctrl+Enter)'
              : 'Быстрый прогон JUnit 5 тестов в Java 21 Sandbox (Ctrl+Enter)'
          }
        >
          {isSandboxRunning ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : isWriteTheTestsMode ? (
            <Bug className="w-3.5 h-3.5" />
          ) : (
            <Play className="w-3.5 h-3.5 fill-current" />
          )}
          <span>
            {isSandboxRunning
              ? isWriteTheTestsMode
                ? 'Анализ мутаций...'
                : 'Запуск тестов...'
              : isWriteTheTestsMode
              ? '▶ Проверить на мутантах'
              : '▶ Тесты (Java 21)'}
          </span>
          <span className="hidden sm:inline text-[10px] opacity-75 font-mono">(Ctrl+↵)</span>
        </button>

        {/* Senior AI Review Button */}
        {isPracticeEvaluating ? (
          <button
            type="button"
            onClick={onToggleReviewConsole}
            title="Нажмите, чтобы развернуть/свернуть детальную консоль статусов Senior AI Review"
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-800 border border-pastel-accentRose/40 text-slate-200 text-xs font-bold shadow-sm hover:border-pastel-accentRose hover:bg-slate-750 transition cursor-pointer active:scale-95"
          >
            <Loader2 className="w-3.5 h-3.5 animate-spin text-pastel-accentRose flex-shrink-0" />
            <span className="truncate max-w-[240px]">
              {evaluationStage.label || 'Senior AI Рецензия...'}
            </span>
            <span className="text-[10px] text-pastel-muted font-mono opacity-75">({evaluationTimer}с)</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onStartEvaluation}
            disabled={isSandboxRunning}
            className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-gradient-to-r from-pastel-accentRose via-pink-500 to-pastel-accentViolet text-white font-bold text-xs hover:opacity-95 transition shadow-md active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Senior AI Review</span>
          </button>
        )}
      </div>
    </div>
  );
};
