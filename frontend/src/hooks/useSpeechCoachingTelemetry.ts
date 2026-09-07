import { useState, useRef, useCallback } from 'react';
import {
  AcousticTelemetryService,
  SpeechClarityMetrics
} from '../services/AcousticTelemetryService';

export function useSpeechCoachingTelemetry() {
  const [speechCoachingMode, setSpeechCoachingMode] = useState<'adaptive' | 'always' | 'off'>(() => {
    try {
      const saved = localStorage.getItem('interview_speech_coaching_mode');
      if (saved === 'adaptive' || saved === 'always' || saved === 'off') {
        return saved;
      }
    } catch {}
    return 'adaptive';
  });

  const [liveClarityMetrics, setLiveClarityMetrics] = useState<SpeechClarityMetrics | null>(null);
  const [liveTranscript, setLiveTranscript] = useState<string>('');
  const [deepgramTranscript, setDeepgramTranscript] = useState<string>('');
  const [isTranscribing, setIsTranscribing] = useState(false);

  const speechRecognitionRef = useRef<any>(null);
  const turnStartTimeRef = useRef<number>(Date.now());

  const updateSpeechCoachingMode = useCallback((mode: 'adaptive' | 'always' | 'off') => {
    setSpeechCoachingMode(mode);
    try {
      localStorage.setItem('interview_speech_coaching_mode', mode);
    } catch {}
  }, []);

  // Web Speech API Fallback listener
  const startSpeechRecognition = useCallback(() => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    try {
      if (speechRecognitionRef.current) {
        try { speechRecognitionRef.current.stop(); } catch {}
      }
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'ru-RU';

      recognition.onresult = (event: any) => {
        let currentInterim = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            setLiveTranscript((prev) => prev + ' ' + event.results[i][0].transcript);
          } else {
            currentInterim += event.results[i][0].transcript;
          }
        }
      };

      recognition.onerror = () => {};
      recognition.onend = () => {};

      speechRecognitionRef.current = recognition;
      recognition.start();
    } catch {}
  }, []);

  const stopSpeechRecognition = useCallback(() => {
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch {}
      speechRecognitionRef.current = null;
    }
  }, []);

  // Trigger Background High-Fidelity STT (Deepgram / Whisper)
  const triggerBackgroundStt = useCallback(async (pcmBase64: string): Promise<string> => {
    if (!pcmBase64) return '';
    setIsTranscribing(true);
    try {
      const res = await fetch('/api/stt/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pcmBase64 })
      });
      if (res.ok) {
        const data = await res.json();
        const transcript = data.transcript || '';
        if (transcript) {
          setDeepgramTranscript(transcript);
          return transcript;
        }
      }
    } catch (e) {
      console.warn('Background STT failed:', e);
    } finally {
      setIsTranscribing(false);
    }
    return '';
  }, []);

  const resetCoachingTurn = useCallback(() => {
    setLiveTranscript('');
    setDeepgramTranscript('');
    setLiveClarityMetrics(null);
    turnStartTimeRef.current = Date.now();
  }, []);

  return {
    speechCoachingMode,
    updateSpeechCoachingMode,
    liveClarityMetrics,
    setLiveClarityMetrics,
    liveTranscript,
    setLiveTranscript,
    deepgramTranscript,
    setDeepgramTranscript,
    isTranscribing,
    startSpeechRecognition,
    stopSpeechRecognition,
    triggerBackgroundStt,
    resetCoachingTurn
  };
}
