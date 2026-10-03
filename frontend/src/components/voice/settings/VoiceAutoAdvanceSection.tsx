import React from 'react';
import { InterviewConfig } from '../../../types/interviewConfig';

interface VoiceAutoAdvanceSectionProps {
  config: InterviewConfig;
  onChangeConfig: (newConfig: InterviewConfig) => void;
}

export const VoiceAutoAdvanceSection: React.FC<VoiceAutoAdvanceSectionProps> = ({
  config,
  onChangeConfig
}) => {
  return (
    <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <label className="text-xs font-bold text-slate-800 block">
            ⚡ Автопереход к следующему вопросу (Hands-Free)
          </label>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {config.autoAdvance !== false
              ? 'Таймер автоматически запускает следующий вопрос после оценки.'
              : 'Ручной режим: окно вердикта ждет вашего клика, время не ограничено.'}
          </p>
        </div>
        <div
          onClick={() => onChangeConfig({ ...config, autoAdvance: config.autoAdvance === false ? true : false })}
          className={`w-11 h-6 rounded-full p-0.5 transition-colors cursor-pointer shrink-0 ${
            config.autoAdvance !== false ? 'bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet' : 'bg-slate-300'
          }`}
        >
          <div
            className={`w-5 h-5 rounded-full bg-white shadow-xs transform transition-transform ${
              config.autoAdvance !== false ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </div>
      </div>

      {config.autoAdvance !== false && (
        <div className="pt-2 border-t border-slate-200/80">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold text-slate-600">
              ⏱️ Задержка перед следующим вопросом:
            </span>
            <span className="text-xs font-bold text-pastel-accentViolet">
              {config.transitionDelay ?? 5} сек
            </span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[3, 5, 10, 15].map((sec) => (
              <button
                key={sec}
                type="button"
                onClick={() => onChangeConfig({ ...config, transitionDelay: sec, autoAdvance: true })}
                className={`py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                  (config.transitionDelay ?? 5) === sec
                    ? 'bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet text-white border-transparent shadow-xs'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                {sec} сек
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
