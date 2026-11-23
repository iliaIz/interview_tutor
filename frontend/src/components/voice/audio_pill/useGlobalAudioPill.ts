import { useState, useEffect, useRef, useCallback } from 'react';
import { GeminiVoiceName, TurnMode, UserGender } from '../../../types/interviewConfig';
import { TargetGrade } from '../../../types/personas';
import { useInterviewConfig } from '../../../hooks/useInterviewConfig';

export interface UseGlobalAudioPillReturn {
  isOpen: boolean;
  setIsOpen: (val: boolean) => void;
  isAdvancedOpen: boolean;
  setIsAdvancedOpen: (val: boolean) => void;
  config: any;
  updateConfig: (cfg: any) => void;
  previewingVoice: GeminiVoiceName | null;
  playVoicePreview: (voice: GeminiVoiceName) => Promise<void>;
  turnMode: TurnMode;
  voice: GeminiVoiceName;
  targetGrade: TargetGrade;
  alwaysShowPreflight: boolean;
  popoverRef: React.RefObject<HTMLDivElement>;
  getGradeShort: (g: TargetGrade) => string;
}

export function useGlobalAudioPill(): UseGlobalAudioPillReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const { config, updateConfig } = useInterviewConfig();
  const [previewingVoice, setPreviewingVoice] = useState<GeminiVoiceName | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

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

  const playVoicePreview = useCallback(async (v: GeminiVoiceName) => {
    if (previewingVoice) return;
    setPreviewingVoice(v);

    try {
      const res = await fetch('/api/interview/greeting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: 'Знакомство',
          questionText: 'Привет! Я твой голосовой наставник по Java и Spring.',
          voice: v,
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
  }, [previewingVoice]);

  const turnMode = config.turnMode || 'manual';
  const voice = config.voice || 'Kore';
  const targetGrade = config.targetGrade || 'L5_SENIOR';
  const alwaysShowPreflight = config.alwaysShowPreflight === true;

  const getGradeShort = useCallback((g: TargetGrade) => {
    if (g === 'L4_MIDDLE') return 'L4 Middle';
    if (g === 'L6_STAFF') return 'L6 Staff';
    return 'L5 Senior';
  }, []);

  return {
    isOpen,
    setIsOpen,
    isAdvancedOpen,
    setIsAdvancedOpen,
    config,
    updateConfig,
    previewingVoice,
    playVoicePreview,
    turnMode,
    voice,
    targetGrade,
    alwaysShowPreflight,
    popoverRef,
    getGradeShort
  };
}
