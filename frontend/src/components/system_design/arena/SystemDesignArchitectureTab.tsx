import React, { useState } from 'react';
import { Layers, Code2, Edit3, Eye } from 'lucide-react';
import { ArchitectureCanvas } from '../canvas/ArchitectureCanvas';
import { MermaidPreview } from '../MermaidPreview';
import { MarkdownRenderer } from '../../MarkdownRenderer';
import { ArchitectureGraphPayload } from '../../../types/systemDesignCanvas';

interface SystemDesignArchitectureTabProps {
  scenarioTitle: string;
  architectureMode: 'canvas' | 'mermaid';
  setArchitectureMode: (mode: 'canvas' | 'mermaid') => void;
  mermaidCode: string;
  setMermaidCode: (code: string) => void;
  candidateNotes: string;
  setCandidateNotes: React.Dispatch<React.SetStateAction<string>>;
  onExportPayload: (payload: ArchitectureGraphPayload) => void;
  onDeicticContextChange: (delta: any) => void;
}

export const SystemDesignArchitectureTab: React.FC<SystemDesignArchitectureTabProps> = ({
  scenarioTitle,
  architectureMode,
  setArchitectureMode,
  mermaidCode,
  setMermaidCode,
  candidateNotes,
  setCandidateNotes,
  onExportPayload,
  onDeicticContextChange
}) => {
  const [notesViewMode, setNotesViewMode] = useState<'edit' | 'preview'>('edit');

  return (
    <div className="max-w-7xl 2xl:max-w-[2200px] mx-auto space-y-4">
      {/* Mode Switcher Header */}
      <div className="flex items-center justify-between bg-white/95 dark:bg-slate-900/95 border border-pastel-border/80 rounded-2xl p-2.5 shadow-2xs">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-pastel-text">Режим архитектора:</span>
          <div className="flex items-center bg-pastel-bg p-0.5 rounded-xl border border-pastel-border">
            <button
              type="button"
              onClick={() => setArchitectureMode('canvas')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                architectureMode === 'canvas'
                  ? 'bg-white text-pastel-accentRose shadow-2xs border border-pastel-border'
                  : 'text-pastel-muted hover:text-pastel-text'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Интерактивный холст (SOTA 2026)</span>
            </button>
            <button
              type="button"
              onClick={() => setArchitectureMode('mermaid')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                architectureMode === 'mermaid'
                  ? 'bg-white text-pastel-accentRose shadow-2xs border border-pastel-border'
                  : 'text-pastel-muted hover:text-pastel-text'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>Mermaid редактор</span>
            </button>
          </div>
        </div>

        <div className="text-[11px] text-pastel-muted font-mono hidden sm:block">
          {architectureMode === 'canvas'
            ? '⚡ 60 FPS Web Worker DES Engine • Drag & Drop • SPOF Detection'
            : '📜 Ручной ввод кода Mermaid'}
        </div>
      </div>

      {architectureMode === 'canvas' ? (
        <div className="h-[calc(100vh-14rem)] min-h-[640px] w-full rounded-2xl overflow-hidden border border-pastel-border/80 shadow-2xs relative">
          <ArchitectureCanvas
            scenarioTitle={scenarioTitle}
            onExportPayload={onExportPayload}
            onDeicticContextChange={onDeicticContextChange}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 min-h-[580px]">
          <div className="lg:col-span-6 flex flex-col gap-4">
            <div className="bg-white/95 border border-pastel-border/80 rounded-2xl p-4 flex flex-col shadow-2xs space-y-2">
              <div className="flex items-center justify-between border-b border-pastel-border/60 pb-2">
                <span className="text-xs font-bold text-pastel-text font-mono flex items-center gap-1.5">
                  <Code2 className="w-4 h-4 text-pastel-accentRose" />
                  <span>Mermaid Код Топологии:</span>
                </span>
                <span className="text-[10px] text-pastel-muted font-mono">graph TD / C4</span>
              </div>

              <textarea
                value={mermaidCode}
                onChange={(e) => setMermaidCode(e.target.value)}
                className="w-full h-56 bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono text-blue-300 focus:outline-hidden focus:border-pastel-accentRose resize-none leading-relaxed"
                placeholder="graph TD..."
                spellCheck={false}
              />
            </div>

            <div className="bg-white/95 border border-pastel-border/80 rounded-2xl p-4 flex flex-col shadow-2xs space-y-2 flex-1">
              <div className="flex items-center justify-between border-b border-pastel-border/60 pb-2">
                <span className="text-xs font-bold text-pastel-text font-mono">
                  Пояснительная записка (CAP, Шардирование, Кэш):
                </span>

                <div className="flex items-center bg-pastel-bg p-0.5 rounded-lg border border-pastel-border">
                  <button
                    onClick={() => setNotesViewMode('edit')}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold transition cursor-pointer ${
                      notesViewMode === 'edit'
                        ? 'bg-white text-pastel-text shadow-2xs'
                        : 'text-pastel-muted hover:text-pastel-text'
                    }`}
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>Редактор</span>
                  </button>
                  <button
                    onClick={() => setNotesViewMode('preview')}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold transition cursor-pointer ${
                      notesViewMode === 'preview'
                        ? 'bg-white text-pastel-accentRose shadow-2xs'
                        : 'text-pastel-muted hover:text-pastel-text'
                    }`}
                  >
                    <Eye className="w-3 h-3" />
                    <span>Предпросмотр</span>
                  </button>
                </div>
              </div>

              {notesViewMode === 'edit' ? (
                <textarea
                  value={candidateNotes}
                  onChange={(e) => setCandidateNotes(e.target.value)}
                  className="flex-1 min-h-[160px] w-full bg-pastel-bg border border-pastel-border rounded-xl p-3 text-xs font-mono text-pastel-text focus:outline-hidden focus:border-pastel-accentRose resize-none"
                  placeholder="Опишите стратегию партиционирования, выбор СУБД, схему репликации и защиту от сбоев..."
                />
              ) : (
                <div className="flex-1 min-h-[160px] p-3 rounded-xl bg-pastel-bg/60 border border-pastel-border overflow-y-auto">
                  {candidateNotes.trim() ? (
                    <MarkdownRenderer content={candidateNotes} />
                  ) : (
                    <span className="text-xs text-pastel-muted italic">Пояснительная записка пока пуста.</span>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-6 flex flex-col min-h-[500px]">
            <MermaidPreview code={mermaidCode} className="flex-1" />
          </div>
        </div>
      )}
    </div>
  );
};
