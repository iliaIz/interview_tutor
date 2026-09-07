import React, { useState, useRef } from 'react';
import { Volume2, Play, Loader2 } from 'lucide-react';
import { InterviewConfig, AVAILABLE_VOICES, GeminiVoiceName } from '../../types/interviewConfig';

interface VoiceAudioTesterProps {
  config: InterviewConfig;
  onChangeVoice: (voice: GeminiVoiceName) => void;
}

export const VoiceAudioTester: React.FC<VoiceAudioTesterProps> = ({
  config,
  onChangeVoice
}) => {
  const [previewingVoice, setPreviewingVoice] = useState<GeminiVoiceName | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const isFemale = ['Kore', 'Aoede'].includes(config.voice);

  const playVoicePreview = async (voice: GeminiVoiceName) => {
    if (previewingVoice) return;
    setPreviewingVoice(voice);

    try {
      const res = await fetch('/api/interview/greeting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: 'Знакомство',
          questionText: 'Привет! Я твой голосовой наставник по Java и Spring.',
          voice: voice,
          strategy: config.strategy || 'socratic_tutoring'
        })
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.audioBase64) {
        if (!audioRef.current) {
          audioRef.current = new Audio();
        }
        audioRef.current.src = `data:audio/wav;base64,${data.audioBase64}`;
        audioRef.current.onended = () => setPreviewingVoice(null);
        audioRef.current.onerror = () => setPreviewingVoice(null);
        await audioRef.current.play();
      } else {
        setPreviewingVoice(null);
      }
    } catch (err) {
      console.warn('Voice preview failed:', err);
      setPreviewingVoice(null);
    }
  };

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
              onClick={() => onChangeVoice(v.id)}
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
                      void playVoicePreview(v.id);
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
