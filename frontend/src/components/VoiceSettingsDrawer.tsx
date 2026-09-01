import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Settings2, Sparkles, GraduationCap, ShieldCheck, 
  Volume2, Bookmark, Plus, Trash2, Code2, ChevronDown, ChevronUp,
  Microscope
} from 'lucide-react';
import { 
  InterviewConfig, InterviewProfile, AVAILABLE_VOICES 
} from '../types/interviewConfig';
import { 
  getCachedProfiles, fetchProfiles, saveUserProfile, deleteUserProfile 
} from '../services/profileStorage';

interface VoiceSettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  config: InterviewConfig;
  onChangeConfig: (newConfig: InterviewConfig) => void;
  questionText: string;
  referenceAnswer: string;
}

export const VoiceSettingsDrawer: React.FC<VoiceSettingsDrawerProps> = ({
  isOpen,
  onClose,
  config,
  onChangeConfig,
  questionText,
  referenceAnswer
}) => {
  const [profiles, setProfiles] = useState<InterviewProfile[]>(getCachedProfiles());
  const [newProfileName, setNewProfileName] = useState('');
  const [showNewProfileInput, setShowNewProfileInput] = useState(false);
  const [showPromptInspector, setShowPromptInspector] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      fetchProfiles().then((data) => setProfiles(data));
    }
  }, [isOpen]);

  const handleSelectProfile = (profile: InterviewProfile) => {
    onChangeConfig({
      ...profile.config,
      customPromptOverride: profile.config.customPromptOverride
    });
  };

  const handleSaveCurrentAsProfile = async () => {
    if (!newProfileName.trim()) return;
    await saveUserProfile(newProfileName, 'Пользовательский профиль', config);
    const updated = await fetchProfiles();
    setProfiles(updated);
    setNewProfileName('');
    setShowNewProfileInput(false);
  };

  const handleDeleteProfile = async (e: React.MouseEvent, profileId: string) => {
    e.stopPropagation();
    await deleteUserProfile(profileId);
    const updated = await fetchProfiles();
    setProfiles(updated);
  };

  const isFemale = ['Kore', 'Aoede'].includes(config.voice);
  const genderLabel = isFemale ? 'Женский род («готова», «слушала», «рада»)' : 'Мужской род («готов», «слушал», «рад»)';

  // Construct preview of prompt for inspector
  const generatedPromptPreview = `[РОЛЬ]: ${config.strategy === 'socratic_tutoring' ? 'Поддерживающий ментор' : 'Senior/Lead технический интервьюер'} (${isFemale ? 'женщина' : 'мужчина'})
[ГРАММАТИЧЕСКИЙ РОД]: ${genderLabel}
[ВОПРОС]: "${questionText}"
[ГОЛОС]: ${config.voice}
[ЛИМИТ РАУНДОВ]: ${config.maxProbes}
[ГЛУБОКОЕ ЗОНДИРОВАНИЕ]: ${config.deepDive ? 'ВКЛЮЧЕНО (Подкапотка, Edge Cases, Radius-1)' : 'ВЫКЛЮЧЕНО (Строго по эталону)'}
[РАЗБОР И ОБУЧЕНИЕ НА ЛЕТУ]: ${config.liveCoaching ? 'ВКЛЮЧЕНО (Micro-Lecture до 40 сек + Active Recall)' : 'ВЫКЛЮЧЕНО (Экзаменация без подсказок)'}
[ДИНАМИЧЕСКИЕ ЯКОРЯ]: До 10 ключевых критериев извлекаются автоматически из эталонного ответа`;

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 md:p-6 bg-slate-900/75 backdrop-blur-md overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="w-full max-w-2xl max-h-[86dvh] flex flex-col bg-white rounded-3xl shadow-2xl border border-pastel-border overflow-hidden my-auto relative z-10"
          >
            {/* 1. Header (Solid White) */}
            <div className="p-5 md:p-6 border-b border-pastel-border bg-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-pastel-accentRose to-pastel-accentViolet flex items-center justify-center text-white shadow-sm">
                  <Settings2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Настройки Live-интервьюера</h3>
                  <p className="text-xs text-slate-500">Стратегия, пресеты голоса, согласование рода речи и профили</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full hover:bg-pastel-rose/80 flex items-center justify-center text-slate-500 hover:text-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 2. Scrollable Body (Opaque Light Background) */}
            <div className="flex-1 overflow-y-auto p-5 md:p-6 space-y-6 bg-[#faf9fa] text-slate-800">
              {/* Профиль собеседования */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Bookmark className="w-3.5 h-3.5 text-pastel-accentViolet" />
                    <span>Профиль собеседования</span>
                  </label>
                  {!showNewProfileInput && (
                    <button
                      type="button"
                      onClick={() => setShowNewProfileInput(true)}
                      className="text-xs font-semibold text-pastel-accentViolet hover:text-pastel-accentRose transition flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Сохранить текущие как новый</span>
                    </button>
                  )}
                </div>

                {showNewProfileInput && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 mb-3 bg-white rounded-2xl border border-pastel-border shadow-xs flex items-center gap-2"
                  >
                    <input
                      type="text"
                      placeholder="Название профиля (например, 'Строгий техдир')"
                      value={newProfileName}
                      onChange={(e) => setNewProfileName(e.target.value)}
                      className="flex-1 text-xs px-3 py-2 bg-pastel-bg rounded-xl border border-pastel-border outline-none focus:border-pastel-accentViolet text-slate-800"
                    />
                    <button
                      type="button"
                      onClick={handleSaveCurrentAsProfile}
                      className="px-3 py-2 bg-pastel-accentViolet text-white rounded-xl text-xs font-semibold hover:opacity-90 transition cursor-pointer"
                    >
                      Сохранить
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowNewProfileInput(false)}
                      className="px-2 py-2 text-slate-500 hover:text-slate-800 text-xs cursor-pointer"
                    >
                      Отмена
                    </button>
                  </motion.div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {profiles.map((p) => {
                    const isSelected = 
                      config.strategy === p.config.strategy && 
                      config.voice === p.config.voice && 
                      config.maxProbes === p.config.maxProbes;

                    return (
                      <div
                        key={p.id}
                        onClick={() => handleSelectProfile(p)}
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer text-left relative ${
                          isSelected
                            ? 'bg-gradient-to-br from-pastel-rose/80 to-white border-pastel-accentViolet shadow-sm ring-1 ring-pastel-accentViolet/30'
                            : 'bg-white hover:bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-slate-800">{p.name}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-pastel-accentViolet/10 text-pastel-accentViolet font-semibold">
                            {p.badge}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                          {p.description}
                        </p>
                        {!p.isPreset && (
                          <button
                            type="button"
                            onClick={(e) => handleDeleteProfile(e, p.id)}
                            className="absolute bottom-2 right-2 text-slate-400 hover:text-red-500 transition p-1 cursor-pointer"
                            title="Удалить профиль"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Стратегия интервью */}
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
                  Стратегия интервью
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => onChangeConfig({ ...config, strategy: 'adaptive_probing' })}
                    className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                      config.strategy === 'adaptive_probing'
                        ? 'bg-gradient-to-r from-pastel-accentRose/10 to-pastel-accentViolet/10 border-pastel-accentViolet ring-1 ring-pastel-accentViolet/40'
                        : 'bg-white hover:bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <ShieldCheck className="w-4 h-4 text-pastel-accentViolet" />
                      <span className="text-xs font-bold text-slate-800">Адаптивное зондирование</span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-snug">
                      Стандарт FAANG: объективная оценка без подсказок, проверка глубины и краевых случаев.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => onChangeConfig({ ...config, strategy: 'socratic_tutoring' })}
                    className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                      config.strategy === 'socratic_tutoring'
                        ? 'bg-gradient-to-r from-pastel-accentRose/10 to-pastel-accentViolet/10 border-pastel-accentViolet ring-1 ring-pastel-accentViolet/40'
                        : 'bg-white hover:bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <GraduationCap className="w-4 h-4 text-pastel-accentRose" />
                      <span className="text-xs font-bold text-slate-800">Сократический ментор</span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-snug">
                      Обучающий режим: поддержка, похвала за верные мысли и мягкие наводящие аналогии.
                    </p>
                  </button>
                </div>
              </div>

              {/* Персонализация пола кандидата (Обращение к вам) */}
              <div className="p-4 rounded-2xl border border-pastel-accentViolet/30 bg-gradient-to-r from-pastel-rose/30 to-pastel-lavender/30 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-pastel-accentRose" />
                    <span>Обращение к вам (Пол кандидата)</span>
                  </label>
                  <span className="text-[10px] font-bold text-pastel-accentViolet bg-white/80 px-2.5 py-0.5 rounded-full border border-pastel-border shadow-2xs">
                    {config.userGender === 'male' ? '👨 Мужской род' : config.userGender === 'neutral' ? '⚪ На «Вы»' : '👩 Женский род'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 leading-snug">
                  ИИ будет строго согласовывать окончания глаголов и прилагательных при обращении к вам.
                </p>
                <div className="grid grid-cols-3 gap-2 pt-1">
                  {[
                    { id: 'female', label: '👩 Женский', hint: '«Ты сказала», «готова»' },
                    { id: 'male', label: '👨 Мужской', hint: '«Ты сказал», «готов»' },
                    { id: 'neutral', label: '⚪ На «Вы»', hint: '«Вы сказали», «готовы»' }
                  ].map((g) => {
                    const isSelected = (config.userGender || 'female') === g.id;
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => {
                          const newGender = g.id as 'female' | 'male' | 'neutral';
                          localStorage.setItem('interview_user_gender', newGender);
                          onChangeConfig({ ...config, userGender: newGender });
                        }}
                        className={`p-2 rounded-xl text-center border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet text-white border-transparent shadow-xs ring-1 ring-pastel-accentViolet/30'
                            : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                        }`}
                      >
                        <div className="text-xs font-bold">{g.label}</div>
                        <div className={`text-[9px] mt-0.5 ${isSelected ? 'text-white/80' : 'text-slate-400'}`}>{g.hint}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Режим ведения диалога (Turn Mode) */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Режим ответа (Защита от перебивания)</span>
                  </label>
                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                    (config.turnMode || 'manual') === 'manual'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}>
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

                {/* Выбор Live-модели для Auto-VAD */}
                {config.turnMode === 'auto' && (
                  <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                      Движок Live WebSocket (через LiteLLM Proxy)
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => onChangeConfig({ ...config, liveModel: 'gemini-live-v2' })}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          (config.liveModel || 'gemini-live-v2') === 'gemini-live-v2'
                            ? 'bg-emerald-50/80 border-emerald-400 ring-1 ring-emerald-400/40 shadow-xs'
                            : 'bg-white hover:bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs font-bold text-emerald-950">🟢 gemini-live-v2</span>
                          <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">Стабильный</span>
                        </div>
                        <p className="text-[10px] text-slate-600">Высокая квота, без обрывов длинных сессий.</p>
                      </button>

                      <button
                        type="button"
                        onClick={() => onChangeConfig({ ...config, liveModel: 'gemini-live-v3' })}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          config.liveModel === 'gemini-live-v3'
                            ? 'bg-purple-50/80 border-purple-400 ring-1 ring-purple-400/40 shadow-xs'
                            : 'bg-white hover:bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs font-bold text-purple-950">🟣 gemini-live-v3</span>
                          <span className="text-[9px] bg-purple-100 text-purple-800 font-bold px-1.5 py-0.5 rounded">Preview</span>
                        </div>
                        <p className="text-[10px] text-slate-600">Экспериментальный Gemini 3.1 Live Preview.</p>
                      </button>
                    </div>
                  </div>
                )}
              </div>
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
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-50 border border-slate-200 text-slate-500 font-medium">
                            {v.gender}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-tight">
                          {v.style}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

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

              {/* Настройки автоперехода и таймера между вопросами */}
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

              {/* Настройки VAD (длительность паузы перед отправкой ответа) */}
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

              {/* Инспектор системного промпта */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
                <button
                  type="button"
                  onClick={() => setShowPromptInspector(!showPromptInspector)}
                  className="w-full p-3 flex items-center justify-between text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Code2 className="w-4 h-4 text-pastel-accentViolet" />
                    <span>Предпросмотр системного промпта (Inspector)</span>
                  </div>
                  {showPromptInspector ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </button>

                {showPromptInspector && (
                  <div className="p-3.5 bg-slate-900 text-slate-200 text-[11px] font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap border-t border-slate-200">
                    {generatedPromptPreview}
                  </div>
                )}
              </div>
            </div>

            {/* 3. Footer (Solid White) */}
            <div className="p-4 md:p-5 border-t border-pastel-border bg-white flex justify-end shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="py-2.5 px-6 rounded-2xl bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet text-white font-semibold text-xs hover:opacity-95 transition shadow-sm cursor-pointer"
              >
                Готово
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};
