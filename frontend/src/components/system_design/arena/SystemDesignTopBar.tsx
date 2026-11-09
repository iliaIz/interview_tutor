import React from 'react';
import {
  ArrowLeft,
  BookOpen,
  Calculator,
  Layers,
  MessageSquare,
  Compass,
  Radio,
  Award,
  Loader2,
  Bot
} from 'lucide-react';
import { usePracticeTutorStore } from '../../../store/usePracticeTutorStore';

interface SystemDesignTopBarProps {
  title: string;
  academyBreadcrumbContext?: any;
  returnToAcademyStep: () => void;
  closeSystemDesignScenario: () => void;
  isDraftRestored: boolean;
  activeTab: 'spec' | 'architecture' | 'math_coach' | 'staff_ai';
  setActiveTab: (tab: 'spec' | 'architecture' | 'math_coach' | 'staff_ai') => void;
  onOpenCompass: () => void;
  isVoiceConnected: boolean;
  onToggleVoiceDefense: () => void;
  onEvaluate: () => void;
  isEvaluating: boolean;
}

export const SystemDesignTopBar: React.FC<SystemDesignTopBarProps> = ({
  title,
  academyBreadcrumbContext,
  returnToAcademyStep,
  closeSystemDesignScenario,
  isDraftRestored,
  activeTab,
  setActiveTab,
  onOpenCompass,
  isVoiceConnected,
  onToggleVoiceDefense,
  onEvaluate,
  isEvaluating
}) => {
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
            onClick={closeSystemDesignScenario}
            className="flex items-center gap-1 text-xs font-bold text-pastel-muted hover:text-pastel-text px-2.5 py-1.5 rounded-xl hover:bg-pastel-rose/40 transition cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Каталог HLD</span>
          </button>
        )}

        <div className="h-4 w-px bg-pastel-border shrink-0" />

        <span className="font-bold text-xs text-pastel-text truncate max-w-[140px] sm:max-w-md">
          {title}
        </span>

        {isDraftRestored && (
          <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
            💾 Черновик восстановлен
          </span>
        )}
      </div>

      {/* Tab Switcher */}
      <div className="flex items-center bg-pastel-bg p-0.5 rounded-xl border border-pastel-border shrink-0">
        <button
          onClick={() => setActiveTab('spec')}
          className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
            activeTab === 'spec'
              ? 'bg-white text-pastel-accentRose shadow-2xs border border-pastel-border'
              : 'text-pastel-muted hover:text-pastel-text'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>ТЗ & Расчеты</span>
        </button>

        <button
          onClick={() => setActiveTab('math_coach')}
          className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
            activeTab === 'math_coach'
              ? 'bg-white text-pastel-accentRose shadow-2xs border border-pastel-border'
              : 'text-pastel-muted hover:text-pastel-text'
          }`}
        >
          <Calculator className="w-3.5 h-3.5" />
          <span>Math Coach</span>
        </button>

        <button
          onClick={() => setActiveTab('architecture')}
          className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
            activeTab === 'architecture'
              ? 'bg-white text-pastel-accentRose shadow-2xs border border-pastel-border'
              : 'text-pastel-muted hover:text-pastel-text'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Архитектура & Схема</span>
        </button>

        <button
          onClick={() => setActiveTab('staff_ai')}
          className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
            activeTab === 'staff_ai'
              ? 'bg-white text-pastel-accentRose shadow-2xs border border-pastel-border'
              : 'text-pastel-muted hover:text-pastel-text'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Staff AI</span>
        </button>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => usePracticeTutorStore.getState().toggleOpen()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-pastel-accentRose/15 hover:bg-pastel-accentRose/25 text-pastel-accentRose border border-pastel-accentRose/30 transition cursor-pointer shadow-2xs"
          title="Открыть AI-Напарника (Текст / Голос Gemini Live)"
        >
          <Bot className="w-3.5 h-3.5 text-pastel-accentRose" />
          <span className="hidden sm:inline">AI-Напарник</span>
        </button>

        <button
          onClick={onOpenCompass}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/80 transition cursor-pointer shadow-2xs"
          title="Шпаргалка System Design Compass (Ctrl + /)"
        >
          <Compass className="w-3.5 h-3.5 text-amber-600" />
          <span className="hidden sm:inline">Компас (Ctrl+/)</span>
        </button>

        {/* Live Bar-Raiser Defense Trigger */}
        <button
          onClick={onToggleVoiceDefense}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs ${
            isVoiceConnected
              ? 'bg-purple-100 text-purple-900 border border-purple-300'
              : 'bg-gradient-to-r from-purple-600 to-pastel-accentViolet text-white hover:opacity-95'
          }`}
          title="Запустить голосовую защиту с Bar-Raiser (Live Audio)"
        >
          <Radio className={`w-3.5 h-3.5 ${isVoiceConnected ? 'text-purple-600 animate-pulse' : 'text-white'}`} />
          <span className="hidden sm:inline">{isVoiceConnected ? 'Защита активна' : '🎙️ Защита Bar-Raiser'}</span>
          <span className="sm:hidden">{isVoiceConnected ? 'Активна' : '🎙️ Голос'}</span>
        </button>

        <button
          onClick={onEvaluate}
          disabled={isEvaluating}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-pastel-accentRose via-pink-500 to-pastel-accentViolet text-white transition shadow-sm shadow-pastel-accentRose/20 cursor-pointer disabled:opacity-50 shrink-0 touch-manipulation active:scale-95"
        >
          {isEvaluating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Award className="w-3.5 h-3.5" />}
          <span className="hidden sm:inline">{isEvaluating ? 'Оценка...' : 'Сдать проект (Ctrl+↵)'}</span>
          <span className="sm:hidden">{isEvaluating ? '...' : 'Сдать'}</span>
        </button>
      </div>
    </div>
  );
};
