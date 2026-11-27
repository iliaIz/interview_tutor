import React, { useState } from 'react';
import {
  Play,
  RotateCcw,
  Save,
  Loader2,
  Shield,
  Bug,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';
import { EvaluationStageState } from './useWorkspaceRunner';
import { filterActiveAstViolations } from '../../utils/astRules';
import { NativeModalDialog } from '../shared/NativeModalDialog';

interface WorkspaceFooterBarProps {
  hasGoldenMaster: boolean;
  onOpenDiff: () => void;
  onSaveDraft: () => void;
  onResetWorkspace: () => void;
  isSavingDraft: boolean;
  isSandboxRunning: boolean;
  isPracticeEvaluating: boolean;
  isWriteTheTestsMode: boolean;
  liveAstViolations: Array<{ id: string; text: string; isViolation?: boolean }>;
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
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  const activeAstViolations = filterActiveAstViolations(
    liveAstViolations.map((v) => ({ ...v, isViolation: v.isViolation ?? v.id !== 'clean' }))
  );

  return (
    <>
      <div className="px-2.5 py-2 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-1.5 flex-wrap shrink-0">
        {/* Left utility buttons */}
        <div className="flex items-center gap-1.5">
          {hasGoldenMaster && (
            <button
              type="button"
              onClick={onOpenDiff}
              className="touch-target-44 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 text-xs font-bold transition border border-emerald-500/30 cursor-pointer whitespace-nowrap"
            >
              <Shield className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="hidden xl:inline">Golden Master Diff</span>
              <span className="xl:hidden">Diff</span>
            </button>
          )}

          <button
            type="button"
            onClick={onSaveDraft}
            disabled={isSavingDraft || isPracticeEvaluating || isSandboxRunning}
            className="touch-target-44 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition border border-slate-700 cursor-pointer disabled:opacity-50 whitespace-nowrap"
            title="Сохранить черновик (Ctrl+S)"
          >
            {isSavingDraft ? <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" /> : <Save className="w-3.5 h-3.5 shrink-0" />}
            <span className="hidden xl:inline">Сохранить</span>
          </button>

          <button
            type="button"
            onClick={() => setIsResetConfirmOpen(true)}
            disabled={isPracticeEvaluating || isSandboxRunning}
            aria-label="Сбросить воркспейс к начальному состоянию"
            className="touch-target-44 flex items-center gap-1 px-2 py-1.5 rounded-xl text-slate-300 hover:text-rose-300 hover:bg-slate-800 transition cursor-pointer disabled:opacity-50 whitespace-nowrap"
            title="Сбросить воркспейс к начальному состоянию"
          >
            <RotateCcw className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden xl:inline text-xs font-medium">Сброс</span>
          </button>
        </div>

        {/* Center AST live indicator */}
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-800/80 border border-slate-700 text-xs shrink-0">
          {activeAstViolations.length === 0 ? (
            <span className="text-emerald-300 font-medium flex items-center gap-1.5 text-[11px] whitespace-nowrap">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="hidden xl:inline">0 нарушений AST</span>
              <span className="xl:hidden">AST: 0</span>
            </span>
          ) : (
            <span
              className="text-amber-300 font-medium flex items-center gap-1.5 text-[11px]"
              title={activeAstViolations.map((v) => v.text).join('\n')}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="max-w-[180px] xl:max-w-[240px] truncate">{activeAstViolations[0].text}</span>
              {activeAstViolations.length > 1 && (
                <span className="px-1.5 py-0.2 rounded-full bg-amber-400/20 text-[10px]">
                  +{activeAstViolations.length - 1}
                </span>
              )}
            </span>
          )}
        </div>

        {/* Right execution actions */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onRunSandbox}
            disabled={isSandboxRunning || isPracticeEvaluating}
            className={`touch-target-44 flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition shadow-md cursor-pointer disabled:opacity-50 whitespace-nowrap ${
              isWriteTheTestsMode
                ? 'bg-[#B5433E] hover:bg-[#9B3B36] text-white'
                : 'bg-emerald-700 hover:bg-emerald-600 text-white'
            }`}
            title={
              isWriteTheTestsMode
                ? 'Прогон тестов кандидата против мутантов байткода (Ctrl+Enter)'
                : 'Быстрый прогон JUnit 5 тестов в Java 21 Sandbox (Ctrl+Enter)'
            }
          >
            {isSandboxRunning ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
            ) : isWriteTheTestsMode ? (
              <Bug className="w-3.5 h-3.5 shrink-0" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current shrink-0" />
            )}
            <span>
              {isSandboxRunning
                ? isWriteTheTestsMode
                  ? 'Анализ мутаций...'
                  : 'Запуск...'
                : isWriteTheTestsMode
                ? 'На мутантах'
                : 'Тесты (Java 21)'}
            </span>
            <span className="hidden 2xl:inline text-[10px] opacity-85 font-mono">(Ctrl+↵)</span>
          </button>

          {isPracticeEvaluating ? (
            <button
              type="button"
              onClick={onToggleReviewConsole}
              title="Нажмите, чтобы развернуть/свернуть детальную консоль статусов Senior AI Review"
              className="touch-target-44 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800 border border-pastel-accentRose/50 text-slate-100 text-xs font-bold shadow-sm hover:border-pastel-accentRose transition cursor-pointer whitespace-nowrap"
            >
              <Loader2 className="w-3.5 h-3.5 animate-spin text-pastel-accentRose shrink-0" />
              <span className="truncate max-w-[160px] xl:max-w-[200px]">
                {evaluationStage.label || 'Senior AI Рецензия...'}
              </span>
              <span className="text-[10px] text-slate-300 font-mono">({evaluationTimer}с)</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onStartEvaluation}
              disabled={isSandboxRunning}
              className="touch-target-44 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#B5433E] hover:bg-[#9B3B36] text-white font-bold text-xs transition shadow-md cursor-pointer disabled:opacity-50 whitespace-nowrap"
            >
              <Shield className="w-3.5 h-3.5 shrink-0" />
              <span>Senior AI Review</span>
            </button>
          )}
        </div>
      </div>

      {/* Native <dialog> Reset Confirmation */}
      <NativeModalDialog
        isOpen={isResetConfirmOpen}
        onClose={() => setIsResetConfirmOpen(false)}
        ariaLabelledBy="reset-workspace-dialog-title"
        panelClassName="relative w-full max-w-md rounded-2xl bg-white border border-pastel-border shadow-2xl overflow-hidden text-pastel-text"
      >
        <div className="p-5 space-y-3">
          <h3 id="reset-workspace-dialog-title" className="text-sm font-bold text-pastel-text">
            Сбросить воркспейс к начальному состоянию?
          </h3>
          <p className="text-xs text-pastel-muted leading-relaxed">
            Все текущие правки в файлах задачи и локальный черновик будут удалены и заменены исходным шаблоном.
          </p>
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsResetConfirmOpen(false)}
              className="px-3.5 py-2 rounded-xl border border-pastel-border text-xs font-semibold text-pastel-text hover:bg-pastel-bg transition cursor-pointer"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={() => {
                setIsResetConfirmOpen(false);
                onResetWorkspace();
              }}
              className="px-4 py-2 rounded-xl bg-[#B5433E] hover:bg-[#9B3B36] text-white text-xs font-bold transition cursor-pointer"
            >
              Сбросить файлы
            </button>
          </div>
        </div>
      </NativeModalDialog>
    </>
  );
};
