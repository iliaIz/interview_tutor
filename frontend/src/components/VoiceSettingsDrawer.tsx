import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Settings2 } from 'lucide-react';
import { InterviewConfig, InterviewProfile, GeminiVoiceName } from '../types/interviewConfig';
import { getCachedProfiles, fetchProfiles, saveUserProfile, deleteUserProfile } from '../services/profileStorage';
import { useInterviewConfig } from '../hooks/useInterviewConfig';
import { VoiceProfileList } from './voice/VoiceProfileList';
import { VoiceAudioTester } from './voice/VoiceAudioTester';
import { VoiceBehaviorModifiers } from './voice/VoiceBehaviorModifiers';
import { VoicePromptInspector } from './voice/VoicePromptInspector';

interface VoiceSettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  config?: InterviewConfig;
  onChangeConfig?: (newConfig: InterviewConfig) => void;
  questionText?: string;
  referenceAnswer?: string;
}

export const VoiceSettingsDrawer: React.FC<VoiceSettingsDrawerProps> = ({
  isOpen,
  onClose,
  config: propConfig,
  onChangeConfig: propOnChangeConfig,
  questionText = 'Расскажите о вашем опыте в backend-разработке.',
  referenceAnswer = ''
}) => {
  const hookConfig = useInterviewConfig();
  const config = propConfig || hookConfig.config;
  const onChangeConfig = propOnChangeConfig || hookConfig.setConfig;

  const [profiles, setProfiles] = useState<InterviewProfile[]>(getCachedProfiles());

  useEffect(() => {
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

  const handleSaveCurrentAsProfile = async (name: string) => {
    await saveUserProfile(name, 'Пользовательский профиль', config);
    const updated = await fetchProfiles();
    setProfiles(updated);
  };

  const handleDeleteProfile = async (e: React.MouseEvent, profileId: string) => {
    e.stopPropagation();
    await deleteUserProfile(profileId);
    const updated = await fetchProfiles();
    setProfiles(updated);
  };

  const handleChangeVoice = (voice: GeminiVoiceName) => {
    onChangeConfig({ ...config, voice });
  };

  const isFemale = ['Kore', 'Aoede'].includes(config.voice);
  const genderLabel = isFemale
    ? 'Женский род («готова», «слушала», «рада»)'
    : 'Мужской род («готов», «слушал», «рад»)';

  const generatedPromptPreview = `[РОЛЬ]: ${
    config.strategy === 'socratic_tutoring' ? 'Поддерживающий ментор' : 'Senior/Lead технический интервьюер'
  } (${isFemale ? 'женщина' : 'мужчина'})
[ГРАММАТИЧЕСКИЙ РОД]: ${genderLabel}
[ВОПРОС]: "${questionText}"
[ГОЛОС]: ${config.voice}
[ЛИМИТ РАУНДОВ]: ${config.maxProbes}
[ГЛУБОКОЕ ЗОНДИРОВАНИЕ]: ${
    config.deepDive ? 'ВКЛЮЧЕНО (Подкапотка, Edge Cases, Radius-1)' : 'ВЫКЛЮЧЕНО (Строго по эталону)'
  }
[РАЗБОР И ОБУЧЕНИЕ НА ЛЕТУ]: ${
    config.liveCoaching ? 'ВКЛЮЧЕНО (Micro-Lecture до 40 сек + Active Recall)' : 'ВЫКЛЮЧЕНО (Экзаменация без подсказок)'
  }
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
            {/* Header */}
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

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-5 md:p-6 space-y-6 bg-[#faf9fa] text-slate-800">
              <VoiceProfileList
                profiles={profiles}
                config={config}
                onSelectProfile={handleSelectProfile}
                onSaveNewProfile={handleSaveCurrentAsProfile}
                onDeleteProfile={handleDeleteProfile}
              />

              <VoiceBehaviorModifiers
                config={config}
                onChangeConfig={onChangeConfig}
              />

              <VoiceAudioTester
                config={config}
                onChangeVoice={handleChangeVoice}
              />

              <VoicePromptInspector
                promptPreview={generatedPromptPreview}
              />
            </div>

            {/* Footer */}
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
