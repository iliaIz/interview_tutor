/**
 * useVoiceShortcuts.ts
 * Ergonomic hotkeys hook for VoiceModal:
 * - 'Space': Push-To-Talk / commit turn or barge-in.
 * - 'C': Cough-mute toggle.
 * Cognitive bounding limit: <= 350 lines.
 */

import { useEffect } from 'react';
import { VoiceEngineState } from './types';

interface UseVoiceShortcutsProps {
  isOpen: boolean;
  stage: string;
  state: VoiceEngineState;
  toggleMute: () => void;
  handleCentralButtonClick: () => void;
}

export function useVoiceShortcuts({
  isOpen,
  stage,
  state,
  toggleMute,
  handleCentralButtonClick
}: UseVoiceShortcutsProps): void {
  useEffect(() => {
    if (!isOpen || stage !== 'active') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          (activeEl as HTMLElement).isContentEditable)
      ) {
        return;
      }

      if (e.code === 'KeyC' && !e.repeat) {
        e.preventDefault();
        toggleMute();
      } else if (e.code === 'Space' && !e.repeat && state === 'LISTENING') {
        e.preventDefault();
        handleCentralButtonClick();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, stage, state, toggleMute, handleCentralButtonClick]);
}
