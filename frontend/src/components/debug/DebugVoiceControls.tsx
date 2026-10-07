import React from 'react';

interface DebugVoiceControlsProps {
  voice: string;
  temperature: number;
  isRunning: boolean;
  onVoiceChange: (voice: string) => void;
  onTempChange: (temp: number) => void;
}

/**
 * DebugVoiceControls (SOTA Late 2026).
 * Voice timbre and temperature controls for Live VAD diagnostic studio.
 * Cognitive bounding limit: <= 100 lines.
 */
export const DebugVoiceControls: React.FC<DebugVoiceControlsProps> = ({
  voice,
  temperature,
  isRunning,
  onVoiceChange,
  onTempChange
}) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-bold text-slate-500">Голос:</span>
        <select
          value={voice}
          disabled={isRunning}
          onChange={(e) => onVoiceChange(e.target.value)}
          className="px-2 py-1 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-800 outline-none focus:border-violet-400"
        >
          <option value="Aoede">Aoede (Женский)</option>
          <option value="Puck">Puck (Мужской, Google Default)</option>
          <option value="Charon">Charon (Мужской, глубокий)</option>
          <option value="Fenrir">Fenrir (Мужской, энергичный)</option>
          <option value="Kore">Kore (Женский, мягкий)</option>
        </select>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[11px] font-bold text-slate-500">Температура:</span>
        <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200">
          <button
            type="button"
            disabled={isRunning}
            onClick={() => onTempChange(1.0)}
            className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
              temperature === 1.0 ? 'bg-emerald-500 text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            1.0 (Google SOTA)
          </button>
          <button
            type="button"
            disabled={isRunning}
            onClick={() => onTempChange(0.3)}
            className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
              temperature === 0.3 ? 'bg-amber-500 text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            0.3 (Заниженная)
          </button>
        </div>
      </div>
    </div>
  );
};
