import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { CompanyProfile, CompanyPipelineStage, TargetArena } from '@interview-prep/shared';
import { CompanyPipelineTab } from './CompanyPipelineTab';
import { CompanyDossierTab } from './CompanyDossierTab';
import { CompanyRunbookTab } from './CompanyRunbookTab';
import { SqlArena } from '../sql/SqlArena';
import { CompanyTakeHomeLab } from './CompanyTakeHomeLab';
import { VoiceModal } from '../VoiceModal';
import { 
  Building2, Sparkles, MapPin, ExternalLink, 
  Layers, FileText, Zap, Database, RotateCcw, AlertCircle, PackageCheck, Bot
} from 'lucide-react';
import { usePracticeTutorStore } from '../../store/usePracticeTutorStore';
import { normalizeCompanyContext } from '@interview-prep/shared';
import { launchArenaTask, resolveStageTarget, resolveRunbookTaskTarget } from '../../services/arenaNavigator';

export const CompanyPrepStudio: React.FC = () => {
  const { setStudioTab } = useAppStore();

  const [profiles, setProfiles] = useState<CompanyProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('raiffeisen_dgtl');
  const [activeSubTab, setActiveSubTab] = useState<'pipeline' | 'dossier' | 'runbook' | 'sql_arena' | 'take_home'>('pipeline');
  const [completedStageIds, setCompletedStageIds] = useState<Set<string>>(new Set());
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [targetSqlChallengeId, setTargetSqlChallengeId] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Load profiles from backend
  const fetchProfiles = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/companies', { credentials: 'include' });
      if (!res.ok) {
        throw new Error(`Ошибка сервера (${res.status}): не удалось получить профили`);
      }
      const data: CompanyProfile[] = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setProfiles(data);
        if (!data.some((p) => p.id === selectedProfileId)) {
          setSelectedProfileId(data[0].id);
        }
      } else {
        throw new Error('Список профилей компаний пуст');
      }
    } catch (err: any) {
      console.error('[CompanyPrepStudio] Failed to load profiles:', err);
      setLoadError(err.message || 'Ошибка загрузки профиля компании');
    } finally {
      setIsLoading(false);
    }
  }, [selectedProfileId]);

  useEffect(() => {
    void fetchProfiles();
  }, [fetchProfiles]);

  // Load completed stages from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`company_completed_stages_${selectedProfileId}`);
      if (saved) {
        setCompletedStageIds(new Set(JSON.parse(saved)));
      }
    } catch {}
  }, [selectedProfileId]);

  const profile = useMemo(() => {
    return profiles.find((p) => p.id === selectedProfileId) || profiles[0];
  }, [profiles, selectedProfileId]);

  const setActiveContext = usePracticeTutorStore((s) => s.setActiveContext);
  const toggleOpen = usePracticeTutorStore((s) => s.toggleOpen);

  // Sync active company context to polymorphic AI Copilot
  useEffect(() => {
    if (profile && activeSubTab !== 'sql_arena') {
      setActiveContext(
        normalizeCompanyContext({
          profile,
          activeStage: profile.stages[0],
          activeTaskTitle: `Целевая подготовка: ${profile.name} [${activeSubTab}]`
        })
      );
    }
  }, [profile, activeSubTab, setActiveContext]);

  // Clean up tutor context on unmount
  useEffect(() => {
    return () => {
      setActiveContext(null);
    };
  }, [setActiveContext]);

  // Compute Company Readiness Index (CRI)
  const readinessIndex = useMemo(() => {
    if (!profile) return 0;
    let score = 0;
    for (const stage of profile.stages) {
      if (completedStageIds.has(stage.id)) {
        score += stage.weight * 100;
      }
    }
    return Math.min(100, Math.round(score));
  }, [profile, completedStageIds]);

  const toggleStageComplete = (stageId: string) => {
    const updated = new Set(completedStageIds);
    if (updated.has(stageId)) {
      updated.delete(stageId);
    } else {
      updated.add(stageId);
    }
    setCompletedStageIds(updated);
    try {
      localStorage.setItem(
        `company_completed_stages_${selectedProfileId}`,
        JSON.stringify([...updated])
      );
    } catch {}
  };

  // Stage Action Launcher
  const handleLaunchStage = (stage: CompanyPipelineStage) => {
    const target = resolveStageTarget(stage);
    void launchArenaTask(target, {
      setActiveSubTab,
      setTargetSqlChallengeId,
      setIsVoiceOpen
    });
  };

  const handleNavigateToTask = (taskId: string, explicitArena?: TargetArena) => {
    const target = resolveRunbookTaskTarget(taskId, profile, explicitArena);
    void launchArenaTask(target, {
      setActiveSubTab,
      setTargetSqlChallengeId,
      setIsVoiceOpen
    });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-3 font-sans">
        <div className="w-10 h-10 border-4 border-amber-400/40 border-t-amber-500 rounded-full animate-spin" />
        <p className="text-sm text-pastel-muted font-medium">Загрузка профиля компании...</p>
      </div>
    );
  }

  if (loadError || !profile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 font-sans px-4 text-center">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div className="space-y-1 max-w-md">
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">Не удалось загрузить профиль компании</h3>
          <p className="text-xs text-rose-500/90 font-mono">{loadError || 'Профиль не найден'}</p>
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
      {/* Brand Header Banner */}
      <div className="bg-gradient-to-r from-amber-400/20 via-amber-200/10 to-white border border-amber-300/60 rounded-3xl p-5 sm:p-6 shadow-sm relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-400 text-amber-950 shadow-xs flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" />
                {profile.name}
              </span>
              <span className="text-xs text-slate-600 font-mono flex items-center gap-1">
                <MapPin className="w-3 h-3 text-pastel-muted" /> Raiffeisen DGTL Hub
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight">
              Целевая Подготовка: Product Engineer (Java/Kotlin)
            </h1>
            <p className="text-xs text-slate-700 max-w-2xl leading-relaxed">
              {profile.tagline}
            </p>
          </div>

          {/* Quick Stats Pill & AI Copilot Action */}
          <div className="flex flex-wrap items-center gap-3 self-start md:self-auto">
            <button
              onClick={() => {
                if (profile) {
                  setActiveContext(
                    normalizeCompanyContext({
                      profile,
                      activeStage: profile.stages[0],
                      activeTaskTitle: `Целевая подготовка: ${profile.name} (${activeSubTab})`
                    })
                  );
                }
                toggleOpen(true);
              }}
              className="px-3.5 py-2.5 rounded-2xl bg-amber-400 hover:bg-amber-500 text-slate-950 font-extrabold text-xs shadow-xs flex items-center gap-2 transition-all cursor-pointer border border-amber-500/30"
              title="Открыть диалог с AI-Напарником (Raiffeisen Bar-Raiser)"
            >
              <Bot className="w-4 h-4 text-slate-950" />
              <span>AI-Напарник (Bar-Raiser)</span>
            </button>

            <div className="flex items-center gap-3 bg-white/90 p-3 rounded-2xl border border-amber-300/40 shadow-xs font-mono text-xs">
              <div>
                <span className="block text-slate-500 text-[10px] uppercase font-bold">Степень готовности</span>
                <span className="font-extrabold text-base text-slate-900">{readinessIndex}% CRI</span>
              </div>
              <div className="h-8 w-px bg-slate-200" />
              <div>
                <span className="block text-slate-500 text-[10px] uppercase font-bold">Этапов</span>
                <span className="font-extrabold text-base text-amber-700">{profile.stages.length} раундов</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-pastel-border/70 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveSubTab('pipeline')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-colors flex items-center gap-2 shrink-0 ${
            activeSubTab === 'pipeline'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Layers className="w-4 h-4" />
          Воронка отбора (Пайплайн)
        </button>

        <button
          onClick={() => setActiveSubTab('dossier')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-colors flex items-center gap-2 shrink-0 ${
            activeSubTab === 'dossier'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FileText className="w-4 h-4" />
          Инженерное досье & Флаги
        </button>

        <button
          onClick={() => setActiveSubTab('runbook')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-colors flex items-center gap-2 shrink-0 ${
            activeSubTab === 'runbook'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Zap className="w-4 h-4" />
          Ранбук «Собеседование завтра»
        </button>

        <button
          onClick={() => setActiveSubTab('sql_arena')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-colors flex items-center gap-2 shrink-0 ${
            activeSubTab === 'sql_arena'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-indigo-50 hover:text-indigo-700'
          }`}
        >
          <Database className="w-4 h-4" />
          PostgreSQL WASM Арена
        </button>

        <button
          onClick={() => setActiveSubTab('take_home')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-colors flex items-center gap-2 shrink-0 ${
            activeSubTab === 'take_home'
              ? 'bg-teal-700 text-white shadow-xs'
              : 'text-slate-600 hover:bg-teal-50 hover:text-teal-800'
          }`}
        >
          <PackageCheck className="w-4 h-4" />
          Тестовое задание (25 PRs)
        </button>
      </div>

      {/* Tab Panels */}
      {activeSubTab === 'pipeline' && (
        <CompanyPipelineTab
          stages={profile.stages}
          completedStageIds={completedStageIds}
          onToggleStageComplete={toggleStageComplete}
          onLaunchStageAction={handleLaunchStage}
          companyReadinessIndex={readinessIndex}
        />
      )}

      {activeSubTab === 'dossier' && (
        <CompanyDossierTab culture={profile.culture} companyName={profile.name} profile={profile} />
      )}

      {activeSubTab === 'runbook' && (
        <CompanyRunbookTab
          runbook={profile.expressRunbook}
          onNavigateToTask={handleNavigateToTask}
          companyId={profile.id}
        />
      )}

      {activeSubTab === 'sql_arena' && (
        <SqlArena
          initialChallengeId={targetSqlChallengeId}
          onBackToCompanyTrack={() => setActiveSubTab('pipeline')}
          companyContextName={profile.name}
        />
      )}

      {activeSubTab === 'take_home' && (
        <CompanyTakeHomeLab
          onBackToPipeline={() => setActiveSubTab('pipeline')}
          companyName={profile.name}
          prCases={profile.takeHomePrCases}
        />
      )}

      {/* Voice Modal with Dynamic Bar-Raiser Persona */}
      {isVoiceOpen && (
        <VoiceModal
          isOpen={isVoiceOpen}
          onClose={() => setIsVoiceOpen(false)}
          initialSessionType="interview"
          vadPauseMs={800}
          topic={`${profile.name}: Product Engineer Fit Interview`}
          currentQuestionText={`Расскажи о своем опыте: как ты подходишь к сквозной ответственности за фичи, какие метрики отслеживаешь (${profile.culture.metricsFocus.slice(0, 3).join(', ')}) и как предотвращаешь финансовые сбои на проде?`}
          customPromptOverride={`РОЛЬ: Product Engineer Lead в ${profile.name}. Проведи Fit/Culture интервью по методике STAR. ТЕМЫ К ОБСУЖДЕНИЮ: 1) 5-шаговый поиск причин просадки конверсии; 2) Метрики TTM, Customer Pain Index, SRM в A/B, Conversion Lift%; 3) STAR-опыт решения факапов; 4) Финтех-инварианты: BigDecimal, сортировка блокировок min->max, Transactional Outbox. Инженерная парадигма: ${profile.culture.engineeringParadigm}. Если кандидат начинает ответ с разбора любого из этих пунктов — сразу тепло поддерживай продуктовый диалог без лишних вводных. Красные флаги: ${profile.culture.redFlags.join('; ')}. Зеленые сигналы: ${profile.culture.greenFlags.join('; ')}.`}
        />
      )}
    </div>
  );
};
