import React, { useState, useEffect, useRef } from 'react';
import { 
  Headphones, Mic, Volume2, Sparkles, Sliders, ChevronDown, 
  Check, Zap, Hand, User, Shield, Info, Play, Loader2
} from 'lucide-react';
import { 
  getActiveConfig, saveActiveConfig 
} from '../../services/profileStorage';
import { 
  AVAILABLE_VOICES, GeminiVoiceName, TurnMode, UserGender 
} from '../../types/interviewConfig';
import { TargetGrade } from '../../types/personas';

export const GlobalAudioControlPill: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState(getActiveConfig());
  const [previewingVoice, setPreviewingVoice] = useState<GeminiVoiceName | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Synchronize state across tabs or when saved elsewhere
  useEffect(() => {
    const handleUpdate = () => {
      setConfig(getActiveConfig());
    };
    window.addEventListener('interview_config_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('interview_config_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  // Close on outside click or Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const updateConfig = (patch: Partial<typeof config>) => {
    const next = { ...config, ...patch };
    setConfig(next);
    saveActiveConfig(next);
  };

  const playVoicePreview = async (voice: GeminiVoiceName) => {
    if (previewingVoice) return;
    setPreviewingVoice(voice);

    try {
      const res = await fetch('/api/interview/greeting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: 'Знакомство',
          questionText: 'Привет! Я твой голосовой наставник по Java и Spring.',
          voice: voice,
          strategy: 'socratic_tutoring'
        })
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.audioBase64) {
        if (!audioRef.current) {
          audioRef.current = new Audio();
        }
        audioRef.current.src = `data:audio/wav;base64,${data.audioBase64}`;
        audioRef.current.onended = () => setPreviewingVoice(null);
        audioRef.current.onerror = () => setPreviewingVoice(null);
        await audioRef.current.play();
      } else {
        setPreviewingVoice(null);
      }
    } catch (err) {
      console.warn('Voice preview failed:', err);
      setPreviewingVoice(null);
    }
  };

  const turnMode = config.turnMode || 'manual';
  const voice = config.voice || 'Kore';
  const targetGrade = config.targetGrade || 'L5_SENIOR';
  const alwaysShowPreflight = config.alwaysShowPreflight === true;

  const getGradeShort = (g: TargetGrade) => {
    if (g === 'L4_MIDDLE') return 'L4 Middle';
    if (g === 'L6_STAFF') return 'L6 Staff';
    return 'L5 Senior';
  };

  return (
    <div className="relative shrink-0" ref={popoverRef}>
      {/* 1. Ambient Top Bar Pill */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        title="Настройки голосового тракта (Голос, Режим реплик, Быстрый старт)"
        className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-200 cursor-pointer shadow-2xs active:scale-95 touch-manipulation select-none ${
          isOpen
            ? 'bg-pastel-accentRose/15 text-pastel-accentRoseText border-pastel-accentRose/40 shadow-xs'
            : 'bg-pastel-card hover:bg-pastel-rose/50 text-pastel-text border-pastel-border hover:border-pastel-accentRose/30'
        }`}
      >
        <span className="flex items-center gap-1">
          <span className={`w-2 h-2 rounded-full ${turnMode === 'auto' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
          <Headphones className="w-3.5 h-3.5 text-pastel-accentRose" />
        </span>

        <span className="hidden sm:inline font-bold text-[11px] text-pastel-text">
          {voice}
        </span>

        <span className="hidden md:inline text-[10px] text-pastel-muted font-normal">
          ·
        </span>

        <span className="hidden md:inline text-[10px] font-medium text-pastel-muted">
          {turnMode === 'auto' ? '⚡ Авто' : '✋ По очереди'}
        </span>

        <span className="hidden xl:inline text-[10px] text-pastel-muted font-normal">
          ·
        </span>

        <span className="hidden xl:inline text-[10px] font-bold text-pastel-accentViolet">
          {getGradeShort(targetGrade)}
        </span>

        <ChevronDown className={`w-3 h-3 text-pastel-muted transition-transform duration-200 ${isOpen ? 'rotate-180 text-pastel-accentRose' : ''}`} />
      </button>

      {/* 2. Interactive Popover Drawer */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 max-w-[calc(100vw-1.5rem)] bg-white/95 backdrop-blur-xl border border-pastel-border/90 rounded-3xl p-4 sm:p-5 shadow-2xl z-50 font-sans space-y-4 animate-in fade-in zoom-in-95 duration-150 text-slate-800">
          
          {/* Header */}
          <div className="flex items-center justify-between border-b border-pastel-border/60 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-pastel-accentRose/20 text-pastel-accentRose flex items-center justify-center">
                <Sliders className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-800">Голосовой тракт и интервью</h4>
                <p className="text-[10px] text-slate-500">Глобальные параметры для всех разделов</p>
              </div>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-pastel-bg text-pastel-muted border border-pastel-border">
              SOTA 2026
            </span>
          </div>

          {/* Turn Mode: Auto vs Manual */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
              <span>Режим общения</span>
              <span className="text-[10px] font-normal text-slate-500">
                {turnMode === 'auto' ? 'Живой диалог (VAD)' : 'Push-to-Talk'}
              </span>
            </label>
            <div className="grid grid-cols-2 gap-1.5 bg-pastel-bg/80 p-1 rounded-2xl border border-pastel-border">
              <button
                type="button"
                onClick={() => updateConfig({ turnMode: 'auto' })}
                className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  turnMode === 'auto'
                    ? 'bg-white text-emerald-700 shadow-xs border border-emerald-200'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <Zap className="w-3.5 h-3.5 text-emerald-500" />
                <span>⚡ Авто-VAD</span>
              </button>

              <button
                type="button"
                onClick={() => updateConfig({ turnMode: 'manual' })}
                className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  turnMode === 'manual'
                    ? 'bg-white text-amber-800 shadow-xs border border-amber-200'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <Hand className="w-3.5 h-3.5 text-amber-600" />
                <span>✋ По очереди</span>
              </button>
            </div>
            <p className="text-[10px] text-slate-500 leading-tight">
              {turnMode === 'auto' 
                ? 'ИИ слушает паузы в речи и отвечает мгновенно без нажатий кнопок.' 
                : 'Вы сами нажимаете «Закончить ответ» — идеально для шумных мест.'}
            </p>

            {turnMode === 'auto' && (
              <div className="pt-1.5 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Движок Live</span>
                  <span className="text-[9px] text-slate-400 font-medium">Auto-VAD</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5 bg-pastel-bg/80 p-1 rounded-xl border border-pastel-border">
                  <button
                    type="button"
                    onClick={() => updateConfig({ liveModel: 'gemini-live-v3' })}
                    className={`flex items-center justify-center gap-1 py-1.5 px-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                      (config.liveModel || 'gemini-live-v3') === 'gemini-live-v3'
                        ? 'bg-white text-purple-900 shadow-xs border border-purple-300 ring-1 ring-purple-300/40'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                    }`}
                  >
                    <span>🟣 Live v3</span>
                    <span className="text-[8px] bg-purple-100 text-purple-700 px-1 py-0.2 rounded font-semibold">Def</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => updateConfig({ liveModel: 'gemini-live-v2' })}
                    className={`flex items-center justify-center gap-1 py-1.5 px-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                      (config.liveModel || 'gemini-live-v3') === 'gemini-live-v2'
                        ? 'bg-white text-emerald-900 shadow-xs border border-emerald-300 ring-1 ring-emerald-300/40'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                    }`}
                  >
                    <span>🟢 Live v2</span>
                    <span className="text-[8px] bg-emerald-100 text-emerald-700 px-1 py-0.2 rounded font-semibold">SOTA</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Voice Selection */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
              <span>Голос ИИ ({voice})</span>
              <span className="text-[10px] font-normal text-slate-500">Gemini TTS / Live</span>
            </label>
            <div className="space-y-1 max-h-36 overflow-y-auto pr-1 no-scrollbar">
              {AVAILABLE_VOICES.map((v) => {
                const isSelected = voice === v.id;
                const isPreviewing = previewingVoice === v.id;

                return (
                  <div
                    key={v.id}
                    onClick={() => updateConfig({ voice: v.id })}
                    className={`flex items-center justify-between p-2 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-pastel-accentRose/10 border-pastel-accentRose/40 text-slate-900 font-semibold'
                        : 'bg-white/60 hover:bg-white border-pastel-border/60 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        v.gender === 'Женский' ? 'bg-rose-100 text-rose-700' : 'bg-indigo-100 text-indigo-700'
                      }`}>
                        {v.name[0]}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold truncate">{v.name}</span>
                          <span className="text-[9px] px-1 py-0.2 rounded bg-slate-100 text-slate-500">
                            {v.gender}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 truncate">{v.style}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void playVoicePreview(v.id);
                        }}
                        title="Прослушать голос"
                        className="p-1.5 rounded-lg hover:bg-pastel-rose text-pastel-accentRoseText transition cursor-pointer"
                      >
                        {isPreviewing ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-pastel-accentRose" />
                        ) : (
                          <Play className="w-3.5 h-3.5 text-pastel-accentRose fill-pastel-accentRose/20" />
                        )}
                      </button>
                      {isSelected && (
                        <Check className="w-4 h-4 text-pastel-accentRose shrink-0 ml-0.5" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Target Grade & Grammar Gender */}
          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-pastel-border/60">
            <div>
              <label className="text-[10px] font-bold text-slate-600 block mb-1">Грейд кандидата</label>
              <select
                value={targetGrade}
                onChange={(e) => updateConfig({ targetGrade: e.target.value as TargetGrade })}
                className="w-full text-xs font-bold px-2.5 py-1.5 rounded-xl bg-pastel-bg border border-pastel-border text-slate-800 focus:outline-none focus:border-pastel-accentRose cursor-pointer"
              >
                <option value="L4_MIDDLE">L4 Middle</option>
                <option value="L5_SENIOR">L5 Senior</option>
                <option value="L6_STAFF">L6 Staff / Lead</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-600 block mb-1">Обращение</label>
              <select
                value={config.userGender || 'female'}
                onChange={(e) => updateConfig({ userGender: e.target.value as UserGender })}
                className="w-full text-xs font-bold px-2.5 py-1.5 rounded-xl bg-pastel-bg border border-pastel-border text-slate-800 focus:outline-none focus:border-pastel-accentRose cursor-pointer"
              >
                <option value="female">👩 Женский (готова)</option>
                <option value="male">👨 Мужской (готов)</option>
                <option value="neutral">⚪ Нейтральный</option>
              </select>
            </div>
          </div>

          {/* Fast-Launch Toggle */}
          <div className="pt-2 border-t border-pastel-border/60">
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={alwaysShowPreflight}
                onChange={(e) => updateConfig({ alwaysShowPreflight: e.target.checked })}
                className="mt-0.5 w-4 h-4 rounded text-pastel-accentRose focus:ring-pastel-accentRose border-slate-300 cursor-pointer"
              />
              <div className="text-[11px] leading-tight">
                <span className="font-bold text-slate-800 block">Показывать предстартовое подтверждение</span>
                <span className="text-[10px] text-slate-500">
                  {alwaysShowPreflight 
                    ? 'Перед диалогом будет открываться окно подтверждения темы и микрофона.'
                    : 'Быстрый запуск в 1 клик с текущими настройками (режим виден на карточке).'}
                </span>
              </div>
            </label>
          </div>

        </div>
      )}
    </div>
  );
};
