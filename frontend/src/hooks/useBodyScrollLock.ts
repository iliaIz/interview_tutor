import { useEffect } from 'react';

/**
 * Custom hook to lock body scrolling when a modal or drawer is open.
 * Completely eliminates scroll chaining, pull-to-refresh, and rubber-banding on iOS Safari and mobile Chrome.
 */
export function useBodyScrollLock(isLocked: boolean) {
  useEffect(() => {
    if (!isLocked || typeof document === 'undefined') return;

    const originalOverflow = document.body.style.overflow;
    const originalPosition = document.body.style.position;
    const originalTop = document.body.style.top;
    const originalWidth = document.body.style.width;
    const originalTouchAction = document.body.style.touchAction;

    const scrollY = window.scrollY;

    // Lock body without jumping
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    document.body.style.touchAction = 'none';

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.position = originalPosition;
      document.body.style.top = originalTop;
      document.body.style.width = originalWidth;
      document.body.style.touchAction = originalTouchAction;

      // Restore scroll position
      window.scrollTo(0, scrollY);
    };
  }, [isLocked]);
}
