import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';
import { X, Headphones, Sparkles, Loader2, Music, CheckCircle2, AlertCircle, ChevronDown, ChevronUp, User, Users, Settings2, Sliders, Volume2, VolumeX } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const RUSSIAN_VOICES = [
  { id: 'ru-RU-SvetlanaNeural', name: 'Светлана', gender: 'Женский', desc: 'Уверенный, чёткий' },
  { id: 'ru-RU-DmitryNeural', name: 'Дмитрий', gender: 'Мужской', desc: 'Глубокий, спокойный' },
  { id: 'ru-RU-ElenaNeural', name: 'Елена', gender: 'Женский', desc: 'Мягкий, повествовательный' },
  { id: 'ru-RU-DariyaNeural', name: 'Дарья', gender: 'Женский', desc: 'Энергичный, живой' },
];

const VOICE_SAMPLES: Record<string, string> = {
  'ru-RU-SvetlanaNeural': 'Привет! Я Светлана. Помогу вам легко подготовиться к техническому собеседованию.',
  'ru-RU-DmitryNeural': 'Здравствуйте! Я Дмитрий. Давайте детально изучим ключевые концепции и архитектуру.',
  'ru-RU-ElenaNeural': 'Приветствую! Я Елена. Разберу ответы и подводные камни, которые спрашивают интервьюеры.',
  'ru-RU-DariyaNeural': 'Всем привет! Я Дарья. Разберем практические задачи backend-разработки ярко и понятно.',
};

const DEFAULT_SYSTEM_PROMPT = `Ты — ведущий эксперт по IT-собеседованиям. Твоя задача — создавать качественные аудиопересказы вопросов и ответов на русском языке. Объясняй материал глубоко и доступно, используй жизненные аналогии из реальной backend-разработки, подсвечивай ключевые слова и подводные камни.`;

const DEFAULT_USER_PROMPT = `Сделай акцент на практическом применении в коммерческой разработке. Объясни, что именно кандидат должен ответить интервьюеру, чтобы показать высокий уровень знаний.`;

const DUO_TONE_PROMPTS: Record<string, string> = {
  Fun: 'Создай динамичный диалог двух IT-ведущих. Пусть они общаются непринужденно, с юмором, подшучивают над сложными багами, задают друг другу уточняющие вопросы и приводят смешные аналогии.',
  Informative: 'Создай познавательный диалог в формате "Ведущий + Эксперт". Ведущий задает практические вопросы от лица кандидата, а эксперт понятно и структурированно разжевывает суть с точки зрения собеседования.',
  Formal: 'Создай академическую дискуссию двух технических экспертов. Пусть они строго и аргументированно обсуждают формулировки, спецификации стандартов, архитектуру и потенциальные подводные камни.',
};

const SOLO_TONE_PROMPTS: Record<string, string> = {
  Fun: 'Проведи легкий и увлекательный монолог. Объясняй материал живо, с естественными интонациями, используй понятные жизненные метафоры из реального опыта backend-разработки.',
  Informative: 'Проведи понятный разбор от лица опытного IT-ментора. Объясни, что именно кандидат обязан ответить на собеседовании, выделяя ключевые концепции и формулировки.',
  Formal: 'Проведи академический доклад. Сфокусируйся на точных определениях, спецификациях стандартов и терминологии, излагай материал строго, глубоко и без лишней эмоциональности.',
};

