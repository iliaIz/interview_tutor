import React from 'react';
import { Volume2, Play, Loader2 } from 'lucide-react';
import { InterviewConfig, AVAILABLE_VOICES, GeminiVoiceName } from '../../../types/interviewConfig';

interface VoiceSelectionSectionProps {
  config: InterviewConfig;
  onChangeConfig: (newConfig: InterviewConfig) => void;
  previewingVoice: GeminiVoiceName | null;
  onPlayPreview: (voice: GeminiVoiceName) => Promise<void>;
  isFemale: boolean;
}

export const VoiceSelectionSection: React.FC<VoiceSelectionSectionProps> = ({
  config,
  onChangeConfig,
  previewingVoice,
  onPlayPreview,
  isFemale
}) => {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
          Голос и пол интервьюера (Google Gemini Live)
        </label>
        <span className="text-[11px] font-semibold text-pastel-accentViolet bg-white px-2.5 py-0.5 rounded-full border border-pastel-border shadow-2xs">
          {isFemale ? '♀️ Женский род речи' : '♂️ Мужской род речи'}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
        {AVAILABLE_VOICES.map((v) => {
          const isSelected = config.voice === v.id;
          return (
            <div
              key={v.id}
              onClick={() => onChangeConfig({ ...config, voice: v.id })}
              className={`p-3 rounded-2xl border transition-all cursor-pointer text-left ${
                isSelected
                  ? 'bg-pastel-rose/80 border-pastel-accentViolet shadow-sm ring-1 ring-pastel-accentViolet/30'
                  : 'bg-white hover:bg-slate-50 border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-pastel-accentViolet" />
                  {v.name}
                </span>
                <div className="flex items-center gap-1">
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-50 border border-slate-200 text-slate-500 font-medium">
                    {v.gender}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void onPlayPreview(v.id);
                    }}
                    title="Прослушать голос"
                    className="p-1 rounded-lg hover:bg-pastel-rose text-pastel-accentRoseText transition cursor-pointer"
                  >
                    {previewingVoice === v.id ? (
                      <Loader2 className="w-3 h-3 animate-spin text-pastel-accentRose" />
                    ) : (
                      <Play className="w-3 h-3 text-pastel-accentRose fill-pastel-accentRose/20" />
                    )}
                  </button>
                </div>
              </div>
              <p className="text-[10px] text-slate-500 leading-tight">
                {v.style}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
