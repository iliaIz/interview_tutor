import React, { useState } from 'react';
import { ShieldAlert, CheckCircle2, Edit3, Eye, Zap, AlertTriangle } from 'lucide-react';
import { MarkdownRenderer } from '../../MarkdownRenderer';

interface IncidentRcaTabProps {
  rcaHypothesis: string;
  updateRcaHypothesis: (val: string) => void;
  preventionPlan: string;
  updatePreventionPlan: (val: string) => void;
  selectedMitigation?: string;
  onSelectMitigation?: (mitigation: string) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}

const MITIGATION_ACTIONS = [
  { id: 'drain_traffic', label: 'Дрейнить трафик на здоровый AZ (Traffic Shift)', icon: Zap },
  { id: 'kill_deadlock_tx', label: 'Принудительно оборвать блокирующий коннект СУБД (Kill TX)', icon: AlertTriangle },
  { id: 'circuit_breaker', label: 'Включить Circuit Breaker на деградировавший downstream', icon: ShieldAlert },
  { id: 'rollback_release', label: 'Откатить канареечный релиз (Rollback deployment)', icon: CheckCircle2 }
];

export const IncidentRcaTab: React.FC<IncidentRcaTabProps> = ({
  rcaHypothesis,
  updateRcaHypothesis,
  preventionPlan,
  updatePreventionPlan,
  selectedMitigation,
  onSelectMitigation,
  onKeyDown
}) => {
  const [rcaMode, setRcaMode] = useState<'edit' | 'preview'>('edit');
  const [preventionMode, setPreventionMode] = useState<'edit' | 'preview'>('edit');

  return (
    <div className="max-w-4xl mx-auto space-y-6" onKeyDown={onKeyDown}>
      {/* Block 0: Phase 1 SRE Mitigation Selector */}
      {onSelectMitigation && (
        <div className="bg-white/95 border border-pastel-border/80 rounded-2xl p-5 space-y-3 shadow-2xs">
          <label className="text-xs font-bold text-pastel-text flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-amber-500" />
            <span>Фаза 1: Неотложная митигация сбоя (Stop the Bleeding):</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {MITIGATION_ACTIONS.map((action) => {
              const Icon = action.icon;
              const isSelected = selectedMitigation === action.id;
              return (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => onSelectMitigation(action.id)}
                  className={`p-3 rounded-xl border text-left text-xs font-medium transition cursor-pointer flex items-center gap-2.5 ${
                    isSelected
                      ? 'bg-amber-50/80 border-amber-300 text-amber-900 shadow-2xs ring-1 ring-amber-200'
                      : 'bg-pastel-bg/50 border-pastel-border/70 text-pastel-text hover:bg-pastel-bg'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-amber-600' : 'text-pastel-muted'}`} />
                  <span>{action.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Block 1: RCA Hypothesis */}
      <div className="bg-white/95 border border-pastel-border/80 rounded-2xl p-5 space-y-3 shadow-2xs">
        <div className="flex items-center justify-between border-b border-pastel-border/60 pb-2.5">
          <label className="text-xs font-bold text-pastel-text flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4 text-amber-600" />
            <span>1. Гипотеза корневой причины (Root Cause Analysis):</span>
          </label>

          <div className="flex items-center bg-pastel-bg p-0.5 rounded-lg border border-pastel-border">
            <button
              type="button"
              onClick={() => setRcaMode('edit')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold transition cursor-pointer ${
                rcaMode === 'edit' ? 'bg-white text-pastel-text shadow-2xs' : 'text-pastel-muted hover:text-pastel-text'
              }`}
            >
              <Edit3 className="w-3 h-3" />
              <span>Редактор</span>
            </button>
            <button
              type="button"
              onClick={() => setRcaMode('preview')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold transition cursor-pointer ${
                rcaMode === 'preview' ? 'bg-white text-pastel-accentRose shadow-2xs' : 'text-pastel-muted hover:text-pastel-text'
              }`}
            >
              <Eye className="w-3 h-3" />
              <span>Предпросмотр</span>
            </button>
          </div>
        </div>

        {rcaMode === 'edit' ? (
          <textarea
            value={rcaHypothesis}
            onChange={(e) => updateRcaHypothesis(e.target.value)}
            maxLength={20000}
            placeholder="Опишите, что именно вызвало сбой на уровне JVM, блокировок, пулов потоков или СУБД (поддерживается Markdown)..."
            className="w-full h-36 bg-pastel-bg border border-pastel-border rounded-xl p-3 text-xs font-mono text-pastel-text placeholder-pastel-muted/50 focus:outline-hidden focus:border-amber-500 resize-none shadow-2xs"
          />
        ) : (
          <div className="min-h-[144px] p-3 rounded-xl bg-pastel-bg/60 border border-pastel-border">
            {rcaHypothesis.trim() ? (
              <MarkdownRenderer content={rcaHypothesis} />
            ) : (
              <span className="text-xs text-pastel-muted italic">Текст гипотезы пока пуст.</span>
            )}
          </div>
        )}
      </div>

      {/* Block 2: Prevention Plan */}
      <div className="bg-white/95 border border-pastel-border/80 rounded-2xl p-5 space-y-3 shadow-2xs">
        <div className="flex items-center justify-between border-b border-pastel-border/60 pb-2.5">
          <label className="text-xs font-bold text-pastel-text flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>2. Архитектурный план превентивных мер (Remediation Plan):</span>
          </label>

          <div className="flex items-center bg-pastel-bg p-0.5 rounded-lg border border-pastel-border">
            <button
              type="button"
              onClick={() => setPreventionMode('edit')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold transition cursor-pointer ${
                preventionMode === 'edit' ? 'bg-white text-pastel-text shadow-2xs' : 'text-pastel-muted hover:text-pastel-text'
              }`}
            >
              <Edit3 className="w-3 h-3" />
              <span>Редактор</span>
            </button>
            <button
              type="button"
              onClick={() => setPreventionMode('preview')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold transition cursor-pointer ${
                preventionMode === 'preview' ? 'bg-white text-pastel-accentRose shadow-2xs' : 'text-pastel-muted hover:text-pastel-text'
              }`}
            >
              <Eye className="w-3 h-3" />
              <span>Предпросмотр</span>
            </button>
          </div>
        </div>

        {preventionMode === 'edit' ? (
          <textarea
            value={preventionPlan}
            onChange={(e) => updatePreventionPlan(e.target.value)}
            maxLength={20000}
            placeholder="Опишите, как перепроектировать код или конфигурацию (ReentrantLock, таймауты, индексы, ScopedValue, HikariCP), чтобы исключить рецидив..."
            className="w-full h-36 bg-pastel-bg border border-pastel-border rounded-xl p-3 text-xs font-mono text-pastel-text placeholder-pastel-muted/50 focus:outline-hidden focus:border-amber-500 resize-none shadow-2xs"
          />
        ) : (
          <div className="min-h-[144px] p-3 rounded-xl bg-pastel-bg/60 border border-pastel-border">
            {preventionPlan.trim() ? (
              <MarkdownRenderer content={preventionPlan} />
            ) : (
              <span className="text-xs text-pastel-muted italic">План превентивных мер пока пуст.</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
