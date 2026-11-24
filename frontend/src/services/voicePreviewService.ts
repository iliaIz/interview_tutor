/**
 * voicePreviewService.ts
 * Shared single-responsibility Gemini TTS voice preview client helper.
 * Eliminates duplication between VoiceSettingsDrawer and GlobalAudioControlPill.
 * Cognitive Bounding Limit: <= 60 lines (Rule 8).
 */

import type { MutableRefObject } from 'react';
import { GeminiVoiceName, InterviewStrategy, UserGender } from '../types/interviewConfig';

export interface PreviewGeminiVoiceOptions {
  voice: GeminiVoiceName;
  userGender?: UserGender;
  strategy?: InterviewStrategy;
  audioRef: MutableRefObject<HTMLAudioElement | null>;
  onFinish: () => void;
}

export async function previewGeminiVoiceAudio(options: PreviewGeminiVoiceOptions): Promise<void> {
  const {
    voice,
    userGender = 'female',
    strategy = 'socratic_tutoring',
    audioRef,
    onFinish
  } = options;

  try {
    const res = await fetch('/api/interview/greeting', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic: 'Знакомство',
        questionText: 'Привет! Я твой голосовой наставник по Java и Spring.',
        voice,
        userGender,
        strategy
      })
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.audioBase64) {
      if (!audioRef.current) {
        audioRef.current = new Audio();
      }
      audioRef.current.src = `data:audio/wav;base64,${data.audioBase64}`;
      audioRef.current.onended = onFinish;
      audioRef.current.onerror = onFinish;
      await audioRef.current.play();
    } else {
      onFinish();
    }
  } catch (err) {
    console.warn('Voice preview failed:', err);
    onFinish();
  }
}
