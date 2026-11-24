import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { InterviewConfig } from '../../../types/interviewConfig';
import { useAppStore } from '../../../store/useAppStore';
import { VOICE_DEFAULTS, getLiveModelUiMeta } from '../../../config/voiceDefaults';
import { resolveEffectiveLiveModel } from '../../../audio/voiceConfigResolver';
import { setExplicitLiveModelPreference } from '../../../services/profileStorage';

interface VoiceDialogueModeSectionProps {
  config: InterviewConfig;
  onChangeConfig: (newConfig: InterviewConfig) => void;
}

export const VoiceDialogueModeSection: React.FC<VoiceDialogueModeSectionProps> = ({
  config,
  onChangeConfig
}) => {
  const runtimeConfig = useAppStore((s) => s.runtimeConfig);
  const supportedModels = runtimeConfig?.models?.supportedLiveModels?.length
    ? runtimeConfig.models.supportedLiveModels
    : [...VOICE_DEFAULTS.supportedLiveModels];
  const defaultRuntimeModel = runtimeConfig?.models?.defaultLiveModel || VOICE_DEFAULTS.liveModel;
  const activeLiveModel = resolveEffectiveLiveModel(config, runtimeConfig);
  return (
    <div className="p-4 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-2.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Режим ответа (Защита от перебивания)</span>
        </label>
        <span
          className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
            (config.turnMode || 'manual') === 'manual'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-amber-50 text-amber-700 border-amber-200'
          }`}
        >
          {(config.turnMode || 'manual') === 'manual' ? '🛑 По кнопке (Manual)' : '🎙️ Свободный (Auto-VAD)'}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={() => {
            localStorage.setItem('interview_turn_mode', 'manual');
            onChangeConfig({ ...config, turnMode: 'manual' });
          }}
          className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
            (config.turnMode || 'manual') === 'manual'
              ? 'bg-emerald-50/80 border-emerald-400 ring-1 ring-emerald-400/40 shadow-xs'
              : 'bg-white hover:bg-slate-50 border-slate-200'
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-emerald-900">🛑 По кнопке «Закончить ответ»</span>
          </div>
          <p className="text-[11px] text-slate-600 leading-snug">
            ✨ <strong>Рекомендуется</strong>: ИИ ждет сколько угодно, пока вы думаете. Никаких случайных перебиваний при паузах.
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            localStorage.setItem('interview_turn_mode', 'auto');
            onChangeConfig({ ...config, turnMode: 'auto' });
          }}
          className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
            config.turnMode === 'auto'
              ? 'bg-gradient-to-r from-pastel-accentRose/10 to-pastel-accentViolet/10 border-pastel-accentViolet ring-1 ring-pastel-accentViolet/40 shadow-xs'
              : 'bg-white hover:bg-slate-50 border-slate-200'
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-slate-800">🎙️ Свободный диалог (Auto-VAD)</span>
          </div>
          <p className="text-[11px] text-slate-500 leading-snug">
            ИИ сам фиксирует ответ после 1.5–2.5с тишины. Удобно в наушниках при беглой речи.
          </p>
        </button>
      </div>

      {/* Выбор Live-модели (доступен в обоих режимах диалога) */}
      <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
        <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
          Движок Live WebSocket (через LiteLLM Proxy)
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {supportedModels.map((modelId) => {
            const meta = getLiveModelUiMeta(modelId, defaultRuntimeModel);
            const isSelected = activeLiveModel === modelId;
            return (
              <button
                key={modelId}
                type="button"
                onClick={() => {
                  setExplicitLiveModelPreference(modelId);
                  onChangeConfig({ ...config, liveModel: modelId });
                }}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-purple-50/80 border-purple-400 ring-1 ring-purple-400/40 shadow-xs'
                    : 'bg-white hover:bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between mb-0.5 gap-1">
                  <span className="text-xs font-bold text-slate-900 truncate">{meta.icon} {meta.label}</span>
                  <span className="text-[9px] bg-slate-100 text-slate-700 font-bold px-1.5 py-0.5 rounded shrink-0">
                    {meta.shortBadge}
                  </span>
                </div>
                <p className="text-[10px] text-slate-600">{meta.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Тумблер переспрашивания при тишине / неразборчивом ответе */}
      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
        <div>
          <label className="text-xs font-bold text-slate-800 block">
            🔄 Переспрашивать при тишине / неразборчивом ответе
          </label>
          <p className="text-[11px] text-slate-500 mt-0.5 max-w-sm">
            {config.enableSilenceClarification
              ? 'ИИ переспросит («Я тебя не расслышала...»), если звук был тихим или прервался.'
              : 'Режим молчания (по умолчанию): ИИ не надоедает переспрашиваниями и спокойно ждет продолжения ответа.'}
          </p>
        </div>
        <div
          onClick={() => onChangeConfig({ ...config, enableSilenceClarification: !config.enableSilenceClarification })}
          className={`w-11 h-6 rounded-full p-0.5 transition-colors cursor-pointer shrink-0 ${
            config.enableSilenceClarification ? 'bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet' : 'bg-slate-300'
          }`}
        >
          <div
            className={`w-5 h-5 rounded-full bg-white shadow-xs transform transition-transform ${
              config.enableSilenceClarification ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </div>
      </div>
    </div>
  );
};
