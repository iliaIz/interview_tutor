import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  Circle,
  Clock,
  ArrowRight,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { AcademyStep } from '../../../types/nextgen';

interface AcademyMilestoneAccordionProps {
  milestone: { id: string; title: string; stepRange?: string };
  mIdx: number;
  isOpen: boolean;
  onToggle: () => void;
  milestoneAllSteps: AcademyStep[];
  milestoneVisibleSteps: AcademyStep[];
  activeStepNumber: number | null;
  onOpenStepModal: (step: AcademyStep) => void;
  onToggleStep: (stepNumber: number, isCompleted: boolean) => void;
}

export const AcademyMilestoneAccordion: React.FC<AcademyMilestoneAccordionProps> = ({
  milestone,
  mIdx,
  isOpen,
  onToggle,
  milestoneAllSteps,
  milestoneVisibleSteps,
  activeStepNumber,
  onOpenStepModal,
  onToggleStep
}) => {
  const totalInMilestone = milestoneAllSteps.length;
  const completedInMilestone = milestoneAllSteps.filter((s) => s.isCompleted).length;
  const percentage = totalInMilestone > 0 ? Math.round((completedInMilestone / totalInMilestone) * 100) : 0;
  const isMilestoneCompleted = totalInMilestone > 0 && completedInMilestone === totalInMilestone;

  return (
    <div className="rounded-3xl border border-pastel-border/80 bg-white/70 backdrop-blur-md overflow-hidden shadow-2xs transition-all duration-200">
      {/* Milestone Accordion Header */}
      <button
        onClick={onToggle}
        className={`w-full p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left transition-colors cursor-pointer select-none ${
          isOpen ? 'bg-white/95 border-b border-pastel-border/60' : 'hover:bg-white/90'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
              isMilestoneCompleted
                ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                : 'bg-pastel-rose text-pastel-accentRose border border-pastel-accentRose/20'
            }`}
          >
            {isMilestoneCompleted ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <span>M{mIdx + 1}</span>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-pastel-text">{milestone.title}</h3>
              {milestone.stepRange && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pastel-bg text-pastel-muted border border-pastel-border">
                  {milestone.stepRange}
                </span>
              )}
            </div>
            <p className="text-[11px] text-pastel-muted font-medium">
              {completedInMilestone} из {totalInMilestone} шагов освоено • {percentage}% прогресс
            </p>
          </div>
        </div>

        {/* Milestone Progress & Toggle Action */}
        <div className="flex items-center gap-3 self-end sm:self-auto">
          <div className="w-28 sm:w-36 flex flex-col gap-1">
            <div className="flex justify-between text-[10px] font-bold text-pastel-muted">
              <span>{percentage}%</span>
              {isMilestoneCompleted && <span className="text-emerald-600">Готово</span>}
            </div>
            <div className="w-full h-1.5 rounded-full bg-pastel-border/60 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isMilestoneCompleted
                    ? 'bg-emerald-500'
                    : 'bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet'
                }`}
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>

          <div className="w-8 h-8 rounded-full bg-pastel-bg flex items-center justify-center text-pastel-muted hover:text-pastel-text transition shrink-0">
            {isOpen ? <ChevronUp className="w-4 h-4 text-pastel-accentRose" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>
      </button>

      {/* Milestone Steps Cards Grid (when expanded) */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="p-4 sm:p-5 bg-pastel-bg/30"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {milestoneVisibleSteps.map((step) => {
                const isCompleted = Boolean(step.isCompleted);
                const core = step.coreRequirements || {};

                return (
                  <div
                    key={step.stepNumber}
                    id={`academy-step-${step.stepNumber}`}
                    onClick={() => onOpenStepModal(step)}
                    className={`card-content-visibility p-4 sm:p-5 rounded-3xl border transition-all duration-200 cursor-pointer flex flex-col justify-between gap-4 relative overflow-hidden group ${
                      activeStepNumber === step.stepNumber
                        ? 'ring-2 ring-pastel-accentRose shadow-md bg-white border-pastel-accentRose/60'
                        : isCompleted
                        ? 'bg-white border-emerald-200/80 shadow-xs hover:border-emerald-300'
                        : 'bg-white hover:bg-white border-pastel-border/80 hover:border-pastel-accentRose/40 shadow-2xs hover:shadow-md'
                    }`}
                  >
                    {/* Top Meta */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pastel-rose text-pastel-accentRoseText border border-pastel-accentRose/20 font-mono">
                            #{step.stepNumber}
                          </span>
                          <span className="text-[10px] text-pastel-muted font-medium flex items-center gap-0.5">
                            <Clock className="w-2.5 h-2.5" /> ~{step.estimatedMinutes}м
                          </span>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleStep(step.stepNumber, !isCompleted);
                          }}
                          className="p-2 -m-1 rounded-xl text-pastel-muted hover:text-emerald-600 transition cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center touch-manipulation focus:outline-hidden"
                          title={isCompleted ? 'Отменить зачёт' : 'Отметить выполненным'}
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-500 fill-emerald-50" />
                          ) : (
                            <Circle className="w-5 h-5 text-pastel-muted/50 hover:text-pastel-accentRose" />
                          )}
                        </button>
                      </div>

                      <h4 className="font-bold text-sm text-pastel-text group-hover:text-pastel-accentRoseText transition-colors line-clamp-2">
                        {step.title}
                      </h4>
                      <p className="text-xs text-pastel-muted line-clamp-2 leading-relaxed">
                        💡 {step.seniorBarConcept}
                      </p>
                    </div>

                    {/* Core Requirements Badges */}
                    <div className="pt-3 border-t border-pastel-border/40 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {step.requiredForGrade && (
                          <span
                            className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200"
                            title="Обязательный шаг для целевого грейда"
                          >
                            ★ Core
                          </span>
                        )}
                        {step.targetArena === 'transactions' && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                            ⚡ Транзакции
                          </span>
                        )}
                        {step.targetArena === 'testing_mutation' && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                            🧪 Мутации
                          </span>
                        )}
                        {core.lldChallengeSlug && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200">
                            💻 LLD
                          </span>
                        )}
                        {core.hldScenarioId && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                            🏛️ HLD
                          </span>
                        )}
                        {core.triageIncidentId && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200">
                            🧵 Триаж
                          </span>
                        )}
                        {core.theoryTitle && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                            📖 Теория
                          </span>
                        )}
                      </div>

                      <span className="text-[11px] font-bold text-pastel-accentRoseText opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                        Открыть <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
