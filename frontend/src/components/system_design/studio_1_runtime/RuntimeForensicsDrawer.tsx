import React, { useState } from 'react';
import { 
  FileCode, Database, Cpu, Layers, X, Wrench, 
  ChevronRight, Sparkles, SlidersHorizontal 
} from 'lucide-react';
import { useBodyScrollLock } from '../../../hooks/useBodyScrollLock';
import { ForensicCodeEditor } from './ForensicCodeEditor';
import { HikariPoolVisualizer } from './HikariPoolVisualizer';
import { VirtualThreadPinningLab } from './VirtualThreadPinningLab';
import { PagedAttentionVisualizer } from './PagedAttentionVisualizer';

interface RuntimeForensicsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  scenarioManifest: any;
  onCodeChange?: (content: string) => void;
}

type ForensicsTab = 'code' | 'hikari' | 'virtual_threads' | 'paged_attention';

export const RuntimeForensicsDrawer: React.FC<RuntimeForensicsDrawerProps> = ({
  isOpen,
  onClose,
  scenarioManifest,
  onCodeChange
}) => {
  useBodyScrollLock(isOpen);

  const [activeTab, setActiveTab] = useState<ForensicsTab>('code');

  if (!isOpen) return null;

  const runtimeSpec = scenarioManifest?.studio_1_runtime;
  const files = runtimeSpec?.source_files || [];
  const fadedBug = runtimeSpec?.faded_bug;
  const correctFixDiff = runtimeSpec?.correct_fix_diff;
  const astRuleInvariants = runtimeSpec?.ast_rule_invariants || [];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-4xl h-[calc(100dvh-4rem)] mt-16 bg-slate-950 border-l border-slate-800 shadow-2xl flex flex-col overflow-hidden animate-slide-in-right">
        {/* Drawer Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900/90 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Студия 1: Runtime & Forensics Workbench
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-800">
                  Micro / Meso Scale
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                {scenarioManifest?.title || 'Анализ низкоуровневого рантайма и устранение дефектов'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            title="Закрыть шторку"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Studio Sub-Navigation Tabs */}
        <div className="flex items-center gap-2 px-6 py-2.5 bg-slate-900/50 border-b border-slate-800/80 overflow-x-auto shrink-0">
          <button
            onClick={() => setActiveTab('code')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
              activeTab === 'code'
                ? 'bg-purple-600 text-white shadow-md'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <FileCode className="w-4 h-4" />
            <span>Код и антипаттерны</span>
            {fadedBug && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('hikari')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
              activeTab === 'hikari'
                ? 'bg-purple-600 text-white shadow-md'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>HikariCP Little's Law</span>
          </button>

          <button
            onClick={() => setActiveTab('virtual_threads')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
              activeTab === 'virtual_threads'
                ? 'bg-purple-600 text-white shadow-md'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <Cpu className="w-4 h-4" />
            <span>Virtual Threads Pinning</span>
          </button>

          <button
            onClick={() => setActiveTab('paged_attention')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
              activeTab === 'paged_attention'
                ? 'bg-purple-600 text-white shadow-md'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>PagedAttention KV-Cache</span>
          </button>
        </div>

        {/* Active Tab Body */}
        <div className="flex-1 p-6 overflow-y-auto">
          {activeTab === 'code' && (
            <div className="h-full">
              <ForensicCodeEditor
                files={files}
                fadedBug={fadedBug}
                correctFixDiff={correctFixDiff}
                astRuleInvariants={astRuleInvariants}
                onCodeChange={onCodeChange}
              />
            </div>
          )}

          {activeTab === 'hikari' && (
            <HikariPoolVisualizer />
          )}

          {activeTab === 'virtual_threads' && (
            <VirtualThreadPinningLab />
          )}

          {activeTab === 'paged_attention' && (
            <PagedAttentionVisualizer />
          )}
        </div>
      </div>
    </div>
  );
};
