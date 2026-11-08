import React, { useState } from 'react';
import {
  Calculator,
  BookOpen,
  Clock,
  Sparkles,
  CheckCircle2,
  XCircle,
  HelpCircle
} from 'lucide-react';

export const CompanyTalentQGuide: React.FC = () => {
  const [val1, setVal1] = useState<string>('1250');
  const [val2, setVal2] = useState<string>('1475');

  const x1 = parseFloat(val1);
  const x2 = parseFloat(val2);

  const isValid = !isNaN(x1) && !isNaN(x2) && x1 !== 0;
  const deltaAbs = isValid ? x2 - x1 : 0;
  const deltaPercent = isValid ? ((x2 - x1) / Math.abs(x1)) * 100 : 0;
  const ratio = isValid ? x2 / x1 : 0;

  return (
    <div className="space-y-4 font-sans">
      {/* 72h Critical Warning Banner */}
      <div className="p-4 rounded-3xl bg-rose-50 border-2 border-rose-300/80 shadow-xs flex items-start gap-3.5">
        <div className="w-10 h-10 rounded-2xl bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
          <Clock className="w-5 h-5 animate-pulse" />
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-extrabold uppercase font-mono tracking-wider px-2 py-0.5 rounded-md bg-rose-200/80 text-rose-900">
              Hard Deadline: строго 72 часа
            </span>
          </div>
          <h4 className="text-sm sm:text-base font-extrabold text-rose-950">
            Психометрический тест Talent Q Elements / SHL
          </h4>
          <p className="text-xs text-rose-900/90 leading-relaxed max-w-3xl">
            Ссылка на онлайн-тест высылается рекрутером сразу после первичного отклика. Ровно через <strong>72 часа</strong> ссылка деактивируется.
            Если кандидат не успел завершить тест — система фиксирует авто-отказ без возможности апелляции или пересдачи в течение 6 месяцев!
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Numerical Section & Live Calculator */}
        <div className="p-4 sm:p-5 rounded-3xl bg-white border border-slate-200/90 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center font-bold">
              <Calculator className="w-4 h-4 text-amber-700" />
            </div>
            <div>
              <h5 className="text-sm font-extrabold text-slate-900">
                1. Числовой тест: Быстрый расчет динамики (Δ%)
              </h5>
              <span className="text-[11px] text-slate-700">
                Адаптивный таймер: ~90 сек на вопрос с таблицами и валютными парами
              </span>
            </div>
          </div>

          <p className="text-xs text-slate-700 leading-relaxed">
            В 80% задач требуется мгновенно рассчитать процентное изменение между двумя периодами или долями рынка:
          </p>

          {/* Formula Display */}
          <div className="p-3 rounded-2xl bg-amber-50/70 border border-amber-200 text-center font-mono text-xs text-amber-950">
            <span className="font-bold">Δ% = ((X₂ - X₁) / X₁) × 100%</span>
          </div>

          {/* Interactive Calculator */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 font-mono">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Интерактивный тренажер формулы:
            </span>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  X₁ (Базовое значение):
                </label>
                <input
                  type="number"
                  value={val1}
                  onChange={(e) => setVal1(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-400 font-mono"
                  placeholder="Например, 1000"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  X₂ (Новое значение):
                </label>
                <input
                  type="number"
                  value={val2}
                  onChange={(e) => setVal2(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-400 font-mono"
                  placeholder="Например, 1250"
                />
              </div>
            </div>

            {/* Results Pill Grid */}
            <div className="grid grid-cols-3 gap-2 pt-1 text-center font-mono">
              <div className="p-2 rounded-xl bg-white border border-slate-200">
                <span className="text-[10px] text-slate-700 block">Разница (Δ)</span>
                <span className="text-xs font-bold text-slate-900">
                  {isValid ? `${deltaAbs > 0 ? '+' : ''}${deltaAbs.toFixed(2)}` : '—'}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-amber-400/20 border border-amber-300">
                <span className="text-[10px] text-amber-900 font-bold block">Прирост (Δ%)</span>
                <span className="text-xs font-extrabold text-amber-950">
                  {isValid ? `${deltaPercent > 0 ? '+' : ''}${deltaPercent.toFixed(2)}%` : '—'}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-white border border-slate-200">
                <span className="text-[10px] text-slate-700 block">Кратность</span>
                <span className="text-xs font-bold text-slate-900">
                  {isValid ? `${ratio.toFixed(2)}x` : '—'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Verbal Section & Decision Rules */}
        <div className="p-4 sm:p-5 rounded-3xl bg-white border border-slate-200/90 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-900 flex items-center justify-center font-bold">
              <BookOpen className="w-4 h-4 text-indigo-700" />
            </div>
            <div>
              <h5 className="text-sm font-extrabold text-slate-900">
                2. Вербальный тест: Правило трех исходов
              </h5>
              <span className="text-[11px] text-slate-700">
                Строго текстовая логика. Запрет на использование жизненного опыта!
              </span>
            </div>
          </div>

          <p className="text-xs text-slate-700 leading-relaxed">
            К каждому сложному финансовому тексту предлагается утверждение с тремя вариантами ответа:
          </p>

          <div className="space-y-2 text-xs">
            {/* True */}
            <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-extrabold text-emerald-900 block">«Истинно» (True)</span>
                <p className="text-slate-800 leading-relaxed">
                  Утверждение логически и прямо следует из фактов, однозначно приведенных в тексте.
                </p>
              </div>
            </div>

            {/* False */}
            <div className="p-3 rounded-2xl bg-rose-50/70 border border-rose-200/80 flex items-start gap-2.5">
              <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-extrabold text-rose-900 block">«Ложно» (False)</span>
                <p className="text-slate-800 leading-relaxed">
                  Утверждение прямо противоречит фактам, изложенным в тексте.
                </p>
              </div>
            </div>

            {/* Cannot Tell */}
            <div className="p-3 rounded-2xl bg-amber-50/70 border border-amber-200/80 flex items-start gap-2.5">
              <HelpCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-extrabold text-amber-900 block">
                  «Нельзя сказать» (Cannot Tell — Главная ловушка!)
                </span>
                <p className="text-slate-800 leading-relaxed">
                  В тексте недостаточно информации, чтобы сделать однозначный вывод. Даже если вы знаете, что это так в реальном мире — если в тексте об этом не сказано, ответ только «Нельзя сказать».
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
