import React, { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { AcademyCourse, AcademyStep } from '../../types/nextgen';
import { AcademyStepModal } from './AcademyStepModal';
import { NextBestActionCard } from './NextBestActionCard';
import { AcademyHeader } from './studio/AcademyHeader';
import { AcademyCourseGrid } from './studio/AcademyCourseGrid';
import { AcademyReadinessRadar } from './studio/AcademyReadinessRadar';
import { AcademyOmniToolbar, StepFilterType } from './studio/AcademyOmniToolbar';
import { AcademyMilestoneAccordion } from './studio/AcademyMilestoneAccordion';
import { Search } from 'lucide-react';

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

  const fetchActiveCourseDetails = async (courseId: string) => {
    try {
      const res = await fetch(`/api/roadmaps/${courseId}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setCurrentCourse(data);

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
    void fetchCourses();
  }, []);

  useEffect(() => {
    if (activeAcademyCourseId) {
      void fetchActiveCourseDetails(activeAcademyCourseId);
    }
  }, [activeAcademyCourseId]);

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
      void fetchActiveCourseDetails(currentCourse.id);
      void fetchCourses();
    } catch (e) {
      console.error('Failed to toggle academy step:', e);
      void fetchActiveCourseDetails(currentCourse.id);
    }
  };

  const toggleMilestone = (mid: string) => {
    setOpenMilestones((prev) => {
      const next = new Set(prev);
      if (next.has(mid)) next.delete(mid);
      else next.add(mid);
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
  const steps = useMemo(() => currentCourse?.steps || [], [currentCourse]);

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

  const filteredSteps = useMemo(() => {
    return steps.filter((step) => {
      if (filterType === 'uncompleted' && step.isCompleted) return false;
      if (filterType === 'transactions' && step.targetArena !== 'transactions') return false;
      if (filterType === 'testing_mutation' && step.targetArena !== 'testing_mutation') return false;
      if (filterType === 'lld' && step.targetArena !== 'machine_coding' && !step.coreRequirements?.lldChallengeSlug) return false;
      if (filterType === 'hld' && step.targetArena !== 'system_design' && !step.coreRequirements?.hldScenarioId) return false;
      if (filterType === 'triage' && step.targetArena !== 'incident_triage' && !step.coreRequirements?.triageIncidentId) return false;
      if (filterType === 'theory' && step.targetArena !== 'theory' && step.targetArena !== 'oral_interview' && !step.coreRequirements?.theoryTitle) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const numMatch = `#${step.stepNumber}` === q || String(step.stepNumber) === q;
      const titleMatch = step.title.toLowerCase().includes(q);
      const conceptMatch = step.seniorBarConcept.toLowerCase().includes(q);
      const theoryMatch = step.coreRequirements?.theoryTitle?.toLowerCase().includes(q) || false;

      return numMatch || titleMatch || conceptMatch || theoryMatch;
    });
  }, [steps, filterType, searchQuery]);

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
      <AcademyHeader
        coursesCount={courses.length}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
        careerCount={careerCount}
        domainCount={domainCount}
      />

      <AcademyCourseGrid
        courses={filteredCourses}
        activeCourseId={activeAcademyCourseId}
        onSelectCourse={handleCourseChange}
      />

      {currentCourse && (
        <>
          <NextBestActionCard
            courseId={currentCourse.id}
            courseTitle={currentCourse.title}
            onStepStarted={() => fetchActiveCourseDetails(currentCourse.id)}
          />

          <AcademyReadinessRadar
            rank={progress.rank}
            percentage={progress.percentage}
            pillars={progress.pillars}
          />

          <AcademyOmniToolbar
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onExpandAll={expandAllMilestones}
            onCollapseAll={collapseAllMilestones}
            filterType={filterType}
            setFilterType={setFilterType}
            filterCounts={filterCounts}
          />

          <div className="space-y-6">
            {(
              (currentCourse.milestones && currentCourse.milestones.length > 0)
                ? currentCourse.milestones
                : [{ id: 'default_milestone', title: 'Программа курса', stepRange: `Шаги 1–${steps.length}` }]
            ).map((milestone, mIdx) => {
              const milestoneAllSteps =
                currentCourse.milestones && currentCourse.milestones.length > 0
                  ? steps.filter((s) => s.milestoneId === milestone.id)
                  : steps;
              const milestoneVisibleSteps =
                currentCourse.milestones && currentCourse.milestones.length > 0
                  ? filteredSteps.filter((s) => s.milestoneId === milestone.id)
                  : filteredSteps;

              if ((searchQuery.trim() || filterType !== 'all') && milestoneVisibleSteps.length === 0) {
                return null;
              }

              return (
                <AcademyMilestoneAccordion
                  key={milestone.id}
                  milestone={milestone}
                  mIdx={mIdx}
                  isOpen={openMilestones.has(milestone.id)}
                  onToggle={() => toggleMilestone(milestone.id)}
                  milestoneAllSteps={milestoneAllSteps}
                  milestoneVisibleSteps={milestoneVisibleSteps}
                  activeStepNumber={activeAcademyStepNumber}
                  onOpenStepModal={openAcademyStepModal}
                  onToggleStep={handleToggleStep}
                />
              );
            })}

            {filteredSteps.length === 0 && (
              <div className="p-8 rounded-3xl bg-white border border-pastel-border text-center space-y-3 shadow-xs">
                <div className="w-12 h-12 rounded-2xl bg-pastel-rose/50 text-pastel-accentRose flex items-center justify-center mx-auto">
                  <Search className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-base text-pastel-text">Шаги не найдены</h3>
                <p className="text-xs text-pastel-muted max-w-md mx-auto">
                  По запросу «{searchQuery}» с фильтром «{filterType}» ничего не найдено.
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
        </>
      )}

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
