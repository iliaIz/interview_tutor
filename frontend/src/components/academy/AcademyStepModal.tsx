import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import { AcademyStep } from '../../types/nextgen';
import { X, CheckCircle2, Circle, Sparkles, AlertTriangle, Flame, Star, Headphones, ArrowRight, Code2, Layers, Terminal, BookOpen, Clock, ShieldCheck, Database, Bug, Compass, Target } from 'lucide-react';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';

interface AcademyStepModalProps {
  step: AcademyStep | null;
  courseId: string;
  courseTitle: string;
  onClose: () => void;
  onToggleCompleted: (stepNumber: number, isCompleted: boolean) => void;
}

export const AcademyStepModal: React.FC<AcademyStepModalProps> = ({
  step,
  courseId,
  courseTitle,
  onClose,
  onToggleCompleted
}) => {
  useBodyScrollLock(Boolean(step));
  const { 
    setStudioTab, 
    setAcademyBreadcrumb,
    setSelectedTopic,
    setView,
    launchAcademyStepTarget
  } = useAppStore();

  if (!step) return null;

  const core = step.coreRequirements || {};
  const isCompleted = Boolean(step.isCompleted);
  const arena = step.targetArena || core.targetArena || core.taskType || 'theory';

  const handleLaunchPractice = () => {
    void launchAcademyStepTarget(step, courseId, courseTitle);
    onClose();
  };

  const handleLaunchTheory = () => {
    setAcademyBreadcrumb({
      courseId,
      courseTitle,
      stepNumber: step.stepNumber,
      stepTitle: step.title
    });
    setStudioTab('theory');
    setSelectedTopic('core', 'Java Core & Spring');
    setView('questions');
    onClose();
  };

  const handleLaunchVoice = () => {
    setAcademyBreadcrumb({
      courseId,
      courseTitle,
      stepNumber: step.stepNumber,
      stepTitle: step.title
    });
    setStudioTab('theory');
    onClose();
  };

  const getArenaBadge = (targetArena: string) => {
    switch (targetArena) {
      case 'transactions':
        return { label: 'Spring Transactions Lab', icon: Database, color: 'bg-blue-50 text-blue-700 border-blue-200' };
      case 'system_design':
        return { label: 'System Design Arena', icon: Layers, color: 'bg-purple-50 text-purple-700 border-purple-200' };
      case 'incident_triage':
        return { label: 'Incident Triage Studio', icon: Terminal, color: 'bg-amber-50 text-amber-800 border-amber-200' };
      case 'testing_mutation':
        return { label: 'Mutation Testing Arena', icon: Bug, color: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
      case 'machine_coding':
        return { label: 'Machine Coding (LLD)', icon: Code2, color: 'bg-rose-50 text-rose-800 border-rose-200' };
      case 'oral_interview':
        return { label: 'Gemini Live Mock Voice', icon: Headphones, color: 'bg-teal-50 text-teal-800 border-teal-200' };
      default:
        return { label: 'База Знаний (Теория)', icon: BookOpen, color: 'bg-slate-50 text-slate-800 border-slate-200' };
    }
  };
  const arenaInfo = getArenaBadge(arena);
  const ArenaBadgeIcon = arenaInfo.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-pastel-text/30 backdrop-blur-md animate-fade-in">
      <div className="bg-white/95 rounded-3xl shadow-2xl border border-pastel-border w-full max-w-3xl max-h-[92dvh] flex flex-col overflow-hidden relative backdrop-blur-xl">
        
        {/* Decorative Luxury Glow */}
        <div className="absolute top-0 right-0 w-80 h-80 rounded-full bg-gradient-to-bl from-pastel-accentRose/15 via-pastel-accentViolet/10 to-transparent blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full bg-gradient-to-tr from-pastel-peach/25 to-transparent blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-pastel-border/60 flex items-start justify-between gap-4 relative z-10 bg-white/70 backdrop-blur-md">
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-pastel-rose text-pastel-accentRose border border-pastel-accentRose/20">
                Шаг #{step.stepNumber}
              </span>
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1 ${arenaInfo.color}`}>
                <ArenaBadgeIcon className="w-3 h-3" /> {arenaInfo.label}
              </span>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-pastel-lavender text-pastel-accentViolet border border-pastel-accentViolet/20 flex items-center gap-1">
                <Clock className="w-3 h-3" /> ~{step.estimatedMinutes} мин
              </span>
              {isCompleted ? (
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Зачтено
                </span>
              ) : (
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                  <Circle className="w-3 h-3 text-amber-600" /> В процессе
                </span>
              )}
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-pastel-text tracking-tight">
              {step.title}
            </h2>
            <p className="text-xs sm:text-sm text-pastel-accentRose font-medium">
              💡 {step.seniorBarConcept}
            </p>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-pastel-muted hover:text-pastel-text hover:bg-pastel-bg transition cursor-pointer shrink-0"
            title="Закрыть"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-6 relative z-10 custom-scrollbar">

          {/* 1. Interview Trap Banner */}
          {step.interviewTrap && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-50/90 to-rose-50/80 border border-amber-200/80 shadow-2xs">
              <div className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-amber-900 mb-0.5">⚠️ Ловушка на собеседовании (Interview Trap)</h4>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    {step.interviewTrap}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 1.5 Pedagogical Rationale Callout */}
          {step.pedagogicalRationale && (
            <div className="p-3.5 rounded-2xl bg-white/90 border border-pastel-border/80 shadow-2xs flex items-start gap-2.5 text-xs text-pastel-text/90">
              <Target className="w-4 h-4 text-pastel-accentRose shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-pastel-accentRose">Методическое обоснование: </span>
                <span>{step.pedagogicalRationale}</span>
              </div>
            </div>
          )}

          {/* 2. Core Requirements (100% Зачёт) */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-pastel-text font-bold text-xs uppercase tracking-wider">
              <Flame className="w-4 h-4 text-pastel-accentRose" />
              <span>Обязательное Ядро шага (Core Requirements)</span>
              <span className="text-[10px] lowercase font-normal px-2 py-0.5 rounded-full bg-pastel-rose text-pastel-accentRose border border-pastel-accentRose/20">
                100% зачёт
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Theory Card */}
              <div className="p-4 rounded-2xl bg-white/90 border border-pastel-border/80 shadow-2xs hover:border-pastel-accentRose/30 transition flex flex-col justify-between gap-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                      <BookOpen className="w-3 h-3" /> Теоретический тезис
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-pastel-text leading-snug">
                    {core.theoryTitle || "Фундаментальный разбор концепта"}
                  </p>
                </div>
                <button
                  onClick={handleLaunchTheory}
                  className="flex items-center justify-center gap-1.5 w-full py-2 px-3 rounded-xl text-xs font-bold bg-pastel-bg text-pastel-text hover:bg-pastel-rose hover:text-pastel-accentRose border border-pastel-border transition cursor-pointer"
                >
                  <span>Изучить в Базе Знаний</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Practical Challenge Card */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-white/90 to-pastel-rose/20 border border-pastel-accentRose/30 shadow-2xs flex flex-col justify-between gap-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 ${arenaInfo.color}`}>
                      <ArenaBadgeIcon className="w-3 h-3" />
                      {arenaInfo.label}
                    </span>
                    {step.entityStatus?.isTxPassed || step.entityStatus?.isTestingPassed || step.entityStatus?.isLldPassed || step.entityStatus?.isTriagePassed || step.entityStatus?.isHldPassed ? (
                      <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-0.5">
                        <CheckCircle2 className="w-3 h-3" /> Решено
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-pastel-text leading-snug">
                    {core.taskDescription || step.pedagogicalRationale || "Решить профильную задачу с верификацией"}
                  </p>
                </div>
                <button
                  onClick={handleLaunchPractice}
                  className="flex items-center justify-center gap-1.5 w-full py-2 px-3 rounded-xl text-xs font-bold bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet text-white shadow-xs hover:opacity-95 transition cursor-pointer"
                >
                  <span>Запустить в {arenaInfo.label}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* 3. Bonus Deep Dive (Факультатив ⭐) */}
          {step.bonusDeepDive && (
            <div className="p-4 rounded-2xl bg-gradient-to-br from-pastel-lavender/30 to-pastel-bg border border-pastel-accentViolet/25 shadow-2xs space-y-1.5">
              <div className="flex items-center gap-1.5 text-pastel-accentViolet font-bold text-xs">
                <Star className="w-3.5 h-3.5 fill-pastel-accentViolet" />
                <span>{step.bonusDeepDive.title} (Опционально)</span>
              </div>
              <p className="text-xs text-pastel-text/90 leading-relaxed">
                {step.bonusDeepDive.description}
              </p>
            </div>
          )}

          {/* 4. Gemini Live Verbal Probe */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-50/80 via-teal-50/60 to-white/90 border border-emerald-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Headphones className="w-4 h-4 animate-pulse" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-emerald-950">Голосовой блиц с ИИ (Gemini Live)</h4>
                <p className="text-[11px] text-emerald-800/80">2-минутный экспресс-опрос по теме шага в режиме диалога</p>
              </div>
            </div>
            <button
              onClick={handleLaunchVoice}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white transition shadow-xs hover:shadow-sm cursor-pointer shrink-0 text-center active:scale-95 touch-manipulation"
            >
              Сдать голосом →
            </button>
          </div>

          {/* 5. Mastery Checklist */}
          {step.masteryChecklist && step.masteryChecklist.length > 0 && (
            <div className="space-y-2 pt-1">
              <h4 className="text-xs font-bold text-pastel-text flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-pastel-accentRose" />
                <span>Чек-лист готовности к Bar-Raiser:</span>
              </h4>
              <ul className="space-y-1.5">
                {step.masteryChecklist.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-xs text-pastel-text/90 bg-pastel-bg/60 p-2.5 rounded-xl border border-pastel-border/60">
                    <CheckCircle2 className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${isCompleted ? 'text-emerald-600' : 'text-slate-400'}`} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

        </div>

        {/* Modal Footer with Completion Toggle */}
        <div className="p-3.5 sm:p-5 border-t border-pastel-border/60 bg-white/90 backdrop-blur-md flex flex-wrap items-center justify-between gap-2.5 relative z-10">
          <button
            onClick={() => onToggleCompleted(step.stepNumber, !isCompleted)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all duration-200 cursor-pointer active:scale-95 touch-manipulation ${
              isCompleted
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs hover:bg-emerald-200/80'
                : 'bg-white text-pastel-text border border-pastel-border hover:bg-pastel-rose/40 hover:border-pastel-accentRose/40 shadow-xs'
            }`}
          >
            {isCompleted ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Шаг выполнен (Снять зачёт)</span>
              </>
            ) : (
              <>
                <Circle className="w-4 h-4 text-slate-400" />
                <span>Отметить шаг как завершенный</span>
              </>
            )}
          </button>

          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-2xl text-xs font-bold bg-pastel-text text-white hover:bg-pastel-text/90 transition cursor-pointer shadow-xs active:scale-95 touch-manipulation ml-auto"
          >
            Закрыть
          </button>
        </div>

      </div>
    </div>
  );
};
