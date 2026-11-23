import React, { useState, useEffect } from 'react';
import { Compass, X, HelpCircle, ShieldAlert } from 'lucide-react';
import { TRIAGE_RULES, CompassSection } from './triageRules';
import { TriageRuleDetail } from './TriageRuleDetail';

export type { CompassSection };
export { TRIAGE_RULES };

interface TriageCompassSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onAskTutorAboutRule?: (ruleTitle: string, ruleSummary: string) => void;
}

export const TriageCompassSheet: React.FC<TriageCompassSheetProps> = ({
  isOpen,
  onClose,
  onAskTutorAboutRule
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSectionId, setActiveSectionId] = useState<string>(TRIAGE_RULES[0].id);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredRules = TRIAGE_RULES.filter(
    (rule) =>
      rule.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rule.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rule.badge.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const currentRule =
    TRIAGE_RULES.find((r) => r.id === activeSectionId) || TRIAGE_RULES[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/50 backdrop-blur-md animate-in fade-in duration-200 font-sans">
      <div className="relative w-full max-w-5xl h-[88vh] max-h-[850px] bg-white/95 rounded-3xl shadow-2xl border border-slate-200/90 flex flex-col overflow-hidden text-slate-800">
        
        {/* Top Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200/80 bg-slate-50/80 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-600 to-rose-600 text-white flex items-center justify-center shadow-md">
              <Compass className="w-5 h-5 animate-spin-slow" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight text-slate-900">
                  Triage Compass • Золотые Правила SRE (2026)
                </h2>
                <span className="hidden sm:inline text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                  Ctrl + /
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Справочник криминалистики JVM, thread dumps, утечек памяти, пауз GC и методологий RED/USE
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
            title="Закрыть (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Navigation Bar */}
        <div className="p-3 border-b border-slate-200/60 bg-white flex flex-col sm:flex-row items-center gap-3 shrink-0">
          <div className="relative flex-1 w-full">
            <input
              type="text"
              placeholder="Поиск по правилам (например: thread states, deadlock, metaspace, humongous, RED/USE)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-100/80 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto no-scrollbar py-0.5">
            {filteredRules.map((rule) => (
              <button
                key={rule.id}
                type="button"
                onClick={() => setActiveSectionId(rule.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                  activeSectionId === rule.id
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>{rule.number}</span>
                <span className="hidden md:inline">{rule.badge}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          <TriageRuleDetail rule={currentRule} />
        </div>

        {/* Bottom Footer Actions */}
        <div className="p-3.5 sm:p-4 border-t border-slate-200/80 bg-slate-50/80 flex items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 hidden sm:flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-slate-400" />
            <span>Используйте стрелки или кликайте по вкладкам для перехода между правилами</span>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {onAskTutorAboutRule && (
              <button
                type="button"
                onClick={() => onAskTutorAboutRule(currentRule.title, currentRule.summary)}
                className="px-4 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-extrabold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                <span>Спросить Incident Commander</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold transition cursor-pointer shadow-sm"
            >
              Закрыть (Esc)
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
