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
            className="w-full max-w-2xl max-h-[86vh] flex flex-col bg-white rounded-3xl shadow-2xl border border-pastel-border overflow-hidden my-auto relative z-10"
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

              {/* Выбор голоса и авто-согласование пола */}
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
