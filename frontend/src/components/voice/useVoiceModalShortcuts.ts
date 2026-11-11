import { useEffect } from 'react';

interface UseVoiceModalShortcutsOptions {
  isOpen: boolean;
  stage: string;
  state: string;
  onToggleMute: () => void;
  onInteraction: () => void;
}

/**
 * useVoiceModalShortcuts.ts
 * Headless keyboard shortcut handler for VoiceModal (Spacebar PTT / interaction & 'C' mute toggle).
 * Decoupled from VoiceModal.tsx to maintain cognitive bounding (Rule 8: <= 400 lines).
 */
export function useVoiceModalShortcuts({
  isOpen,
  stage,
  state,
  onToggleMute,
  onInteraction
}: UseVoiceModalShortcutsOptions): void {
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
        onToggleMute();
      } else if (e.code === 'Space' && !e.repeat && state === 'LISTENING') {
        e.preventDefault();
        onInteraction();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, stage, state, onToggleMute, onInteraction]);
}
