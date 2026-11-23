import React from 'react';
import { Volume2, VolumeX, Loader2 } from 'lucide-react';
import { RUSSIAN_VOICES } from '../audioRecapConfig';

export interface VoiceSelectorGroupProps {
  mode: 'duo' | 'solo';
  voice1: string;
  setVoice1: (v: string) => void;
  voice2: string;
  setVoice2: (v: string) => void;
  previewingVoice: string | null;
  onPreviewVoice: (v: string) => void;
  isAiReady: boolean;
}

export const VoiceSelectorGroup: React.FC<VoiceSelectorGroupProps> = ({
  mode,
  voice1,
  setVoice1,
  voice2,
  setVoice2,
  previewingVoice,
  onPreviewVoice,
  isAiReady,
}) => {
  return (
    <div className="bg-pastel-card/60 p-3 rounded-2xl border border-pastel-border/60 space-y-3">
      {mode === 'solo' ? (
        <div>
          <label className="block text-xs font-semibold text-pastel-text mb-1.5 flex items-center justify-between">
            <span>Выберите диктора (Русский)</span>
          </label>
          <div className="flex items-center gap-2 min-w-0">
            <select
              value={voice1}
              onChange={(e) => setVoice1(e.target.value)}
              className="flex-1 min-w-0 w-full bg-white text-pastel-text text-xs rounded-xl p-2.5 border border-pastel-border focus:border-pastel-accentRose outline-none truncate"
            >
              {RUSSIAN_VOICES.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.gender}) — {v.desc}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!isAiReady}
              onClick={() => onPreviewVoice(voice1)}
              className={`shrink-0 p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-1 transition ${
                !isAiReady
                  ? 'opacity-50 cursor-not-allowed bg-gray-100 text-gray-400 border-gray-200'
                  : previewingVoice === voice1
                  ? 'bg-pastel-accentRose text-white border-pastel-accentRose'
                  : 'bg-white text-pastel-accentRose border-pastel-accentRose/30 hover:bg-pastel-rose cursor-pointer'
              }`}
              title="Прослушать пример голоса"
            >
              {!isAiReady ? (
                <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
              ) : previewingVoice === voice1 ? (
                <VolumeX className="w-4 h-4 animate-pulse" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">Тест</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
          <div className="min-w-0">
            <label className="block text-xs font-semibold text-pastel-text mb-1 flex items-center justify-between">
              <span>Голос 1 (Ведущий)</span>
            </label>
            <div className="flex items-center gap-1.5 min-w-0">
              <select
                value={voice1}
                onChange={(e) => setVoice1(e.target.value)}
                className="flex-1 min-w-0 w-full bg-white text-pastel-text text-xs rounded-xl p-2.5 border border-pastel-border focus:border-pastel-accentRose outline-none truncate"
              >
                {RUSSIAN_VOICES.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.gender}) — {v.desc}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!isAiReady}
                onClick={() => onPreviewVoice(voice1)}
                className={`shrink-0 p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-1 transition ${
                  !isAiReady
                    ? 'opacity-50 cursor-not-allowed bg-gray-100 text-gray-400 border-gray-200'
                    : previewingVoice === voice1
                    ? 'bg-pastel-accentRose text-white border-pastel-accentRose'
                    : 'bg-white text-pastel-accentRose border-pastel-accentRose/30 hover:bg-pastel-rose cursor-pointer'
                }`}
              >
                {previewingVoice === voice1 ? (
                  <VolumeX className="w-4 h-4 animate-pulse" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <div className="min-w-0">
            <label className="block text-xs font-semibold text-pastel-text mb-1 flex items-center justify-between">
              <span>Голос 2 (Соведущий)</span>
            </label>
            <div className="flex items-center gap-1.5 min-w-0">
              <select
                value={voice2}
                onChange={(e) => setVoice2(e.target.value)}
                className="flex-1 min-w-0 w-full bg-white text-pastel-text text-xs rounded-xl p-2.5 border border-pastel-border focus:border-pastel-accentViolet outline-none truncate"
              >
                {RUSSIAN_VOICES.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.gender}) — {v.desc}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!isAiReady}
                onClick={() => onPreviewVoice(voice2)}
                className={`shrink-0 p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-1 transition ${
                  !isAiReady
                    ? 'opacity-50 cursor-not-allowed bg-gray-100 text-gray-400 border-gray-200'
                    : previewingVoice === voice2
                    ? 'bg-pastel-accentViolet text-white border-pastel-accentViolet'
                    : 'bg-white text-pastel-accentViolet border-pastel-accentViolet/30 hover:bg-pastel-lavender cursor-pointer'
                }`}
              >
                {previewingVoice === voice2 ? (
                  <VolumeX className="w-4 h-4 animate-pulse" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
