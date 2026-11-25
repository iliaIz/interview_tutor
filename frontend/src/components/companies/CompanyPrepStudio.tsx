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
  const companyProfiles = useAppStore((s) => s.companyProfiles);
  const selectedCompanyProfileId = useAppStore((s) => s.selectedCompanyProfileId);
  const activeCompanySubTab = useAppStore((s) => s.activeCompanySubTab);
  const targetSqlChallengeId = useAppStore((s) => s.targetSqlChallengeId);
  const isCompanyVoiceOpen = useAppStore((s) => s.isCompanyVoiceOpen);
  const isCompanyLoading = useAppStore((s) => s.isCompanyLoading);
  const companyLoadError = useAppStore((s) => s.companyLoadError);
  const setSelectedCompanyProfileId = useAppStore((s) => s.setSelectedCompanyProfileId);
  const setActiveCompanySubTab = useAppStore((s) => s.setActiveCompanySubTab);
  const toggleCompanyStageComplete = useAppStore((s) => s.toggleCompanyStageComplete);
  const setIsCompanyVoiceOpen = useAppStore((s) => s.setIsCompanyVoiceOpen);

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

  const curatedChallenges = profile.curatedChallenges || [];
  const hasTheoryTab = Boolean(profile.readinessConfig?.questionCatalogFile);
  const theoryCount = profile.readinessConfig?.theory.total ?? 0;

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 space-y-6 pb-24 font-sans">
      <CompanyPrepStudioHeader
        profile={profile}
        companyProfiles={companyProfiles}
        selectedCompanyProfileId={selectedCompanyProfileId}
        setSelectedCompanyProfileId={setSelectedCompanyProfileId}
        isAlfa={isAlfa}
        readinessIndex={readinessIndex}
        hasTheoryTab={hasTheoryTab}
        theoryCount={theoryCount}
        challengesCount={curatedChallenges.length}
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
          challenges={curatedChallenges}
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
          topic={profile.voicePreset?.topic ?? `${profile.name}: Interview Preparation`}
          currentQuestionText={
            profile.voicePreset?.initialQuestionText ??
            `Расскажи о своем опыте работы с высоконагруженными сервисами, метриках (${profile.culture.metricsFocus.slice(0, 3).join(', ')}) и предотвращении инцидентов.`
          }
          customPromptOverride={
            profile.voicePreset?.systemPrompt ??
            `РОЛЬ: Ведущий инженер в ${profile.name}. Парадигма: ${profile.culture.engineeringParadigm}. Красные флаги: ${profile.culture.redFlags.join('; ')}. Зеленые сигналы: ${profile.culture.greenFlags.join('; ')}.`
          }
        />
      )}
    </div>
  );
};
