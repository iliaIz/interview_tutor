import React, { useState, useRef, useEffect } from 'react';
import { useAppStore, StudioTab } from '../store/useAppStore';
import { 
  Sparkles, Headphones, Loader2, AlertCircle, BookOpen, Bug, 
  Code2, Terminal, Layers, User, LogOut, Edit2, KeyRound, 
  CheckCircle2, X, Activity, Server, Cpu, Brain
} from 'lucide-react';
import { MemoryRadarDrawer } from './MemoryRadarDrawer';
import { fetchFsrsQueue } from '../services/fsrsApi';
import { GlobalAudioControlPill } from './voice/GlobalAudioControlPill';

export const StudioHeader: React.FC = () => {
  const { 
    currentStudioTab, 
    setStudioTab, 
    systemHealth, 
    openTopicBugHunt, 
    currentUser, 
    logout, 
    openProfileModal, 
    openAdminInvitesModal,
    academyBreadcrumbContext,
    returnToAcademyStep
  } = useAppStore();

  const [isHealthPopoverOpen, setIsHealthPopoverOpen] = useState(false);
  const [isRadarOpen, setIsRadarOpen] = useState(false);
  const [dueCount, setDueCount] = useState<number>(0);
  const healthPopoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void fetchFsrsQueue(5).then((data) => {
      setDueCount(data.count || 0);
    }).catch(() => {});
  }, []);

  // Close health popover on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (healthPopoverRef.current && !healthPopoverRef.current.contains(e.target as Node)) {
        setIsHealthPopoverOpen(false);
      }
    };
    if (isHealthPopoverOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isHealthPopoverOpen]);

  const renderHealthBadge = () => {
    let badgeContent = null;

    if (systemHealth.isAiReady) {
      badgeContent = (
        <div
          onClick={() => setIsHealthPopoverOpen(!isHealthPopoverOpen)}
          className="flex items-center gap-1.5 text-xs font-semibold px-2 sm:px-2.5 py-1.5 rounded-full bg-emerald-50/90 hover:bg-emerald-100/90 text-emerald-700 border border-emerald-200/80 shadow-2xs backdrop-blur-sm cursor-pointer shrink-0 transition active:scale-95 touch-manipulation"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <Headphones className="w-3.5 h-3.5 text-emerald-600" />
          <span className="hidden xl:inline text-[11px]">AI Шлюз</span>
          {systemHealth.latencyMs && (
            <span className="text-[10px] opacity-70 hidden sm:inline">({systemHealth.latencyMs}мс)</span>
          )}
        </div>
      );
    } else if (systemHealth.status === 'warming_up' || systemHealth.status === 'checking') {
      badgeContent = (
        <div
          onClick={() => setIsHealthPopoverOpen(!isHealthPopoverOpen)}
          className="flex items-center gap-1.5 text-xs font-semibold px-2 sm:px-2.5 py-1.5 rounded-full bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/80 shadow-2xs animate-pulse cursor-pointer shrink-0 transition active:scale-95 touch-manipulation"
        >
          <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
          <span className="hidden xl:inline text-[11px]">{systemHealth.error ? 'Синхронизация...' : 'Запуск AI...'}</span>
        </div>
      );
    } else {
      badgeContent = (
        <div
          onClick={() => setIsHealthPopoverOpen(!isHealthPopoverOpen)}
          className="flex items-center gap-1.5 text-xs font-semibold px-2 sm:px-2.5 py-1.5 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 shadow-2xs cursor-pointer shrink-0 transition active:scale-95 touch-manipulation"
        >
          <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
          <span className="hidden xl:inline text-[11px]">AI Офлайн</span>
        </div>
      );
    }

    return (
      <div className="relative" ref={healthPopoverRef}>
        {badgeContent}

        {/* Interactive Touch Health Popover for Desktop & Mobile */}
        {isHealthPopoverOpen && (
          <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 bg-white/95 backdrop-blur-xl border border-pastel-border/90 rounded-3xl p-4 shadow-2xl z-50 font-sans space-y-3 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-pastel-border/60 pb-2.5">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-pastel-accentRose" />
                <h4 className="text-xs font-bold text-pastel-text">LiteLLM AI Gateway Status</h4>
              </div>
              <button
                onClick={() => setIsHealthPopoverOpen(false)}
                className="p-1 text-pastel-muted hover:text-pastel-text rounded-lg hover:bg-pastel-bg"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-2 rounded-xl bg-pastel-bg/80 border border-pastel-border">
                <span className="text-pastel-muted flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-pastel-accentViolet" />
                  <span>Шлюз LiteLLM</span>
                </span>
                <span className="font-mono font-bold text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{systemHealth.latencyMs ? `${systemHealth.latencyMs} мс` : 'Ready'}</span>
                </span>
              </div>

              {/* 4 Models Matrix */}
              <div className="grid grid-cols-2 gap-1.5 font-mono text-[11px]">
                <div className="p-2 rounded-xl bg-pastel-bg/60 border border-pastel-border/80 flex items-center justify-between">
                  <span className="text-slate-600">Text: Smart</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                </div>
                <div className="p-2 rounded-xl bg-pastel-bg/60 border border-pastel-border/80 flex items-center justify-between">
                  <span className="text-slate-600">Live: Multimodal</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                </div>
                <div className="p-2 rounded-xl bg-pastel-bg/60 border border-pastel-border/80 flex items-center justify-between">
                  <span className="text-slate-600">TTS: v3 Audio</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                </div>
                <div className="p-2 rounded-xl bg-pastel-bg/60 border border-pastel-border/80 flex items-center justify-between">
                  <span className="text-slate-600">Embeddings</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                </div>
              </div>

              <p className="text-[10px] text-pastel-muted leading-relaxed pt-1">
                Все запросы маршрутизируются через отказоустойчивый LiteLLM Proxy с двухслойным Circuit Breaker.
              </p>
            </div>
          </div>
        )}
      </div>
    );
  };

  const tabs: { id: StudioTab; label: string; shortLabel: string; icon: React.ComponentType<any>; badge?: string }[] = [
    { id: 'academy', label: 'Академия', shortLabel: 'Академия', icon: Sparkles, badge: '6' },
    { id: 'theory', label: 'База знаний', shortLabel: 'Теория', icon: BookOpen },
    { id: 'incidents', label: 'Инциденты', shortLabel: 'Инциденты', icon: Bug, badge: '70' },
    { id: 'triage', label: 'Триаж Дампов', shortLabel: 'Триаж', icon: Terminal, badge: '15' },
    { id: 'practice', label: 'Machine Coding', shortLabel: 'LLD', icon: Code2, badge: '35' },
    { id: 'system_design', label: 'System Design', shortLabel: 'HLD', icon: Layers, badge: '20' }
  ];

  return (
    <header className="border-b border-pastel-border/70 bg-white/85 backdrop-blur-xl sticky top-0 z-40 shadow-xs font-sans">
      <div className="max-w-[1700px] w-full mx-auto px-2 sm:px-4 h-14 sm:h-16 flex items-center justify-between gap-1.5 sm:gap-3">
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-2xl bg-gradient-to-tr from-pastel-accentRose via-pink-400 to-pastel-accentViolet flex items-center justify-center text-white font-bold shadow-sm shadow-pastel-accentRose/20">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1">
              <h1 className="font-bold text-xs sm:text-base tracking-tight text-pastel-text">InterviewPrep</h1>
              <span className="text-[9px] sm:text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-pastel-rose text-pastel-accentRoseText border border-pastel-accentRose/20">AI</span>
            </div>
            <p className="text-[10px] text-pastel-muted font-medium hidden 2xl:block">Твой личный ИИ-ментор по Java & Spring</p>
          </div>
        </div>

        {/* Nav Tabs Bar with Scroll Affordance Mask on Mobile */}
        <div className="flex-1 min-w-0 mx-1 sm:mx-2 relative flex justify-center mask-fade-horizontal sm:mask-none">
          {/* Scroll container */}
          <nav className="flex items-center bg-pastel-bg/90 p-0.5 sm:p-1 rounded-2xl border border-pastel-border shadow-2xs overflow-x-auto no-scrollbar scroll-smooth touch-pan-x">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = currentStudioTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => setStudioTab(tab.id)}
                  className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer relative shrink-0 active:scale-95 touch-manipulation min-h-[32px] ${
                    isActive
                      ? 'bg-white text-pastel-text shadow-xs border border-pastel-border/60'
                      : 'text-pastel-muted hover:text-pastel-text hover:bg-white/40'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-pastel-accentRoseText' : 'text-pastel-muted'}`} />
                  <span>{tab.shortLabel}</span>

                  {tab.badge && (
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ml-0.5 ${
                      tab.id === 'practice'
                        ? 'bg-gradient-to-r from-amber-200 to-rose-200 text-amber-900 border border-amber-300/60'
                        : 'bg-pastel-rose text-pastel-accentRoseText border border-pastel-accentRose/30'
                    }`}>
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Breadcrumb Bridge, Health Status & User Profile Badge */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {academyBreadcrumbContext && currentStudioTab !== 'academy' && (
            <button
              onClick={returnToAcademyStep}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-bold bg-pastel-rose text-pastel-accentRoseText border border-pastel-accentRose/40 hover:bg-pastel-accentRose hover:text-white transition shadow-xs cursor-pointer shrink-0"
              title="Вернуться к текущему шагу в Академии"
            >
              <span className="hidden sm:inline">← Академия: Шаг #{academyBreadcrumbContext.stepNumber}</span>
              <span className="sm:hidden">← #{academyBreadcrumbContext.stepNumber}</span>
            </button>
          )}

          {/* FSRS-5 Memory Radar Quick Action */}
          <button
            onClick={() => setIsRadarOpen(true)}
            className="flex items-center gap-1.5 text-xs font-semibold px-2 sm:px-2.5 py-1.5 rounded-full bg-pastel-card hover:bg-pastel-rose/60 text-pastel-text border border-pastel-border shadow-2xs cursor-pointer transition active:scale-95 shrink-0"
            title="Открыть Радар Памяти FSRS-5"
          >
            <Brain className="w-3.5 h-3.5 text-pastel-accentViolet" />
            <span className="hidden xl:inline text-[11px]">Память</span>
            {dueCount > 0 && (
              <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded-full bg-amber-500 text-white animate-pulse">
                {dueCount}
              </span>
            )}
          </button>
 
          {/* SOTA 2026 Global Audio Control & Ambient Status */}
          <GlobalAudioControlPill />

          {renderHealthBadge()}

          {currentUser && (
            <div className="flex items-center gap-1 pl-1 sm:pl-2 border-l border-pastel-border/80">
              {currentUser.role === 'owner' && (
                <button
                  onClick={openAdminInvitesModal}
                  title="Генератор инвайт-кодов (Владелец)"
                  className="flex items-center gap-1 text-xs font-bold p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100/80 text-amber-800 border border-amber-200/80 shadow-2xs transition cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                  <span className="hidden xl:inline text-[11px]">Инвайты</span>
                </button>
              )}

              <button
                onClick={openProfileModal}
                title={`Настройки профиля: ${currentUser.name} (${currentUser.role})`}
                className="flex items-center gap-1 sm:gap-1.5 text-xs font-bold p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-pastel-card hover:bg-pastel-rose/50 text-pastel-text border border-pastel-border hover:border-pastel-accentRose/50 shadow-2xs transition cursor-pointer group shrink-0"
              >
                <User className="w-3.5 h-3.5 text-pastel-accentRose" />
                <span className="max-w-[90px] truncate hidden sm:inline text-[11px]">{currentUser.name}</span>
                <Edit2 className="w-3 h-3 text-pastel-muted group-hover:text-pastel-accentRose transition hidden sm:inline" />
              </button>

              <button
                onClick={() => logout()}
                title="Выйти из студии"
                className="p-1.5 rounded-xl text-pastel-muted hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer shrink-0"
              >
                <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Memory Radar Drawer */}
      <MemoryRadarDrawer
        isOpen={isRadarOpen}
        onClose={() => setIsRadarOpen(false)}
      />
    </header>
  );
};
