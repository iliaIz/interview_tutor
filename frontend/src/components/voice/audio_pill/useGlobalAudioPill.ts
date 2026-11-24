import { useState, useEffect, useRef, useCallback } from 'react';
import { GeminiVoiceName, TurnMode, UserGender } from '../../../types/interviewConfig';
import { TargetGrade } from '../../../types/personas';
import { useInterviewConfig } from '../../../hooks/useInterviewConfig';
import { VOICE_DEFAULTS } from '../../../config/voiceDefaults';
import { previewGeminiVoiceAudio } from '../../../services/voicePreviewService';

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
    await previewGeminiVoiceAudio({
      voice: v,
      userGender: config.userGender,
      strategy: config.strategy,
      audioRef,
      onFinish: () => setPreviewingVoice(null)
    });
  }, [previewingVoice, config.userGender, config.strategy]);

  const turnMode = config.turnMode || VOICE_DEFAULTS.turnMode;
  const voice = config.voice || VOICE_DEFAULTS.voice;
  const targetGrade = config.targetGrade || VOICE_DEFAULTS.targetGrade;
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
