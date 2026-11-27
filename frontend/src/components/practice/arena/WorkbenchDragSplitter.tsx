/**
 * WorkbenchDragSplitter.tsx
 * Accessible WAI-ARIA resize splitter with requestAnimationFrame throttling.
 * Mutates host CSS variables at 60fps during drag and commits to store once on release.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';

export interface WorkbenchDragSplitterProps {
  edge: 'left' | 'right';
  label: string;
  minWidth: number;
  maxWidth: number;
  currentWidth: number;
  onPreviewWidth: (px: number) => void;
  onCommitWidth: (px: number) => void;
  onResetWidth: () => void;
  testId?: string;
}

const KEY_STEP_PX = 16;
const KEY_SHIFT_STEP_PX = 48;

export const WorkbenchDragSplitter: React.FC<WorkbenchDragSplitterProps> = ({
  edge,
  label,
  minWidth,
  maxWidth,
  currentWidth,
  onPreviewWidth,
  onCommitWidth,
  onResetWidth,
  testId
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{
    startX: number;
    startWidth: number;
    latestWidth: number;
    rafId: number | null;
  } | null>(null);

  const clampDragWidth = useCallback(
    (rawWidth: number) => {
      const safeMax = Math.max(minWidth, maxWidth);
      return Math.min(safeMax, Math.max(minWidth, Math.round(rawWidth)));
    },
    [minWidth, maxWidth]
  );

  useEffect(() => {
    return () => {
      if (dragRef.current?.rafId !== null && dragRef.current?.rafId !== undefined) {
        cancelAnimationFrame(dragRef.current.rafId);
      }
      if (typeof document !== 'undefined') {
        document.body.classList.remove('select-none');
      }
    };
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startWidth: currentWidth,
      latestWidth: currentWidth,
      rafId: null
    };
    setIsDragging(true);
    document.body.classList.add('select-none');
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const session = dragRef.current;
    if (!session) return;
    const deltaX = e.clientX - session.startX;
    // Left panel grows when dragging right (+deltaX); right panel grows when dragging left (-deltaX)
    const rawTarget = edge === 'left' ? session.startWidth + deltaX : session.startWidth - deltaX;
    const clamped = clampDragWidth(rawTarget);
    session.latestWidth = clamped;

    if (session.rafId === null) {
      session.rafId = requestAnimationFrame(() => {
        if (dragRef.current) {
          onPreviewWidth(dragRef.current.latestWidth);
          dragRef.current.rafId = null;
        }
      });
    }
  };

  const finishDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const session = dragRef.current;
    if (!session) return;
    if (session.rafId !== null) {
      cancelAnimationFrame(session.rafId);
    }
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    const finalWidth = session.latestWidth;
    dragRef.current = null;
    setIsDragging(false);
    document.body.classList.remove('select-none');
    onCommitWidth(finalWidth);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? KEY_SHIFT_STEP_PX : KEY_STEP_PX;
    let nextWidth: number | null = null;

    if (e.key === 'ArrowLeft') {
      nextWidth = edge === 'left' ? currentWidth - step : currentWidth + step;
    } else if (e.key === 'ArrowRight') {
      nextWidth = edge === 'left' ? currentWidth + step : currentWidth - step;
    } else if (e.key === 'Home') {
      nextWidth = minWidth;
    } else if (e.key === 'End') {
      nextWidth = maxWidth;
    }

    if (nextWidth !== null) {
      e.preventDefault();
      const clamped = clampDragWidth(nextWidth);
      onPreviewWidth(clamped);
      onCommitWidth(clamped);
    }
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuemin={minWidth}
      aria-valuemax={Math.max(minWidth, maxWidth)}
      aria-valuenow={Math.round(currentWidth)}
      tabIndex={0}
      data-testid={testId}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      onDoubleClick={onResetWidth}
      onKeyDown={handleKeyDown}
      title={`${label} (двойной клик для сброса)`}
      className="group relative flex h-full w-[6px] shrink-0 cursor-col-resize touch-none items-center justify-center focus:outline-none"
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none h-10 w-[2px] rounded-full transition-all duration-150 ${
          isDragging
            ? 'h-16 bg-violet-500 shadow-[0_0_8px_rgba(139,92,246,0.45)]'
            : 'bg-gray-200/80 group-hover:h-14 group-hover:bg-violet-400 group-focus-visible:h-14 group-focus-visible:bg-violet-500'
        }`}
      />
    </div>
  );
};
