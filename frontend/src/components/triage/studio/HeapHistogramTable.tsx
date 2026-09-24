import React from 'react';
import { Table } from 'lucide-react';

export interface HeapHistogramEntry {
  rank: string;
  instances: number;
  bytes: number;
  className: string;
}

interface HeapHistogramTableProps {
  entries: HeapHistogramEntry[];
  maxBytes: number;
  logSearchQuery: string;
}

export const HeapHistogramTable: React.FC<HeapHistogramTableProps> = ({
  entries,
  maxBytes,
  logSearchQuery
}) => {
  const filteredEntries = entries.filter(
    (e) => !logSearchQuery.trim() || e.className.toLowerCase().includes(logSearchQuery.toLowerCase())
  );

  return (
    <div className="bg-white rounded-2xl border border-pastel-border overflow-hidden shadow-2xs">
      <div className="p-4 border-b border-pastel-border/80 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Table className="w-4 h-4 text-purple-600" />
          <h3 className="text-xs font-bold text-pastel-text uppercase tracking-wider">
            VisualVM Heap Objects Histogram (Топ аллокаций памяти)
          </h3>
        </div>
        <span className="text-[11px] font-mono text-pastel-muted">
          Показано: {filteredEntries.length} классов
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs font-mono text-left">
          <thead className="bg-pastel-bg text-pastel-text text-[10px] uppercase font-bold border-b border-pastel-border">
            <tr>
              <th className="px-3.5 py-2.5"># Ранг</th>
              <th className="px-3.5 py-2.5">Класс в куче (Class Name)</th>
              <th className="px-3.5 py-2.5">Кол-во объектов</th>
              <th className="px-3.5 py-2.5">Размер (Bytes)</th>
              <th className="px-3.5 py-2.5 min-w-[120px]">% Памяти</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-pastel-border/60">
            {filteredEntries.map((entry) => {
              const pct = Math.round((entry.bytes / (maxBytes || 1)) * 100);
              return (
                <tr key={entry.rank} className="hover:bg-pastel-bg/50 transition">
                  <td className="px-3.5 py-2 font-bold text-pastel-muted">#{entry.rank}</td>
                  <td className="px-3.5 py-2 font-bold text-pastel-text break-all">{entry.className}</td>
                  <td className="px-3.5 py-2 text-slate-600">{entry.instances.toLocaleString()}</td>
                  <td className="px-3.5 py-2 font-bold text-purple-700">
                    {(entry.bytes / 1024 / 1024).toFixed(2)} MB ({entry.bytes.toLocaleString()} B)
                  </td>
                  <td className="px-3.5 py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div className="h-full bg-purple-500 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[10px] text-pastel-muted">{pct}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
