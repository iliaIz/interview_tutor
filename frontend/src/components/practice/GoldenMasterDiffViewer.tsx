import React, { useState } from 'react';
import { GoldenMasterConfig } from '../../types/practice';
import { Shield, CheckCircle2, XCircle, ArrowLeftRight, FileText } from 'lucide-react';

interface GoldenMasterDiffViewerProps {
  config: GoldenMasterConfig;
  isOpen: boolean;
  onClose: () => void;
}

export const GoldenMasterDiffViewer: React.FC<GoldenMasterDiffViewerProps> = ({ config, isOpen, onClose }) => {
  const [viewMode, setViewMode] = useState<'split' | 'unified'>('split');

  if (!isOpen) return null;

  const baselineLines = (config.sampleBaselineText || 'No baseline generated').split('\n');

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl border border-pastel-border shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 border-b border-pastel-border flex items-center justify-between bg-pastel-bg/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-pastel-text">Golden Master Approval Test Diff</h3>
              <p className="text-[11px] text-pastel-muted">
                Сравнение эталонного слепка ({config.approvedSnapshotPath}) и текущего вывода ({config.receivedSnapshotPath})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center bg-white rounded-xl border border-pastel-border p-1 text-xs">
              <button
                onClick={() => setViewMode('split')}
                className={`px-2.5 py-1 rounded-lg font-bold transition ${
                  viewMode === 'split' ? 'bg-pastel-text text-white' : 'text-pastel-muted hover:text-pastel-text'
                }`}
              >
                Split View
              </button>
              <button
                onClick={() => setViewMode('unified')}
                className={`px-2.5 py-1 rounded-lg font-bold transition ${
                  viewMode === 'unified' ? 'bg-pastel-text text-white' : 'text-pastel-muted hover:text-pastel-text'
                }`}
              >
                Unified
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-pastel-muted hover:text-pastel-text hover:bg-pastel-card transition cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Diff Content Area */}
        <div className="flex-1 overflow-y-auto p-4 font-mono text-xs custom-scrollbar bg-slate-900 text-slate-100">
          {viewMode === 'split' ? (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-[11px] font-bold text-emerald-400 mb-2 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Approved Baseline (.approved.txt)</span>
                </div>
                <div className="space-y-1 bg-slate-950 p-3 rounded-xl border border-slate-800">
                  {baselineLines.map((line, i) => (
                    <div key={i} className="text-slate-300">
                      <span className="text-slate-600 select-none mr-3 inline-block w-6 text-right">{i + 1}</span>
                      {line}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-[11px] font-bold text-teal-400 mb-2 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  <span>Your Current Output (.received.txt)</span>
                </div>
                <div className="space-y-1 bg-slate-950 p-3 rounded-xl border border-slate-800">
                  {baselineLines.map((line, i) => (
                    <div key={i} className="text-emerald-300/90 bg-emerald-950/30 px-1 rounded">
                      <span className="text-slate-600 select-none mr-3 inline-block w-6 text-right">{i + 1}</span>
                      {line}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-1 bg-slate-950 p-3 rounded-xl border border-slate-800">
              {baselineLines.map((line, i) => (
                <div key={i} className="text-slate-300">
                  <span className="text-slate-600 select-none mr-3 inline-block w-6 text-right">{i + 1}</span>
                  <span>  {line}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-pastel-border bg-white flex items-center justify-between text-xs text-pastel-muted">
          <span>✨ 100% совпадение слепка гарантирует отсутствие регрессий при рефакторинге.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-pastel-text text-white rounded-xl font-bold hover:opacity-90 transition cursor-pointer"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};
