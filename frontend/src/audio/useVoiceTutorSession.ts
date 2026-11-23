/**
 * useVoiceTutorSession.ts
 * Headless state and keyboard navigation hook for Voice Tutor sessions.
 * Cognitive Bounding Limit: <= 200 lines.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSelectionFocusStore } from '../store/useSelectionFocusStore';

export interface UseVoiceTutorSessionOptions {
  isBatchMode: boolean;
  totalQuestions: number;
  activeBatchIndex: number;
  onSwitchQuestion?: (newIndex: number) => void;
  onSendCustomText?: (text?: string) => void;
}

export function useVoiceTutorSession(options: UseVoiceTutorSessionOptions) {
  const {
    isBatchMode,
    totalQuestions,
    activeBatchIndex,
    onSwitchQuestion,
    onSendCustomText
  } = options;

  const { activeFocus, setFocus, clearFocus } = useSelectionFocusStore();
  const [mobileActiveTab, setMobileActiveTab] = useState<'theory' | 'tutor'>('theory');
  const [inputText, setInputText] = useState('');
  const textInputRef = useRef<HTMLInputElement>(null);

  // Keyboard navigation between questions (Alt+ArrowLeft / Alt+ArrowRight)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!onSwitchQuestion || !isBatchMode || totalQuestions <= 1) return;
      if (e.altKey && e.key === 'ArrowLeft' && activeBatchIndex > 0) {
        e.preventDefault();
        onSwitchQuestion(activeBatchIndex - 1);
      } else if (e.altKey && e.key === 'ArrowRight' && activeBatchIndex < totalQuestions - 1) {
        e.preventDefault();
        onSwitchQuestion(activeBatchIndex + 1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSwitchQuestion, isBatchMode, totalQuestions, activeBatchIndex]);

  const handleSendText = useCallback((textOverride?: string) => {
    const toSend = textOverride ?? inputText;
    if (!toSend.trim() || !onSendCustomText) return;
    onSendCustomText(toSend.trim());
    if (!textOverride) {
      setInputText('');
    }
  }, [inputText, onSendCustomText]);

  const handleInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  }, [handleSendText]);

  return {
    mobileActiveTab,
    setMobileActiveTab,
    inputText,
    setInputText,
    textInputRef,
    handleSendText,
    handleInputKeyDown,
    activeFocus,
    setFocus,
    clearFocus
  };
}
