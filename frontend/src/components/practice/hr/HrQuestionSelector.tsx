import React from 'react';
import { 
  CheckCircle2, 
  Sparkles, 
  Timer, 
  Tag, 
  HelpCircle,
  Briefcase,
  Scale,
  ShieldCheck,
  Cpu
} from 'lucide-react';
import { useHrSimulatorStore } from '../../../store/useHrSimulatorStore';
import { HrQuestionRubricItem } from '@interview-prep/shared';

const PHASE_LABELS: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  phase2_elevator_pitch: { label: '1. Самопрезентация (Pitch)', icon: Sparkles, color: 'text-pink-600 bg-pink-50' },
  phase3_work_history: { label: '2. Опыт и причины ухода', icon: Briefcase, color: 'text-indigo-600 bg-indigo-50' },
  phase4_gap_deep_dive: { label: '3. Перерыв, R&D и НПД', icon: Scale, color: 'text-amber-700 bg-amber-50' },
  phase5_compliance_financials: { label: '4. Зарплата и комплаенс', icon: ShieldCheck, color: 'text-emerald-700 bg-emerald-50' },
  phase6_candidate_qa: { label: '5. Технический блиц и STAR', icon: Cpu, color: 'text-purple-700 bg-purple-50' }
};

interface HrQuestionSelectorProps {
  onSelect?: () => void;
}

export const HrQuestionSelector: React.FC<HrQuestionSelectorProps> = ({ onSelect }) => {
  const questionsList = useHrSimulatorStore((state) => state.questionsList);
  const selectedQuestionId = useHrSimulatorStore((state) => state.selectedQuestionId);
  const selectQuestion = useHrSimulatorStore((state) => state.selectQuestion);

  // Group questions by phase
  const groupedQuestions = React.useMemo(() => {
    const groups: Record<string, HrQuestionRubricItem[]> = {};
    for (const q of questionsList) {
      const phase = q.phase || 'phase2_elevator_pitch';
      if (!groups[phase]) {
        groups[phase] = [];
      }
      groups[phase].push(q);
    }
    return groups;
  }, [questionsList]);

  const handleQuestionClick = (id: string) => {
    selectQuestion(id);
    if (onSelect) {
      onSelect();
    }
  };

  if (!questionsList.length) {
    return (
      <div className="p-4 text-center text-xs text-slate-400">
        Загрузка матрицы вопросов...
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
          <HelpCircle className="w-3.5 h-3.5 text-pastel-accentRose" />
          <span>Каталог вопросов матрицы ({questionsList.length})</span>
        </span>
      </div>

      <div className="space-y-3">
        {Object.entries(groupedQuestions).map(([phase, items]) => {
          const config = PHASE_LABELS[phase] || {
            label: phase,
            icon: HelpCircle,
            color: 'text-slate-600 bg-slate-50'
          };
          const PhaseIcon = config.icon;

          return (
            <div key={phase} className="space-y-1.5">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider px-1 flex items-center gap-1.5">
                <PhaseIcon className="w-3 h-3 text-pastel-accentRose" />
                <span>{config.label}</span>
              </div>

              <div className="space-y-1">
                {items.map((q) => {
                  const isSelected = q.id === selectedQuestionId;
                  const anchorsCount = q.requiredAnchors?.length || 0;

                  return (
                    <button
                      key={q.id}
                      onClick={() => handleQuestionClick(q.id)}
                      className={`w-full text-left p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 select-none ${
                        isSelected
                          ? 'bg-rose-50/80 border-pastel-accentRose shadow-xs ring-1 ring-pastel-accentRose/30 text-slate-900 font-semibold'
                          : 'bg-white border-slate-200/90 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-xs truncate leading-snug">
                          {q.title}
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400 font-medium">
                          <span className="flex items-center gap-0.5">
                            <Timer className="w-2.5 h-2.5" />
                            {q.targetDurationSec.minSec}–{q.targetDurationSec.maxSec}с
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-0.5">
                            <Tag className="w-2.5 h-2.5" />
                            {anchorsCount} {anchorsCount === 1 ? 'якорь' : 'якорей'}
                          </span>
                        </div>
                      </div>

                      {isSelected && (
                        <div className="shrink-0 text-pastel-accentRose">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
