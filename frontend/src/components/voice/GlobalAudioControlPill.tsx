import React from 'react';
import { Headphones, ChevronDown } from 'lucide-react';
import { VoiceSettingsDrawer } from '../VoiceSettingsDrawer';
import { useGlobalAudioPill } from './audio_pill/useGlobalAudioPill';
import { GlobalAudioDrawerContent } from './audio_pill/GlobalAudioDrawerContent';

export const GlobalAudioControlPill: React.FC = () => {
  const {
    isOpen,
    setIsOpen,
    isAdvancedOpen,
    setIsAdvancedOpen,
    config,
    updateConfig,
    previewingVoice,
    playVoicePreview,
    turnMode,
    voice,
    targetGrade,
    alwaysShowPreflight,
    popoverRef,
    getGradeShort
  } = useGlobalAudioPill();

  return (
    <div className="relative shrink-0" ref={popoverRef}>
      {/* 1. Ambient Top Bar Pill */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        title="Настройки голосового тракта (Голос, Режим реплик, Быстрый старт)"
        className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-200 cursor-pointer shadow-2xs active:scale-95 touch-manipulation select-none ${
          isOpen
            ? 'bg-pastel-accentRose/15 text-pastel-accentRoseText border-pastel-accentRose/40 shadow-xs'
            : 'bg-pastel-card hover:bg-pastel-rose/50 text-pastel-text border-pastel-border hover:border-pastel-accentRose/30'
        }`}
      >
        <span className="flex items-center gap-1">
          <span className={`w-2 h-2 rounded-full ${turnMode === 'auto' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
          <Headphones className="w-3.5 h-3.5 text-pastel-accentRose" />
        </span>

        <span className="hidden md:inline font-bold text-[11px] text-pastel-text">
          {voice}
        </span>

        <span className="hidden xl:inline text-[10px] text-pastel-muted font-normal">
          ·
        </span>

        <span className="hidden xl:inline text-[10px] font-medium text-pastel-muted">
          {turnMode === 'auto' ? 'Авто' : 'По очереди'}
        </span>

        <ChevronDown className={`w-3 h-3 text-pastel-muted transition-transform duration-200 ${isOpen ? 'rotate-180 text-pastel-accentRose' : ''}`} />
      </button>

      {/* 2. Interactive Popover Drawer */}
      {isOpen && (
        <GlobalAudioDrawerContent
          turnMode={turnMode}
          voice={voice}
          targetGrade={targetGrade}
          alwaysShowPreflight={alwaysShowPreflight}
          config={config}
          updateConfig={updateConfig}
          previewingVoice={previewingVoice}
          onPlayPreview={playVoicePreview}
          onOpenAdvanced={() => {
            setIsOpen(false);
            setIsAdvancedOpen(true);
          }}
        />
      )}

      {/* Advanced Settings Drawer Modal */}
      <VoiceSettingsDrawer
        isOpen={isAdvancedOpen}
        onClose={() => setIsAdvancedOpen(false)}
      />
    </div>
  );
};
