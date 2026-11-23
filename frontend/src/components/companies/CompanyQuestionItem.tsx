/**
 * CompanyQuestionItem.tsx
 * Presenter for an individual Company Theory Question card.
 * SLA: <= 220 lines (Rule 8 compliant).
 */

import React from 'react';
import { CompanyQuestionSummary } from '../../services/CompanyTrackContextAdapter';
import { CheckCircle2, Circle, ChevronDown, ChevronUp, Bot, Mic, Brain, Award, ShieldAlert } from 'lucide-react';
import { MarkdownRenderer } from '../MarkdownRenderer';

interface CompanyQuestionItemProps {
  question: CompanyQuestionSummary;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onToggleMastery: () => void;
  onStartVoiceTutor: () => void;
  onStartVoiceScreening: () => void;
  onOpenCopilotDrawer: () => void;
}

export const CompanyQuestionItem: React.FC<CompanyQuestionItemProps> = ({
  question: q,
  isExpanded,
  onToggleExpand,
  onToggleMastery,
  onStartVoiceTutor,
  onStartVoiceScreening,
  onOpenCopilotDrawer
}) => {
  return (
    <div
      className={`border rounded-2xl transition-all shadow-xs overflow-hidden ${
        q.isMastered
          ? 'bg-emerald-50/20 border-emerald-200/80'
          : 'bg-white border-pastel-border/80 hover:border-slate-300'
      }`}
    >
      {/* Header row */}
      <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <button
            onClick={onToggleMastery}
            className="mt-0.5 text-slate-400 hover:text-emerald-600 transition-colors cursor-pointer shrink-0"
            title={q.isMastered ? 'Снять отметку об освоении' : 'Отметить как освоенный'}
          >
            {q.isMastered ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 fill-emerald-100" />
            ) : (
              <Circle className="w-5 h-5 text-slate-300" />
            )}
          </button>

          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                {q.id}
              </span>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 truncate max-w-[200px]">
                {q.module || q.topic}
              </span>
            </div>
            <h4 className="text-sm font-bold text-slate-900 leading-snug break-words">
              {q.question}
            </h4>
          </div>
        </div>

        {/* Multimodal Actions */}
        <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center flex-wrap">
          {/* 1. Voice Live Tutor */}
          <button
            onClick={onStartVoiceTutor}
            className="px-2.5 py-1.5 rounded-xl bg-violet-50 hover:bg-violet-100 text-violet-900 text-xs font-bold border border-violet-200 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
            title="Обсудить голосом с AI-Тьютором (обучение без оценок)"
          >
            <Brain className="w-3.5 h-3.5 text-violet-600" />
            <span>Тьютор</span>
          </button>

          {/* 2. Voice Live Screening */}
          <button
            onClick={onStartVoiceScreening}
            className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-900 text-xs font-bold border border-rose-200 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
            title="Пройти устный AI-скрининг с оценкой ответа"
          >
            <Mic className="w-3.5 h-3.5 text-rose-600" />
            <span>Скрининг</span>
          </button>

          {/* 3. Text Copilot Drawer (Zero auto-send) */}
          <button
            onClick={onOpenCopilotDrawer}
            className="px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold border border-amber-200 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
            title="Открыть контекст в шторке Copilot (без автоматической отправки)"
          >
            <Bot className="w-3.5 h-3.5 text-amber-600" />
            <span className="hidden sm:inline">Спросить</span>
          </button>

          {/* 4. Accordion Toggle */}
          <button
            onClick={onToggleExpand}
            className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
          >
            <span>{isExpanded ? 'Скрыть' : 'Разбор'}</span>
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-slate-200/80 p-5 bg-slate-50/70 space-y-4 text-xs text-slate-800 animate-in fade-in duration-150">
          {/* Depth Probe Tags */}
          {q.depthProbe && q.depthProbe.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-slate-700 uppercase font-mono flex items-center gap-1">
                <Award className="w-3.5 h-3.5 text-indigo-600" /> Точки углубления (Что спросит сеньор):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {q.depthProbe.map((dp, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 rounded-md bg-white border border-indigo-200 text-indigo-900 text-[11px] font-mono shadow-xs"
                  >
                    {dp}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Red Flags Tags */}
          {q.redFlags && q.redFlags.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-rose-700 uppercase font-mono flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-600" /> Красные флаги (Причины отказа):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {q.redFlags.map((rf, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 rounded-md bg-rose-50 border border-rose-200 text-rose-900 text-[11px] font-mono shadow-xs"
                  >
                    {rf}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Reference Answer Body */}
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider font-mono">
              Эталонный ответ и физика решения:
            </span>
            <div className="p-4 bg-white rounded-xl border border-slate-200/90 shadow-2xs leading-relaxed text-slate-900">
              <MarkdownRenderer content={q.answer} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
