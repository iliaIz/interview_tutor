import React from 'react';
import {
  ArrowLeft,
  RotateCcw,
  Compass,
  Bot,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { TransactionScenario } from '../../types/transactionLab';

interface TransactionLabHeaderProps {
  scenario: TransactionScenario;
  onBack: () => void;
  lastSavedTime: string | null;
  isVoiceConnected: boolean;
  onToggleVoice: () => void;
  isFocusMode: boolean;
  onToggleFocusMode: () => void;
  onToggleCompass: () => void;
  onReset: () => void;
}

/**
 * TransactionLabHeader.tsx (SOTA Late 2026).
 * Single responsibility: top navigation bar with scenario meta, voice tutor toggle, and mode controls.
 * Cognitive bounding limit: <= 350 lines.
 */
export const TransactionLabHeader: React.FC<TransactionLabHeaderProps> = ({
  scenario,
  onBack,
  lastSavedTime,
  isVoiceConnected,
  onToggleVoice,
  isFocusMode,
  onToggleFocusMode,
  onToggleCompass,
  onReset
}) => {
  return (
    <div className="h-12 border-b border-pastel-border/80 bg-white/90 backdrop-blur-md px-3 sm:px-4 flex items-center justify-between shrink-0 z-10 shadow-2xs gap-2">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 text-xs font-bold text-pastel-muted hover:text-pastel-text px-2 py-1.5 rounded-xl hover:bg-pastel-bg transition cursor-pointer shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Каталог</span>
        </button>
        <div className="h-4 w-px bg-pastel-border shrink-0" />
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-bold text-xs text-pastel-text truncate max-w-[140px] sm:max-w-xs">
            {scenario.title}
          </span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pastel-rose text-pastel-accentRose border border-pastel-accentRose/20 hidden lg:inline shrink-0">
            {scenario.level}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {lastSavedTime && (
          <span className="hidden xl:inline text-[10px] text-pastel-muted font-mono">
            Сохранено {lastSavedTime}
          </span>
        )}

        <button
          type="button"
          onClick={onToggleVoice}
          title={isVoiceConnected ? "Отключить AI-напарника" : "Запустить AI-напарника для парного программирования"}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold border shadow-2xs transition cursor-pointer ${
            isVoiceConnected
              ? 'bg-pastel-accentRose text-white border-pastel-accentRose'
              : 'bg-white text-slate-700 border-pastel-border hover:border-pastel-accentRose/50'
          }`}
        >
          <Bot className="w-3.5 h-3.5 text-pastel-accentRose" />
          <span className="hidden sm:inline">AI-Напарник</span>
        </button>

        <button
          type="button"
          onClick={onToggleFocusMode}
          title={isFocusMode ? "Показать постановку задачи и каталог" : "Развернуть интерактивный редактор на 100% высоты (Focus Mode)"}
          className={`hidden md:flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold border transition cursor-pointer ${
            isFocusMode
              ? 'bg-pastel-rose text-pastel-accentRoseText border-pastel-accentRose/40 shadow-2xs'
              : 'bg-white text-pastel-text border-pastel-border hover:bg-pastel-bg'
          }`}
        >
          {isFocusMode ? <Minimize2 className="w-3.5 h-3.5 text-pastel-accentRoseText" /> : <Maximize2 className="w-3.5 h-3.5 text-pastel-muted" />}
          <span>{isFocusMode ? 'Показать спеку' : 'Focus Mode'}</span>
        </button>

        <button
          type="button"
          onClick={onToggleCompass}
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-xl bg-white hover:bg-pastel-bg text-pastel-text border border-pastel-border transition cursor-pointer text-xs font-semibold shadow-2xs"
        >
          <Compass className="w-3.5 h-3.5 text-pastel-accentRose" />
          <span className="hidden sm:inline">Transaction Compass</span>
          <kbd className="hidden sm:inline px-1 py-0.2 rounded bg-slate-100 border border-pastel-border text-[9px] text-pastel-muted">Ctrl+/</kbd>
        </button>

        <button
          type="button"
          onClick={onReset}
          className="flex items-center gap-1 px-2 py-1 rounded-xl text-pastel-muted hover:text-rose-500 hover:bg-rose-50 transition cursor-pointer text-xs"
          title="Сбросить конфигурацию к значениям по умолчанию"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Сброс</span>
        </button>
      </div>
    </div>
  );
};
