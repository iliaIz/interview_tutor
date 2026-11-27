/**
 * useWorkbenchViewport.ts
 * Tracks reactive container width via ResizeObserver alongside responsive md/lg breakpoints.
 */

import { useEffect, useState, type RefObject } from 'react';

export interface WorkbenchViewportState {
  containerWidth: number;
  isDesktopMd: boolean;
  isDesktopLg: boolean;
}

function queryMatch(query: string, fallback: boolean): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return fallback;
  }
  return window.matchMedia(query).matches;
}

export function useWorkbenchViewport(containerRef: RefObject<HTMLElement | null>): WorkbenchViewportState {
  const [isDesktopMd, setIsDesktopMd] = useState<boolean>(() => queryMatch('(min-width: 768px)', true));
  const [isDesktopLg, setIsDesktopLg] = useState<boolean>(() => queryMatch('(min-width: 1024px)', true));
  const [containerWidth, setContainerWidth] = useState<number>(() => {
    if (typeof window !== 'undefined' && Number.isFinite(window.innerWidth) && window.innerWidth > 0) {
      return Math.round(window.innerWidth);
    }
    return 1440;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mqlMd = window.matchMedia('(min-width: 768px)');
    const mqlLg = window.matchMedia('(min-width: 1024px)');
    const onMdChange = (e: MediaQueryListEvent) => setIsDesktopMd(e.matches);
    const onLgChange = (e: MediaQueryListEvent) => setIsDesktopLg(e.matches);

    setIsDesktopMd(mqlMd.matches);
    setIsDesktopLg(mqlLg.matches);
    mqlMd.addEventListener('change', onMdChange);
    mqlLg.addEventListener('change', onLgChange);
    return () => {
      mqlMd.removeEventListener('change', onMdChange);
      mqlLg.removeEventListener('change', onLgChange);
    };
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof window === 'undefined') return;

    const updateWidth = (rawWidth: number) => {
      if (Number.isFinite(rawWidth) && rawWidth > 0) {
        setContainerWidth(Math.round(rawWidth));
      }
    };

    updateWidth(el.getBoundingClientRect().width || window.innerWidth);

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.contentRect.width > 0) {
            updateWidth(entry.contentRect.width);
          }
        }
      });
      observer.observe(el);
      return () => observer.disconnect();
    }

    const onResize = () => updateWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [containerRef]);

  return { containerWidth, isDesktopMd, isDesktopLg };
}
