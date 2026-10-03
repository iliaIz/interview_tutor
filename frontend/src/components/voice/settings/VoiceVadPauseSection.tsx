import React from 'react';
import { InterviewConfig } from '../../../types/interviewConfig';

interface VoiceVadPauseSectionProps {
  config: InterviewConfig;
  onChangeConfig: (newConfig: InterviewConfig) => void;
}

export const VoiceVadPauseSection: React.FC<VoiceVadPauseSectionProps> = ({
  config,
  onChangeConfig
}) => {
  return (
    <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <label className="text-xs font-bold text-slate-800 block">
            🎙️ Пауза перед отправкой (VAD Silence Gate)
          </label>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Сколько секунд ИИ ждет в тишине перед тем, как зафиксировать ваш ответ и начать осмысливание.
          </p>
        </div>
        <span className="text-xs font-bold text-pastel-accentViolet px-2.5 py-1 rounded-xl bg-white border border-slate-200 shrink-0">
          {((config.vadPauseMs ?? 1800) / 1000).toFixed(1)} сек
        </span>
      </div>

      <div className="grid grid-cols-4 gap-2 pt-1">
        {[
          { ms: 1200, label: '1.2с (Быстро)' },
          { ms: 1500, label: '1.5с (Базово)' },
          { ms: 1800, label: '1.8с (Senior ✨)' },
          { ms: 2400, label: '2.4с (Вдумчиво)' }
        ].map((item) => (
          <button
            key={item.ms}
            type="button"
            onClick={() => onChangeConfig({ ...config, vadPauseMs: item.ms })}
            className={`py-1.5 px-1 rounded-xl text-[11px] font-bold border transition cursor-pointer text-center ${
              (config.vadPauseMs ?? 1800) === item.ms
                ? 'bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet text-white border-transparent shadow-xs'
                : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
};
