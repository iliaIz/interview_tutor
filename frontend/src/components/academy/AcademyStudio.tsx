import React, { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { AcademyCourse, AcademyStep } from '../../types/nextgen';
import { AcademyStepModal } from './AcademyStepModal';
import { 
  Sparkles, 
  CheckCircle2, 
  Circle, 
  ArrowRight, 
  Clock, 
  Layers, 
  Code2, 
  Terminal, 
  BookOpen, 
  Target, 
  Cpu, 
  Database, 
  Search, 
  Activity,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Filter,
  CheckCheck,
  RotateCcw,
  Flame
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type StepFilterType = 'all' | 'uncompleted' | 'lld' | 'hld' | 'triage' | 'theory';

export const AcademyStudio: React.FC = () => {
  const { 
    activeAcademyCourseId, 
    setActiveAcademyCourseId,
    activeAcademyStepNumber,
    activeAcademyStepModal,
    openAcademyStepModal,
    closeAcademyStepModal,
    toggleAcademyStepProgress
  } = useAppStore();

  const [courses, setCourses] = useState<AcademyCourse[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<'career' | 'domain'>('career');
  const [currentCourse, setCurrentCourse] = useState<AcademyCourse | null>(null);
  const [openMilestones, setOpenMilestones] = useState<Set<string>>(new Set());
  const [filterType, setFilterType] = useState<StepFilterType>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

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

        // Auto-expand milestones: prioritize active step, then first uncompleted
        if (data.milestones && data.milestones.length > 0) {
          let activeMid = data.milestones[0].id;
          if (activeAcademyStepNumber) {
            const step = (data.steps || []).find((s: AcademyStep) => s.stepNumber === activeAcademyStepNumber);
            if (step?.milestoneId) activeMid = step.milestoneId;
          } else {
            const firstUncompleted = (data.steps || []).find((s: AcademyStep) => !s.isCompleted);
            if (firstUncompleted) activeMid = firstUncompleted.milestoneId;
          }
          
          setOpenMilestones((prev) => {
            const next = new Set(prev);
            next.add(activeMid);
            return next;
          });
        }
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

  // Smooth scroll to active step when returning from practice
  useEffect(() => {
    if (!isLoading && activeAcademyStepNumber && currentCourse) {
      const el = document.getElementById(`academy-step-${activeAcademyStepNumber}`);
      if (el) {
        const timer = setTimeout(() => {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 180);
        return () => clearTimeout(timer);
      }
    }
  }, [isLoading, activeAcademyStepNumber, currentCourse, openMilestones]);

  const handleCourseChange = (id: string) => {
    setActiveAcademyCourseId(id);
    setOpenMilestones(new Set());
    setFilterType('all');
    setSearchQuery('');
  };

  const handleToggleStep = async (stepNumber: number, isCompleted: boolean) => {
    if (!currentCourse) return;
    await toggleAcademyStepProgress(currentCourse.id, stepNumber, isCompleted);
    // Refresh course details to recalculate reactive knowledge graph
    fetchActiveCourseDetails(currentCourse.id);
    fetchCourses();
  };

  const toggleMilestone = (mid: string) => {
    setOpenMilestones((prev) => {
      const next = new Set(prev);
      if (next.has(mid)) {
        next.delete(mid);
      } else {
        next.add(mid);
      }
      return next;
    });
  };

  const expandAllMilestones = () => {
    if (!currentCourse?.milestones) return;
    setOpenMilestones(new Set(currentCourse.milestones.map((m) => m.id)));
  };

  const collapseAllMilestones = () => {
    setOpenMilestones(new Set());
  };

  const filteredCourses = courses.filter((c) => c.category === selectedCategory);

  // All steps for current course
  const steps = useMemo(() => currentCourse?.steps || [], [currentCourse]);
  const nextFocusStep = useMemo(() => steps.find((s) => !s.isCompleted) || steps[0], [steps]);

  // Counts for quick filter badges
  const filterCounts = useMemo(() => {
    let uncompleted = 0;
    let lld = 0;
    let hld = 0;
    let triage = 0;
    let theory = 0;

    steps.forEach((s) => {
      if (!s.isCompleted) uncompleted++;
      if (s.coreRequirements?.lldChallengeSlug) lld++;
      if (s.coreRequirements?.hldScenarioId) hld++;
      if (s.coreRequirements?.triageIncidentId) triage++;
      if (s.coreRequirements?.theoryTitle) theory++;
    });

    return { total: steps.length, uncompleted, lld, hld, triage, theory };
  }, [steps]);

  // Filtered steps based on search and active filter pill
  const filteredSteps = useMemo(() => {
    return steps.filter((step) => {
      // 1. Filter Type
      if (filterType === 'uncompleted' && step.isCompleted) return false;
      if (filterType === 'lld' && !step.coreRequirements?.lldChallengeSlug) return false;
      if (filterType === 'hld' && !step.coreRequirements?.hldScenarioId) return false;
      if (filterType === 'triage' && !step.coreRequirements?.triageIncidentId) return false;
      if (filterType === 'theory' && !step.coreRequirements?.theoryTitle) return false;

      // 2. Search Query
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const numMatch = `#${step.stepNumber}` === q || String(step.stepNumber) === q;
      const titleMatch = step.title.toLowerCase().includes(q);
      const conceptMatch = step.seniorBarConcept.toLowerCase().includes(q);
      const theoryMatch = step.coreRequirements?.theoryTitle?.toLowerCase().includes(q) || false;

      return numMatch || titleMatch || conceptMatch || theoryMatch;
    });
  }, [steps, filterType, searchQuery]);

  // Auto-expand all milestones when search query is active
  useEffect(() => {
    if (searchQuery.trim() && currentCourse?.milestones) {
      setOpenMilestones(new Set(currentCourse.milestones.map((m) => m.id)));
    }
  }, [searchQuery, currentCourse]);

  const progress = currentCourse?.userProgress || {
    completedSteps: [],
    currentStep: 1,
    percentage: 0,
    rank: '🌱 Начало подготовки',
    pillars: { concurrency: 0, databases: 0, systemDesign: 0, forensics: 0 }
  };

  const careerCount = courses.filter((c) => c.category === 'career').length;
  const domainCount = courses.filter((c) => c.category === 'domain').length;

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 py-6 sm:py-8 space-y-8 animate-fade-in relative z-10 font-sans">

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

      {/* 5. SOTA 2026 Omni-Toolbar for Academy Syllabus */}
      {currentCourse && (
        <div className="p-4 rounded-3xl bg-white/90 border border-pastel-border shadow-xs space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            
            {/* Search Input */}
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 text-pastel-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск по шагам, темам и Bar-Raiser концептам (например, Virtual Threads, JMM, MVCC)..."
                className="w-full pl-9 pr-8 py-2 text-xs bg-pastel-bg/60 rounded-xl border border-pastel-border text-pastel-text placeholder-pastel-muted focus:outline-hidden focus:border-pastel-accentRose/50 transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-pastel-muted hover:text-pastel-text p-1 cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Expand / Collapse All Accordions */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={expandAllMilestones}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-pastel-bg hover:bg-pastel-rose/30 text-pastel-muted hover:text-pastel-text border border-pastel-border transition cursor-pointer"
                title="Развернуть все майлстоуны"
              >
                <ChevronsUpDown className="w-3.5 h-3.5 text-pastel-accentRose" />
                <span className="hidden sm:inline">Развернуть все</span>
              </button>
              <button
                onClick={collapseAllMilestones}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-pastel-bg hover:bg-pastel-rose/30 text-pastel-muted hover:text-pastel-text border border-pastel-border transition cursor-pointer"
                title="Свернуть все майлстоуны"
              >
                <ChevronUp className="w-3.5 h-3.5 text-pastel-muted" />
                <span className="hidden sm:inline">Свернуть все</span>
              </button>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs font-bold">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer shrink-0 flex items-center gap-1 ${
                filterType === 'all'
                  ? 'bg-pastel-text text-white shadow-2xs'
                  : 'bg-pastel-bg text-pastel-muted hover:text-pastel-text border border-pastel-border/60'
              }`}
            >
              <span>Все шаги ({filterCounts.total})</span>
            </button>

            <button
              onClick={() => setFilterType('uncompleted')}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer shrink-0 flex items-center gap-1 ${
                filterType === 'uncompleted'
                  ? 'bg-pastel-accentRose text-white shadow-2xs'
                  : 'bg-pastel-bg text-pastel-muted hover:text-pastel-text border border-pastel-border/60'
              }`}
            >
              <Flame className="w-3 h-3 text-amber-500" />
              <span>В фокусе ({filterCounts.uncompleted})</span>
            </button>

            <button
              onClick={() => setFilterType('lld')}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer shrink-0 flex items-center gap-1 ${
                filterType === 'lld'
                  ? 'bg-purple-600 text-white shadow-2xs'
                  : 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200'
              }`}
            >
              <Code2 className="w-3 h-3" />
              <span>Кодинг LLD ({filterCounts.lld})</span>
            </button>

            <button
              onClick={() => setFilterType('hld')}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer shrink-0 flex items-center gap-1 ${
                filterType === 'hld'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200'
              }`}
            >
              <Layers className="w-3 h-3" />
              <span>Архитектура HLD ({filterCounts.hld})</span>
            </button>

            <button
              onClick={() => setFilterType('triage')}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer shrink-0 flex items-center gap-1 ${
                filterType === 'triage'
                  ? 'bg-rose-600 text-white shadow-2xs'
                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
              }`}
            >
              <Terminal className="w-3 h-3" />
              <span>Дампы & Триаж ({filterCounts.triage})</span>
            </button>

            <button
              onClick={() => setFilterType('theory')}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer shrink-0 flex items-center gap-1 ${
                filterType === 'theory'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
              }`}
            >
              <BookOpen className="w-3 h-3" />
              <span>Теория ({filterCounts.theory})</span>
            </button>
          </div>
        </div>
      )}

      {/* 6. Structured Milestone Syllabus (Option B: Milestone-Grouped Accordions) */}
      {currentCourse && (
        <div className="space-y-6">
          {(currentCourse.milestones || []).map((milestone, mIdx) => {
            // All steps belonging to this milestone
            const milestoneAllSteps = steps.filter((s) => s.milestoneId === milestone.id);
            // Steps visible after search/filters
            const milestoneVisibleSteps = filteredSteps.filter((s) => s.milestoneId === milestone.id);

            // If a search or filter is active and 0 matching steps, hide this milestone
            if ((searchQuery.trim() || filterType !== 'all') && milestoneVisibleSteps.length === 0) {
              return null;
            }

            const totalInMilestone = milestoneAllSteps.length;
            const completedInMilestone = milestoneAllSteps.filter((s) => s.isCompleted).length;
            const percentage = totalInMilestone > 0 ? Math.round((completedInMilestone / totalInMilestone) * 100) : 0;
            const isMilestoneCompleted = totalInMilestone > 0 && completedInMilestone === totalInMilestone;
            const isOpen = openMilestones.has(milestone.id);

            return (
              <div 
                key={milestone.id}
                className="rounded-3xl border border-pastel-border/80 bg-white/70 backdrop-blur-md overflow-hidden shadow-2xs transition-all duration-200"
              >
                {/* Milestone Accordion Header */}
                <button
                  onClick={() => toggleMilestone(milestone.id)}
                  className={`w-full p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left transition-colors cursor-pointer select-none ${
                    isOpen ? 'bg-white/95 border-b border-pastel-border/60' : 'hover:bg-white/90'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                      isMilestoneCompleted
                        ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                        : 'bg-pastel-rose text-pastel-accentRose border border-pastel-accentRose/20'
                    }`}>
                      {isMilestoneCompleted ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <span>M{mIdx + 1}</span>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm sm:text-base font-bold text-pastel-text">
                          {milestone.title}
                        </h3>
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
                    {/* Mini Progress Bar */}
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
                      {isOpen ? (
                        <ChevronUp className="w-4 h-4 text-pastel-accentRose" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
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
                              onClick={() => openAcademyStepModal(step)}
                              className={`card-content-visibility p-4 sm:p-5 rounded-3xl border transition-all duration-200 cursor-pointer flex flex-col justify-between gap-4 relative overflow-hidden group ${
                                activeAcademyStepNumber === step.stepNumber
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
                                      handleToggleStep(step.stepNumber, !isCompleted);
                                    }}
                                    className="p-2 -m-1 rounded-xl text-pastel-muted hover:text-emerald-600 transition cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center touch-manipulation focus:outline-hidden"
                                    title={isCompleted ? "Отменить зачёт" : "Отметить выполненным"}
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
          })}

          {/* Empty Search State */}
          {filteredSteps.length === 0 && (
            <div className="p-8 rounded-3xl bg-white border border-pastel-border text-center space-y-3 shadow-xs">
              <div className="w-12 h-12 rounded-2xl bg-pastel-rose/50 text-pastel-accentRose flex items-center justify-center mx-auto">
                <Search className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-base text-pastel-text">Шаги не найдены</h3>
              <p className="text-xs text-pastel-muted max-w-md mx-auto">
                По запросу «{searchQuery}» с фильтром «{filterType}» ничего не найдено. Попробуйте изменить параметры поиска.
              </p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setFilterType('all');
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-pastel-accentRose text-white hover:opacity-90 transition cursor-pointer"
              >
                Сбросить фильтры
              </button>
            </div>
          )}
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
