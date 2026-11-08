import React from 'react';
import { Database, Clock, Layers } from 'lucide-react';

interface SqlDataGridProps {
  columns: string[];
  rows: Record<string, unknown>[];
  executionTimeMs?: number;
  emptyMessage?: string;
}

export const SqlDataGrid: React.FC<SqlDataGridProps> = ({
  columns,
  rows,
  executionTimeMs,
  emptyMessage = 'Запрос вернул пустой набор данных (0 строк).'
}) => {
  if (columns.length === 0 || rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center bg-pastel-card/50 rounded-2xl border border-pastel-border/60">
        <Database className="w-10 h-10 text-pastel-muted/50 mb-3" />
        <p className="text-sm font-medium text-pastel-muted">{emptyMessage}</p>
        {executionTimeMs !== undefined && (
          <span className="text-xs text-pastel-muted/70 mt-2 font-mono flex items-center gap-1">
            <Clock className="w-3 h-3" /> Время выполнения: {executionTimeMs} мс
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-2">
      {/* Telemetry metadata header */}
      <div className="flex items-center justify-between text-xs text-pastel-muted font-mono px-1">
        <span className="flex items-center gap-1.5 font-semibold text-pastel-text">
          <Layers className="w-3.5 h-3.5 text-pastel-accentIndigo" />
          Строк: {rows.length} | Колонок: {columns.length}
        </span>
        {executionTimeMs !== undefined && (
          <span className="flex items-center gap-1 text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
            <Clock className="w-3 h-3" /> {executionTimeMs} мс (WASM)
          </span>
        )}
      </div>

      {/* Responsive Data Grid */}
      <div className="overflow-x-auto rounded-xl border border-pastel-border/80 bg-white shadow-sm max-h-80 overflow-y-auto">
        <table className="min-w-full text-left text-xs divide-y divide-pastel-border/70 font-sans">
          <thead className="bg-slate-50 sticky top-0 z-10">
            <tr>
              <th className="px-3 py-2 text-pastel-muted font-mono text-[10px] uppercase tracking-wider w-10 text-center">
                #
              </th>
              {columns.map((col) => (
                <th
                  key={col}
                  className="px-3 py-2 font-bold text-slate-700 tracking-wider font-mono text-xs whitespace-nowrap"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-pastel-border/40 font-mono text-xs">
            {rows.map((row, rowIdx) => (
              <tr
                key={rowIdx}
                className="hover:bg-pastel-hover/40 transition-colors odd:bg-white even:bg-slate-50/40"
              >
                <td className="px-3 py-2 text-center text-pastel-muted/60 text-[10px] select-none">
                  {rowIdx + 1}
                </td>
                {columns.map((col) => {
                  const val = row[col];
                  const isNull = val === null || val === undefined;
                  return (
                    <td
                      key={col}
                      className="px-3 py-2 whitespace-nowrap text-slate-800"
                    >
                      {isNull ? (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold tracking-wider rounded bg-rose-50 text-rose-600 border border-rose-200 select-none">
                          NULL
                        </span>
                      ) : typeof val === 'boolean' ? (
                        <span
                          className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
                            val
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}
                        >
                          {String(val)}
                        </span>
                      ) : (
                        <span>{String(val)}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
