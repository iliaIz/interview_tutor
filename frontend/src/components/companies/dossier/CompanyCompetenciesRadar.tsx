import React, { useState } from 'react';
import { CompetencyItem } from '@interview-prep/shared';
import {
  Code2,
  Users,
  Lightbulb,
  Layers,
  BarChart3,
  Server,
  ShieldCheck,
  FileText,
  Bot,
  ChevronDown,
  Sparkles,
  CheckCircle2
} from 'lucide-react';

const ICON_MAP: Record<string, React.ElementType> = {
  Code2,
  Users,
  Lightbulb,
  Layers,
  BarChart3,
  Server,
  ShieldCheck,
  FileText,
  Bot
};

interface CompanyCompetenciesRadarProps {
  competencies?: CompetencyItem[];
  companyName?: string;
}

export const CompanyCompetenciesRadar: React.FC<CompanyCompetenciesRadarProps> = ({
  competencies = [],
  companyName = 'Компании'
}) => {
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'engineering' | 'product' | 'quality_ai'>('all');
  const [expandedId, setExpandedId] = useState<number | null>(1);

  if (!competencies || competencies.length === 0) {
    return (
      <div className="p-6 rounded-2xl bg-white border border-slate-200 text-center text-xs text-slate-500">
        Матрица компетенций для данной компании формируется.
      </div>
    );
  }

  const filteredCompetencies = selectedFilter === 'all'
    ? competencies
    : competencies.filter((c) => c.category === selectedFilter);

  return (
    <div className="space-y-4">
      {/* Header & Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-900 text-white">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 font-mono">
              Методология Self-Driving
            </span>
          </div>
          <h4 className="text-sm sm:text-base font-extrabold text-white mt-0.5">
            {competencies.length} функциональных блоков компетенций Product Engineer
          </h4>
          <p className="text-xs text-slate-300 mt-1 max-w-xl">
            В {companyName} оценивают готовность отвечать за весь жизненный цикл фичи. Нажмите на блок, чтобы увидеть каверзный вопрос интервьюера.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-800/90 border border-slate-700/60 self-start sm:self-center shrink-0">
          {(
            [
              { id: 'all', label: `Все (${competencies.length})` },
              { id: 'engineering', label: 'Инженерия' },
              { id: 'product', label: 'Продукт' },
              { id: 'quality_ai', label: 'Качество & AI' }
            ] as const
          ).map((btn) => (
            <button
              key={btn.id}
              onClick={() => setSelectedFilter(btn.id)}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors cursor-pointer ${
                selectedFilter === btn.id
                  ? 'bg-amber-400 text-slate-950 shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Competencies */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredCompetencies.map((comp) => {
          const Icon = ICON_MAP[comp.iconName] || Sparkles;
          const isExpanded = expandedId === comp.id;

          return (
            <div
              key={comp.id}
              onClick={() => setExpandedId(isExpanded ? null : comp.id)}
              className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                isExpanded
                  ? 'bg-amber-50/40 border-amber-300/80 shadow-md ring-1 ring-amber-300/60'
                  : 'bg-white border-slate-200/80 hover:border-amber-300/60 hover:shadow-sm'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                      isExpanded
                        ? 'bg-amber-400 text-slate-950 font-bold'
                        : 'bg-slate-100 text-slate-700 font-bold'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold font-mono text-slate-700 uppercase">
                      #{comp.id} • {comp.categoryLabel}
                    </span>
                    <h5 className="text-xs sm:text-sm font-bold text-slate-900 leading-snug">
                      {comp.title}
                    </h5>
                  </div>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-slate-700 transition-transform ${
                    isExpanded ? 'rotate-180 text-amber-800' : ''
                  }`}
                />
              </div>

              <p className="text-xs text-slate-700 mt-2 line-clamp-2 leading-relaxed">
                {comp.description}
              </p>

              <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-700 font-mono">
                <span className="truncate max-w-[200px]">{comp.techStack}</span>
                <span className="text-amber-800 font-bold shrink-0">
                  {isExpanded ? 'Свернуть' : 'Подробнее'}
                </span>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="mt-3 pt-3 border-t border-amber-200/60 space-y-2.5 text-xs animate-in fade-in duration-150">
                  <div className="p-2.5 rounded-xl bg-amber-100/60 border border-amber-200/80">
                    <span className="font-bold text-amber-900 block mb-1">
                      Каверзный вопрос на собеседовании:
                    </span>
                    <p className="italic text-slate-800">{comp.interviewQuestion}</p>
                  </div>

                  <div className="p-2.5 rounded-xl bg-emerald-50/80 border border-emerald-200/80">
                    <span className="font-bold text-emerald-900 flex items-center gap-1.5 mb-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      Что ожидает услышать Bar-Raiser:
                    </span>
                    <p className="text-slate-800">{comp.barRaiserExpectation}</p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
