import React, { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { AcademyCourse, AcademyStep } from '../../types/nextgen';
import { AcademyStepModal } from './AcademyStepModal';
import { NextBestActionCard } from './NextBestActionCard';
import { AcademyCourseCatalog } from './AcademyCourseCatalog';
import { AcademyReadinessRadar } from './AcademyReadinessRadar';
import { AcademyStepFilterBar, StepFilterType } from './AcademyStepFilterBar';
import { AcademyMilestoneAccordion } from './AcademyMilestoneAccordion';

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
        } else {
          setOpenMilestones(new Set(['default_milestone']));
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
    // Optimistic UI update
    setCurrentCourse((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        steps: (prev.steps || []).map((s) =>
          s.stepNumber === stepNumber ? { ...s, isCompleted } : s
        )
      };
    });

    try {
      await toggleAcademyStepProgress(currentCourse.id, stepNumber, isCompleted);
      // Refresh course details to recalculate reactive knowledge graph
      fetchActiveCourseDetails(currentCourse.id);
      fetchCourses();
    } catch (e) {
      console.error('Failed to toggle academy step:', e);
      fetchActiveCourseDetails(currentCourse.id);
    }
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

  // Counts for quick filter badges
  const filterCounts = useMemo(() => {
    let uncompleted = 0;
    let transactions = 0;
    let testingMutation = 0;
    let lld = 0;
    let hld = 0;
    let triage = 0;
    let theory = 0;

    steps.forEach((s) => {
      if (!s.isCompleted) uncompleted++;
      if (s.targetArena === 'transactions') transactions++;
      if (s.targetArena === 'testing_mutation') testingMutation++;
      if (s.targetArena === 'machine_coding' || s.coreRequirements?.lldChallengeSlug) lld++;
      if (s.targetArena === 'system_design' || s.coreRequirements?.hldScenarioId) hld++;
      if (s.targetArena === 'incident_triage' || s.coreRequirements?.triageIncidentId) triage++;
      if (s.targetArena === 'theory' || s.targetArena === 'oral_interview' || s.coreRequirements?.theoryTitle) theory++;
    });

    return { total: steps.length, uncompleted, transactions, testingMutation, lld, hld, triage, theory };
  }, [steps]);

  // Filtered steps based on search and active filter pill
  const filteredSteps = useMemo(() => {
    return steps.filter((step) => {
      // 1. Filter Type
      if (filterType === 'uncompleted' && step.isCompleted) return false;
      if (filterType === 'transactions' && step.targetArena !== 'transactions') return false;
      if (filterType === 'testing_mutation' && step.targetArena !== 'testing_mutation') return false;
      if (filterType === 'lld' && step.targetArena !== 'machine_coding' && !step.coreRequirements?.lldChallengeSlug) return false;
      if (filterType === 'hld' && step.targetArena !== 'system_design' && !step.coreRequirements?.hldScenarioId) return false;
      if (filterType === 'triage' && step.targetArena !== 'incident_triage' && !step.coreRequirements?.triageIncidentId) return false;
      if (filterType === 'theory' && step.targetArena !== 'theory' && step.targetArena !== 'oral_interview' && !step.coreRequirements?.theoryTitle) return false;

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
      {/* 1. Header Banner & Course Cards Grid */}
      <AcademyCourseCatalog
        courses={courses}
        filteredCourses={filteredCourses}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
        careerCount={careerCount}
        domainCount={domainCount}
        activeCourseId={activeAcademyCourseId}
        onSelectCourse={handleCourseChange}
      />

      {/* 2. SOTA Socratic Next Best Action Recommender */}
      {currentCourse && (
        <>
          <NextBestActionCard
            courseId={currentCourse.id}
            courseTitle={currentCourse.title}
            onStepStarted={() => fetchActiveCourseDetails(currentCourse.id)}
          />
          {progress.percentage === 100 && (
            <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-emerald-50 via-teal-50 to-white border border-emerald-200/80 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-600 text-white">
                  🎉 Трек полностью освоен!
                </span>
                <h3 className="text-base sm:text-lg font-bold text-emerald-950">
                  Все {steps.length} шагов программы {currentCourse.title} успешно пройдены
                </h3>
                <p className="text-xs text-emerald-800">
                  Все требования грейда выполнены. Вы можете провести пробное интервью с AI Bar-Raiser в голосовом режиме Gemini Live или выбрать следующий трек.
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {/* 3. Senior Readiness Radar (4 Pillars of Seniority) */}
      {currentCourse && (
        <AcademyReadinessRadar progress={progress} />
      )}

      {/* 4. SOTA 2026 Omni-Toolbar for Academy Syllabus */}
      {currentCourse && (
        <AcademyStepFilterBar
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          filterType={filterType}
          setFilterType={setFilterType}
          filterCounts={filterCounts}
          onExpandAll={expandAllMilestones}
          onCollapseAll={collapseAllMilestones}
        />
      )}

      {/* 5. Structured Milestone Syllabus */}
      {currentCourse && (
        <AcademyMilestoneAccordion
          currentCourse={currentCourse}
          steps={steps}
          filteredSteps={filteredSteps}
          openMilestones={openMilestones}
          toggleMilestone={toggleMilestone}
          activeAcademyStepNumber={activeAcademyStepNumber}
          openAcademyStepModal={openAcademyStepModal}
          handleToggleStep={handleToggleStep}
          searchQuery={searchQuery}
          filterType={filterType}
          onResetFilters={() => {
            setSearchQuery('');
            setFilterType('all');
          }}
        />
      )}

      {/* 6. Modal */}
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