export const AudioRecapModal: React.FC = () => {
  const { isRecapModalOpen, closeRecapModal, recapTarget, setActiveAudioJob } = useAppStore();

  const [mode, setMode] = useState<'duo' | 'solo'>('duo');
  const [voice1, setVoice1] = useState<string>('ru-RU-SvetlanaNeural');
  const [voice2, setVoice2] = useState<string>('ru-RU-DmitryNeural');
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);
  const sampleAudioRef = useRef<HTMLAudioElement | null>(null);

  const [tone, setTone] = useState<string>('Fun');
  const [length, setLength] = useState<string>('Medium (10-15 min)');
  
  const [systemPrompt, setSystemPrompt] = useState<string>(DEFAULT_SYSTEM_PROMPT);
  const [userPrompt, setUserPrompt] = useState<string>(DUO_TONE_PROMPTS['Fun']);
  const [showAdvancedPrompts, setShowAdvancedPrompts] = useState<boolean>(false);

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

  const stopPreview = () => {
    if (sampleAudioRef.current) {
      sampleAudioRef.current.pause();
      sampleAudioRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setPreviewingVoice(null);
  };

  const handlePreviewVoice = (voiceId: string) => {
    if (previewingVoice === voiceId) {
      stopPreview();
      return;
    }

    stopPreview();
    setPreviewingVoice(voiceId);

    const sampleText = VOICE_SAMPLES[voiceId] || 'Привет! Это пример звучания выбранного голоса.';

    // 1. Try HTML5 Audio MP3 stream from backend
    const audioUrl = `/api/podcast/sample-audio?voice=${encodeURIComponent(voiceId)}`;
    const audio = new Audio(audioUrl);
    sampleAudioRef.current = audio;

    let playedAudio = false;

    audio.onended = () => setPreviewingVoice(null);
    audio.onerror = () => {
      if (!playedAudio) playWebSpeech();
    };

    audio.play().then(() => {
      playedAudio = true;
    }).catch(() => {
      playWebSpeech();
    });

    function playWebSpeech() {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        setPreviewingVoice(null);
        return;
      }

      try {
        window.speechSynthesis.cancel();
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }

        const utterance = new SpeechSynthesisUtterance(sampleText);
        utterance.lang = 'ru-RU';

        if (voiceId === 'ru-RU-DmitryNeural') {
          utterance.pitch = 0.6;
          utterance.rate = 0.9;
        } else if (voiceId === 'ru-RU-SvetlanaNeural') {
          utterance.pitch = 1.2;
          utterance.rate = 1.0;
        } else if (voiceId === 'ru-RU-ElenaNeural') {
          utterance.pitch = 0.9;
          utterance.rate = 0.95;
        } else if (voiceId === 'ru-RU-DariyaNeural') {
          utterance.pitch = 1.4;
          utterance.rate = 1.1;
        }

        utterance.onend = () => setPreviewingVoice(null);
        utterance.onerror = () => setPreviewingVoice(null);

        window.speechSynthesis.speak(utterance);
      } catch (e) {
        console.error('SpeechSynthesis error:', e);
        setPreviewingVoice(null);
      }
    }
  };

  const [status, setStatus] = useState<'idle' | 'queued' | 'processing' | 'completed' | 'failed'>('idle');
  const [jobId, setJobId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [progressMsg, setProgressMsg] = useState<string>('');

  useEffect(() => {
    if (!isRecapModalOpen) {
      stopPreview();
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
            setProgressMsg('В очереди на генерацию сценария...');
          } else if (data.status === 'PROCESSING') {
            setStatus('processing');
            setProgressMsg('Gemini 3 создает глубокий сценарий & Edge-TTS озвучивает...');
          } else if (data.status === 'COMPLETED') {
            setStatus('completed');
            setProgressMsg('Аудиопересказ готов!');
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
          language: 'Russian',
          mode,
          voice1,
          voice2: mode === 'duo' ? voice2 : undefined,
          systemPrompt,
          userPrompt,
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
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-4 bg-slate-900/50 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.25 }}
          className="w-full max-w-3xl bg-white/95 rounded-3xl p-5 md:p-8 shadow-2xl border border-pastel-rose/80 relative overflow-hidden my-auto max-h-[92vh] flex flex-col"
        >
          {/* Decorative ambient blurs */}
          <div className="absolute -top-12 -right-12 w-36 h-36 rounded-full bg-pastel-accentRose/20 blur-2xl pointer-events-none" />
          <div className="absolute -bottom-12 -left-12 w-36 h-36 rounded-full bg-pastel-accentViolet/20 blur-2xl pointer-events-none" />

          {/* Close button */}
          <button
            onClick={closeRecapModal}
            className="absolute top-4 right-4 p-2 text-pastel-muted hover:text-pastel-text rounded-full hover:bg-pastel-rose/60 transition z-10"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header */}
          <div className="flex items-center gap-3 mb-4 shrink-0">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-pastel-accentRose to-pastel-accentViolet flex items-center justify-center text-white shadow-md shadow-pastel-accentRose/20">
              <Headphones className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-pastel-accentRose px-2 py-0.5 rounded-md bg-pastel-rose border border-pastel-accentRose/20">
                AI Audio Studio • Русская озвучка
              </span>
              <h3 className="text-lg font-bold text-pastel-text mt-0.5">
                Настройки аудиопересказа
              </h3>
            </div>
          </div>

          <div className="bg-pastel-bg/80 p-2.5 rounded-xl border border-pastel-border/60 text-xs text-pastel-muted mb-4 shrink-0">
            <span className="font-semibold text-pastel-text">Материал:</span> {recapTarget.title}
          </div>

          {status === 'idle' && (
            <div className="space-y-4 overflow-y-auto pr-1 flex-1">
              
              {/* 1. Format Mode: Solo vs Duo */}
              <div>
                <label className="block text-xs font-semibold text-pastel-text mb-1.5 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-pastel-accentRose" /> Формат озвучки
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleModeChange('duo')}
                    className={`p-3 rounded-2xl text-xs font-semibold border flex items-center gap-2.5 transition ${
                      mode === 'duo'
                        ? 'bg-pastel-rose/80 text-pastel-accentRose border-pastel-accentRose/40 shadow-sm'
                        : 'bg-pastel-card text-pastel-muted border-pastel-border hover:border-pastel-accentRose/20'
                    }`}
                  >
                    <div className="p-1.5 rounded-lg bg-pastel-accentRose/10">
                      <Users className="w-4 h-4 text-pastel-accentRose" />
                    </div>
                    <div className="text-left">
                      <div className="font-bold">Дуэт (Подкаст)</div>
                      <div className="text-[10px] opacity-80">2 ведущих в диалоге</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleModeChange('solo')}
                    className={`p-3 rounded-2xl text-xs font-semibold border flex items-center gap-2.5 transition ${
                      mode === 'solo'
                        ? 'bg-pastel-lavender/80 text-pastel-accentViolet border-pastel-accentViolet/40 shadow-sm'
                        : 'bg-pastel-card text-pastel-muted border-pastel-border hover:border-pastel-accentViolet/20'
                    }`}
                  >
                    <div className="p-1.5 rounded-lg bg-pastel-accentViolet/10">
                      <User className="w-4 h-4 text-pastel-accentViolet" />
                    </div>
                    <div className="text-left">
                      <div className="font-bold">Соло (Монолог)</div>
                      <div className="text-[10px] opacity-80">1 диктор / лектор</div>
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
                    <div className="flex items-center gap-2">
                      <select
                        value={voice1}
                        onChange={(e) => setVoice1(e.target.value)}
                        className="flex-1 bg-white text-pastel-text text-xs rounded-xl p-2.5 border border-pastel-border focus:border-pastel-accentRose outline-none"
                      >
                        {RUSSIAN_VOICES.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.name} ({v.gender}) — {v.desc}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => handlePreviewVoice(voice1)}
                        className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-1 transition ${
                          previewingVoice === voice1
                            ? 'bg-pastel-accentRose text-white border-pastel-accentRose'
                            : 'bg-white text-pastel-accentRose border-pastel-accentRose/30 hover:bg-pastel-rose'
                        }`}
                        title="Прослушать пример голоса"
                      >
                        {previewingVoice === voice1 ? <VolumeX className="w-4 h-4 animate-pulse" /> : <Volume2 className="w-4 h-4" />}
                        <span className="hidden sm:inline">Тест</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-pastel-text mb-1 flex items-center justify-between">
                        <span>Голос 1 (Ведущий)</span>
                      </label>
                      <div className="flex items-center gap-1.5">
                        <select
                          value={voice1}
                          onChange={(e) => setVoice1(e.target.value)}
                          className="flex-1 bg-white text-pastel-text text-xs rounded-xl p-2.5 border border-pastel-border focus:border-pastel-accentRose outline-none"
                        >
                          {RUSSIAN_VOICES.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.name} ({v.gender}) — {v.desc}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => handlePreviewVoice(voice1)}
                          className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-1 transition ${
                            previewingVoice === voice1
                              ? 'bg-pastel-accentRose text-white border-pastel-accentRose'
                              : 'bg-white text-pastel-accentRose border-pastel-accentRose/30 hover:bg-pastel-rose'
                          }`}
                          title="Прослушать голос 1"
                        >
                          {previewingVoice === voice1 ? <VolumeX className="w-4 h-4 animate-pulse" /> : <Volume2 className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-pastel-text mb-1 flex items-center justify-between">
                        <span>Голос 2 (Соведущий)</span>
                      </label>
                      <div className="flex items-center gap-1.5">
                        <select
                          value={voice2}
                          onChange={(e) => setVoice2(e.target.value)}
                          className="flex-1 bg-white text-pastel-text text-xs rounded-xl p-2.5 border border-pastel-border focus:border-pastel-accentViolet outline-none"
                        >
                          {RUSSIAN_VOICES.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.name} ({v.gender}) — {v.desc}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => handlePreviewVoice(voice2)}
                          className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-1 transition ${
                            previewingVoice === voice2
                              ? 'bg-pastel-accentViolet text-white border-pastel-accentViolet'
                              : 'bg-white text-pastel-accentViolet border-pastel-accentViolet/30 hover:bg-pastel-lavender'
                          }`}
                          title="Прослушать голос 2"
                        >
                          {previewingVoice === voice2 ? <VolumeX className="w-4 h-4 animate-pulse" /> : <Volume2 className="w-4 h-4" />}
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
                      className={`p-2.5 rounded-xl text-xs font-semibold border text-center transition ${
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

              {/* 4. Tone Selector */}
              <div>
                <label className="block text-xs font-semibold text-pastel-text mb-1.5">Стиль подачи</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'Fun', label: '😊 Живой' },
                    { id: 'Informative', label: '💡 Понятный' },
                    { id: 'Formal', label: '💼 Строгий' },
                  ].map((t) => (
                    <button
                      type="button"
                      key={t.id}
                      onClick={() => handleToneChange(t.id)}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold border text-center transition ${
                        tone === t.id
                          ? 'bg-pastel-sage text-pastel-accentTeal border-pastel-accentTeal/40 shadow-sm'
                          : 'bg-pastel-card text-pastel-muted border-pastel-border hover:border-pastel-accentTeal/20'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 5. Custom Prompts Accordion */}
              <div className="border border-pastel-border/70 rounded-2xl overflow-hidden bg-pastel-card/40">
                <button
                  type="button"
                  onClick={() => setShowAdvancedPrompts(!showAdvancedPrompts)}
                  className="w-full p-3 text-left text-xs font-bold text-pastel-text flex items-center justify-between hover:bg-pastel-rose/30 transition"
                >
                  <span className="flex items-center gap-1.5">
                    <Settings2 className="w-3.5 h-3.5 text-pastel-accentRose" /> Настройка промпта для ИИ (System & User)
                  </span>
                  {showAdvancedPrompts ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {showAdvancedPrompts && (
                  <div className="p-3 space-y-3 border-t border-pastel-border/60 bg-white">
                    <div>
                      <label className="block text-[11px] font-semibold text-pastel-muted mb-1">
                        Системный промпт (System Role)
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
                      className="text-[10px] text-pastel-accentRose hover:underline"
                    >
                      Сбросить промпты к дефолтным
                    </button>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="button"
                onClick={handleStartGeneration}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet hover:opacity-95 text-white font-bold text-sm rounded-2xl shadow-lg shadow-pastel-accentRose/25 flex items-center justify-center gap-2 transition transform active:scale-[0.98] mt-2"
              >
                <Sparkles className="w-4 h-4" /> Запустить генерацию аудио
              </button>
            </div>
          )}

          {(status === 'queued' || status === 'processing' || status === 'completed') && (
            <div className="py-10 text-center flex flex-col items-center justify-center">
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
                type="button"
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
