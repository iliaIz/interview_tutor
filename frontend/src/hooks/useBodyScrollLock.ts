import { useEffect } from 'react';

/**
 * Singleton lock state manager for multi-modal stacks.
 * Ensures that nesting drawers or popups over modals never causes premature scroll unlocking.
 */
let activeLocksCount = 0;
let savedScrollY = 0;
let originalOverflow = '';
let originalPosition = '';
let originalTop = '';
let originalWidth = '';
let originalTouchAction = '';

/**
 * Custom hook to lock body scrolling when a modal or drawer is open.
 * Completely eliminates scroll chaining, pull-to-refresh, and rubber-banding on iOS Safari and mobile Chrome.
 * Supports arbitrary modal nesting with atomic reference counting.
 */
export function useBodyScrollLock(isLocked: boolean) {
  useEffect(() => {
    if (!isLocked || typeof document === 'undefined') return;

    if (activeLocksCount === 0) {
      savedScrollY = window.scrollY;
      originalOverflow = document.body.style.overflow;
      originalPosition = document.body.style.position;
      originalTop = document.body.style.top;
      originalWidth = document.body.style.width;
      originalTouchAction = document.body.style.touchAction;

      // Lock body without page jump
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${savedScrollY}px`;
      document.body.style.width = '100%';
      document.body.style.touchAction = 'none';
    }

    activeLocksCount++;

    return () => {
      activeLocksCount = Math.max(0, activeLocksCount - 1);

      if (activeLocksCount === 0) {
        document.body.style.overflow = originalOverflow;
        document.body.style.position = originalPosition;
        document.body.style.top = originalTop;
        document.body.style.width = originalWidth;
        document.body.style.touchAction = originalTouchAction;

        // Restore original scroll position
        window.scrollTo(0, savedScrollY);
      }
    };
  }, [isLocked]);
}
