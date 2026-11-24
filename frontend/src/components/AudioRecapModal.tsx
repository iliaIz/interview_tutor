import React, { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { X, Headphones, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { useInterviewConfig } from '../hooks/useInterviewConfig';
import { VOICE_DEFAULTS } from '../config/voiceDefaults';
import {
  DEFAULT_SYSTEM_PROMPT,
  DUO_TONE_PROMPTS,
  SOLO_TONE_PROMPTS,
} from './audio/audioRecapConfig';
import { usePodcastGeneration } from './audio/usePodcastGeneration';
import { RecapSettingsForm } from './audio/RecapSettingsForm';
import { RecapProgressTelemetry } from './audio/RecapProgressTelemetry';

export const AudioRecapModal: React.FC = () => {
  const { isRecapModalOpen, closeRecapModal, recapTarget, systemHealth } = useAppStore();
  const { config: interviewConfig } = useInterviewConfig();

  useBodyScrollLock(isRecapModalOpen);

  const defaultVoice1 = interviewConfig.voice || VOICE_DEFAULTS.voice;
  const defaultVoice2 = defaultVoice1 === VOICE_DEFAULTS.secondaryVoice
    ? VOICE_DEFAULTS.voice
    : VOICE_DEFAULTS.secondaryVoice;

  const [mode, setMode] = useState<'duo' | 'solo'>('duo');
  const [voice1, setVoice1] = useState<string>(defaultVoice1);
  const [voice2, setVoice2] = useState<string>(defaultVoice2);
  const [tone, setTone] = useState<string>('Fun');
  const [length, setLength] = useState<string>('Medium (10-15 min)');
  const [systemPrompt, setSystemPrompt] = useState<string>(DEFAULT_SYSTEM_PROMPT);
  const [userPrompt, setUserPrompt] = useState<string>(DUO_TONE_PROMPTS['Fun']);

  const handleToneChange = (newTone: string, targetMode: 'duo' | 'solo' = mode) => {
    setTone(newTone);
    const map = targetMode === 'duo' ? DUO_TONE_PROMPTS : SOLO_TONE_PROMPTS;
    if (map[newTone]) {
      setUserPrompt(map[newTone]);
    }
  };

  const handleModeChange = (newMode: 'duo' | 'solo') => {
    setMode(newMode);
    handleToneChange(tone, newMode);
  };

  const {
    status,
    setStatus,
    jobId,
    errorMessage,
    progressMsg,
    progressData,
    completedJobData,
    previewingVoice,
    handlePreviewVoice,
    handleStartGeneration,
  } = usePodcastGeneration({
    isOpen: isRecapModalOpen,
    recapTarget,
    mode,
    voice1,
    voice2,
    tone,
    length,
    systemPrompt,
    userPrompt,
  });

  if (!isRecapModalOpen || !recapTarget) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-4 bg-slate-900/50 backdrop-blur-md overflow-y-auto modal-overscroll-contain">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.25 }}
          className="w-full max-w-3xl bg-white/95 rounded-3xl p-5 md:p-8 shadow-2xl border border-pastel-rose/80 relative overflow-hidden my-auto max-h-[92dvh] flex flex-col modal-overscroll-contain"
        >
          {/* Ambient blurs */}
          <div className="absolute -top-12 -right-12 w-36 h-36 rounded-full bg-pastel-accentRose/20 blur-2xl pointer-events-none" />
          <div className="absolute -bottom-12 -left-12 w-36 h-36 rounded-full bg-pastel-accentViolet/20 blur-2xl pointer-events-none" />

          {/* Modal Header */}
          <div className="flex items-center justify-between mb-3 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-pastel-accentRose to-pastel-accentViolet flex items-center justify-center text-white shadow-sm">
                <Headphones className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base md:text-lg font-bold text-pastel-text">
                  {status === 'idle' ? 'Настройки аудиопересказа' : 'Генерация аудиопересказа'}
                </h3>
                <p className="text-[11px] text-pastel-muted">
                  Gemini TTS Studio • Opus VoIP 48 kbps • SSE Поток
                </p>
              </div>
            </div>

            <button
              onClick={closeRecapModal}
              className="w-8 h-8 rounded-full bg-pastel-bg text-pastel-muted hover:text-pastel-text flex items-center justify-center hover:bg-pastel-rose/30 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="bg-pastel-bg/80 p-2.5 rounded-xl border border-pastel-border/60 text-xs text-pastel-muted mb-3 shrink-0">
            <span className="font-semibold text-pastel-text">Материал:</span> {recapTarget.title}
          </div>

          {/* View 1: Settings */}
          {status === 'idle' && (
            <RecapSettingsForm
              mode={mode}
              onModeChange={handleModeChange}
              voice1={voice1}
              setVoice1={setVoice1}
              voice2={voice2}
              setVoice2={setVoice2}
              previewingVoice={previewingVoice}
              onPreviewVoice={handlePreviewVoice}
              isAiReady={systemHealth.isAiReady}
              length={length}
              setLength={setLength}
              tone={tone}
              onToneChange={handleToneChange}
              systemPrompt={systemPrompt}
              setSystemPrompt={setSystemPrompt}
              userPrompt={userPrompt}
              setUserPrompt={setUserPrompt}
              onSubmit={handleStartGeneration}
            />
          )}

          {/* View 2: Progress & Telemetry */}
          {(status === 'queued' || status === 'processing' || status === 'completed') && (
            <RecapProgressTelemetry
              status={status}
              progressMsg={progressMsg}
              progressData={progressData}
              completedJobData={completedJobData}
              jobId={jobId}
              recapTarget={recapTarget}
              mode={mode}
              voice1={voice1}
              voice2={voice2}
              onClose={closeRecapModal}
            />
          )}

          {/* View 3: Error State */}
          {status === 'failed' && (
            <div className="py-6 text-center">
              <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
              <h4 className="text-base font-bold text-pastel-text mb-1">Ошибка генерации</h4>
              <p className="text-xs text-rose-600 mb-6 bg-rose-50 p-3 rounded-xl border border-rose-200">
                {errorMessage}
              </p>
              <button
                type="button"
                onClick={() => setStatus('idle')}
                className="px-5 py-2.5 bg-pastel-bg border border-pastel-border text-pastel-text font-bold text-xs rounded-xl hover:bg-pastel-card transition cursor-pointer"
              >
                Вернуться к настройкам
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
