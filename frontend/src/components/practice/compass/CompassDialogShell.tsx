import React, { useState, useEffect } from 'react';
import { Compass, X, Sparkles, CheckCircle2 } from 'lucide-react';
import { NativeModalDialog } from '../../shared/NativeModalDialog';
import { TestingCompassRadar } from './TestingCompassRadar';
import {
  COMPASS_DOMAINS,
  CompassDomainKey,
  CompassRuleDef,
  buildCompassGroundingPrompt
} from './compassDomains';

export interface CompassDialogShellProps {
  isOpen: boolean;
  onClose: () => void;
  domain: CompassDomainKey;
  onGroundRule: (rule: CompassRuleDef, prompt: string) => void;
}

export const CompassDialogShell: React.FC<CompassDialogShellProps> = ({
  isOpen,
  onClose,
  domain,
  onGroundRule
}) => {
  const config = COMPASS_DOMAINS[domain] || COMPASS_DOMAINS.testing;
  const [selectedRuleId, setSelectedRuleId] = useState<string>(config.rules[0].id);

  useEffect(() => {
    setSelectedRuleId(config.rules[0].id);
  }, [domain, config.rules]);

  const activeRule = config.rules.find((r) => r.id === selectedRuleId) || config.rules[0];

  return (
    <NativeModalDialog
      isOpen={isOpen}
      onClose={onClose}
      ariaLabelledBy="compass-dialog-title"
      panelClassName="w-full max-w-5xl max-h-[90dvh] bg-pastel-bg border border-pastel-border shadow-2xl rounded-3xl flex flex-col overflow-hidden text-pastel-text"
    >
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-pastel-border bg-white flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-pastel-rose border border-pastel-accentRose/30 text-pastel-accentRoseText flex items-center justify-center shrink-0">
            <Compass className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 id="compass-dialog-title" className="font-bold text-sm sm:text-base text-pastel-text truncate">
                {config.title}
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pastel-rose text-pastel-accentRoseText border border-pastel-accentRose/30 shrink-0">
                {config.badge}
              </span>
            </div>
            <p className="text-xs text-pastel-muted truncate">{config.subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <kbd className="hidden sm:inline px-2 py-1 bg-pastel-bg border border-pastel-border rounded-lg text-[10px] font-mono text-pastel-muted">
            Ctrl + / · Esc
          </kbd>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть шпаргалку"
            className="touch-target-44 w-9 h-9 rounded-xl text-pastel-muted hover:text-pastel-text hover:bg-pastel-bg flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 custom-scrollbar">
        {config.hasTestingRadar && <TestingCompassRadar />}

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Rule Selector Tablist */}
          <div
            role="tablist"
            aria-label="Правила компаса"
            className="md:col-span-5 flex flex-col gap-1.5"
          >
            {config.rules.map((rule) => {
              const isSelected = rule.id === activeRule.id;
              return (
                <button
                  key={rule.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => setSelectedRuleId(rule.id)}
                  className={`touch-target-44 w-full p-3 rounded-2xl text-left border transition flex items-start gap-2.5 cursor-pointer ${
                    isSelected
                      ? 'bg-white border-[#B5433E] shadow-xs'
                      : 'bg-white/60 border-pastel-border hover:bg-white'
                  }`}
                >
                  <span
                    className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-lg shrink-0 ${
                      isSelected
                        ? 'bg-[#B5433E] text-white'
                        : 'bg-pastel-bg text-pastel-muted border border-pastel-border'
                    }`}
                  >
                    {rule.number}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-pastel-text leading-snug">{rule.title}</div>
                    <div className="text-[10px] text-pastel-muted mt-0.5">{rule.badge}</div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Active Rule Details Tabpanel */}
          <div
            role="tabpanel"
            className="md:col-span-7 p-5 rounded-2xl bg-white border border-pastel-border flex flex-col justify-between gap-4"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-pastel-lavender text-pastel-text border border-pastel-border">
                  {activeRule.badge}
                </span>
                <span className="text-xs text-pastel-muted font-mono font-semibold">
                  Правило {activeRule.number} / 05
                </span>
              </div>

              <h3 className="text-sm sm:text-base font-bold text-pastel-text leading-snug">
                {activeRule.title}
              </h3>

              <p className="text-xs font-semibold text-pastel-accentRoseText bg-pastel-rose/60 p-3 rounded-xl border border-pastel-accentRose/25 leading-relaxed">
                {activeRule.shortFormula}
              </p>

              <p className="text-xs text-pastel-text leading-relaxed">{activeRule.fullPrinciple}</p>

              {activeRule.formulaOrCode && (
                <pre className="p-3 rounded-xl bg-[#121622] text-slate-100 font-mono text-[11px] overflow-x-auto border border-slate-800">
                  <code>{activeRule.formulaOrCode}</code>
                </pre>
              )}

              <div className="space-y-1.5 pt-2 border-t border-pastel-border">
                <div className="text-[10px] font-bold uppercase tracking-wider text-pastel-muted">
                  Чек-лист проверки
                </div>
                <ul className="space-y-1.5">
                  {activeRule.checklist.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-xs text-pastel-text">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="pt-3 border-t border-pastel-border flex items-center justify-between gap-2 flex-wrap">
              <span className="text-[11px] text-pastel-muted">
                Разбор правила по вашему текущему коду
              </span>
              <button
                type="button"
                onClick={() => onGroundRule(activeRule, buildCompassGroundingPrompt(config.domain, activeRule))}
                className="touch-target-44 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#B5433E] hover:bg-[#9B3B36] text-white text-xs font-bold transition cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Обсудить с AI-напарником</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </NativeModalDialog>
  );
};

export default CompassDialogShell;
