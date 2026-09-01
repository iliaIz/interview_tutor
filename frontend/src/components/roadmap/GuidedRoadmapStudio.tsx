import React, { useEffect, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { GuidedRoadmap, RoadmapStep } from '../../types/nextgen';
import { 
  CheckCircle2, Circle, ArrowRight, BookOpen, Bug, Code2, 
  Layers, ShieldAlert, Zap, Compass, Award, Sparkles, ChevronRight
} from 'lucide-react';

export const GuidedRoadmapStudio: React.FC = () => {
  const { 
    activeRoadmapId, setActiveRoadmapId,
    activeRoadmapStep, setActiveRoadmapStep,
    completedRoadmapSteps, toggleRoadmapStepCompleted,
    setStudioTab, openPracticeChallenge, showToast
  } = useAppStore();

  const [roadmaps, setRoadmaps] = useState<GuidedRoadmap[]>([]);
  const [currentRoadmap, setCurrentRoadmap] = useState<GuidedRoadmap | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<string>('all');

  useEffect(() => {
    fetch('/api/roadmaps')
      .then(res => res.json())
      .then(data => {
        setRoadmaps(data);
        if (data.length > 0 && !activeRoadmapId) {
          setActiveRoadmapId(data[0].id);
        }
      })
      .catch(err => console.error('Failed to load roadmaps:', err));
  }, []);

  useEffect(() => {
    if (!activeRoadmapId) return;
    setLoading(true);
    fetch(`/api/roadmaps/${activeRoadmapId}`)
      .then(res => res.json())
      .then(data => {
        setCurrentRoadmap(data);
        if (!activeRoadmapStep && data.steps?.length > 0) {
          setActiveRoadmapStep(data.steps[0]);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load roadmap details:', err);
        setLoading(false);
      });
  }, [activeRoadmapId]);

  if (loading || !currentRoadmap) {
    return (
      <div className="flex items-center justify-center min-h-[500px] text-pastel-muted">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-pastel-accentRose border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-mono">Загрузка траектории подготовки...</p>
        </div>
      </div>
    );
  }

  const completedList = completedRoadmapSteps[currentRoadmap.id] || [];
  const completedCount = completedList.length;
  const progressPercent = Math.round((completedCount / currentRoadmap.totalSteps) * 100);

  const getSeniorRank = (pct: number) => {
    if (pct >= 85) return { title: '👑 BigTech Bar-Raiser (Principal Candidate)', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' };
    if (pct >= 50) return { title: '⭐ Solid Senior Ready (Confident Hire)', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' };
    if (pct >= 25) return { title: '📈 Middle+ / Developing Senior', color: 'text-blue-400 bg-blue-500/10 border-blue-500/30' };
    return { title: '🌱 Начало подготовки (Junior / Middle)', color: 'text-slate-400 bg-slate-800 border-slate-700' };
  };

  const rank = getSeniorRank(progressPercent);

  const filteredSteps = selectedMilestoneId === 'all'
    ? currentRoadmap.steps
    : currentRoadmap.steps.filter(s => s.milestoneId === selectedMilestoneId);

  const handleLaunchTheory = (step: RoadmapStep) => {
    setStudioTab('theory');
    showToast({
      type: 'info',
      title: `Шаг ${step.stepNumber}: Теоретический блок`,
      message: `Открыта теория: ${step.title}`
    });
  };

  const handleLaunchTriage = (step: RoadmapStep) => {
    setStudioTab('triage');
    showToast({
      type: 'info',
      title: `Шаг ${step.stepNumber}: Прод-инцидент`,
      message: `Переход к триажу инцидента: ${step.title}`
    });
  };

  const handleLaunchLLD = async (step: RoadmapStep) => {
    if (!step.lldChallengeId) return;
    try {
      const res = await fetch(`/api/practice/challenges/${step.lldChallengeId}`);
      if (res.ok) {
        const data = await res.json();
        setStudioTab('practice');
        openPracticeChallenge(data.challenge, data.savedDraft);
      } else {
        setStudioTab('practice');
      }
    } catch {
      setStudioTab('practice');
    }
  };

  const handleLaunchHLD = (step: RoadmapStep) => {
    setStudioTab('system_design');
    showToast({
      type: 'info',
      title: `Шаг ${step.stepNumber}: System Design HLD`,
      message: `Переход к сценарию: ${step.title}`
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 space-y-6 pb-20">
      {/* Header Program Selector */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-pastel-accentRose/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-pastel-rose/10 text-pastel-accentRose border border-pastel-accentRose/20">
                SOTA 2026 Траектории
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {completedCount} из {currentRoadmap.totalSteps} шагов пройдено
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-tight">
              {currentRoadmap.title}
            </h1>
            <p className="text-sm text-slate-400 mt-1 max-w-2xl">
              {currentRoadmap.description}
            </p>
          </div>

          {/* Program Switcher Tabs */}
          <div className="flex items-center gap-2 bg-slate-950/80 p-1.5 rounded-2xl border border-slate-800 shrink-0">
            {roadmaps.map(rm => {
              const isActive = rm.id === currentRoadmap.id;
              return (
                <button
                  key={rm.id}
                  onClick={() => setActiveRoadmapId(rm.id)}
                  className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-r from-pastel-accentRose/20 to-pastel-accentViolet/20 text-pastel-accentRose border border-pastel-accentRose/40 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  <span>{rm.title.split(':')[0]}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Readiness Index & Progress Bar */}
        <div className="mt-6 pt-6 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex-1 max-w-xl">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-slate-400 font-medium">Senior Readiness Index:</span>
              <span className="font-mono font-bold text-pastel-accentRose">{progressPercent}%</span>
            </div>
            <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
              <div 
                className="h-full bg-gradient-to-r from-pastel-accentRose via-pastel-accentViolet to-emerald-400 transition-all duration-500 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          <div className={`px-3.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-2 ${rank.color}`}>
            <Award className="w-4 h-4 shrink-0" />
            <span>{rank.title}</span>
          </div>
        </div>
      </div>

      {/* Milestone Filters */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar touch-pan-x py-1">
        <button
          onClick={() => setSelectedMilestoneId('all')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
            selectedMilestoneId === 'all'
              ? 'bg-slate-800 text-pastel-accentRose border border-pastel-accentRose/40'
              : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800'
          }`}
        >
          Все шаги ({currentRoadmap.totalSteps})
        </button>
        {currentRoadmap.milestones?.map(m => (
          <button
            key={m.id}
            onClick={() => setSelectedMilestoneId(m.id)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
              selectedMilestoneId === m.id
                ? 'bg-slate-800 text-pastel-accentRose border border-pastel-accentRose/40'
                : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            {m.title}
          </button>
        ))}
      </div>

      {/* Non-Linear Step Matrix & Interactive Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredSteps.map((step) => {
          const isDone = completedList.includes(step.stepNumber);
          const isSelected = activeRoadmapStep?.stepNumber === step.stepNumber;

          return (
            <div
              key={step.stepNumber}
              onClick={() => setActiveRoadmapStep(step)}
              className={`bg-slate-900/90 border rounded-2xl p-4 transition-all duration-200 cursor-pointer flex flex-col justify-between relative group hover:border-slate-700 ${
                isSelected
                  ? 'border-pastel-accentRose/60 ring-1 ring-pastel-accentRose/40 bg-slate-850 shadow-lg'
                  : isDone
                  ? 'border-emerald-500/30 bg-slate-900/50'
                  : 'border-slate-800'
              }`}
            >
              <div>
                {/* Step Card Top: Number & Checkbox */}
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-lg bg-slate-800 text-slate-300 border border-slate-700">
                    Шаг {step.stepNumber} / {currentRoadmap.totalSteps}
                  </span>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleRoadmapStepCompleted(currentRoadmap.id, step.stepNumber);
                    }}
                    className="cursor-pointer text-slate-500 hover:text-emerald-400 transition"
                    title={isDone ? 'Отметить как не пройденный' : 'Отметить как освоенный'}
                  >
                    {isDone ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <Circle className="w-5 h-5 hover:text-slate-300" />
                    )}
                  </button>
                </div>

                {/* Step Title */}
                <h3 className="font-bold text-sm text-slate-100 group-hover:text-pastel-accentRose transition line-clamp-1">
                  {step.title}
                </h3>

                {/* Senior Bar Concept */}
                <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                  {step.seniorBarConcept}
                </p>
              </div>

              {/* Action Buttons Hub */}
              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-1.5">
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleLaunchTheory(step); }}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-pastel-accentRose/20 text-slate-300 hover:text-pastel-accentRose transition cursor-pointer"
                    title="Теория & Voice AI"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleLaunchTriage(step); }}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-pastel-accentViolet/20 text-slate-300 hover:text-pastel-accentViolet transition cursor-pointer"
                    title="Триаж прод-аварии"
                  >
                    <Bug className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleLaunchLLD(step); }}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-400 transition cursor-pointer"
                    title="Machine Coding LLD"
                  >
                    <Code2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleLaunchHLD(step); }}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-blue-500/20 text-slate-300 hover:text-blue-400 transition cursor-pointer"
                    title="System Design HLD"
                  >
                    <Layers className="w-3.5 h-3.5" />
                  </button>
                </div>

                <span className="text-[10px] text-slate-500 font-mono">~{step.estimatedMinutes} мин</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
