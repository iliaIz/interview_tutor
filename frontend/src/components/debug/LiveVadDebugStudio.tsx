import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useAuthStore } from '../../store/useAuthStore';
import { DebugStepPipeline } from './DebugStepPipeline';
import { DebugConfigInspector } from './DebugConfigInspector';
import { DebugLiveConsole } from './DebugLiveConsole';
import { VoiceSettingsDrawer } from '../VoiceSettingsDrawer';
import { ShieldAlert, ArrowLeft, Sliders, Sparkles, Layers, Cpu } from 'lucide-react';

/**
 * LiveVadDebugStudio (SOTA Late 2026).
 * Owner-only diagnostic and incremental verification studio for Gemini Live v3.
 * Decomposes platform additions step-by-step from clean baseline (Step 0) to full stack (Step 6).
 * Cognitive bounding limit: <= 350 lines.
 */
export const LiveVadDebugStudio: React.FC = () => {
  const { setStudioTab } = useAppStore();
  const { currentUser } = useAuthStore();
  const [selectedStep, setSelectedStep] = useState<number>(0);
  const [isVoiceSettingsOpen, setIsVoiceSettingsOpen] = useState(false);
  const [stepStatusMap, setStepStatusMap] = useState<Record<number, 'idle' | 'running' | 'success' | 'error'>>({
    0: 'idle',
    1: 'idle',
    2: 'idle',
    3: 'idle',
    4: 'idle',
    5: 'idle',
    6: 'idle'
  });

  // Strict Owner Access Guard
  if (!currentUser || currentUser.role !== 'owner') {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white/90 border border-rose-200 rounded-3xl p-6 shadow-xl text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-slate-800">Доступ ограничен</h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            Лаборатория глубокой пошаговой декомпозиции Авто-VAD live v3 доступна исключительно для учетной записи с ролью Владельца (Owner).
          </p>
          <button
            onClick={() => setStudioTab('practice')}
            className="w-full py-2.5 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 transition cursor-pointer"
          >
            Вернуться в практическую арену
          </button>
        </div>
      </div>
    );
  }

  const handleStepResult = (step: number, status: 'success' | 'error') => {
    setStepStatusMap((prev) => ({ ...prev, [step]: status }));
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 space-y-6 relative z-10 font-sans">
      {/* Top Banner / Studio Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-3xl bg-white/70 backdrop-blur-md border border-pastel-rose/80 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-xl bg-violet-100 text-violet-800 border border-violet-200 text-xs font-mono font-bold flex items-center gap-1.5 shadow-2xs">
              <Sparkles className="w-3.5 h-3.5 text-violet-600" />
              <span>Owner Diagnostic Studio</span>
            </span>
            <span className="px-2.5 py-1 rounded-xl bg-pastel-card text-pastel-muted border border-pastel-border text-xs font-mono">
              SOTA Late 2026
            </span>
          </div>

          <h1 className="text-xl sm:text-2xl font-black text-pastel-text tracking-tight flex items-center gap-2">
            Лаборатория Авто-VAD live v3
          </h1>
          <p className="text-xs text-pastel-muted max-w-2xl leading-relaxed">
            Пошаговая изоляция платформенных надстроек. Проверка чистого ядра Google Gemini Live v3 «из коробки» (Шаг 0) и послойный ввод промптов, кода, инструментов и VAD.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => setIsVoiceSettingsOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-white hover:bg-violet-50 text-slate-700 hover:text-violet-800 border border-pastel-border hover:border-violet-300 text-xs font-bold transition shadow-2xs cursor-pointer"
          >
            <Sliders className="w-4 h-4 text-violet-600" />
            <span>Настройки голосового тракта</span>
          </button>

          <button
            onClick={() => setStudioTab('practice')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-pastel-card hover:bg-pastel-rose/40 text-pastel-text text-xs font-bold border border-pastel-border transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>В студию</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Left Pipeline (Steps 0..6) + Right Live Harness & Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Step Selector Pipeline (5 columns) */}
        <div className="lg:col-span-5 space-y-4">
          <DebugStepPipeline
            selectedStep={selectedStep}
            onSelectStep={(step) => {
              setSelectedStep(step);
              setStepStatusMap((prev) => ({ ...prev, [step]: 'idle' }));
            }}
            isRunning={stepStatusMap[selectedStep] === 'running'}
            stepStatusMap={stepStatusMap}
          />
        </div>

        {/* Live Test Console & Configuration Inspector (7 columns) */}
        <div className="lg:col-span-7 space-y-4">
          <DebugLiveConsole
            selectedStep={selectedStep}
            onStepResult={handleStepResult}
          />

          <DebugConfigInspector selectedStep={selectedStep} />
        </div>
      </div>

      {/* Voice Settings Drawer */}
      <VoiceSettingsDrawer
        isOpen={isVoiceSettingsOpen}
        onClose={() => setIsVoiceSettingsOpen(false)}
      />
    </div>
  );
};
