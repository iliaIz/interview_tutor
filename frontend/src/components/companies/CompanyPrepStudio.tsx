import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import { CompanyPipelineTab } from './CompanyPipelineTab';
import { CompanyDossierTab } from './CompanyDossierTab';
import { CompanyRunbookTab } from './CompanyRunbookTab';
import { CompanyTheoryDeckTab } from './CompanyTheoryDeckTab';
import { CompanyChallengesTab } from './CompanyChallengesTab';
import { CompanyTakeHomeLab } from './CompanyTakeHomeLab';
import { SqlArena } from '../sql/SqlArena';
import { VoiceModal } from '../VoiceModal';
import { RotateCcw, AlertCircle } from 'lucide-react';
import { useCompanyStudioSession } from './hooks/useCompanyStudioSession';
import { CompanyPrepStudioHeader } from './components/CompanyPrepStudioHeader';

export const CompanyPrepStudio: React.FC = () => {
  const {
    companyProfiles,
    selectedCompanyProfileId,
    activeCompanySubTab,
    targetSqlChallengeId,
    isCompanyVoiceOpen,
    isCompanyLoading,
    companyLoadError,
    setSelectedCompanyProfileId,
    setActiveCompanySubTab,
    toggleCompanyStageComplete,
    setIsCompanyVoiceOpen
  } = useAppStore();

  const {
    profile,
    readinessIndex,
    isAlfa,
    completedSet,
    fetchProfiles,
    fetchReadiness,
    handleLaunchStage,
    handleNavigateToTask,
    openCopilot
  } = useCompanyStudioSession();

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

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 space-y-6 pb-24 font-sans">
      <CompanyPrepStudioHeader
        profile={profile}
        companyProfiles={companyProfiles}
        selectedCompanyProfileId={selectedCompanyProfileId}
        setSelectedCompanyProfileId={setSelectedCompanyProfileId}
        isAlfa={isAlfa}
        readinessIndex={readinessIndex}
        activeCompanySubTab={activeCompanySubTab}
        setActiveCompanySubTab={setActiveCompanySubTab}
        onOpenCopilot={openCopilot}
      />

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
