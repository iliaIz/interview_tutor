import React from 'react';
import { DEBUG_STEPS, DebugStepDef } from './debugStepDefinitions';
import { CheckCircle2, Play, AlertCircle, Layers, Sparkles, ChevronRight, Activity } from 'lucide-react';

interface DebugStepPipelineProps {
  selectedStep: number;
  onSelectStep: (step: number) => void;
  isRunning: boolean;
  stepStatusMap: Record<number, 'idle' | 'running' | 'success' | 'error'>;
}

/**
 * DebugStepPipeline (SOTA Late 2026).
 * Interactive step-by-step pipeline decomposition selector for Auto-VAD live v3.
 * Cognitive bounding limit: <= 350 lines.
 */
export const DebugStepPipeline: React.FC<DebugStepPipelineProps> = ({
  selectedStep,
  onSelectStep,
  isRunning,
  stepStatusMap
}) => {
  return (
    <div className="bg-white/80 backdrop-blur-md border border-pastel-rose/80 rounded-3xl p-5 shadow-xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-pastel-border/60">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-violet-500 via-purple-500 to-pink-500 flex items-center justify-center text-white shadow-sm shadow-purple-500/20">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-pastel-text">Конвейер пошаговой декомпозиции</h2>
            <p className="text-[11px] text-pastel-muted">
              Каждый шаг добавляет ровно один слой поверх чистого ядра Google Gemini Live v3
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-pastel-card border border-pastel-border/80 text-[11px] font-mono font-bold text-pastel-text">
          <Sparkles className="w-3.5 h-3.5 text-pastel-accentRose" />
          <span>7 Шагов (0 - 6)</span>
        </div>
      </div>

      {/* Steps List */}
      <div className="space-y-2.5">
        {DEBUG_STEPS.map((def: DebugStepDef) => {
          const isSelected = selectedStep === def.step;
          const status = stepStatusMap[def.step] || 'idle';

          return (
            <div
              key={def.step}
              onClick={() => {
                if (!isRunning) onSelectStep(def.step);
              }}
              className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group ${
                isSelected
                  ? 'bg-gradient-to-r from-violet-50/90 via-pink-50/70 to-rose-50/90 border-violet-300 ring-2 ring-violet-200/80 shadow-md'
                  : 'bg-pastel-bg/50 hover:bg-white border-pastel-border/70 hover:border-violet-200'
              } ${isRunning ? 'cursor-not-allowed opacity-90' : ''}`}
            >
              {/* Active Step Indicator Pill */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className={`w-7 h-7 rounded-xl flex items-center justify-center font-mono font-bold text-xs shrink-0 transition-all ${
                      isSelected
                        ? 'bg-violet-600 text-white shadow-sm shadow-violet-500/30'
                        : 'bg-white text-pastel-muted border border-pastel-border group-hover:text-violet-600 group-hover:border-violet-200'
                    }`}
                  >
                    {def.step}
                  </div>

                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-pastel-text group-hover:text-violet-900 transition truncate">
                        {def.title}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold ${
                          def.step === 0
                            ? 'bg-emerald-100/80 text-emerald-800 border border-emerald-200'
                            : def.step === 6
                            ? 'bg-rose-100/80 text-rose-800 border border-rose-200'
                            : 'bg-violet-100/80 text-violet-800 border border-violet-200'
                        }`}
                      >
                        {def.badge}
                      </span>
                    </div>

                    <p className="text-[11px] text-pastel-muted line-clamp-1">
                      {def.subtitle}
                    </p>

                    <div className="text-[10px] text-slate-600 font-medium flex items-center gap-1.5 pt-0.5">
                      <span className="text-violet-600 font-bold">+ Добавлено:</span>
                      <span className="truncate">{def.layerAdded}</span>
                    </div>
                  </div>
                </div>

                {/* Right Status Badge */}
                <div className="flex items-center gap-2 shrink-0">
                  {status === 'running' && (
                    <span className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-100 text-amber-800 text-[10px] font-bold animate-pulse">
                      <Activity className="w-3 h-3 animate-spin" />
                      <span>Тестируется</span>
                    </span>
                  )}
                  {status === 'success' && (
                    <span className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span>Пройден</span>
                    </span>
                  )}
                  {status === 'error' && (
                    <span className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-rose-100 text-rose-800 text-[10px] font-bold">
                      <AlertCircle className="w-3 h-3 text-rose-600" />
                      <span>Сбой</span>
                    </span>
                  )}
                  {status === 'idle' && (
                    <span
                      className={`p-1.5 rounded-xl transition ${
                        isSelected
                          ? 'bg-violet-200/80 text-violet-800'
                          : 'text-pastel-muted group-hover:text-violet-600 group-hover:bg-violet-50'
                      }`}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </span>
                  )}
                </div>
              </div>

              {/* Expanded Highlights for Selected Step */}
              {isSelected && (
                <div className="mt-3 pt-3 border-t border-violet-200/60 space-y-2 text-[11px]">
                  <p className="text-slate-700 leading-relaxed font-sans">
                    {def.description}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                    {def.highlights.map((h, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-slate-600">
                        <span className="w-1.5 h-1.5 rounded-full bg-violet-500 shrink-0" />
                        <span className="truncate">{h}</span>
                      </div>
                    ))}
                  </div>

                  <div className="p-2.5 rounded-xl bg-white/90 border border-violet-100 mt-2 space-y-1">
                    <div className="text-[10px] font-bold text-violet-700 uppercase tracking-wide">
                      Ожидаемый ответ модели:
                    </div>
                    <div className="text-slate-800 italic">
                      «{def.expectedGreeting}»
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
