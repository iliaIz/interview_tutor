import React, { useState, useEffect } from 'react';
import { 
  Wrench, Layers, Radio, ArrowLeft, ShieldCheck, 
  Sparkles, Award, Cpu, BookOpen, ChevronRight, Bot
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { usePracticeTutorStore } from '../../store/usePracticeTutorStore';
import { normalizeSystemDesignContext } from '@interview-prep/shared';
import { ForensicCodeEditor } from './studio_1_runtime/ForensicCodeEditor';
import { HikariPoolVisualizer } from './studio_1_runtime/HikariPoolVisualizer';
import { VirtualThreadPinningLab } from './studio_1_runtime/VirtualThreadPinningLab';
import { PagedAttentionVisualizer } from './studio_1_runtime/PagedAttentionVisualizer';
import { TopologyCanvas } from './studio_2_topology/TopologyCanvas';
import { VoiceDefenseArena } from './studio_3_bar_raiser/VoiceDefenseArena';

export const MultiScaleCanvasHub: React.FC = () => {
  const {
    activeSystemDesignScenario,
    closeSystemDesignScenario,
    activeTriStudioMode,
    setActiveTriStudioMode,
    academyBreadcrumbContext,
    setStudioTab
  } = useAppStore();

  const [studio1SubTab, setStudio1SubTab] = useState<'code' | 'hikari' | 'virtual_threads' | 'paged_attention'>('code');
  const [isRuntimeFixApplied, setIsRuntimeFixApplied] = useState(false);

  if (!activeSystemDesignScenario) {
    return null;
  }

  const scenario = activeSystemDesignScenario;
  const runtimeSpec = scenario.studio_1_runtime;

  const handleBack = () => {
    if (academyBreadcrumbContext) {
      setStudioTab('academy');
    } else {
      closeSystemDesignScenario();
    }
  };

  useEffect(() => {
    if (activeTriStudioMode === 'topology') {
      const timer = setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [activeTriStudioMode]);

  // Dynamic Omnipresent Copilot Context Streaming (SPEC-13 §4.2.1)
  useEffect(() => {
    if (!scenario) return;

    const payload = normalizeSystemDesignContext({
      scenarioId: scenario.canonical_id || scenario.id,
      scenarioTitle: scenario.title,
      targetLevel: scenario.target_level,
      activeStudioTab: activeTriStudioMode === 'runtime' ? 'runtime' : activeTriStudioMode === 'topology' ? 'topology' : 'defense',
      activeCodeSnippet: runtimeSpec?.source_files?.[0]?.content,
      activeFilePath: runtimeSpec?.source_files?.[0]?.path,
      fadedBug: runtimeSpec?.faded_bug ? {
        lineNumber: runtimeSpec.faded_bug.line_number,
        description: runtimeSpec.faded_bug.description,
        bugPattern: runtimeSpec.faded_bug.bug_pattern
      } : undefined,
      topologySummary: scenario.studio_2_simulation?.topology?.nodes
        ? scenario.studio_2_simulation.topology.nodes.map((n: { title?: string; id?: string }) => n.title || n.id || '').join(' -> ')
        : undefined,
      companyContextName: 'Raiffeisen DGTL Product Engineer'
    });

    usePracticeTutorStore.getState().setActiveContext(payload);
  }, [scenario, activeTriStudioMode, studio1SubTab, runtimeSpec]);

  useEffect(() => {
    return () => {
      const store = usePracticeTutorStore.getState();
      if (store.activeContext?.arena === 'system_design') {
        store.setActiveContext(null);
      }
    };
  }, []);

  return (
    <div className="flex flex-col h-[calc(100dvh-4rem)] w-full bg-slate-950 text-slate-100 relative overflow-hidden font-sans select-none">
      {/* Top Navigation Bar with Soft Luxury Pastel Aesthetics */}
      <header className="h-14 px-6 bg-slate-900/90 border-b border-slate-800/80 backdrop-blur-md flex items-center justify-between shrink-0 z-30 shadow-md">
        {/* Left: Breadcrumbs & Scenario Title */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={handleBack}
            className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition cursor-pointer flex items-center gap-1 text-xs"
            title={academyBreadcrumbContext ? 'Вернуться в Академию' : 'Вернуться в каталог'}
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden md:inline font-semibold">
              {academyBreadcrumbContext ? 'Академия' : 'Каталог'}
            </span>
          </button>

          <div className="h-4 w-px bg-slate-800 hidden sm:block" />

          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-bold text-white truncate max-w-[240px] sm:max-w-md">
              {scenario.title}
            </span>
            <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-800 shrink-0">
              {scenario.target_level || 'L5'}
            </span>
            <span className="text-[10px] font-mono text-slate-400 uppercase px-2 py-0.5 rounded-full bg-slate-800/80 shrink-0 hidden lg:inline">
              {scenario.archetype || 'DISTRIBUTED_SYSTEM'}
            </span>
          </div>
        </div>

        {/* Center: 3 Tri-Studio Modes Switcher */}
        <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-2xl border border-slate-800 shadow-inner">
          <button
            onClick={() => setActiveTriStudioMode('runtime')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTriStudioMode === 'runtime'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Wrench className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Студия 1: Runtime</span>
            <span className="sm:hidden">Runtime</span>
          </button>

          <button
            onClick={() => setActiveTriStudioMode('topology')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTriStudioMode === 'topology'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Студия 2: Topology</span>
            <span className="sm:hidden">Topology</span>
          </button>

          <button
            onClick={() => setActiveTriStudioMode('defense')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTriStudioMode === 'defense'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Radio className="w-3.5 h-3.5 text-pink-400 animate-pulse" />
            <span className="hidden sm:inline">Студия 3: Defense</span>
            <span className="sm:hidden">Defense</span>
          </button>
        </div>

        {/* Right: Omnipresent AI-Copilot Trigger */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => usePracticeTutorStore.getState().toggleOpen()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-pastel-accentRose/20 hover:bg-pastel-accentRose/30 text-rose-200 border border-pastel-accentRose/40 transition cursor-pointer shadow-sm active:scale-95"
            title="Открыть AI-Напарника (Текст / Голос Gemini Live)"
          >
            <Bot className="w-3.5 h-3.5 text-rose-400" />
            <span className="hidden sm:inline">AI-Напарник</span>
          </button>
        </div>
      </header>

      {/* Main Studio Viewport with Persistent DOM Mounting */}
      <main className="flex-1 w-full h-[calc(100%-3.5rem)] relative overflow-hidden">
        {/* Studio 1: Runtime & Forensics Workbench */}
        <div className={`h-full w-full bg-slate-950 p-6 overflow-hidden ${activeTriStudioMode === 'runtime' ? 'flex flex-col' : 'hidden'}`}>
          {/* Sub-tabs bar */}
          <div className="flex items-center gap-2 pb-4 shrink-0 overflow-x-auto">
            <button
              onClick={() => setStudio1SubTab('code')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                studio1SubTab === 'code'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              <span>Код и антипаттерны</span>
              {runtimeSpec?.faded_bug && (
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              )}
            </button>

            <button
              onClick={() => setStudio1SubTab('hikari')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                studio1SubTab === 'hikari'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              <span>HikariCP Little's Law</span>
            </button>

            <button
              onClick={() => setStudio1SubTab('virtual_threads')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                studio1SubTab === 'virtual_threads'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              <span>Virtual Threads Pinning</span>
            </button>

            <button
              onClick={() => setStudio1SubTab('paged_attention')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                studio1SubTab === 'paged_attention'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              <span>PagedAttention KV-Cache</span>
            </button>
          </div>

          {/* Sub-tab content */}
          <div className="flex-1 h-[calc(100%-3rem)] overflow-y-auto">
            {studio1SubTab === 'code' && (
              <ForensicCodeEditor
                files={runtimeSpec?.source_files}
                fadedBug={runtimeSpec?.faded_bug}
                correctFixDiff={runtimeSpec?.correct_fix_diff}
                astRuleInvariants={runtimeSpec?.ast_rule_invariants}
                onRuntimeFixApplied={setIsRuntimeFixApplied}
              />
            )}

            {studio1SubTab === 'hikari' && (
              <div className="max-w-4xl mx-auto">
                <HikariPoolVisualizer />
              </div>
            )}

            {studio1SubTab === 'virtual_threads' && (
              <div className="max-w-4xl mx-auto">
                <VirtualThreadPinningLab />
              </div>
            )}

            {studio1SubTab === 'paged_attention' && (
              <div className="max-w-4xl mx-auto">
                <PagedAttentionVisualizer />
              </div>
            )}
          </div>
        </div>

        {/* Studio 2: Topology Canvas & DES Simulation (Kept mounted for state preservation) */}
        <div className={`h-full w-full ${activeTriStudioMode === 'topology' ? 'block' : 'hidden'}`}>
          <TopologyCanvas
            scenarioManifest={scenario}
            onProceedToDefense={() => setActiveTriStudioMode('defense')}
            isRuntimeFixApplied={isRuntimeFixApplied}
            isActive={activeTriStudioMode === 'topology'}
          />
        </div>

        {/* Studio 3: Voice Bar-Raiser Defense Arena (Kept mounted for transcript preservation) */}
        <div className={`h-full w-full ${activeTriStudioMode === 'defense' ? 'block' : 'hidden'}`}>
          <VoiceDefenseArena
            scenarioManifest={scenario}
            onBackToTopology={() => setActiveTriStudioMode('topology')}
          />
        </div>
      </main>
    </div>
  );
};

