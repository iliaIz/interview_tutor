import React from 'react';
import { useAppStore, StudioTab } from '../store/useAppStore';
import { Sparkles, Headphones, Loader2, AlertCircle, BookOpen, Bug, Code2, Compass, Terminal, Layers, User, LogOut, Edit2, KeyRound } from 'lucide-react';

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

  const renderHealthBadge = () => {
    if (systemHealth.isAiReady) {
      return (
        <div
          title={systemHealth.message || "AI Шлюз активен. Модель Gemini 3.7 Flash проверена в LiteLLM."}
          className="flex items-center gap-1.5 text-xs font-semibold px-2 sm:px-2.5 py-1.5 rounded-full bg-emerald-50/90 text-emerald-700 border border-emerald-200/80 shadow-2xs backdrop-blur-sm cursor-default shrink-0"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <Headphones className="w-3.5 h-3.5 text-emerald-600" />
          <span className="hidden xl:inline text-[11px]">AI Шлюз</span>
          {systemHealth.latencyMs && (
            <span className="text-[10px] opacity-70 hidden sm:inline">({systemHealth.latencyMs}мс)</span>
          )}
        </div>
      );
    }

    if (systemHealth.status === 'warming_up' || systemHealth.status === 'checking') {
      return (
        <div
          title={systemHealth.error || "Проверка моделей в LiteLLM-Proxy..."}
          className="flex items-center gap-1.5 text-xs font-semibold px-2 sm:px-2.5 py-1.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200/80 shadow-2xs animate-pulse cursor-help shrink-0"
        >
          <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
          <span className="hidden xl:inline text-[11px]">{systemHealth.error ? 'Синхронизация...' : 'Запуск AI...'}</span>
        </div>
      );
    }

    return (
      <div
        title={systemHealth.error || 'Проверьте запуск LiteLLM_Proxy'}
        className="flex items-center gap-1.5 text-xs font-semibold px-2 sm:px-2.5 py-1.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs cursor-help shrink-0"
      >
        <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
        <span className="hidden xl:inline text-[11px]">AI Офлайн</span>
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
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-2xl bg-gradient-to-tr from-pastel-accentRose via-pink-400 to-pastel-accentViolet flex items-center justify-center text-white font-bold shadow-sm shadow-pastel-accentRose/20">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1">
              <h1 className="font-bold text-xs sm:text-base tracking-tight text-pastel-text">InterviewPrep</h1>
              <span className="text-[9px] sm:text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-pastel-rose text-pastel-accentRose border border-pastel-accentRose/20">AI</span>
            </div>
            <p className="text-[10px] text-pastel-muted font-medium hidden 2xl:block">Твой личный ИИ-ментор по Java & Spring</p>
          </div>
        </div>

        <div className="flex-1 min-w-0 mx-1 sm:mx-2 relative flex justify-center">
          <nav className="flex items-center bg-pastel-bg/90 p-0.5 sm:p-1 rounded-2xl border border-pastel-border shadow-2xs overflow-x-auto no-scrollbar scroll-smooth">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = currentStudioTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    if (tab.id === 'incidents') {
                      openTopicBugHunt('core', 'Java Core & Spring Incidents');
                    } else {
                      setStudioTab(tab.id);
                    }
                  }}
                  className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer relative shrink-0 active:scale-95 touch-manipulation ${
                    isActive
                      ? 'bg-white text-pastel-text shadow-xs border border-pastel-border/60'
                      : 'text-pastel-muted hover:text-pastel-text hover:bg-white/40'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-pastel-accentRose' : 'text-pastel-muted'}`} />
                  <span>{tab.shortLabel}</span>

                  {tab.badge && (
                    <span className={`text-[8px] sm:text-[9px] px-1 sm:px-1.5 py-0.2 rounded-full font-bold ml-0.5 ${
                      tab.id === 'practice'
                        ? 'bg-gradient-to-r from-amber-200 to-rose-200 text-amber-900 border border-amber-300/60'
                        : 'bg-pastel-rose text-pastel-accentRose'
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
              className="flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-full text-xs font-bold bg-pastel-rose text-pastel-accentRose border border-pastel-accentRose/30 hover:bg-pastel-accentRose hover:text-white transition shadow-xs cursor-pointer animate-pulse-subtle shrink-0"
              title="Вернуться к текущему шагу в Академии"
            >
              <span className="hidden sm:inline">← Академия</span>
              <span className="sm:hidden">← #</span>
              <span className="opacity-90 font-mono text-[11px]">{academyBreadcrumbContext.stepNumber}</span>
            </button>
          )}

          {renderHealthBadge()}

          {currentUser && (
            <div className="flex items-center gap-1 pl-1 sm:pl-2 border-l border-pastel-border/80">
              {currentUser.role === 'owner' && (
                <button
                  onClick={openAdminInvitesModal}
                  title="Генератор инвайт-кодов (Владелец)"
                  className="flex items-center gap-1 text-xs font-bold px-2 sm:px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100/80 text-amber-800 border border-amber-200/80 shadow-2xs transition cursor-pointer"
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
    </header>
  );
};
