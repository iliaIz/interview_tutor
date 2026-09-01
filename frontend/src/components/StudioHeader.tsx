import React from 'react';
import { useAppStore, StudioTab } from '../store/useAppStore';
import { Sparkles, Headphones, Loader2, AlertCircle, BookOpen, Bug, Code2, Compass, Terminal, Layers } from 'lucide-react';

export const StudioHeader: React.FC = () => {
  const { currentStudioTab, setStudioTab, systemHealth, openTopicBugHunt } = useAppStore();

  const renderHealthBadge = () => {
    if (systemHealth.isAiReady) {
      return (
        <div
          title={systemHealth.message || "AI Шлюз активен. Модель Gemini 3.7 Flash проверена в LiteLLM."}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-emerald-50/90 text-emerald-700 border border-emerald-200/80 shadow-2xs backdrop-blur-sm cursor-default"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <Headphones className="w-3.5 h-3.5 text-emerald-600 hidden sm:inline" />
          <span className="hidden sm:inline">AI Шлюз готов</span>
          <span className="sm:hidden">Готов</span>
          {systemHealth.latencyMs && (
            <span className="text-[10px] opacity-70">({systemHealth.latencyMs}мс)</span>
          )}
        </div>
      );
    }

    if (systemHealth.status === 'warming_up' || systemHealth.status === 'checking') {
      return (
        <div
          title={systemHealth.error || "Проверка моделей в LiteLLM-Proxy..."}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200/80 shadow-2xs animate-pulse cursor-help"
        >
          <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
          <span className="hidden sm:inline">{systemHealth.error ? 'Синхронизация...' : 'Инициализация AI...'}</span>
          <span className="sm:hidden">Запуск...</span>
        </div>
      );
    }

    return (
      <div
        title={systemHealth.error || 'Проверьте запуск LiteLLM_Proxy'}
        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs cursor-help"
      >
        <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
        <span className="hidden sm:inline">AI Офлайн</span>
        <span className="sm:hidden">Офлайн</span>
      </div>
    );
  };

  const tabs: { id: StudioTab; label: string; icon: React.ComponentType<any>; badge?: string }[] = [
    { id: 'roadmaps', label: 'Траектории', icon: Compass, badge: '25/50/100' },
    { id: 'theory', label: 'База знаний', icon: BookOpen },
    { id: 'incidents', label: 'Инциденты', icon: Bug, badge: '70 Ката' },
    { id: 'triage', label: 'Триаж Дампов', icon: Terminal, badge: '15 Дампов' },
    { id: 'practice', label: 'Machine Coding', icon: Code2, badge: '35 LLD' },
    { id: 'system_design', label: 'System Design', icon: Layers, badge: '20 HLD' }
  ];


  return (
    <header className="border-b border-pastel-border/70 bg-white/80 backdrop-blur-xl sticky top-0 z-40 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-2">
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-pastel-accentRose via-pink-400 to-pastel-accentViolet flex items-center justify-center text-white font-bold shadow-sm shadow-pastel-accentRose/20">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="font-bold text-sm sm:text-base tracking-tight text-pastel-text">InterviewPrep AI</h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pastel-rose text-pastel-accentRose border border-pastel-accentRose/20">Studio</span>
            </div>
            <p className="text-[10px] text-pastel-muted font-medium hidden md:block">Твой личный ИИ-ментор по Java & Spring</p>
          </div>
        </div>

        {/* Studio Mode Segmented Switcher */}
        <nav className="flex items-center bg-pastel-bg/90 p-1 rounded-2xl border border-pastel-border shadow-2xs">
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
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer relative ${
                  isActive
                    ? 'bg-white text-pastel-text shadow-xs border border-pastel-border/60'
                    : 'text-pastel-muted hover:text-pastel-text hover:bg-white/40'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-pastel-accentRose' : 'text-pastel-muted'}`} />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.label.split(' ')[0]}</span>

                {tab.badge && (
                  <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold ml-0.5 ${
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

        {/* Health Status Badge */}
        <div className="flex items-center gap-2 shrink-0">
          {renderHealthBadge()}
        </div>
      </div>
    </header>
  );
};
