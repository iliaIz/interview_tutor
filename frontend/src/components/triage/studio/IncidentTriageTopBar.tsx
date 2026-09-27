import React from 'react';
import {
  ArrowLeft,
  Terminal,
  Activity,
  Award,
  Compass,
  MessageSquare,
  Loader2,
  Clock,
  ShieldAlert,
  CheckCircle2
} from 'lucide-react';

interface IncidentTriageTopBarProps {
  title: string;
  severity?: string;
  academyBreadcrumbContext?: any;
  returnToAcademyStep: () => void;
  closeTriageIncident: () => void;
  activeTab: 'symptoms' | 'artifact' | 'rca' | 'incident_commander';
  setActiveTab: (tab: 'symptoms' | 'artifact' | 'rca' | 'incident_commander') => void;
  onOpenCompass: () => void;
  onEvaluate: () => void;
  isEvaluating: boolean;
  phase: 'mttm' | 'mttr';
  onMitigate: () => void;
  elapsedSeconds: number;
}

export const IncidentTriageTopBar: React.FC<IncidentTriageTopBarProps> = ({
  title,
  severity,
  academyBreadcrumbContext,
  returnToAcademyStep,
  closeTriageIncident,
  activeTab,
  setActiveTab,
  onOpenCompass,
  onEvaluate,
  isEvaluating,
  phase,
  onMitigate,
  elapsedSeconds
}) => {
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-14 border-b border-pastel-border/80 bg-white/95 backdrop-blur-md px-3 sm:px-4 flex items-center justify-between shrink-0 z-10 shadow-2xs gap-2">
      <div className="flex items-center gap-2 min-w-0">
        {academyBreadcrumbContext ? (
          <button
            onClick={returnToAcademyStep}
            className="flex items-center gap-1 text-xs font-bold text-pastel-accentRose bg-pastel-rose hover:bg-pastel-accentRose hover:text-white px-2.5 py-1.5 rounded-xl border border-pastel-accentRose/30 transition cursor-pointer shrink-0"
            title="Вернуться к шагу курса в Академии"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">← Назад в Академию: Шаг #{academyBreadcrumbContext.stepNumber}</span>
            <span className="sm:hidden">← Шаг #{academyBreadcrumbContext.stepNumber}</span>
          </button>
        ) : (
          <button
            onClick={closeTriageIncident}
            className="flex items-center gap-1 text-xs font-bold text-pastel-muted hover:text-pastel-text px-2.5 py-1.5 rounded-xl hover:bg-pastel-rose/40 transition cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Каталог Аварий</span>
          </button>
        )}

        <div className="h-4 w-px bg-pastel-border shrink-0" />

        <span className="font-bold text-xs text-pastel-text truncate max-w-[140px] sm:max-w-xs">
          {title}
        </span>

        {severity && (
          <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 shrink-0">
            {severity}
          </span>
        )}
      </div>

      {/* Dual-Phase Incident Timer HUD */}
      <div className="hidden md:flex items-center gap-2 bg-pastel-bg px-2.5 py-1 rounded-xl border border-pastel-border text-xs font-mono">
        <Clock className={`w-3.5 h-3.5 ${phase === 'mttm' ? 'text-amber-500 animate-pulse' : 'text-emerald-500'}`} />
        <span className="font-bold text-pastel-text">{formatTime(elapsedSeconds)}</span>
        <div className="h-3 w-px bg-pastel-border" />
        {phase === 'mttm' ? (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-amber-700 font-bold">Фаза 1 (MTTM)</span>
            <button
              onClick={onMitigate}
              className="text-[10px] bg-amber-500 hover:bg-amber-600 text-white px-2 py-0.5 rounded-lg font-bold transition cursor-pointer active:scale-95"
              title="Зафиксировать локализацию трафика и перейти к RCA"
            >
              Митигировать →
            </button>
          </div>
        ) : (
          <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Фаза 2: RCA (MTTR)
          </span>
        )}
      </div>

      {/* Tab Switcher */}
      <div className="flex items-center bg-pastel-bg p-0.5 rounded-xl border border-pastel-border shrink-0">
        <button
          onClick={() => setActiveTab('artifact')}
          className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
            activeTab === 'artifact' ? 'bg-white text-pastel-accentRose shadow-2xs border border-pastel-border' : 'text-pastel-muted hover:text-pastel-text'
          }`}
        >
          <Terminal className="w-3.5 h-3.5" />
          <span>Дамп & Артефакты</span>
        </button>

        <button
          onClick={() => setActiveTab('symptoms')}
          className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
            activeTab === 'symptoms' ? 'bg-white text-pastel-accentRose shadow-2xs border border-pastel-border' : 'text-pastel-muted hover:text-pastel-text'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Симптомы</span>
        </button>

        <button
          onClick={() => setActiveTab('rca')}
          className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
            activeTab === 'rca' ? 'bg-white text-pastel-accentRose shadow-2xs border border-pastel-border' : 'text-pastel-muted hover:text-pastel-text'
          }`}
        >
          <Award className="w-3.5 h-3.5" />
          <span>RCA & Фикс</span>
        </button>

        <button
          onClick={() => setActiveTab('incident_commander')}
          className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
            activeTab === 'incident_commander' ? 'bg-white text-pastel-accentRose shadow-2xs border border-pastel-border' : 'text-pastel-muted hover:text-pastel-text'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Commander</span>
        </button>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onOpenCompass}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/80 transition cursor-pointer shadow-2xs"
          title="Шпаргалка Triage Compass (Ctrl + /)"
        >
          <Compass className="w-3.5 h-3.5 text-amber-600" />
          <span className="hidden sm:inline">Компас (Ctrl+/)</span>
        </button>

        <button
          onClick={onEvaluate}
          disabled={isEvaluating}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-pastel-accentRose via-pink-500 to-pastel-accentViolet text-white transition shadow-sm shadow-pastel-accentRose/20 cursor-pointer disabled:opacity-50 shrink-0 touch-manipulation active:scale-95"
        >
          {isEvaluating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Award className="w-3.5 h-3.5" />}
          <span className="hidden sm:inline">{isEvaluating ? 'Оценка...' : 'Сдать RCA (Ctrl+↵)'}</span>
          <span className="sm:hidden">{isEvaluating ? '...' : 'Сдать'}</span>
        </button>
      </div>
    </div>
  );
};
