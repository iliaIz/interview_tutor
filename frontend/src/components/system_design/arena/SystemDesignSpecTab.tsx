import React from 'react';
import { Cpu, ShieldAlert } from 'lucide-react';
import { MarkdownRenderer } from '../../MarkdownRenderer';

interface SystemDesignSpecTabProps {
  scenario: any;
}

const cleanScenarioText = (text?: string): string => {
  if (!text) return '';
  return text
    .replace(/\\?\[cite:\s*[^\]]+\]/g, '')
    .replace(/\\cite:\s*\d+\\?/g, '')
    .replace(/\\_/g, '_')
    .replace(/merchant_id\d+/g, 'merchant_id')
    .replace(/Circuit Breaker\d+/g, 'Circuit Breaker')
    .trim();
};

export const SystemDesignSpecTab: React.FC<SystemDesignSpecTabProps> = ({ scenario }) => {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Traffic Profile */}
      {scenario.trafficProfile && (
        <div className="bg-white/95 border border-pastel-border/80 rounded-2xl p-4 sm:p-5 shadow-2xs">
          <h3 className="text-xs font-bold uppercase tracking-wider text-purple-700 mb-3 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-pastel-accentViolet" />
            <span>Профиль Нагрузки & SLA</span>
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
            <div className="bg-pastel-bg p-2.5 rounded-xl border border-pastel-border">
              <span className="text-pastel-muted block text-[10px]">Аудитория DAU</span>
              <span className="font-bold text-pastel-text">{scenario.trafficProfile.targetDAU}</span>
            </div>
            <div className="bg-pastel-bg p-2.5 rounded-xl border border-pastel-border">
              <span className="text-pastel-muted block text-[10px]">Пиковый RPS</span>
              <span className="font-bold text-blue-600">{scenario.trafficProfile.estimatedPeakRPS}</span>
            </div>
            <div className="bg-pastel-bg p-2.5 rounded-xl border border-pastel-border">
              <span className="text-pastel-muted block text-[10px]">Хранение</span>
              <span className="font-bold text-pastel-text">{scenario.trafficProfile.dailyStorageGrowth}</span>
            </div>
            <div className="bg-pastel-bg p-2.5 rounded-xl border border-pastel-border">
              <span className="text-pastel-muted block text-[10px]">Целевой SLA</span>
              <span className="font-bold text-emerald-600">{scenario.trafficProfile.slaAvailability}</span>
            </div>
          </div>
        </div>
      )}

      {/* Context & Data Flow */}
      <div className="bg-white/95 border border-pastel-border/80 rounded-2xl p-5 space-y-3 shadow-2xs">
        <h3 className="text-sm font-bold text-pastel-text">Контекст и Архитектурный поток данных</h3>
        <p className="text-xs text-pastel-muted leading-relaxed whitespace-pre-line">
          {cleanScenarioText(scenario.contextMarkdown || scenario.problem_statement)}
        </p>
      </div>

      {/* Calculations & Topo with Structured Table Renderer */}
      {scenario.calculationsMarkdown && (
        <div className="bg-white/95 border border-pastel-border/80 rounded-2xl p-5 space-y-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-pastel-text">Нагрузочные расчеты (Back-of-the-Envelope)</h3>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              SLA & Throughput
            </span>
          </div>
          <div className="text-xs text-pastel-text leading-relaxed">
            <MarkdownRenderer content={cleanScenarioText(scenario.calculationsMarkdown)} />
          </div>
        </div>
      )}

      {/* Bottlenecks */}
      {scenario.bottlenecksMarkdown && (
        <div className="bg-white/95 border border-amber-200 rounded-2xl p-5 space-y-3 shadow-2xs">
          <h3 className="text-sm font-bold text-amber-800 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-600" />
            <span>Анализ узких мест и системных сбоев (SPOF, Dual-Write, Split-Brain)</span>
          </h3>
          <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">
            {cleanScenarioText(scenario.bottlenecksMarkdown)}
          </p>
        </div>
      )}
    </div>
  );
};
