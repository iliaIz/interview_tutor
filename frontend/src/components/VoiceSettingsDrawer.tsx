import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Settings2 } from 'lucide-react';
import {
  InterviewProfile,
  GeminiVoiceName
} from '../types/interviewConfig';
import {
  getCachedProfiles,
  fetchProfiles,
  saveUserProfile,
  deleteUserProfile
} from '../services/profileStorage';
import { useInterviewConfig } from '../hooks/useInterviewConfig';
import { previewGeminiVoiceAudio } from '../services/voicePreviewService';
import { VoiceProfilesSection } from './voice/settings/VoiceProfilesSection';
import { VoiceStrategySection } from './voice/settings/VoiceStrategySection';
import { VoiceDialogueModeSection } from './voice/settings/VoiceDialogueModeSection';
import { VoiceSelectionSection } from './voice/settings/VoiceSelectionSection';
import { VoiceProbesSection } from './voice/settings/VoiceProbesSection';
import { VoiceAutoAdvanceSection } from './voice/settings/VoiceAutoAdvanceSection';
import { VoiceVadPauseSection } from './voice/settings/VoiceVadPauseSection';
import { VoicePromptInspectorSection } from './voice/settings/VoicePromptInspectorSection';

interface VoiceSettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  questionText?: string;
  referenceAnswer?: string;
}

export const VoiceSettingsDrawer: React.FC<VoiceSettingsDrawerProps> = ({
  isOpen,
  onClose,
  questionText = 'Расскажите о вашем опыте в backend-разработке.',
  referenceAnswer = ''
}) => {
  const { config, setConfig: onChangeConfig } = useInterviewConfig();

  const [profiles, setProfiles] = useState<InterviewProfile[]>(getCachedProfiles());
  const [previewingVoice, setPreviewingVoice] = useState<GeminiVoiceName | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchProfiles().then((data) => setProfiles(data));
    }
  }, [isOpen]);

  const playVoicePreview = async (voice: GeminiVoiceName) => {
    if (previewingVoice) return;
    setPreviewingVoice(voice);
    await previewGeminiVoiceAudio({
      voice,
      userGender: config.userGender,
      strategy: config.strategy,
      audioRef,
      onFinish: () => setPreviewingVoice(null)
    });
  };

  const handleSelectProfile = (profile: InterviewProfile) => {
    onChangeConfig({
      ...config,
      ...profile.config,
      customPromptOverride: profile.config.customPromptOverride
    });
  };

  const handleSaveProfile = async (name: string) => {
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
[ГЛУБОКОЕ ЗОНДИРОВАНИЕ]: ${config.deepDive ? 'ВКЛЮЧЕНО (Подкапотка, Edge Cases, Radius-1)' : 'ВЫКЛЮЧЕНО (Строго по эталону)'}
[РАЗБОР И ОБУЧЕНИЕ НА ЛЕТУ]: ${config.liveCoaching ? 'ВКЛЮЧЕНО (Micro-Lecture до 40 сек + Active Recall)' : 'ВЫКЛЮЧЕНО (Экзаменация без подсказок)'}
[ПЕРЕСПРАШИВАНИЕ ПРИ ТИШИНЕ]: ${config.enableSilenceClarification ? 'ВКЛЮЧЕНО («Я тебя не расслышала...»)' : 'ВЫКЛЮЧЕНО (Спокойное ожидание)'}
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
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Content Body */}
            <div className="p-5 md:p-6 overflow-y-auto space-y-6">
              <VoiceProfilesSection
                profiles={profiles}
                config={config}
                onSelectProfile={handleSelectProfile}
                onSaveProfile={handleSaveProfile}
                onDeleteProfile={handleDeleteProfile}
              />

              <VoiceStrategySection
                config={config}
                onChangeConfig={onChangeConfig}
              />

              <VoiceDialogueModeSection
                config={config}
                onChangeConfig={onChangeConfig}
              />

              <VoiceSelectionSection
                config={config}
                onChangeConfig={onChangeConfig}
                previewingVoice={previewingVoice}
                onPlayPreview={playVoicePreview}
                isFemale={isFemale}
              />

              <VoiceProbesSection
                config={config}
                onChangeConfig={onChangeConfig}
              />

              <VoiceAutoAdvanceSection
                config={config}
                onChangeConfig={onChangeConfig}
              />

              <VoiceVadPauseSection
                config={config}
                onChangeConfig={onChangeConfig}
              />

              <VoicePromptInspectorSection
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
