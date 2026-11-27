import React, { useState } from 'react';
import { GoldenMasterConfig } from '../../types/practice';
import { Shield, CheckCircle2, FileText, AlertCircle, X } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { NativeModalDialog } from '../shared/NativeModalDialog';

interface GoldenMasterDiffViewerProps {
  config: GoldenMasterConfig;
  isOpen: boolean;
  onClose: () => void;
}

export const GoldenMasterDiffViewer: React.FC<GoldenMasterDiffViewerProps> = ({ config, isOpen, onClose }) => {
  const [viewMode, setViewMode] = useState<'split' | 'unified'>('split');
  const latestSandboxResult = useAppStore((s) => s.latestSandboxResult);

  if (!isOpen) return null;

  const baselineLines = (config.sampleBaselineText || 'Эталонный слепок не задан').split('\n');
  const hasSandboxRun = Boolean(latestSandboxResult);
  const failedTestReason = latestSandboxResult?.testResults?.find((t) => t.status !== 'PASSED')?.failureReason;
  const allSandboxPassed = Boolean(
    latestSandboxResult && latestSandboxResult.isCompilable && latestSandboxResult.failedCount === 0
  );

  return (
    <NativeModalDialog
      isOpen={isOpen}
      onClose={onClose}
      ariaLabelledBy="golden-master-diff-title"
      panelClassName="bg-white rounded-3xl border border-pastel-border shadow-2xl max-w-4xl w-full max-h-[85dvh] flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="p-4 border-b border-pastel-border flex items-center justify-between gap-2 bg-pastel-bg/60 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold shrink-0">
            <Shield className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h2 id="golden-master-diff-title" className="font-bold text-sm text-pastel-text">
              Golden Master Approval Test Diff
            </h2>
            <p className="text-[11px] text-pastel-muted truncate">
              Эталон ({config.approvedSnapshotPath}) vs вывод ({config.receivedSnapshotPath})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div
            role="tablist"
            aria-label="Режим отображения diff"
            className="flex items-center bg-white rounded-xl border border-pastel-border p-1 text-xs"
          >
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'split'}
              onClick={() => setViewMode('split')}
              className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                viewMode === 'split' ? 'bg-pastel-text text-white' : 'text-pastel-muted hover:text-pastel-text'
              }`}
            >
              Split View
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'unified'}
              onClick={() => setViewMode('unified')}
              className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                viewMode === 'unified' ? 'bg-pastel-text text-white' : 'text-pastel-muted hover:text-pastel-text'
              }`}
            >
              Unified
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть окно Golden Master Diff"
            className="touch-target-44 p-2 rounded-xl text-pastel-muted hover:text-pastel-text hover:bg-pastel-card transition cursor-pointer flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Diff Content Area */}
      <div className="flex-1 overflow-y-auto p-4 font-mono text-xs custom-scrollbar bg-slate-900 text-slate-100">
        {viewMode === 'split' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-[11px] font-bold text-emerald-300 mb-2 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Approved Baseline (.approved.txt)</span>
              </div>
              <div className="space-y-1 bg-slate-950 p-3 rounded-xl border border-slate-800 overflow-x-auto">
                {baselineLines.map((line, i) => (
                  <div key={i} className="text-slate-200 whitespace-pre">
                    <span className="text-slate-400 select-none mr-3 inline-block w-6 text-right">{i + 1}</span>
                    {line}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[11px] font-bold text-teal-300 mb-2 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                <span>Your Current Output (.received.txt)</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 min-h-[120px] flex flex-col justify-center">
                {!hasSandboxRun ? (
                  <div className="flex items-start gap-2 text-amber-300 text-xs font-sans">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                      Вывод вашего сервиса ещё не сформирован. Запустите тесты (Ctrl+Enter), чтобы сравнить фактический результат с эталоном.
                    </span>
                  </div>
                ) : allSandboxPassed ? (
                  <div className="space-y-1">
                    {baselineLines.map((line, i) => (
                      <div key={i} className="text-emerald-300 bg-emerald-950/30 px-1 rounded whitespace-pre">
                        <span className="text-slate-400 select-none mr-3 inline-block w-6 text-right">{i + 1}</span>
                        {line}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-rose-300 text-xs font-sans space-y-1">
                    <div className="font-bold">Обнаружено расхождение с эталонным контрактом:</div>
                    <div className="font-mono text-[11px] text-rose-200 whitespace-pre-wrap">
                      {failedTestReason || latestSandboxResult?.error || 'Тесты песочницы не пройдены.'}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-1 bg-slate-950 p-3 rounded-xl border border-slate-800 overflow-x-auto">
            {baselineLines.map((line, i) => (
              <div key={i} className="text-slate-200 whitespace-pre">
                <span className="text-slate-400 select-none mr-3 inline-block w-6 text-right">{i + 1}</span>
                <span>  {line}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-pastel-border bg-white flex items-center justify-between gap-2 text-xs text-pastel-muted">
        <span>
          {!hasSandboxRun
            ? 'Запустите тесты, чтобы проверить совпадение слепка.'
            : allSandboxPassed
            ? 'Последний прогон песочницы подтвердил соответствие эталону.'
            : 'Исправьте расхождения и перезапустите песочницу.'}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-1.5 bg-pastel-text text-white rounded-xl font-bold hover:opacity-90 transition cursor-pointer"
        >
          Закрыть
        </button>
      </div>
    </NativeModalDialog>
  );
};
