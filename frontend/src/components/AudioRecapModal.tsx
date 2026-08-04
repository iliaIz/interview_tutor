import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { X, Headphones, Sparkles, Loader2, Music, Volume2, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const AudioRecapModal: React.FC = () => {
  const { isRecapModalOpen, closeRecapModal, recapTarget, setActiveAudioJob } = useAppStore();

  const [tone, setTone] = useState<string>('Fun');
  const [length, setLength] = useState<string>('Medium (3-5 min)');
  const [language, setLanguage] = useState<string>('Russian');

  const [status, setStatus] = useState<'idle' | 'queued' | 'processing' | 'completed' | 'failed'>('idle');
  const [jobId, setJobId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [progressMsg, setProgressMsg] = useState<string>('');

  useEffect(() => {
    if (!isRecapModalOpen) {
      setStatus('idle');
      setJobId(null);
      setErrorMessage(null);
    }
  }, [isRecapModalOpen]);

  // Poll status when jobId is set
  useEffect(() => {
    if (!jobId || status === 'completed' || status === 'failed') return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/podcast/status/${jobId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'QUEUED') {
            setStatus('queued');
            setProgressMsg('В очереди на генерацию скрипта...');
          } else if (data.status === 'PROCESSING') {
            setStatus('processing');
            setProgressMsg('Gemini 3 создает диалог ведущих & Edge-TTS синтезирует аудио...');
          } else if (data.status === 'COMPLETED') {
            setStatus('completed');
            setProgressMsg('Аудиопересказ готовит плеер...');
            setActiveAudioJob({
              jobId: data.job_id,
              audioUrl: `/api/podcast/audio/${data.job_id}`,
              title: recapTarget?.title || 'Аудиопересказ вопросов',
              topic: recapTarget?.topicName,
              transcript: data.transcript,
              metadata: data.metadata,
            });
            setTimeout(() => {
              closeRecapModal();
            }, 1200);
          } else if (data.status === 'FAILED') {
            setStatus('failed');
            setErrorMessage(data.error || 'Ошибка во время генерации аудиопересказа');
          }
        }
      } catch (err: any) {
        console.error('Error polling status:', err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [jobId, status, recapTarget, setActiveAudioJob, closeRecapModal]);

  if (!isRecapModalOpen || !recapTarget) return null;

  const handleStartGeneration = async () => {
    setStatus('queued');
    setErrorMessage(null);
    setProgressMsg('Отправка запроса к Open-NotebookLM & LiteLLM Proxy...');

    try {
      const res = await fetch('/api/podcast/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionIds: recapTarget.questionIds,
          topicId: recapTarget.topicId,
          topicName: recapTarget.topicName,
          tone,
          length,
          language,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Не удалось запустить генерацию');
      }

      const data = await res.json();
      setJobId(data.job_id);
    } catch (err: any) {
      console.error(err);
      setStatus('failed');
      setErrorMessage(err.message || 'Произошла ошибка при запуске генерации');
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.25 }}
          className="w-full max-w-lg bg-white/95 rounded-3xl p-6 md:p-8 shadow-2xl border border-pastel-rose/80 relative overflow-hidden"
        >
          {/* Decorative soft pastel ambient blur circles */}
          <div className="absolute -top-12 -right-12 w-36 h-36 rounded-full bg-pastel-accentRose/20 blur-2xl pointer-events-none" />
          <div className="absolute -bottom-12 -left-12 w-36 h-36 rounded-full bg-pastel-accentViolet/20 blur-2xl pointer-events-none" />

          {/* Close button */}
          <button
            onClick={closeRecapModal}
            className="absolute top-5 right-5 p-2 text-pastel-muted hover:text-pastel-text rounded-full hover:bg-pastel-rose/60 transition"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Modal Header */}
          <div className="flex items-center gap-3 mb-5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-pastel-accentRose to-pastel-accentViolet flex items-center justify-center text-white shadow-md shadow-pastel-accentRose/20">
              <Headphones className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-pastel-accentRose px-2.5 py-0.5 rounded-md bg-pastel-rose border border-pastel-accentRose/20">
                AI Podcaster • Open-NotebookLM
              </span>
              <h3 className="text-xl font-bold text-pastel-text mt-0.5">
                Генерация аудиопересказа
              </h3>
            </div>
          </div>

          <p className="text-xs text-pastel-muted mb-6">
            Составление диалогового подкаста с двумя ведущими (Светлана и Дмитрий) по выбранным материалам ({recapTarget.title}).
          </p>

          {status === 'idle' && (
            <div className="space-y-5">
              {/* Tone Selection */}
              <div>
                <label className="block text-xs font-semibold text-pastel-text mb-2">Тональность диалога</label>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { id: 'Fun', label: '😊 Живой & Легкий' },
                    { id: 'Informative', label: '💡 Понятный' },
                    { id: 'Formal', label: '💼 Академичный' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setTone(t.id)}
                      className={`px-3 py-2.5 rounded-xl text-xs font-semibold border transition ${
                        tone === t.id
                          ? 'bg-pastel-rose text-pastel-accentRose border-pastel-accentRose/40 shadow-sm'
                          : 'bg-pastel-bg text-pastel-muted border-pastel-border hover:border-pastel-accentRose/20'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Duration Selection */}
              <div>
                <label className="block text-xs font-semibold text-pastel-text mb-2">Длительность</label>
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { id: 'Short (1-2 min)', label: '⚡ Короткий (1-2 мин)' },
                    { id: 'Medium (3-5 min)', label: '☕ Подробный (3-5 мин)' },
                  ].map((l) => (
                    <button
                      key={l.id}
                      onClick={() => setLength(l.id)}
                      className={`px-3 py-2.5 rounded-xl text-xs font-semibold border transition ${
                        length === l.id
                          ? 'bg-pastel-lavender text-pastel-accentViolet border-pastel-accentViolet/40 shadow-sm'
                          : 'bg-pastel-bg text-pastel-muted border-pastel-border hover:border-pastel-accentViolet/20'
                      }`}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Language Selection */}
              <div>
                <label className="block text-xs font-semibold text-pastel-text mb-2">Язык озвучки</label>
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { id: 'Russian', label: '🇷🇺 Русский' },
                    { id: 'English', label: '🇬🇧 English' },
                  ].map((lang) => (
                    <button
                      key={lang.id}
                      onClick={() => setLanguage(lang.id)}
                      className={`px-3 py-2.5 rounded-xl text-xs font-semibold border transition ${
                        language === lang.id
                          ? 'bg-pastel-sage text-pastel-accentTeal border-pastel-accentTeal/40 shadow-sm'
                          : 'bg-pastel-bg text-pastel-muted border-pastel-border hover:border-pastel-accentTeal/20'
                      }`}
                    >
                      {lang.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Submit Button */}
              <button
                onClick={handleStartGeneration}
                className="w-full mt-2 py-3.5 px-4 bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet hover:opacity-95 text-white font-bold text-sm rounded-2xl shadow-lg shadow-pastel-accentRose/25 flex items-center justify-center gap-2 transition transform active:scale-[0.98]"
              >
                <Sparkles className="w-4 h-4" /> Создать аудиопересказ
              </button>
            </div>
          )}

          {(status === 'queued' || status === 'processing' || status === 'completed') && (
            <div className="py-8 text-center flex flex-col items-center justify-center">
              {status !== 'completed' ? (
                <div className="relative w-16 h-16 mb-4">
                  <div className="absolute inset-0 rounded-full border-4 border-pastel-rose border-t-pastel-accentRose animate-spin" />
                  <div className="absolute inset-2 rounded-full border-4 border-pastel-lavender border-b-pastel-accentViolet animate-spin" style={{ animationDirection: 'reverse' }} />
                  <Music className="w-6 h-6 text-pastel-accentRose absolute inset-0 m-auto animate-pulse" />
                </div>
              ) : (
                <CheckCircle2 className="w-16 h-16 text-emerald-500 mb-4 animate-bounce" />
              )}

              <h4 className="text-base font-bold text-pastel-text mb-1">
                {status === 'completed' ? 'Пересказ готов!' : 'Генерация подкаста...'}
              </h4>
              <p className="text-xs text-pastel-muted max-w-xs">{progressMsg}</p>
            </div>
          )}

          {status === 'failed' && (
            <div className="py-6 text-center">
              <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
              <h4 className="text-base font-bold text-pastel-text mb-1">Ошибка генерации</h4>
              <p className="text-xs text-rose-600 mb-6 bg-rose-50 p-3 rounded-xl border border-rose-200">
                {errorMessage}
              </p>
              <button
                onClick={() => setStatus('idle')}
                className="px-6 py-2.5 bg-pastel-card border border-pastel-border hover:bg-pastel-bg text-pastel-text font-semibold text-xs rounded-xl transition"
              >
                Попробовать снова
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
