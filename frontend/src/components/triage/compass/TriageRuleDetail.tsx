import React from 'react';
import { CompassSection } from './triageRules';
import { Activity, Terminal, CheckCircle2 } from 'lucide-react';

export interface TriageRuleDetailProps {
  rule: CompassSection;
}

export const TriageRuleDetail: React.FC<TriageRuleDetailProps> = ({ rule }) => {
  return (
    <div className="space-y-4">
      {/* Rule Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200">
        <div className="flex items-center gap-2.5">
          <span className="text-xl font-black text-amber-700 font-mono">
            #{rule.number}
          </span>
          <h3 className="text-base sm:text-lg font-extrabold text-slate-900">
            {rule.title}
          </h3>
        </div>
        <span
          className={`self-start sm:self-auto text-xs font-mono font-bold px-3 py-1 rounded-full border ${rule.badgeColor}`}
        >
          {rule.badge}
        </span>
      </div>

      {/* Summary */}
      <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200/80 text-xs sm:text-sm text-slate-700 leading-relaxed font-sans">
        {rule.summary}
      </div>

      {/* Details Table */}
      {rule.detailsTable && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-amber-600" />
            <span>Эталонные ориентиры и сигнатуры:</span>
          </h4>
          <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-100/90 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="p-2.5 sm:px-4 font-bold">Событие / Паттерн</th>
                  <th className="p-2.5 sm:px-4 font-bold text-amber-700">Значение</th>
                  <th className="p-2.5 sm:px-4 font-bold hidden sm:table-cell">Диагностический смысл</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {rule.detailsTable.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 transition">
                    <td className="p-2.5 sm:px-4 font-bold text-slate-800">{row.metric}</td>
                    <td className="p-2.5 sm:px-4 font-extrabold text-amber-800">{row.value}</td>
                    <td className="p-2.5 sm:px-4 text-slate-600 text-[11px] hidden sm:table-cell font-sans">
                      {row.note}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Code or Formula Snippet */}
      {rule.formulaOrCode && (
        <div className="space-y-1.5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Terminal className="w-3.5 h-3.5 text-rose-600" />
            <span>Диагностический код & Формула:</span>
          </h4>
          <pre className="p-3.5 rounded-2xl bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto border border-slate-800 leading-relaxed shadow-inner">
            {rule.formulaOrCode}
          </pre>
        </div>
      )}

      {/* Verification Checklist */}
      <div className="space-y-2 pt-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          <span>Чек-лист проверки гипотезы на собеседовании:</span>
        </h4>
        <ul className="grid grid-cols-1 gap-2 text-xs">
          {rule.checklist.map((item, idx) => (
            <li
              key={idx}
              className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-2.5 text-slate-700"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span className="leading-snug">{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
