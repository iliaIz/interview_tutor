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
    fetch('/api/roadmaps', { credentials: 'include' })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setRoadmaps(data);
          if (!activeRoadmapId) {
            setActiveRoadmapId(data[0].id);
          }
        }
      })
      .catch(err => console.error('Failed to load roadmaps:', err));
  }, []);

  useEffect(() => {
    if (!activeRoadmapId) return;
    setLoading(true);
    fetch(`/api/roadmaps/${activeRoadmapId}`, { credentials: 'include' })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        if (data && Array.isArray(data.steps) && Array.isArray(data.milestones)) {
          setCurrentRoadmap(data);
          if (!activeRoadmapStep && data.steps.length > 0) {
            setActiveRoadmapStep(data.steps[0]);
          }
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load roadmap details:', err);
        setLoading(false);
      });
  }, [activeRoadmapId]);

  if (loading || !currentRoadmap || !Array.isArray(currentRoadmap.steps)) {
    return (
      <div className="flex items-center justify-center min-h-[500px] text-pastel-muted font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-pastel-accentRose border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-mono">Загрузка траектории подготовки...</p>
        </div>
      </div>
    );
  }

  const completedList = completedRoadmapSteps[currentRoadmap.id] || [];
  const completedCount = completedList.length;
  const totalSteps = currentRoadmap.totalSteps || currentRoadmap.steps.length || 1;
  const progressPercent = Math.min(100, Math.round((completedCount / totalSteps) * 100));

  const getSeniorRank = (pct: number) => {
    if (pct >= 85) return { title: '👑 BigTech Bar-Raiser (Principal Candidate)', color: 'text-amber-800 bg-amber-50 border-amber-200' };
    if (pct >= 50) return { title: '⭐ Solid Senior Ready (Confident Hire)', color: 'text-emerald-800 bg-emerald-50 border-emerald-200' };
    if (pct >= 25) return { title: '📈 Middle+ / Developing Senior', color: 'text-blue-800 bg-blue-50 border-blue-200' };
    return { title: '🌱 Начало подготовки (Junior / Middle)', color: 'text-pastel-muted bg-pastel-bg border-pastel-border' };
  };

  const rank = getSeniorRank(progressPercent);

  const stepsList = Array.isArray(currentRoadmap.steps) ? currentRoadmap.steps : [];
  const filteredSteps = selectedMilestoneId === 'all'
    ? stepsList
    : stepsList.filter(s => s.milestoneId === selectedMilestoneId);


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
      const res = await fetch(`/api/practice/challenges/${step.lldChallengeId}`, { credentials: 'include' });
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
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 space-y-6 pb-20 font-sans">
      {/* Header Program Selector */}
      <div className="bg-white/95 border border-pastel-border/80 rounded-3xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-pastel-accentRose/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-pastel-rose text-pastel-accentRose border border-pastel-accentRose/30">
                SOTA 2026 Траектории
              </span>
              <span className="text-xs text-pastel-muted font-mono">
                {completedCount} из {currentRoadmap.totalSteps} шагов пройдено
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-pastel-text tracking-tight">
              {currentRoadmap.title}
            </h1>
            <p className="text-sm text-pastel-muted mt-1 max-w-2xl">
              {currentRoadmap.description}
            </p>
          </div>

          {/* Program Switcher Tabs */}
          <div className="flex items-center gap-2 bg-pastel-bg/80 p-1.5 rounded-2xl border border-pastel-border shrink-0">
            {roadmaps.map(rm => {
              const isActive = rm.id === currentRoadmap.id;
              return (
                <button
                  key={rm.id}
                  onClick={() => setActiveRoadmapId(rm.id)}
                  className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-r from-pastel-accentRose/20 to-pastel-accentViolet/20 text-pastel-accentRose border border-pastel-accentRose/40 shadow-sm'
                      : 'text-pastel-muted hover:text-pastel-text hover:bg-white/80'
                  }`}
                >
                  <span>{rm.title.split(':')[0]}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Readiness Index & Progress Bar */}
        <div className="mt-6 pt-6 border-t border-pastel-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex-1 max-w-xl">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-pastel-muted font-medium">Senior Readiness Index:</span>
              <span className="font-mono font-bold text-pastel-accentRose">{progressPercent}%</span>
            </div>
            <div className="w-full h-2.5 bg-pastel-bg rounded-full overflow-hidden border border-pastel-border">
              <div 
                className="h-full bg-gradient-to-r from-pastel-accentRose via-pastel-accentViolet to-emerald-400 transition-all duration-500 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          <div className={`px-3.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-2 shadow-2xs ${rank.color}`}>
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
              ? 'bg-white text-pastel-accentRose border border-pastel-accentRose/40 shadow-sm'
              : 'bg-white/70 text-pastel-muted hover:text-pastel-text border border-pastel-border'
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
                ? 'bg-white text-pastel-accentRose border border-pastel-accentRose/40 shadow-sm'
                : 'bg-white/70 text-pastel-muted hover:text-pastel-text border border-pastel-border'
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
              className={`bg-white/95 border rounded-2xl p-4 transition-all duration-200 cursor-pointer flex flex-col justify-between relative group hover:shadow-md ${
                isSelected
                  ? 'border-pastel-accentRose ring-2 ring-pastel-accentRose/30 bg-pastel-rose/20 shadow-md'
                  : isDone
                  ? 'border-emerald-200/80 bg-emerald-50/30'
                  : 'border-pastel-border/80 shadow-2xs'
              }`}
            >
              <div>
                {/* Step Card Top: Number & Checkbox */}
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-lg bg-pastel-bg text-pastel-muted border border-pastel-border">
                    Шаг {step.stepNumber} / {currentRoadmap.totalSteps}
                  </span>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleRoadmapStepCompleted(currentRoadmap.id, step.stepNumber);
                    }}
                    className="cursor-pointer text-pastel-muted hover:text-emerald-600 transition"
                    title={isDone ? 'Отметить как не пройденный' : 'Отметить как освоенный'}
                  >
                    {isDone ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 fill-emerald-50" />
                    ) : (
                      <Circle className="w-5 h-5 hover:text-emerald-500" />
                    )}
                  </button>
                </div>

                {/* Step Title & Details */}
                <h3 className="font-bold text-sm text-pastel-text leading-snug group-hover:text-pastel-accentRose transition-colors">
                  {step.title}
                </h3>
                <p className="text-xs text-pastel-muted mt-1 line-clamp-2 leading-relaxed">
                  {step.seniorBarConcept}
                </p>
              </div>

              {/* Step Badges & Action Links */}
              <div className="mt-4 pt-3 border-t border-pastel-border/60 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {step.theoryQuestionId && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 text-pastel-accentViolet border border-purple-200 flex items-center gap-1">
                      <BookOpen className="w-3 h-3" /> Теория
                    </span>
                  )}
                  {step.lldChallengeId && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                      <Code2 className="w-3 h-3" /> LLD Код
                    </span>
                  )}
                  {step.hldScenarioId && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1">
                      <Layers className="w-3 h-3" /> System Design
                    </span>
                  )}
                  {step.incidentKataId && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3" /> Авария
                    </span>
                  )}
                </div>

                <span className="text-[11px] font-mono text-pastel-muted font-bold">
                  {step.estimatedMinutes} мин
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Active Step Dedicated Studio Launcher Bar */}
      {activeRoadmapStep && (
        <div className="bg-white/95 border border-pastel-border/80 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-pastel-rose text-pastel-accentRose">
                Выбранный шаг #{activeRoadmapStep.stepNumber}
              </span>
              <span className="text-xs text-pastel-muted font-mono">{activeRoadmapStep.milestoneId}</span>
            </div>
            <h4 className="font-bold text-base text-pastel-text">{activeRoadmapStep.title}</h4>
            <p className="text-xs text-pastel-muted max-w-3xl">{activeRoadmapStep.seniorBarConcept}</p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {activeRoadmapStep.theoryQuestionId && (
              <button
                onClick={() => handleLaunchTheory(activeRoadmapStep)}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet hover:opacity-95 transition shadow-sm cursor-pointer"
              >
                <BookOpen className="w-4 h-4" />
                <span>Открыть теорию</span>
              </button>
            )}

            {activeRoadmapStep.lldChallengeId && (
              <button
                onClick={() => handleLaunchLLD(activeRoadmapStep)}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-95 transition shadow-sm cursor-pointer"
              >
                <Code2 className="w-4 h-4" />
                <span>Запустить LLD Арену</span>
              </button>
            )}

            {activeRoadmapStep.hldScenarioId && (
              <button
                onClick={() => handleLaunchHLD(activeRoadmapStep)}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-pastel-accentViolet hover:opacity-95 transition shadow-sm cursor-pointer"
              >
                <Layers className="w-4 h-4" />
                <span>Запустить System Design</span>
              </button>
            )}

            {activeRoadmapStep.incidentKataId && (
              <button
                onClick={() => handleLaunchTriage(activeRoadmapStep)}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-rose-600 to-pink-600 hover:opacity-95 transition shadow-sm cursor-pointer"
              >
                <ShieldAlert className="w-4 h-4" />
                <span>Начать триаж инцидента</span>
              </button>
            )}
          </div>

        </div>
      )}
    </div>
  );
};
