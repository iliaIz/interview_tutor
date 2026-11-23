import React, { useEffect, useMemo, useCallback } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { CompanyProfile, CompanyPipelineStage, TargetArena } from '@interview-prep/shared';
import { CompanyPipelineTab } from './CompanyPipelineTab';
import { CompanyDossierTab } from './CompanyDossierTab';
import { CompanyRunbookTab } from './CompanyRunbookTab';
import { CompanyTheoryDeckTab } from './CompanyTheoryDeckTab';
import { CompanyChallengesTab } from './CompanyChallengesTab';
import { CompanyBrandBanner } from './CompanyBrandBanner';
import { SqlArena } from '../sql/SqlArena';
import { CompanyTakeHomeLab } from './CompanyTakeHomeLab';
import { VoiceModal } from '../VoiceModal';
import { 
  BookOpen, Code2, Layers, FileText, Zap, Database, RotateCcw, AlertCircle, PackageCheck
} from 'lucide-react';
import { usePracticeTutorStore } from '../../store/usePracticeTutorStore';
import { normalizeCompanyContext } from '@interview-prep/shared';
import { launchArenaTask, resolveStageTarget, resolveRunbookTaskTarget } from '../../services/arenaNavigator';

export const CompanyPrepStudio: React.FC = () => {
  const {
    companyProfiles,
    selectedCompanyProfileId,
    activeCompanySubTab,
    completedCompanyStageIds,
    companyReadinessData,
    targetSqlChallengeId,
    isCompanyVoiceOpen,
    isCompanyLoading,
    companyLoadError,
    setCompanyProfiles,
    setSelectedCompanyProfileId,
    setActiveCompanySubTab,
    toggleCompanyStageComplete,
    setCompletedCompanyStageIds,
    setCompanyReadinessData,
    setTargetSqlChallengeId,
    setIsCompanyVoiceOpen,
    setIsCompanyLoading,
    setCompanyLoadError
  } = useAppStore();

  // Load backend readiness index
  const fetchReadiness = useCallback(async () => {
    try {
      const res = await fetch(`/api/companies/${selectedCompanyProfileId}/readiness`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setCompanyReadinessData(data);
      }
    } catch {}
  }, [selectedCompanyProfileId, setCompanyReadinessData]);

  // Load profiles from backend
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

  // Load completed stages from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`company_stages_${selectedCompanyProfileId}`);
      if (saved) {
        setCompletedCompanyStageIds(JSON.parse(saved));
      }
    } catch {}
  }, [selectedCompanyProfileId, setCompletedCompanyStageIds]);

  const profile = useMemo(() => {
    return companyProfiles.find((p) => p.id === selectedCompanyProfileId) || companyProfiles[0];
  }, [companyProfiles, selectedCompanyProfileId]);

  const setActiveContext = usePracticeTutorStore((s) => s.setActiveContext);
  const toggleOpen = usePracticeTutorStore((s) => s.toggleOpen);

  // Sync active company context to polymorphic AI Copilot
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

  // Compute Company Readiness Index (CRI)
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

  const handleLaunchStage = (stage: CompanyPipelineStage) => {
    const target = resolveStageTarget(stage);
    void launchArenaTask(target, {
      setActiveSubTab: (tab: any) => setActiveCompanySubTab(tab),
      setTargetSqlChallengeId,
      setIsVoiceOpen: setIsCompanyVoiceOpen
    });
  };

  const handleNavigateToTask = (taskId: string, explicitArena?: TargetArena) => {
    const target = resolveRunbookTaskTarget(taskId, profile, explicitArena);
    void launchArenaTask(target, {
      setActiveSubTab: (tab: any) => setActiveCompanySubTab(tab),
      setTargetSqlChallengeId,
      setIsVoiceOpen: setIsCompanyVoiceOpen
    });
  };

  if (isCompanyLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-3 font-sans">
        <div className="w-10 h-10 border-4 border-amber-400/40 border-t-amber-500 rounded-full animate-spin" />
        <p className="text-sm text-pastel-muted font-medium">Загрузка профиля компании...</p>
      </div>
    );
  }

  if (companyLoadError || !profile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 font-sans px-4 text-center">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div className="space-y-1 max-w-md">
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">Не удалось загрузить профиль компании</h3>
          <p className="text-xs text-rose-500/90 font-mono">{companyLoadError || 'Профиль не найден'}</p>
        </div>
        <button
          onClick={() => void fetchProfiles()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-900 font-medium text-xs transition-colors shadow-sm cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
          Повторить попытку
        </button>
      </div>
    );
  }

  const isAlfa = profile.id === 'alfa_digital';
  const completedSet = new Set(completedCompanyStageIds);

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 space-y-6 pb-24 font-sans">
      <CompanyBrandBanner
        profile={profile}
        profiles={companyProfiles}
        selectedProfileId={selectedCompanyProfileId}
        onSelectProfileId={setSelectedCompanyProfileId}
        isAlfa={isAlfa}
        readinessIndex={readinessIndex}
        onOpenCopilot={() => {
          setActiveContext(
            normalizeCompanyContext({
              profile,
              activeStage: profile.stages[0],
              activeTaskTitle: `Целевая подготовка: ${profile.name} (${activeCompanySubTab})`
            })
          );
          toggleOpen(true);
        }}
      />

      <div className="flex items-center gap-2 border-b border-pastel-border/70 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveCompanySubTab('pipeline')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-colors flex items-center gap-2 shrink-0 ${
            activeCompanySubTab === 'pipeline' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Layers className="w-4 h-4" />
          Воронка отбора (Пайплайн)
        </button>

        {isAlfa && (
          <button
            onClick={() => setActiveCompanySubTab('theory')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-colors flex items-center gap-2 shrink-0 ${
              activeCompanySubTab === 'theory' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-600 hover:bg-rose-50 hover:text-rose-700'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            Теория & Скрининг (27)
          </button>
        )}

        {isAlfa && (
          <button
            onClick={() => setActiveCompanySubTab('challenges')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-colors flex items-center gap-2 shrink-0 ${
              activeCompanySubTab === 'challenges' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'text-slate-600 hover:bg-amber-50 hover:text-amber-800'
            }`}
          >
            <Code2 className="w-4 h-4" />
            Задачи & Code Review (11)
          </button>
        )}

        <button
          onClick={() => setActiveCompanySubTab('dossier')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-colors flex items-center gap-2 shrink-0 ${
            activeCompanySubTab === 'dossier' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FileText className="w-4 h-4" />
          Инженерное досье & Флаги
        </button>

        <button
          onClick={() => setActiveCompanySubTab('runbook')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-colors flex items-center gap-2 shrink-0 ${
            activeCompanySubTab === 'runbook' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Zap className="w-4 h-4" />
          Ранбук «Собеседование завтра»
        </button>

        <button
          onClick={() => setActiveCompanySubTab('sql_arena')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-colors flex items-center gap-2 shrink-0 ${
            activeCompanySubTab === 'sql_arena' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:bg-indigo-50 hover:text-indigo-700'
          }`}
        >
          <Database className="w-4 h-4" />
          PostgreSQL WASM Арена
        </button>

        {profile.takeHomePrCases && profile.takeHomePrCases.length > 0 && (
          <button
            onClick={() => setActiveCompanySubTab('take_home')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-colors flex items-center gap-2 shrink-0 ${
              activeCompanySubTab === 'take_home' ? 'bg-teal-700 text-white shadow-xs' : 'text-slate-600 hover:bg-teal-50 hover:text-teal-800'
            }`}
          >
            <PackageCheck className="w-4 h-4" />
            Тестовое задание ({profile.takeHomePrCases.length} PRs)
          </button>
        )}
      </div>

      {activeCompanySubTab === 'pipeline' && (
        <CompanyPipelineTab
          stages={profile.stages}
          completedStageIds={completedSet}
          onToggleStageComplete={toggleCompanyStageComplete}
          onLaunchStageAction={handleLaunchStage}
          companyReadinessIndex={readinessIndex}
        />
      )}

      {activeCompanySubTab === 'theory' && (
        <CompanyTheoryDeckTab
          companyId={profile.id}
          companyName={profile.name}
          companyProfile={profile}
          onMasteryUpdated={fetchReadiness}
        />
      )}

      {activeCompanySubTab === 'challenges' && (
        <CompanyChallengesTab
          companyName={profile.name}
          onNavigateToTask={handleNavigateToTask}
        />
      )}

      {activeCompanySubTab === 'dossier' && (
        <CompanyDossierTab culture={profile.culture} companyName={profile.name} profile={profile} />
      )}

      {activeCompanySubTab === 'runbook' && (
        <CompanyRunbookTab
          runbook={profile.expressRunbook}
          onNavigateToTask={handleNavigateToTask}
          companyId={profile.id}
        />
      )}

      {activeCompanySubTab === 'sql_arena' && (
        <SqlArena
          initialChallengeId={targetSqlChallengeId}
          onBackToCompanyTrack={() => setActiveCompanySubTab('pipeline')}
          companyContextName={profile.name}
        />
      )}

      {activeCompanySubTab === 'take_home' && profile.takeHomePrCases && (
        <CompanyTakeHomeLab
          onBackToPipeline={() => setActiveCompanySubTab('pipeline')}
          companyName={profile.name}
          prCases={profile.takeHomePrCases}
        />
      )}

      {isCompanyVoiceOpen && (
        <VoiceModal
          isOpen={isCompanyVoiceOpen}
          onClose={() => setIsCompanyVoiceOpen(false)}
          initialSessionType="interview"
          vadPauseMs={800}
          topic={
            isAlfa
              ? 'АО «Альфа-Банк» (Alfa Digital & А-Токен): Технический скрининг'
              : `${profile.name}: Product Engineer Fit Interview`
          }
          currentQuestionText={
            isAlfa
              ? 'Привет! Начнем наш технический скрининг в Alfa Digital. Расскажи кратко о своем опыте с HighLoad, и сразу перейдем к физике JMM и HotSpot: что происходит при синхронизации на объекте, и почему String.intern() в synchronized — это критический дефект?'
              : `Расскажи о своем опыте: как ты подходишь к сквозной ответственности за фичи, какие метрики отслеживаешь (${profile.culture.metricsFocus.slice(0, 3).join(', ')}) и как предотвращаешь финансовые сбои на проде?`
          }
          customPromptOverride={
            isAlfa
              ? `РОЛЬ: Lead Java-архитектор в АО «Альфа-Банк» (Alfa Digital & А-Токен). Твоя цель — провести жесткий технический скрининг на позицию Senior Java Engineer в Финтех. ТЕМЫ ДЛЯ ГЛУБОКОГО ЗОНДИРОВАНИЯ: 1) JMM happens-before, safepoints, biased/thin/fat locking, Metaspace vs off-heap zero-copy sendfile, G1 vs ZGC; 2) Concurrency: CAS, полосковые блокировки (SegmentedConcurrentHashMap); 3) Spring: обход прокси при самовызове @Transactional, утечки пула HikariCP; 4) PostgreSQL: MVCC t_xmin/t_xmax, Dead Tuples, vacuum wraparound, SSI write skew; 5) Kafka: zero-copy sendfile, EOS 2PC PID; 6) А-Токен: Waves Enterprise, ГОСТ КС2, SOAP в АБС Equation. Требуй физических причин вместо симптомов. Красные флаги: ${profile.culture.redFlags.join('; ')}. Зеленые сигналы: ${profile.culture.greenFlags.join('; ')}.`
              : `РОЛЬ: Product Engineer Lead в ${profile.name}. Проведи Fit/Culture интервью по методике STAR. ТЕМЫ К ОБСУЖДЕНИЮ: 1) 5-шаговый поиск причин просадки конверсии; 2) Метрики TTM, Customer Pain Index, SRM в A/B, Conversion Lift%; 3) STAR-опыт решения факапов; 4) Финтех-инварианты: BigDecimal, сортировка блокировок min->max, Transactional Outbox. Инженерная парадигма: ${profile.culture.engineeringParadigm}. Красные флаги: ${profile.culture.redFlags.join('; ')}. Зеленые сигналы: ${profile.culture.greenFlags.join('; ')}.`
          }
        />
      )}
    </div>
  );
};
