import React, { useState } from 'react';
import {
  Sliders,
  Users,
  User,
  Volume2,
  VolumeX,
  Loader2,
  Settings2,
  ChevronDown,
  ChevronUp,
  Sparkles
} from 'lucide-react';
import { RUSSIAN_VOICES, DEFAULT_SYSTEM_PROMPT, DEFAULT_USER_PROMPT } from './audioRecapConfig';

interface RecapSettingsFormProps {
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
  const [showAdvancedPrompts, setShowAdvancedPrompts] = useState(false);

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

      {/* 3. Duration Selector */}
      <div>
        <label className="block text-xs font-semibold text-pastel-text mb-1.5">Желаемая длительность</label>
        <div className="grid grid-cols-3 gap-2">
          {[
            { id: 'Short (5-7 min)', label: '⚡ Краткий', desc: '5–7 минут' },
            { id: 'Medium (10-15 min)', label: '☕ Средний', desc: '10–15 минут' },
            { id: 'Long (20+ min)', label: '🎙️ Глубокий', desc: '20+ минут' },
          ].map((l) => (
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
          {[
            { id: 'Fun', label: '🔥 Непринужденный', desc: 'Живой, с юмором' },
            { id: 'Informative', label: '💡 Экспертный', desc: 'Четко по делу' },
            { id: 'Formal', label: '🎓 Академический', desc: 'Строго по стандартам' },
          ].map((t) => (
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
      <div className="border-t border-pastel-border/60 pt-3">
        <button
          type="button"
          onClick={() => setShowAdvancedPrompts(!showAdvancedPrompts)}
          className="flex items-center justify-between w-full text-xs font-semibold text-pastel-muted hover:text-pastel-text py-1 transition cursor-pointer"
        >
          <span className="flex items-center gap-1.5">
            <Settings2 className="w-3.5 h-3.5" /> Настройки системных промптов (Advanced)
          </span>
          {showAdvancedPrompts ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showAdvancedPrompts && (
          <div className="mt-3 space-y-3 p-3 bg-white rounded-2xl border border-pastel-border shadow-xs">
            <div>
              <label className="block text-[11px] font-semibold text-pastel-muted mb-1">
                Системный промпт роли (System Prompt)
              </label>
              <textarea
                rows={3}
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                className="w-full text-xs p-2.5 bg-pastel-bg rounded-xl border border-pastel-border focus:border-pastel-accentRose outline-none text-pastel-text font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-pastel-muted mb-1">
                Инструкция к пересказу (User Prompt / Фокус)
              </label>
              <textarea
                rows={2}
                value={userPrompt}
                onChange={(e) => setUserPrompt(e.target.value)}
                className="w-full text-xs p-2.5 bg-pastel-bg rounded-xl border border-pastel-border focus:border-pastel-accentRose outline-none text-pastel-text"
              />
            </div>

            <button
              type="button"
              onClick={() => {
                setSystemPrompt(DEFAULT_SYSTEM_PROMPT);
                setUserPrompt(DEFAULT_USER_PROMPT);
              }}
              className="text-[10px] text-pastel-accentRose hover:underline cursor-pointer"
            >
              Сбросить промпты к дефолтным
            </button>
          </div>
        )}
      </div>

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
