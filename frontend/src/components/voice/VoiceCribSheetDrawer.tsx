/**
 * VoiceCribSheetDrawer.tsx
 * Slide-over drawer for candidate briefing and FinTech cheat sheet during live voice call.
 * Cognitive bounding limit: <= 100 lines (Rule 8).
 */

import React from 'react';
import { CompanyPreFlightBriefing } from '../companies/dossier/CompanyPreFlightBriefing';

interface VoiceCribSheetDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VoiceCribSheetDrawer: React.FC<VoiceCribSheetDrawerProps> = ({
  isOpen,
  onClose
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[480px] bg-white p-5 shadow-2xl border-l border-amber-200 overflow-y-auto animate-in slide-in-from-right duration-200 font-sans">
      <div className="flex items-center justify-between pb-3 border-b border-amber-100">
        <span className="font-bold text-sm text-amber-950 flex items-center gap-1.5">
          📋 Досье и шпаргалка собеседования
        </span>
        <button
          type="button"
          onClick={onClose}
          className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center cursor-pointer transition"
          title="Закрыть шпаргалку"
        >
          ✕
        </button>
      </div>
      <CompanyPreFlightBriefing compact />
    </div>
  );
};
