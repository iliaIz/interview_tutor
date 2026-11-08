import React from 'react';
import { SqlResultDiff } from '@interview-prep/shared';
import { AlertCircle, CheckCircle2, ArrowRight, AlertTriangle } from 'lucide-react';

interface SqlDiffViewerProps {
  diff: SqlResultDiff;
}

export const SqlDiffViewer: React.FC<SqlDiffViewerProps> = ({ diff }) => {
  if (diff.isMatched) {
    return (
      <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200/80 text-emerald-900 flex items-start gap-3">
        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
        <div>
          <h4 className="text-sm font-bold text-emerald-950">
            Идеальное совпадение выборки! (100% Match)
          </h4>
          <p className="text-xs text-emerald-800 mt-1">
            Колонки, количество строк и значения полностью соответствуют эталонному решению.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 font-sans text-xs">
      {/* Column Mismatch Warning */}
      {diff.columnMismatch && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold text-xs">Несовпадение структуры колонок:</span>
            <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
              <span className="text-pastel-muted">Ожидалось:</span>
              <span className="font-bold text-emerald-700 bg-white px-1.5 py-0.5 rounded border border-emerald-200">
                {diff.expectedColumns.join(', ') || '(нет)'}
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-pastel-muted" />
              <span className="text-pastel-muted">Получено:</span>
              <span className="font-bold text-rose-700 bg-white px-1.5 py-0.5 rounded border border-rose-200">
                {diff.actualColumns.join(', ') || '(нет)'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Row Count Mismatch */}
      {diff.expectedRowCount !== diff.actualRowCount && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center justify-between font-mono text-xs">
          <span className="font-sans font-semibold flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            Несовпадение количества строк:
          </span>
          <span>
            Ожидалось <strong className="text-emerald-700">{diff.expectedRowCount}</strong>, фактически получено{' '}
            <strong className="text-rose-700">{diff.actualRowCount}</strong>
          </span>
        </div>
      )}

      {/* Order Mismatch Warning */}
      {diff.orderMismatch && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Нарушен порядок сортировки (ORDER BY):</span>
            <p className="text-[11px] text-amber-800 mt-0.5">
              Все строки присутствуют в выборке, но порядок строк не соответствует требованию задачи.
            </p>
          </div>
        </div>
      )}

      {/* Missing Expected Rows */}
      {diff.missingRows.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-xs font-bold text-rose-700 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            Пропущенные эталонные строки ({diff.missingRows.length}):
          </span>
          <div className="max-h-36 overflow-y-auto space-y-1 font-mono text-[11px]">
            {diff.missingRows.map((row, idx) => (
              <div
                key={idx}
                className="p-2 rounded-lg bg-rose-50/80 border border-rose-200 text-rose-900 truncate"
              >
                {JSON.stringify(row)}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Unexpected Returned Rows */}
      {diff.unexpectedRows.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-xs font-bold text-amber-700 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            Лишние непредусмотренные строки ({diff.unexpectedRows.length}):
          </span>
          <div className="max-h-36 overflow-y-auto space-y-1 font-mono text-[11px]">
            {diff.unexpectedRows.map((row, idx) => (
              <div
                key={idx}
                className="p-2 rounded-lg bg-amber-50/80 border border-amber-200 text-amber-900 truncate"
              >
                {JSON.stringify(row)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
