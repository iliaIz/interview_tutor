import React from 'react';
import { InterviewConfig } from '../../../types/interviewConfig';
import { useVoiceConfigStore } from '../../../store/useVoiceConfigStore';
import { VOICE_DEFAULTS, getVadPresetOptions } from '../../../config/voiceDefaults';

interface VoiceVadPauseSectionProps {
  config: InterviewConfig;
  onChangeConfig: (newConfig: InterviewConfig) => void;
}

export const VoiceVadPauseSection: React.FC<VoiceVadPauseSectionProps> = ({
  config,
  onChangeConfig
}) => {
  const runtimeConfig = useVoiceConfigStore((s) => s.runtimeConfig);
  const presets = getVadPresetOptions(runtimeConfig?.vad?.presetsMs);
  const currentPauseMs = config.vadPauseMs ?? runtimeConfig?.defaults?.vadPauseMs ?? VOICE_DEFAULTS.vadPauseMs;

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
          {(currentPauseMs / 1000).toFixed(1)} сек
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
        {presets.map((item) => (
          <button
            key={item.ms}
            type="button"
            onClick={() => onChangeConfig({ ...config, vadPauseMs: item.ms })}
            title={item.desc}
            className={`py-1.5 px-1 rounded-xl text-[11px] font-bold border transition cursor-pointer text-center ${
              currentPauseMs === item.ms
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
