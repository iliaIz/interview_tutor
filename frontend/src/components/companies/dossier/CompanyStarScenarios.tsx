import React, { useState } from 'react';
import { StarCase } from '@interview-prep/shared';
import {
  Sparkles,
  ShieldAlert,
  Award,
  CheckCircle2,
  ChevronRight,
  HelpCircle,
  Clock
} from 'lucide-react';

interface CompanyStarScenariosProps {
  scenarios?: StarCase[];
}

export const CompanyStarScenarios: React.FC<CompanyStarScenariosProps> = ({
  scenarios = []
}) => {
  const [activeCaseId, setActiveCaseId] = useState<number>(1);

  if (!scenarios || scenarios.length === 0) {
    return (
      <div className="p-6 rounded-2xl bg-white border border-slate-200 text-center text-xs text-slate-500">
        STAR-сценарии для данной компании формируются.
      </div>
    );
  }

  const activeCase = scenarios.find((c) => c.id === activeCaseId) || scenarios[0];

  return (
    <div className="space-y-4">
      {/* Selector Navigation */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        {scenarios.map((c) => {
          const isSelected = activeCaseId === c.id;
          return (
            <button
              key={c.id}
              onClick={() => setActiveCaseId(c.id)}
              className={`p-3 rounded-2xl text-left border transition-all cursor-pointer ${
                isSelected
                  ? 'bg-amber-400 text-slate-950 font-bold border-amber-500 shadow-sm ring-1 ring-amber-400'
                  : 'bg-white text-slate-700 border-slate-200/90 hover:border-amber-300 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between text-[10px] uppercase font-mono tracking-wider opacity-80 mb-1">
                <span>Кейс {c.id}</span>
                <ChevronRight className={`w-3.5 h-3.5 ${isSelected ? 'text-slate-950' : 'text-slate-700'}`} />
              </div>
              <div className="text-xs font-extrabold line-clamp-1 leading-snug">
                {c.title}
              </div>
            </button>
          );
        })}
      </div>

      {/* Active Case Card */}
      <div className="p-5 rounded-3xl bg-white border border-slate-200/90 shadow-sm space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div>
            <span className="text-[11px] font-bold font-mono text-amber-800 uppercase px-2.5 py-0.5 rounded-full bg-amber-100/70">
              {activeCase.badge}
            </span>
            <h4 className="text-base sm:text-lg font-extrabold text-slate-900 mt-1">
              {activeCase.title}
            </h4>
            <p className="text-xs text-slate-700 mt-0.5">
              {activeCase.tagline}
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-700 shrink-0 font-mono">
            <Clock className="w-3.5 h-3.5 text-slate-700" />
            <span>Хронометраж: 3–4 минуты</span>
          </div>
        </div>

        {/* The Exact Question */}
        <div className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-200/70 space-y-1">
          <div className="flex items-center gap-1.5 text-amber-900 text-xs font-bold font-mono">
            <HelpCircle className="w-4 h-4 text-amber-700" />
            Формулировка вопроса на реальном собеседовании:
          </div>
          <p className="text-xs sm:text-sm text-slate-800 italic leading-relaxed">
            {activeCase.interviewQuestion}
          </p>
        </div>

        {/* STAR Framework Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Situation */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-1">
            <span className="text-[10px] font-extrabold font-mono uppercase tracking-wider text-indigo-700 px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-200/60">
              S — Situation (Контекст)
            </span>
            <p className="text-xs text-slate-800 leading-relaxed pt-1">
              {activeCase.situation}
            </p>
          </div>

          {/* Task */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-1">
            <span className="text-[10px] font-extrabold font-mono uppercase tracking-wider text-purple-700 px-2 py-0.5 rounded-md bg-purple-50 border border-purple-200/60">
              T — Task (Сложность & Вызов)
            </span>
            <p className="text-xs text-slate-800 leading-relaxed pt-1">
              {activeCase.task}
            </p>
          </div>

          {/* Action */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-1.5 md:col-span-2">
            <span className="text-[10px] font-extrabold font-mono uppercase tracking-wider text-amber-800 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200/60">
              A — Action (Конкретные действия от первого лица «Я», а не «Мы»)
            </span>
            <ul className="space-y-1.5 pt-1">
              {activeCase.action.map((step, idx) => (
                <li key={idx} className="text-xs text-slate-800 flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-amber-400 text-slate-950 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <span className="leading-relaxed">{step}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Result */}
          <div className="p-3.5 rounded-2xl bg-emerald-50/50 border border-emerald-200/70 space-y-1 md:col-span-2">
            <span className="text-[10px] font-extrabold font-mono uppercase tracking-wider text-emerald-800 px-2 py-0.5 rounded-md bg-emerald-100/70 border border-emerald-200/80">
              R — Result (Оцифрованный бизнес-итог)
            </span>
            <p className="text-xs text-slate-900 font-medium leading-relaxed pt-1">
              {activeCase.result}
            </p>
          </div>
        </div>

        {/* Footer: Strong Hire vs Red Flag */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
          <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200/70 space-y-1 text-xs">
            <span className="font-bold text-emerald-900 flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              Почему это дает Strong Hire:
            </span>
            <p className="text-slate-800 leading-relaxed">{activeCase.strongHireTakeaway}</p>
          </div>

          <div className="p-3 rounded-2xl bg-rose-50/70 border border-rose-200/70 space-y-1 text-xs">
            <span className="font-bold text-rose-900 flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-600 shrink-0" />
              Чего говорить категорически нельзя (Red Flag):
            </span>
            <p className="text-slate-800 leading-relaxed">{activeCase.redFlagToAvoid}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
