import React, { useState, useRef, useEffect } from 'react';
import { useAppStore, StudioTab } from '../store/useAppStore';
import { 
  Sparkles, Headphones, Loader2, AlertCircle, BookOpen, Bug, 
  Code2, Terminal, Layers, User, LogOut, Edit2, KeyRound, 
  CheckCircle2, X, Activity, Server, Cpu, Brain, ChevronDown, 
  Zap, ArrowRight, Check
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
  const [isArenaMenuOpen, setIsArenaMenuOpen] = useState(false);
  const [isRadarOpen, setIsRadarOpen] = useState(false);
  const [dueCount, setDueCount] = useState<number>(0);
  const healthPopoverRef = useRef<HTMLDivElement>(null);
  const arenaMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void fetchFsrsQueue(5).then((data) => {
      setDueCount(data.count || 0);
    }).catch(() => {});
  }, []);

  // Close health popover and arena menu on outside click or Escape key
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (healthPopoverRef.current && !healthPopoverRef.current.contains(e.target as Node)) {
        setIsHealthPopoverOpen(false);
      }
      if (arenaMenuRef.current && !arenaMenuRef.current.contains(e.target as Node)) {
        setIsArenaMenuOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsHealthPopoverOpen(false);
        setIsArenaMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const shortSha = (import.meta.env.VITE_GIT_COMMIT_SHA as string)?.slice(0, 7) || systemHealth?.commitSha || 'dev';

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

              {shortSha && (
                <div className="flex items-center justify-between px-2 py-1.5 rounded-xl bg-pastel-bg/60 border border-pastel-border/70 text-[11px]">
                  <span className="text-pastel-muted flex items-center gap-1.5 font-sans">
                    <Activity className="w-3 h-3 text-pastel-accentRose" />
                    <span>Версия сборки</span>
                  </span>
                  <span className="font-mono font-bold text-slate-700">{shortSha}</span>
                </div>
              )}

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

  interface ArenaItem {
    id: StudioTab;
    title: string;
    shortLabel: string;
    description: string;
    badge: string;
    levelBadge: string;
    icon: React.ComponentType<any>;
    theme: {
      iconColor: string;
      bgIcon: string;
      borderHover: string;
      activeBorder: string;
      activeBg: string;
      badgeStyle: string;
    };
  }

  const engineeringArenas: ArenaItem[] = [
    {
      id: 'system_design',
      title: 'System Design (HLD)',
      shortLabel: 'HLD',
      description: '26 канонических систем: Runtime Forensics → DES Topology → Bar-Raiser Defense',
      badge: '31 сценарий',
      levelBadge: 'L3–L7',
      icon: Layers,
      theme: {
        iconColor: 'text-purple-600',
        bgIcon: 'bg-purple-100 text-purple-700',
        borderHover: 'hover:border-purple-300 hover:bg-purple-50/50',
        activeBorder: 'border-purple-400',
        activeBg: 'bg-purple-50/80',
        badgeStyle: 'bg-purple-100 text-purple-800 border-purple-200'
      }
    },
    {
      id: 'practice',
      title: 'Machine Coding (LLD)',
      shortLabel: 'Практика',
      description: 'Java 21, Concurrency, Virtual Clock Injection, BigDecimal, Deadlock-Free',
      badge: '93 задачи',
      levelBadge: 'L3–L6',
      icon: Code2,
      theme: {
        iconColor: 'text-amber-600',
        bgIcon: 'bg-amber-100 text-amber-700',
        borderHover: 'hover:border-amber-300 hover:bg-amber-50/50',
        activeBorder: 'border-amber-400',
        activeBg: 'bg-amber-50/80',
        badgeStyle: 'bg-amber-100 text-amber-900 border-amber-200'
      }
    },
    {
      id: 'incidents',
      title: 'Баг-Хант & Forensics',
      shortLabel: 'Баг-Хант',
      description: 'Поиск скрытых дефектов: Race conditions, утечки Heap/Metaspace, Carrier Pinning',
      badge: '70 кат',
      levelBadge: 'L4–L6',
      icon: Bug,
      theme: {
        iconColor: 'text-rose-600',
        bgIcon: 'bg-rose-100 text-rose-700',
        borderHover: 'hover:border-rose-300 hover:bg-rose-50/50',
        activeBorder: 'border-rose-400',
        activeBg: 'bg-rose-50/80',
        badgeStyle: 'bg-rose-100 text-rose-800 border-rose-200'
      }
    },
    {
      id: 'triage',
      title: 'Триаж Аварий (SRE)',
      shortLabel: 'Триаж',
      description: 'SRE-симулятор инцидентов: метрики Prometheus, логи, Linux-терминал, постмортемы',
      badge: '22 инцидента',
      levelBadge: 'L4–L6',
      icon: Terminal,
      theme: {
        iconColor: 'text-emerald-600',
        bgIcon: 'bg-emerald-100 text-emerald-700',
        borderHover: 'hover:border-emerald-300 hover:bg-emerald-50/50',
        activeBorder: 'border-emerald-400',
        activeBg: 'bg-emerald-50/80',
        badgeStyle: 'bg-emerald-100 text-emerald-800 border-emerald-200'
      }
    }
  ];

  const activeArena = engineeringArenas.find(a => a.id === currentStudioTab);
  const isArenaActive = Boolean(activeArena);

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

        {/* Nav Tabs Bar: Two-tier clustered layout (SOTA 2026) */}
        <div className="flex-1 min-w-0 mx-1 sm:mx-2 relative flex justify-center">
          <nav className="flex items-center bg-pastel-bg/90 p-0.5 sm:p-1 rounded-2xl border border-pastel-border shadow-2xs gap-0.5 sm:gap-1">
            {/* 1. Академия */}
            <button
              onClick={() => {
                setStudioTab('academy');
                setIsArenaMenuOpen(false);
              }}
              className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer relative shrink-0 active:scale-95 touch-manipulation min-h-[32px] ${
                currentStudioTab === 'academy' || currentStudioTab === 'roadmaps'
                  ? 'bg-white text-pastel-text shadow-xs border border-pastel-border/60'
                  : 'text-pastel-muted hover:text-pastel-text hover:bg-white/40'
              }`}
            >
              <Sparkles className={`w-3.5 h-3.5 shrink-0 ${
                currentStudioTab === 'academy' || currentStudioTab === 'roadmaps'
                  ? 'text-pastel-accentRoseText'
                  : 'text-pastel-muted'
              }`} />
              <span>Академия</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold ml-0.5 bg-pastel-rose text-pastel-accentRoseText border border-pastel-accentRose/30">
                8
              </span>
            </button>

            {/* 2. База знаний (Теория) */}
            <button
              onClick={() => {
                setStudioTab('theory');
                setIsArenaMenuOpen(false);
              }}
              className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer relative shrink-0 active:scale-95 touch-manipulation min-h-[32px] ${
                currentStudioTab === 'theory'
                  ? 'bg-white text-pastel-text shadow-xs border border-pastel-border/60'
                  : 'text-pastel-muted hover:text-pastel-text hover:bg-white/40'
              }`}
            >
              <BookOpen className={`w-3.5 h-3.5 shrink-0 ${
                currentStudioTab === 'theory' ? 'text-pastel-accentRoseText' : 'text-pastel-muted'
              }`} />
              <span className="hidden sm:inline">База знаний</span>
              <span className="sm:hidden">Теория</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold ml-0.5 bg-pastel-rose text-pastel-accentRoseText border border-pastel-accentRose/30">
                816
              </span>
            </button>

            {/* 3. Инженерные Арены Mega-Menu Dropdown */}
            <div className="relative" ref={arenaMenuRef}>
              <button
                onClick={() => setIsArenaMenuOpen(!isArenaMenuOpen)}
                className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer relative shrink-0 active:scale-95 touch-manipulation min-h-[32px] ${
                  isArenaActive || isArenaMenuOpen
                    ? 'bg-white text-pastel-text shadow-xs border border-pastel-border/60'
                    : 'text-pastel-muted hover:text-pastel-text hover:bg-white/40'
                }`}
                title="Инженерные полигоны: System Design, Machine Coding, Баг-Хант, Триаж Аварий"
              >
                {activeArena ? (
                  <>
                    <activeArena.icon className={`w-3.5 h-3.5 shrink-0 ${activeArena.theme.iconColor}`} />
                    <span className="font-extrabold">{activeArena.shortLabel}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ml-0.5 ${activeArena.theme.badgeStyle}`}>
                      {activeArena.badge.split(' ')[0]}
                    </span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                    <span className="hidden sm:inline">Инженерные Арены</span>
                    <span className="sm:hidden">Арены</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold ml-0.5 bg-pastel-rose text-pastel-accentRoseText border border-pastel-accentRose/30">
                      4
                    </span>
                  </>
                )}

                <ChevronDown className={`w-3.5 h-3.5 text-pastel-muted transition-transform duration-200 ${
                  isArenaMenuOpen ? 'rotate-180 text-pastel-text' : ''
                }`} />
              </button>

              {/* Arena Mega-Menu Popover */}
              {isArenaMenuOpen && (
                <div className="absolute left-1/2 -translate-x-1/2 sm:left-auto sm:right-0 sm:translate-x-0 top-full mt-2.5 w-[calc(100vw-1.5rem)] max-w-sm sm:max-w-md md:w-[520px] bg-white/95 backdrop-blur-2xl border border-pastel-border/90 rounded-3xl p-3 sm:p-4 shadow-2xl z-50 font-sans space-y-2.5 animate-in fade-in zoom-in-95 duration-150">
                  {/* Header in popover */}
                  <div className="flex items-center justify-between border-b border-pastel-border/60 pb-2.5 px-1">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-purple-500 to-rose-400 flex items-center justify-center text-white text-xs font-bold shadow-xs">
                        <Zap className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="font-extrabold text-xs text-pastel-text">Инженерные Полигоны</div>
                        <div className="text-[10px] text-pastel-muted hidden sm:block">Интерактивные тренажеры для подготовки к Hard Skills</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pastel-bg text-pastel-muted border border-pastel-border shrink-0">
                      4 арены • 216 задач
                    </span>
                  </div>

                  {/* 2x2 Grid on desktop, 1 col on mobile */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {engineeringArenas.map((arena) => {
                      const Icon = arena.icon;
                      const isSelected = currentStudioTab === arena.id;

                      return (
                        <button
                          key={arena.id}
                          onClick={() => {
                            setStudioTab(arena.id);
                            setIsArenaMenuOpen(false);
                          }}
                          className={`flex flex-col text-left p-2.5 sm:p-3 rounded-2xl border transition-all duration-150 relative group cursor-pointer ${
                            isSelected
                              ? `${arena.theme.activeBg} ${arena.theme.activeBorder} shadow-sm`
                              : `bg-white/80 border-pastel-border/70 ${arena.theme.borderHover}`
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1.5 w-full">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${arena.theme.bgIcon}`}>
                                <Icon className="w-4 h-4" />
                              </div>
                              <span className="font-bold text-xs text-pastel-text truncate">
                                {arena.title}
                              </span>
                            </div>

                            <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-md border shrink-0 ${arena.theme.badgeStyle}`}>
                              {arena.levelBadge}
                            </span>
                          </div>

                          <p className="text-[10px] text-pastel-muted line-clamp-2 leading-relaxed mt-1.5 min-h-[28px]">
                            {arena.description}
                          </p>

                          <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-pastel-border/40 text-[10px] font-semibold text-slate-500">
                            <span className="text-pastel-muted group-hover:text-pastel-text transition">
                              {arena.badge}
                            </span>
                            <div className="flex items-center gap-1">
                              {isSelected && (
                                <span className="text-emerald-600 flex items-center gap-0.5 text-[10px] font-bold">
                                  <Check className="w-3 h-3" />
                                  Активна
                                </span>
                              )}
                              <ArrowRight className="w-3 h-3 text-pastel-muted group-hover:translate-x-0.5 group-hover:text-pastel-text transition" />
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
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
                title={
                  currentUser.role === 'owner'
                    ? `Профиль: ${currentUser.name} (Владелец) • Сборка: ${shortSha}`
                    : `Настройки профиля: ${currentUser.name} (${currentUser.role})`
                }
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
