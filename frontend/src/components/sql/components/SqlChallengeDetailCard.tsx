import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { SqlChallenge } from '@interview-prep/shared';

export interface SqlChallengeDetailCardProps {
  challenge: SqlChallenge;
}

export const SqlChallengeDetailCard: React.FC<SqlChallengeDetailCardProps> = ({ challenge }) => {
  return (
    <div className="bg-white/95 border border-pastel-border/80 rounded-2xl p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
          {challenge.category}
        </span>
        <span className="text-xs font-mono font-bold text-slate-500 uppercase">
          Грейд: {challenge.difficulty}
        </span>
      </div>

      <h2 className="text-base font-bold text-slate-900 leading-snug">
        {challenge.title}
      </h2>

      <div className="p-3 rounded-xl bg-amber-50/90 border border-amber-200/90 text-amber-950 space-y-1">
        <span className="font-bold text-xs flex items-center gap-1.5 text-amber-900">
          <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
          Ловушка собеседования:
        </span>
        <p className="text-xs leading-relaxed text-amber-900">
          {challenge.companyContext.interviewTrapDescription}
        </p>
      </div>

      <div className="text-xs text-slate-700 leading-relaxed max-h-72 overflow-y-auto space-y-2 pr-1 border-t border-pastel-border/50 pt-2 whitespace-pre-line">
        {challenge.instructionsMarkdown}
      </div>
    </div>
  );
};
