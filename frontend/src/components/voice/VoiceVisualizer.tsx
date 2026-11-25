/**
 * VoiceVisualizer.tsx
 * Smooth Acoustic Frequency Waves & Atmosphere Aura (SOTA Late 2026).
 * Single responsibility: visual waveform and harmonic energy rendering.
 */

import React, { useMemo, useRef, useEffect } from 'react';
import { AudioLevelSubscriber } from '../../audio/useLiveVoiceSession';

export interface VoiceVisualizerProps {
  rmsDb?: number;
  subscribeAudioLevel?: AudioLevelSubscriber;
  isActive: boolean;
  color?: 'emerald' | 'rose' | 'amber';
}

export const VoiceVisualizer: React.FC<VoiceVisualizerProps> = ({
  rmsDb = -100,
  subscribeAudioLevel,
  isActive,
  color = 'emerald'
}) => {
  const bars = useMemo(() => [0.4, 0.7, 1.0, 0.6, 0.85, 0.5, 0.9, 0.75, 0.35], []);
  const barRefs = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    if (!subscribeAudioLevel) return;
    return subscribeAudioLevel((db) => {
      const energy = isActive ? Math.max(0.1, Math.min(1.0, (db + 70) / 50)) : 0.05;
      bars.forEach((weight, idx) => {
        const el = barRefs.current[idx];
        if (el) el.style.height = `${Math.max(12, Math.min(100, weight * energy * 100))}%`;
      });
    });
  }, [subscribeAudioLevel, isActive, bars]);

  // Initial or fallback energy calculation
  const energy = isActive ? Math.max(0.1, Math.min(1.0, (rmsDb + 70) / 50)) : 0.05;

  const barColorClass =
    color === 'rose'
      ? 'bg-gradient-to-t from-rose-400 to-pink-300'
      : color === 'amber'
      ? 'bg-gradient-to-t from-amber-400 to-yellow-300'
      : 'bg-gradient-to-t from-emerald-500 to-teal-300';

  return (
    <div className="flex items-center justify-center gap-1.5 h-10 px-4 py-2">
      {bars.map((weight, idx) => {
        const heightPercent = Math.max(12, Math.min(100, weight * energy * 100));
        return (
          <div
            key={idx}
            ref={(el) => { barRefs.current[idx] = el; }}
            className={`w-1.5 rounded-full transition-all duration-75 ${barColorClass}`}
            style={{
              height: `${heightPercent}%`,
              opacity: isActive ? 0.9 : 0.3
            }}
          />
        );
      })}
    </div>
  );
};
