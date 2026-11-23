import React from 'react';
import { Sliders, Users, User, Loader2, Sparkles } from 'lucide-react';
import { VoiceSelectorGroup } from './recap/VoiceSelectorGroup';
import { AdvancedPromptsCollapsible } from './recap/AdvancedPromptsCollapsible';
import { DURATION_OPTIONS, TONE_OPTIONS } from './recap/recapConfigTypes';

export interface RecapSettingsFormProps {
  mode: 'duo' | 'solo';
  onModeChange: (m: 'duo' | 'solo') => void;
  voice1: string;
  setVoice1: (v: string) => void;
  voice2: string;
  setVoice2: (v: string) => void;
  previewingVoice: string | null;
  onPreviewVoice: (v: string) => void;
  isAiReady: boolean;
  length: string;
  setLength: (l: string) => void;
  tone: string;
  onToneChange: (t: string) => void;
  systemPrompt: string;
  setSystemPrompt: (p: string) => void;
  userPrompt: string;
  setUserPrompt: (p: string) => void;
  onSubmit: () => void;
}

export const RecapSettingsForm: React.FC<RecapSettingsFormProps> = ({
  mode,
  onModeChange,
  voice1,
  setVoice1,
  voice2,
  setVoice2,
  previewingVoice,
  onPreviewVoice,
  isAiReady,
  length,
  setLength,
  tone,
  onToneChange,
  systemPrompt,
  setSystemPrompt,
  userPrompt,
  setUserPrompt,
  onSubmit,
}) => {
  return (
    <div className="space-y-4 overflow-y-auto pr-1 flex-1">
      {/* Warmup notice if AI Gateway is not ready */}
      {!isAiReady && (
        <div className="p-3 rounded-2xl bg-amber-50/90 border border-amber-200 text-amber-900 text-xs flex items-center gap-2.5 shadow-xs">
          <Loader2 className="w-4 h-4 text-amber-600 animate-spin shrink-0" />
          <div>
            <span className="font-semibold block">Инициализация AI Шлюза...</span>
            <p className="text-[11px] text-amber-800/80 mt-0.5">
              Сервер подключается к Google Gemini API. Кнопки станут активны через несколько секунд.
            </p>
          </div>
        </div>
      )}

      {/* 1. Format Mode */}
      <div>
        <label className="block text-xs font-semibold text-pastel-text mb-1.5 flex items-center gap-1.5">
          <Sliders className="w-3.5 h-3.5 text-pastel-accentRose" /> Формат озвучки
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onModeChange('duo')}
            className={`p-3 rounded-2xl text-xs font-semibold border flex items-center gap-2.5 transition cursor-pointer ${
              mode === 'duo'
                ? 'bg-pastel-rose/80 text-pastel-accentRose border-pastel-accentRose/40 shadow-sm'
                : 'bg-pastel-card text-pastel-muted border-pastel-border hover:border-pastel-accentRose/20'
            }`}
          >
            <div className="p-1.5 rounded-lg bg-pastel-accentRose/10">
              <Users className="w-4 h-4 text-pastel-accentRose" />
            </div>
            <div className="text-left">
              <div>Диалог двух экспертов</div>
              <div className="text-[10px] opacity-80 font-normal">2 диктора • Живая дискуссия</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onModeChange('solo')}
            className={`p-3 rounded-2xl text-xs font-semibold border flex items-center gap-2.5 transition cursor-pointer ${
              mode === 'solo'
                ? 'bg-pastel-lavender/80 text-pastel-accentViolet border-pastel-accentViolet/40 shadow-sm'
                : 'bg-pastel-card text-pastel-muted border-pastel-border hover:border-pastel-accentViolet/20'
            }`}
          >
            <div className="p-1.5 rounded-lg bg-pastel-accentViolet/10">
              <User className="w-4 h-4 text-pastel-accentViolet" />
            </div>
            <div className="text-left">
              <div>Соло пересказ</div>
              <div className="text-[10px] opacity-80 font-normal">1 диктор • Структурированный разбор</div>
            </div>
          </button>
        </div>
      </div>

      {/* 2. Voice Pickers */}
      <VoiceSelectorGroup
        mode={mode}
        voice1={voice1}
        setVoice1={setVoice1}
        voice2={voice2}
        setVoice2={setVoice2}
        previewingVoice={previewingVoice}
        onPreviewVoice={onPreviewVoice}
        isAiReady={isAiReady}
      />

      {/* 3. Duration Selector */}
      <div>
        <label className="block text-xs font-semibold text-pastel-text mb-1.5">Желаемая длительность</label>
        <div className="grid grid-cols-3 gap-2">
          {DURATION_OPTIONS.map((l) => (
            <button
              type="button"
              key={l.id}
              onClick={() => setLength(l.id)}
              className={`p-2.5 rounded-xl text-xs font-semibold border text-center transition cursor-pointer ${
                length === l.id
                  ? 'bg-pastel-lavender text-pastel-accentViolet border-pastel-accentViolet/40 shadow-sm'
                  : 'bg-pastel-card text-pastel-muted border-pastel-border hover:border-pastel-accentViolet/20'
              }`}
            >
              <div>{l.label}</div>
              <div className="text-[10px] font-normal opacity-75">{l.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* 4. Tone of Voice */}
      <div>
        <label className="block text-xs font-semibold text-pastel-text mb-1.5">Тон и подача</label>
        <div className="grid grid-cols-3 gap-2">
          {TONE_OPTIONS.map((t) => (
            <button
              type="button"
              key={t.id}
              onClick={() => onToneChange(t.id)}
              className={`p-2.5 rounded-xl text-xs font-semibold border text-center transition cursor-pointer ${
                tone === t.id
                  ? 'bg-pastel-rose text-pastel-accentRose border-pastel-accentRose/40 shadow-sm'
                  : 'bg-pastel-card text-pastel-muted border-pastel-border hover:border-pastel-accentRose/20'
              }`}
            >
              <div>{t.label}</div>
              <div className="text-[10px] font-normal opacity-75">{t.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* 5. Advanced Prompt Settings */}
      <AdvancedPromptsCollapsible
        systemPrompt={systemPrompt}
        setSystemPrompt={setSystemPrompt}
        userPrompt={userPrompt}
        setUserPrompt={setUserPrompt}
      />

      {/* Submit Button */}
      <button
        type="button"
        disabled={!isAiReady}
        onClick={onSubmit}
        className={`w-full py-3.5 px-4 font-bold text-sm rounded-2xl shadow-lg flex items-center justify-center gap-2 transition transform mt-2 ${
          !isAiReady
            ? 'opacity-60 cursor-not-allowed bg-gray-400 text-white'
            : 'bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet hover:opacity-95 text-white shadow-pastel-accentRose/25 active:scale-[0.98] cursor-pointer'
        }`}
      >
        {!isAiReady ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin text-white" />
            <span>Ожидание готовности AI Шлюза...</span>
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" />
            <span>Запустить генерацию аудио (Opus)</span>
          </>
        )}
      </button>
    </div>
  );
};
