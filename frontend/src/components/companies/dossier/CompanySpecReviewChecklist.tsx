import React, { useState } from 'react';
import { SpecReviewItem } from '@interview-prep/shared';
import {
  ClipboardCheck,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles
} from 'lucide-react';

interface CompanySpecReviewChecklistProps {
  items?: SpecReviewItem[];
}

export const CompanySpecReviewChecklist: React.FC<CompanySpecReviewChecklistProps> = ({
  items = []
}) => {
  const [checkedIds, setCheckedIds] = useState<number[]>([1, 2, 5]);

  if (!items || items.length === 0) {
    return (
      <div className="p-6 rounded-2xl bg-white border border-slate-200 text-center text-xs text-slate-500">
        Чеклист защиты архитектурного решения для данной компании формируется.
      </div>
    );
  }

  const toggleCheck = (id: number) => {
    setCheckedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const checkAll = () => setCheckedIds(items.map((item) => item.id));
  const resetAll = () => setCheckedIds([]);

  const progressPercent = Math.round((checkedIds.length / items.length) * 100);

  return (
    <div className="space-y-4">
      {/* Header with Progress Bar */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center justify-center font-bold">
              <ClipboardCheck className="w-4 h-4 text-indigo-700" />
            </div>
            <div>
              <h4 className="text-sm sm:text-base font-extrabold text-slate-900">
                {items.length}-Point Spec Review Checklist
              </h4>
              <p className="text-xs text-slate-700">
                Чеклист защиты архитектурного решения перед командой и Bar-Raiser до написания кода
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            <button
              onClick={resetAll}
              className="px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:text-slate-900 flex items-center gap-1 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              Сброс
            </button>
            <button
              onClick={checkAll}
              className="px-2.5 py-1 text-[11px] font-bold text-indigo-700 hover:text-indigo-800 flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50/60 hover:bg-indigo-100/60 transition-colors cursor-pointer"
            >
              <CheckCircle2 className="w-3 h-3" />
              Отметить все
            </button>
          </div>
        </div>

        {/* Progress Tracker */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-slate-700 font-bold">Готовность спецификации к защите:</span>
            <span className="font-extrabold text-indigo-700">
              {checkedIds.length} из {items.length} ({progressPercent}%)
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                progressPercent === 100
                  ? 'bg-emerald-500'
                  : progressPercent >= 60
                  ? 'bg-indigo-600'
                  : 'bg-amber-500'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Checklist Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {items.map((item) => {
          const isChecked = checkedIds.includes(item.id);

          return (
            <div
              key={item.id}
              onClick={() => toggleCheck(item.id)}
              className={`p-3.5 rounded-2xl border transition-all cursor-pointer select-none ${
                isChecked
                  ? 'bg-emerald-50/40 border-emerald-200/90 shadow-xs'
                  : 'bg-white border-slate-200/80 hover:border-slate-300'
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => {}} // controlled via parent div click
                  className="mt-0.5 w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer shrink-0"
                />

                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-[10px] font-bold font-mono uppercase px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                      #{item.id} {item.tag}
                    </span>
                    {isChecked ? (
                      <span className="text-[10px] font-bold text-emerald-800 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-emerald-600" />
                        Готово
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-amber-800 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-amber-600" />
                        Не закрыто
                      </span>
                    )}
                  </div>

                  <h5 className="text-xs sm:text-sm font-bold text-slate-900 leading-snug">
                    {item.title}
                  </h5>

                  <p className="text-xs text-slate-700 leading-relaxed">
                    {item.question}
                  </p>

                  <div className="pt-2 border-t border-slate-100 space-y-1 text-[11px]">
                    <div className="text-indigo-900 bg-indigo-50/60 p-2 rounded-xl">
                      <span className="font-bold flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-indigo-600 shrink-0" />
                        Артефакт на защите:
                      </span>
                      <span className="text-slate-800">{item.deliverable}</span>
                    </div>

                    <div className="text-rose-900 bg-rose-50/60 p-2 rounded-xl">
                      <span className="font-bold">Риск при отсутствии: </span>
                      <span className="text-slate-800">{item.dangerIfMissing}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
