import { useEffect, useMemo, useCallback } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { CompanyProfile, CompanyPipelineStage, TargetArena } from '@interview-prep/shared';
import { usePracticeTutorStore } from '../../../store/usePracticeTutorStore';
import { normalizeCompanyContext } from '@interview-prep/shared';
import { launchArenaTask, resolveStageTarget, resolveRunbookTaskTarget } from '../../../services/arenaNavigator';

export interface UseCompanyStudioSessionReturn {
  profile: CompanyProfile | null;
  readinessIndex: number;
  isAlfa: boolean;
  completedSet: Set<string>;
  fetchProfiles: () => Promise<void>;
  fetchReadiness: () => Promise<void>;
  handleLaunchStage: (stage: CompanyPipelineStage) => void;
  handleNavigateToTask: (taskId: string, explicitArena?: TargetArena) => void;
  openCopilot: () => void;
}

export function useCompanyStudioSession(): UseCompanyStudioSessionReturn {
  const {
    companyProfiles,
    selectedCompanyProfileId,
    activeCompanySubTab,
    completedCompanyStageIds,
    companyReadinessData,
    setCompanyProfiles,
    setSelectedCompanyProfileId,
    setActiveCompanySubTab,
    setCompletedCompanyStageIds,
    setCompanyReadinessData,
    setTargetSqlChallengeId,
    setIsCompanyVoiceOpen,
    setIsCompanyLoading,
    setCompanyLoadError
  } = useAppStore();

  const fetchReadiness = useCallback(async () => {
    try {
      const res = await fetch(`/api/companies/${selectedCompanyProfileId}/readiness`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setCompanyReadinessData(data);
      }
    } catch {}
  }, [selectedCompanyProfileId, setCompanyReadinessData]);

  const fetchProfiles = useCallback(async () => {
    setIsCompanyLoading(true);
    setCompanyLoadError(null);
    try {
      const res = await fetch('/api/companies', { credentials: 'include' });
      if (!res.ok) throw new Error(`Ошибка сервера (${res.status}): не удалось получить профили`);
      const data: CompanyProfile[] = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setCompanyProfiles(data);
        if (!data.some((p) => p.id === selectedCompanyProfileId)) {
          setSelectedCompanyProfileId(data[0].id);
        }
      } else {
        throw new Error('Список профилей компаний пуст');
      }
    } catch (err: any) {
      console.error('[CompanyPrepStudio] Failed to load profiles:', err);
      setCompanyLoadError(err.message || 'Ошибка загрузки профиля компании');
    } finally {
      setIsCompanyLoading(false);
    }
  }, [selectedCompanyProfileId, setCompanyProfiles, setSelectedCompanyProfileId, setIsCompanyLoading, setCompanyLoadError]);

  useEffect(() => {
    void fetchProfiles();
  }, [fetchProfiles]);

  useEffect(() => {
    void fetchReadiness();
  }, [fetchReadiness]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`company_stages_${selectedCompanyProfileId}`);
      if (saved) {
        setCompletedCompanyStageIds(JSON.parse(saved));
      }
    } catch {}
  }, [selectedCompanyProfileId, setCompletedCompanyStageIds]);

  const profile = useMemo(() => {
    return companyProfiles.find((p) => p.id === selectedCompanyProfileId) || companyProfiles[0] || null;
  }, [companyProfiles, selectedCompanyProfileId]);

  const setActiveContext = usePracticeTutorStore((s) => s.setActiveContext);
  const toggleOpen = usePracticeTutorStore((s) => s.toggleOpen);

  useEffect(() => {
    if (profile && activeCompanySubTab !== 'sql_arena') {
      setActiveContext(
        normalizeCompanyContext({
          profile,
          activeStage: profile.stages[0],
          activeTaskTitle: `Целевая подготовка: ${profile.name} [${activeCompanySubTab}]`
        })
      );
    }
  }, [profile, activeCompanySubTab, setActiveContext]);

  useEffect(() => {
    return () => {
      setActiveContext(null);
    };
  }, [setActiveContext]);

  const readinessIndex = useMemo(() => {
    if (companyReadinessData?.overallPercentage !== undefined) {
      return companyReadinessData.overallPercentage;
    }
    if (!profile) return 0;
    let score = 0;
    const completedSet = new Set(completedCompanyStageIds);
    for (const stage of profile.stages) {
      if (completedSet.has(stage.id)) score += stage.weight * 100;
    }
    return Math.min(100, Math.round(score));
  }, [profile, completedCompanyStageIds, companyReadinessData]);

  const handleLaunchStage = useCallback((stage: CompanyPipelineStage) => {
    const target = resolveStageTarget(stage);
    void launchArenaTask(target, {
      setActiveSubTab: (tab: any) => setActiveCompanySubTab(tab),
      setTargetSqlChallengeId,
      setIsVoiceOpen: setIsCompanyVoiceOpen
    });
  }, [setActiveCompanySubTab, setTargetSqlChallengeId, setIsCompanyVoiceOpen]);

  const handleNavigateToTask = useCallback((taskId: string, explicitArena?: TargetArena) => {
    if (!profile) return;
    const target = resolveRunbookTaskTarget(taskId, profile, explicitArena);
    void launchArenaTask(target, {
      setActiveSubTab: (tab: any) => setActiveCompanySubTab(tab),
      setTargetSqlChallengeId,
      setIsVoiceOpen: setIsCompanyVoiceOpen
    });
  }, [profile, setActiveCompanySubTab, setTargetSqlChallengeId, setIsCompanyVoiceOpen]);

  const openCopilot = useCallback(() => {
    if (!profile) return;
    setActiveContext(
      normalizeCompanyContext({
        profile,
        activeStage: profile.stages[0],
        activeTaskTitle: `Целевая подготовка: ${profile.name} (${activeCompanySubTab})`
      })
    );
    toggleOpen(true);
  }, [profile, activeCompanySubTab, setActiveContext, toggleOpen]);

  const isAlfa = profile?.id === 'alfa_digital';
  const completedSet = useMemo(() => new Set(completedCompanyStageIds), [completedCompanyStageIds]);

  return {
    profile,
    readinessIndex,
    isAlfa,
    completedSet,
    fetchProfiles,
    fetchReadiness,
    handleLaunchStage,
    handleNavigateToTask,
    openCopilot
  };
}
