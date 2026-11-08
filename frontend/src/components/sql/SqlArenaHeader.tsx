import React from 'react';
import { Database, ArrowLeft, ChevronDown } from 'lucide-react';
import { SqlChallenge } from '@interview-prep/shared';

interface SqlArenaHeaderProps {
  challenges: SqlChallenge[];
  selectedId: string;
  onSelectChallenge: (id: string) => void;
  solvedIds: Set<string>;
  onBackToCompanyTrack?: () => void;
  companyContextName?: string;
}

export const SqlArenaHeader: React.FC<SqlArenaHeaderProps> = ({
  challenges,
  selectedId,
  onSelectChallenge,
  solvedIds,
  onBackToCompanyTrack,
  companyContextName = 'Райффайзенбанк'
}) => {
  return (
    <div className="bg-white/95 border border-pastel-border/80 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        {onBackToCompanyTrack && (
          <button
            onClick={onBackToCompanyTrack}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors flex items-center gap-1.5 text-xs font-semibold"
          >
            <ArrowLeft className="w-4 h-4" /> Назад в {companyContextName}
          </button>
        )}
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-900 border border-amber-200 flex items-center gap-1">
              <Database className="w-3 h-3 text-amber-600" /> PostgreSQL 16 WASM
            </span>
            <span className="text-xs text-pastel-muted font-mono">0 MB Server Load</span>
          </div>
          <h1 className="text-lg sm:text-xl font-extrabold text-pastel-text tracking-tight mt-0.5">
            Интерактивная SQL Арена: Финтех-Ловушки
          </h1>
        </div>
      </div>

      <div className="relative min-w-[280px]">
        <select
          value={selectedId}
          onChange={(e) => onSelectChallenge(e.target.value)}
          className="w-full appearance-none bg-slate-50 border border-pastel-border/80 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 pr-8 focus:outline-none focus:ring-2 focus:ring-pastel-accentIndigo/40"
        >
          {challenges.map((c, i) => (
            <option key={c.id} value={c.id}>
              {i + 1}. {c.title} {solvedIds.has(c.id) ? '✓' : ''}
            </option>
          ))}
        </select>
        <ChevronDown className="w-4 h-4 text-pastel-muted absolute right-2.5 top-2.5 pointer-events-none" />
      </div>
    </div>
  );
};
