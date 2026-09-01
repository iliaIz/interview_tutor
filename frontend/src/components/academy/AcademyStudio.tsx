import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { AcademyCourse, AcademyStep } from '../../types/nextgen';
import { AcademyStepModal } from './AcademyStepModal';
import { 
  Sparkles, 
  Compass, 
  CheckCircle2, 
  Circle, 
  ArrowRight, 
  Flame, 
  ShieldCheck, 
  Clock, 
  Layers, 
  Code2, 
  Terminal, 
  BookOpen, 
  Award,
  Zap,
  Target,
  Cpu,
  Database,
  Search,
  Activity
} from 'lucide-react';

export const AcademyStudio: React.FC = () => {
  const { 
    activeAcademyCourseId, 
    setActiveAcademyCourseId,
    activeAcademyStepModal,
    openAcademyStepModal,
    closeAcademyStepModal,
    toggleAcademyStepProgress
  } = useAppStore();

  const [courses, setCourses] = useState<AcademyCourse[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<'career' | 'domain'>('career');
  const [currentCourse, setCurrentCourse] = useState<AcademyCourse | null>(null);
  const [activeMilestoneId, setActiveMilestoneId] = useState<string>('all');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Fetch all courses catalog
  const fetchCourses = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/roadmaps', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setCourses(data);
        }
      }
    } catch (e) {
      console.error('Failed to load academy courses:', e);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch active course details
  const fetchActiveCourseDetails = async (courseId: string) => {
    try {
      const res = await fetch(`/api/roadmaps/${courseId}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setCurrentCourse(data);
      }
    } catch (e) {
      console.error('Failed to load course details:', e);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  useEffect(() => {
    if (activeAcademyCourseId) {
      fetchActiveCourseDetails(activeAcademyCourseId);
    }
  }, [activeAcademyCourseId]);

  const handleCourseChange = (id: string) => {
    setActiveAcademyCourseId(id);
    setActiveMilestoneId('all');
  };

  const handleToggleStep = async (stepNumber: number, isCompleted: boolean) => {
    if (!currentCourse) return;
    await toggleAcademyStepProgress(currentCourse.id, stepNumber, isCompleted);
    // Refresh course details to recalculate reactive knowledge graph
    fetchActiveCourseDetails(currentCourse.id);
    fetchCourses();
  };

  const filteredCourses = courses.filter(c => c.category === selectedCategory);

  // Determine current active focus step (first uncompleted step)
  const steps = currentCourse?.steps || [];
  const nextFocusStep = steps.find(s => !s.isCompleted) || steps[0];

  const filteredSteps = steps.filter(step => {
    const matchesMilestone = activeMilestoneId === 'all' || step.milestoneId === activeMilestoneId;
    const matchesSearch = !searchQuery.trim() || 
      step.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      step.seniorBarConcept.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesMilestone && matchesSearch;
  });

  const progress = currentCourse?.userProgress || {
    completedSteps: [],
    currentStep: 1,
    percentage: 0,
    rank: '🌱 Начало подготовки',
    pillars: { concurrency: 0, databases: 0, systemDesign: 0, forensics: 0 }
  };

  const careerCount = courses.filter(c => c.category === 'career').length;
  const domainCount = courses.filter(c => c.category === 'domain').length;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8 space-y-8 animate-fade-in relative z-10">

      {/* 1. Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-pastel-border/60">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-pastel-accentRose to-pastel-accentViolet text-white flex items-center justify-center shadow-xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-pastel-text tracking-tight">
              Академия Мастерства
            </h1>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-pastel-rose text-pastel-accentRose border border-pastel-accentRose/20">
              {courses.length || 6} Программ 2026
            </span>
          </div>
          <p className="text-xs sm:text-sm text-pastel-muted font-medium">
            Сквозная траектория подготовки к Bar-Raiser интервью на грейды Senior & Staff в BigTech
          </p>
        </div>

        {/* Category Switcher: Career vs Domain */}
        <div className="flex items-center bg-white/80 p-1.5 rounded-2xl border border-pastel-border shadow-2xs self-start md:self-auto">
          <button
            onClick={() => setSelectedCategory('career')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
              selectedCategory === 'career'
                ? 'bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet text-white shadow-xs'
                : 'text-pastel-muted hover:text-pastel-text hover:bg-pastel-bg'
            }`}
          >
            <Target className="w-3.5 h-3.5" />
            <span>Карьерные Спринты ({careerCount})</span>
          </button>
          <button
            onClick={() => setSelectedCategory('domain')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
              selectedCategory === 'domain'
                ? 'bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet text-white shadow-xs'
                : 'text-pastel-muted hover:text-pastel-text hover:bg-pastel-bg'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Доменные Треки ({domainCount})</span>
          </button>
        </div>
      </div>

      {/* 2. Course Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCourses.map((course) => {
          const isSelected = activeAcademyCourseId === course.id;
          const userProg = course.userProgress || { percentage: 0, completedCount: 0 };

          return (
            <div
              key={course.id}
              onClick={() => handleCourseChange(course.id)}
              className={`p-5 rounded-3xl border transition-all duration-300 cursor-pointer relative overflow-hidden flex flex-col justify-between gap-4 ${
                isSelected
                  ? 'bg-white shadow-lg border-pastel-accentRose/50 ring-2 ring-pastel-accentRose/20'
                  : 'bg-white/70 hover:bg-white border-pastel-border hover:border-pastel-accentRose/30 shadow-2xs hover:shadow-sm'
              }`}
            >
              {/* Card Header */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-pastel-bg text-pastel-accentRose border border-pastel-border font-mono">
                    {course.badge}
                  </span>
                  <span className="text-[11px] font-bold text-pastel-muted flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {course.estimatedDuration}
                  </span>
                </div>
                <h3 className="font-bold text-sm sm:text-base text-pastel-text leading-snug">
                  {course.title}
                </h3>
                <p className="text-xs text-pastel-muted line-clamp-2 leading-relaxed">
                  {course.description}
                </p>
              </div>

              {/* Progress Footer */}
              <div className="pt-3 border-t border-pastel-border/50 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-pastel-rose/40 flex items-center justify-center font-bold text-xs text-pastel-accentRose">
                    {userProg.percentage}%
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-pastel-text">
                      {userProg.completedCount || (userProg as any).completedSteps?.length || 0} из {course.totalSteps} шагов
                    </p>
                    <p className="text-[10px] text-pastel-muted">{course.milestonesCount} майлстоунов</p>
                  </div>
                </div>

                <div className={`px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1 ${
                  isSelected 
                    ? 'bg-pastel-accentRose text-white' 
                    : 'bg-pastel-bg text-pastel-text hover:bg-pastel-rose hover:text-pastel-accentRose'
                }`}>
                  <span>{isSelected ? 'Активен' : 'Выбрать'}</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. Hero Focus Unit (Zero-Friction Resume) */}
      {nextFocusStep && currentCourse && (
        <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-white/95 via-pastel-rose/25 to-pastel-lavender/25 border border-pastel-accentRose/30 shadow-md backdrop-blur-xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-1.5 relative z-10">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-pastel-accentRose text-white shadow-2xs">
                Рекомендуемый фокус сейчас
              </span>
              <span className="text-[11px] font-mono font-bold text-pastel-muted">
                {currentCourse.title} • Шаг #{nextFocusStep.stepNumber}
              </span>
            </div>
            <h2 className="text-base sm:text-xl font-bold text-pastel-text">
              {nextFocusStep.title}
            </h2>
            <p className="text-xs sm:text-sm text-pastel-accentRose font-medium">
              💡 {nextFocusStep.seniorBarConcept}
            </p>
          </div>

          <button
            onClick={() => openAcademyStepModal(nextFocusStep)}
            className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl text-xs sm:text-sm font-bold bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet text-white shadow-md shadow-pastel-accentRose/20 hover:opacity-95 transition cursor-pointer shrink-0"
          >
            <span>Продолжить обучение: Шаг #{nextFocusStep.stepNumber}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 4. Senior Readiness Radar (4 Pillars of Seniority) */}
      {currentCourse && (
        <div className="p-5 sm:p-6 rounded-3xl bg-white/80 border border-pastel-border/80 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="font-bold text-sm sm:text-base text-pastel-text flex items-center gap-2">
                <Activity className="w-4 h-4 text-pastel-accentRose" />
                <span>Senior Readiness Matrix (4 Столпа Компетенций)</span>
              </h3>
              <p className="text-xs text-pastel-muted">Объективный скоринг готовности к реальным собеседованиям в BigTech</p>
            </div>
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-pastel-lavender text-pastel-accentViolet border border-pastel-accentViolet/20 self-start sm:self-auto">
              Ранг: {progress.rank || '🌱 Начало подготовки'}
            </span>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
            {/* Pillar 1: Concurrency */}
            <div className="p-3.5 rounded-2xl bg-pastel-bg/60 border border-pastel-border/60 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-pastel-text">
                <span className="flex items-center gap-1.5"><Cpu className="w-3.5 h-3.5 text-indigo-500" /> JMM & Loom</span>
                <span>{progress.pillars?.concurrency ?? progress.percentage}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-white overflow-hidden border border-pastel-border/40">
                <div 
                  className="h-full bg-gradient-to-r from-indigo-400 to-indigo-600 rounded-full transition-all duration-500"
                  style={{ width: `${progress.pillars?.concurrency ?? progress.percentage}%` }}
                />
              </div>
            </div>

            {/* Pillar 2: Databases & Transactions */}
            <div className="p-3.5 rounded-2xl bg-pastel-bg/60 border border-pastel-border/60 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-pastel-text">
                <span className="flex items-center gap-1.5"><Database className="w-3.5 h-3.5 text-blue-500" /> Базы & ACID</span>
                <span>{progress.pillars?.databases ?? progress.percentage}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-white overflow-hidden border border-pastel-border/40">
                <div 
                  className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full transition-all duration-500"
                  style={{ width: `${progress.pillars?.databases ?? progress.percentage}%` }}
                />
              </div>
            </div>

            {/* Pillar 3: System Design */}
            <div className="p-3.5 rounded-2xl bg-pastel-bg/60 border border-pastel-border/60 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-pastel-text">
                <span className="flex items-center gap-1.5"><Layers className="w-3.5 h-3.5 text-purple-500" /> System Design</span>
                <span>{progress.pillars?.systemDesign ?? progress.percentage}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-white overflow-hidden border border-pastel-border/40">
                <div 
                  className="h-full bg-gradient-to-r from-purple-400 to-purple-600 rounded-full transition-all duration-500"
                  style={{ width: `${progress.pillars?.systemDesign ?? progress.percentage}%` }}
                />
              </div>
            </div>

            {/* Pillar 4: Forensics */}
            <div className="p-3.5 rounded-2xl bg-pastel-bg/60 border border-pastel-border/60 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-pastel-text">
                <span className="flex items-center gap-1.5"><Terminal className="w-3.5 h-3.5 text-rose-500" /> Триаж Дампов</span>
                <span>{progress.pillars?.forensics ?? progress.percentage}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-white overflow-hidden border border-pastel-border/40">
                <div 
                  className="h-full bg-gradient-to-r from-rose-400 to-rose-600 rounded-full transition-all duration-500"
                  style={{ width: `${progress.pillars?.forensics ?? progress.percentage}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. Milestones Filter Bar */}
      {currentCourse && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full custom-scrollbar">
              <button
                onClick={() => setActiveMilestoneId('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  activeMilestoneId === 'all'
                    ? 'bg-pastel-text text-white shadow-xs'
                    : 'bg-white text-pastel-muted hover:text-pastel-text border border-pastel-border'
                }`}
              >
                Все шаги ({currentCourse.totalSteps})
              </button>
              {(currentCourse.milestones || []).map((m) => (
                <button
                  key={m.id}
                  onClick={() => setActiveMilestoneId(m.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                    activeMilestoneId === m.id
                      ? 'bg-pastel-accentRose text-white shadow-xs'
                      : 'bg-white text-pastel-muted hover:text-pastel-text border border-pastel-border'
                  }`}
                >
                  {m.title}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative min-w-[200px] sm:w-64">
              <Search className="w-3.5 h-3.5 text-pastel-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск по теме или концепту..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white rounded-xl border border-pastel-border text-pastel-text placeholder-pastel-muted focus:outline-hidden focus:border-pastel-accentRose/50"
              />
            </div>
          </div>

          {/* 6. Step Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSteps.map((step) => {
              const isCompleted = Boolean(step.isCompleted);
              const core = step.coreRequirements || {};

              return (
                <div
                  key={step.stepNumber}
                  onClick={() => openAcademyStepModal(step)}
                  className={`p-5 rounded-3xl border transition-all duration-200 cursor-pointer flex flex-col justify-between gap-4 relative overflow-hidden group ${
                    isCompleted
                      ? 'bg-white/95 border-emerald-200/80 shadow-xs hover:border-emerald-300'
                      : 'bg-white/80 hover:bg-white border-pastel-border/80 hover:border-pastel-accentRose/40 shadow-2xs hover:shadow-md'
                  }`}
                >
                  {/* Top Meta */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pastel-rose text-pastel-accentRose border border-pastel-accentRose/20">
                          #{step.stepNumber}
                        </span>
                        <span className="text-[10px] text-pastel-muted font-medium flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5" /> ~{step.estimatedMinutes}м
                        </span>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleStep(step.stepNumber, !isCompleted);
                        }}
                        className="p-1 rounded-full text-pastel-muted hover:text-emerald-600 transition"
                        title={isCompleted ? "Отменить зачёт" : "Отметить выполненным"}
                      >
                        {isCompleted ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-500 fill-emerald-50" />
                        ) : (
                          <Circle className="w-5 h-5 text-pastel-muted/50 hover:text-pastel-accentRose" />
                        )}
                      </button>
                    </div>

                    <h4 className="font-bold text-sm text-pastel-text group-hover:text-pastel-accentRose transition-colors line-clamp-1">
                      {step.title}
                    </h4>
                    <p className="text-xs text-pastel-muted line-clamp-2 leading-relaxed">
                      💡 {step.seniorBarConcept}
                    </p>
                  </div>

                  {/* Core Requirements Badges */}
                  <div className="pt-3 border-t border-pastel-border/40 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
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

                    <span className="text-[11px] font-bold text-pastel-accentRose opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                      Открыть <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 7. Modal */}
      {activeAcademyStepModal && currentCourse && (
        <AcademyStepModal
          step={activeAcademyStepModal}
          courseId={currentCourse.id}
          courseTitle={currentCourse.title}
          onClose={closeAcademyStepModal}
          onToggleCompleted={handleToggleStep}
        />
      )}

    </div>
  );
};
