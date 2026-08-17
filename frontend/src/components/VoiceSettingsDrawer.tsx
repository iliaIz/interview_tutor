import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Settings2, Sparkles, UserCheck, GraduationCap, ShieldCheck, 
  Flame, Zap, Volume2, Bookmark, Plus, Trash2, Code2, Check, ChevronDown, ChevronUp
} from 'lucide-react';
import { 
  InterviewConfig, InterviewProfile, GeminiVoiceName, InterviewStrategy, AVAILABLE_VOICES 
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
  const [newAnchorText, setNewAnchorText] = useState('');

  React.useEffect(() => {
    if (isOpen) {
      fetchProfiles().then((data) => setProfiles(data));
    }
  }, [isOpen]);

  const currentAnchors = config.customAnchors && config.customAnchors.length > 0 
    ? config.customAnchors 
    : [
        'Понимание базового определения и ключевой терминологии',
        'Архитектурное назначение и внутреннее устройство',
        'Практическое применение и отличия от аналогов'
      ];

  const handleSelectProfile = (profile: InterviewProfile) => {
    onChangeConfig({
      ...profile.config,
      customAnchors: config.customAnchors,
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

  const handleAddAnchor = () => {
    if (!newAnchorText.trim()) return;
    if (currentAnchors.length >= 10) return;
    const updated = [...currentAnchors, newAnchorText.trim()];
    onChangeConfig({ ...config, customAnchors: updated });
    setNewAnchorText('');
  };

  const handleRemoveAnchor = (index: number) => {
    const updated = currentAnchors.filter((_, i) => i !== index);
    onChangeConfig({ ...config, customAnchors: updated });
  };

  // Construct preview of prompt for inspector
  const generatedPromptPreview = config.strategy === 'socratic_tutoring'
    ? `[РОЛЬ]: Поддерживающий ментор по теме\n[ВОПРОС]: "${questionText}"\n[СТРАТЕГИЯ]: Сократический диалог (помощь аналогиями, похвала, до ${config.maxProbes} раундов уточнений)\n[ГОЛОС]: ${config.voice}\n[ЧЕК-ЛИСТ ЯКОРЕЙ (${currentAnchors.length} шт.)]:\n${currentAnchors.map((a, i) => `  ${i + 1}. ${a}`).join('\n')}`
    : `[РОЛЬ]: Senior/Lead технический интервьюер\n[ВОПРОС]: "${questionText}"\n[СТРАТЕГИЯ]: Адаптивное зондирование (FAANG Standard, без подсказок, проверка глубины, до ${config.maxProbes} раундов)\n[ГОЛОС]: ${config.voice}\n[ЧЕК-ЛИСТ ЯКОРЕЙ (${currentAnchors.length} шт.)]:\n${currentAnchors.map((a, i) => `  ${i + 1}. ${a}`).join('\n')}`;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="w-full max-w-2xl max-h-[88vh] flex flex-col bg-white/95 backdrop-blur-2xl rounded-3xl shadow-2xl border border-pastel-border overflow-hidden"
          >
            {/* Header */}
            <div className="p-6 border-b border-pastel-border/60 flex items-center justify-between bg-gradient-to-r from-pastel-card to-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-pastel-accentRose to-pastel-accentViolet flex items-center justify-center text-white shadow-sm">
                  <Settings2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-pastel-text">Настройки Live-интервьюера</h3>
                  <p className="text-xs text-pastel-sub">Стратегия, пресеты голоса, чек-лист якорей и профили</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full hover:bg-pastel-rose/80 flex items-center justify-center text-pastel-sub transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* 1. Предустановленные и сохраненные профили */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <label className="text-xs font-bold text-pastel-text uppercase tracking-wider flex items-center gap-1.5">
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
                    className="p-3 mb-3 bg-pastel-card rounded-2xl border border-pastel-border flex items-center gap-2"
                  >
                    <input
                      type="text"
                      placeholder="Название профиля (например, 'Строгий техдир')"
                      value={newProfileName}
                      onChange={(e) => setNewProfileName(e.target.value)}
                      className="flex-1 text-xs px-3 py-2 bg-white rounded-xl border border-pastel-border outline-none focus:border-pastel-accentViolet"
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
                      className="px-2 py-2 text-pastel-sub hover:text-pastel-text text-xs cursor-pointer"
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
                            ? 'bg-gradient-to-br from-pastel-rose to-pastel-card border-pastel-accentViolet shadow-sm ring-1 ring-pastel-accentViolet/30'
                            : 'bg-white hover:bg-pastel-card border-pastel-border/80'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-pastel-text">{p.name}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-pastel-accentViolet/10 text-pastel-accentViolet font-semibold">
                            {p.badge}
                          </span>
                        </div>
                        <p className="text-[11px] text-pastel-sub line-clamp-2 leading-relaxed">
                          {p.description}
                        </p>
                        {!p.isPreset && (
                          <button
                            type="button"
                            onClick={(e) => handleDeleteProfile(e, p.id)}
                            className="absolute bottom-2 right-2 text-pastel-sub hover:text-red-500 transition p-1 cursor-pointer"
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

              {/* 2. Стратегия интервью */}
              <div>
                <label className="text-xs font-bold text-pastel-text uppercase tracking-wider block mb-2">
                  Стратегия интервью
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => onChangeConfig({ ...config, strategy: 'adaptive_probing' })}
                    className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                      config.strategy === 'adaptive_probing'
                        ? 'bg-gradient-to-r from-pastel-accentRose/10 to-pastel-accentViolet/10 border-pastel-accentViolet ring-1 ring-pastel-accentViolet/40'
                        : 'bg-white hover:bg-pastel-card border-pastel-border'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <ShieldCheck className="w-4 h-4 text-pastel-accentViolet" />
                      <span className="text-xs font-bold text-pastel-text">Адаптивное зондирование</span>
                    </div>
                    <p className="text-[11px] text-pastel-sub leading-snug">
                      Стандарт FAANG: объективная оценка без подсказок, проверка глубины и краевых случаев.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => onChangeConfig({ ...config, strategy: 'socratic_tutoring' })}
                    className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                      config.strategy === 'socratic_tutoring'
                        ? 'bg-gradient-to-r from-pastel-accentRose/10 to-pastel-accentViolet/10 border-pastel-accentViolet ring-1 ring-pastel-accentViolet/40'
                        : 'bg-white hover:bg-pastel-card border-pastel-border'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <GraduationCap className="w-4 h-4 text-pastel-accentRose" />
                      <span className="text-xs font-bold text-pastel-text">Сократический ментор</span>
                    </div>
                    <p className="text-[11px] text-pastel-sub leading-snug">
                      Обучающий режим: поддержка, похвала за верные мысли и мягкие наводящие аналогии.
                    </p>
                  </button>
                </div>
              </div>

              {/* 3. Выбор голоса */}
              <div>
                <label className="text-xs font-bold text-pastel-text uppercase tracking-wider block mb-2">
                  Голос ИИ-интервьюера (Google Gemini Live)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {AVAILABLE_VOICES.map((v) => {
                    const isSelected = config.voice === v.id;
                    return (
                      <div
                        key={v.id}
                        onClick={() => onChangeConfig({ ...config, voice: v.id })}
                        className={`p-3 rounded-2xl border transition-all cursor-pointer text-left ${
                          isSelected
                            ? 'bg-pastel-rose border-pastel-accentViolet shadow-sm ring-1 ring-pastel-accentViolet/30'
                            : 'bg-white hover:bg-pastel-card border-pastel-border'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-pastel-text flex items-center gap-1.5">
                            <Volume2 className="w-3.5 h-3.5 text-pastel-accentViolet" />
                            {v.name}
                          </span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white border border-pastel-border text-pastel-sub font-medium">
                            {v.gender}
                          </span>
                        </div>
                        <p className="text-[10px] text-pastel-sub leading-tight">
                          {v.style}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 4. Лимит уточняющих раундов */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-pastel-text uppercase tracking-wider">
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
                          : 'bg-white hover:bg-pastel-card text-pastel-text border-pastel-border'
                      }`}
                    >
                      {count}
                    </button>
                  ))}
                </div>
              </div>

              {/* 5. Чек-лист якорей темы (до 10 якорей) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-pastel-text uppercase tracking-wider">
                    Ключевые критерии и якоря темы ({currentAnchors.length}/10)
                  </label>
                </div>
                <div className="space-y-1.5 mb-2.5">
                  {currentAnchors.map((anchor, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 bg-pastel-card/60 rounded-xl border border-pastel-border/70 flex items-center justify-between gap-2 text-xs text-pastel-text"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-pastel-accentViolet/10 text-pastel-accentViolet font-bold text-[10px] flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <span className="leading-snug">{anchor}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveAnchor(idx)}
                        className="text-pastel-sub hover:text-red-500 transition p-1 cursor-pointer shrink-0"
                        title="Удалить якорь"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                {currentAnchors.length < 10 && (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Добавить свой критерий (например, 'Знание JIT-компиляции')"
                      value={newAnchorText}
                      onChange={(e) => setNewAnchorText(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddAnchor()}
                      className="flex-1 text-xs px-3 py-2 bg-white rounded-xl border border-pastel-border outline-none focus:border-pastel-accentViolet"
                    />
                    <button
                      type="button"
                      onClick={handleAddAnchor}
                      className="px-3 py-2 bg-pastel-card hover:bg-pastel-rose text-pastel-text border border-pastel-border rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Добавить</span>
                    </button>
                  </div>
                )}
              </div>

              {/* 6. Инспектор системного промпта */}
              <div className="border border-pastel-border rounded-2xl overflow-hidden bg-pastel-card/30">
                <button
                  type="button"
                  onClick={() => setShowPromptInspector(!showPromptInspector)}
                  className="w-full p-3 flex items-center justify-between text-xs font-semibold text-pastel-text hover:bg-pastel-card/60 transition cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Code2 className="w-4 h-4 text-pastel-accentViolet" />
                    <span>Предпросмотр системного промпта (Inspector)</span>
                  </div>
                  {showPromptInspector ? <ChevronUp className="w-4 h-4 text-pastel-sub" /> : <ChevronDown className="w-4 h-4 text-pastel-sub" />}
                </button>

                {showPromptInspector && (
                  <div className="p-3.5 bg-slate-900 text-slate-200 text-[11px] font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap border-t border-pastel-border/60">
                    {generatedPromptPreview}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-pastel-border/60 bg-gradient-to-r from-pastel-card to-white flex justify-end">
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
    </AnimatePresence>
  );
};
