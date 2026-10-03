import React from 'react';
import { Microscope, GraduationCap } from 'lucide-react';
import { InterviewConfig } from '../../../types/interviewConfig';

interface VoiceProbesSectionProps {
  config: InterviewConfig;
  onChangeConfig: (newConfig: InterviewConfig) => void;
}

export const VoiceProbesSection: React.FC<VoiceProbesSectionProps> = ({
  config,
  onChangeConfig
}) => {
  return (
    <>
      {/* Лимит уточняющих раундов */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Глубина зондирования (лимит раундов)
          </label>
          <span className="text-xs font-semibold text-pastel-accentViolet">
            {config.maxProbes} {config.maxProbes === 1 ? 'раунд' : config.maxProbes < 5 ? 'раунда' : 'раундов'}
          </span>
        </div>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((count) => (
            <button
              key={count}
              type="button"
              onClick={() => onChangeConfig({ ...config, maxProbes: count })}
              className={`flex-1 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                config.maxProbes === count
                  ? 'bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet text-white border-transparent shadow-sm'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
              }`}
            >
              {count}
            </button>
          ))}
        </div>
      </div>

      {/* Модификаторы поведения и режимы коучинга */}
      <div>
        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2.5">
          Модификаторы поведения и режимы коучинга
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* 1. Глубокое зондирование (Deep-Dive) */}
          <div
            onClick={() => onChangeConfig({ ...config, deepDive: !config.deepDive })}
            className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
              config.deepDive
                ? 'bg-gradient-to-br from-pastel-rose/80 to-white border-pastel-accentViolet shadow-sm ring-1 ring-pastel-accentViolet/30'
                : 'bg-white hover:bg-slate-50 border-slate-200 opacity-80'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Microscope className="w-4 h-4 text-pastel-accentViolet" />
                  Глубокое зондирование
                </span>
                <div
                  className={`w-9 h-5 rounded-full p-0.5 transition-colors ${
                    config.deepDive ? 'bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet' : 'bg-slate-200'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white shadow-xs transform transition-transform ${
                      config.deepDive ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </div>
              </div>
              <p className="text-[11px] text-slate-500 leading-snug">
                Интервьюер задаёт вопросы под капотом (Proxy, Concurrency, JVM), ищет границы знаний и проверяет смежные темы.
              </p>
            </div>
            <span className={`text-[10px] font-semibold mt-2.5 inline-block ${config.deepDive ? 'text-pastel-accentViolet' : 'text-slate-400'}`}>
              {config.deepDive ? '✨ Режим Deep-Dive активен' : 'Стандартный скоуп (по эталону)'}
            </span>
          </div>

          {/* 2. Разбор ошибок и обучение на лету (Live Coaching) */}
          <div
            onClick={() => onChangeConfig({ ...config, liveCoaching: !config.liveCoaching })}
            className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
              config.liveCoaching
                ? 'bg-gradient-to-br from-emerald-50/80 to-white border-emerald-400 shadow-sm ring-1 ring-emerald-400/30'
                : 'bg-white hover:bg-slate-50 border-slate-200 opacity-80'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <GraduationCap className="w-4 h-4 text-emerald-600" />
                  Разбор и обучение на лету
                </span>
                <div
                  className={`w-9 h-5 rounded-full p-0.5 transition-colors ${
                    config.liveCoaching ? 'bg-emerald-500' : 'bg-slate-200'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white shadow-xs transform transition-transform ${
                      config.liveCoaching ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </div>
              </div>
              <p className="text-[11px] text-slate-500 leading-snug">
                При ошибке или просьбе «Подскажи» ИИ за 30 секунд объяснит суть, даст идеальную формулировку и мини-вопрос на закрепление.
              </p>
            </div>
            <span className={`text-[10px] font-semibold mt-2.5 inline-block ${config.liveCoaching ? 'text-emerald-700' : 'text-slate-400'}`}>
              {config.liveCoaching ? '🎓 Режим наставника активен' : 'Экзаменация без подсказок'}
            </span>
          </div>
        </div>
      </div>
    </>
  );
};
