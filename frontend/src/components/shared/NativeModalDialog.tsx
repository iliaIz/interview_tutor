import React, { useEffect, useRef } from 'react';

export interface NativeModalDialogProps {
  isOpen: boolean;
  onClose: () => void;
  ariaLabelledBy?: string;
  ariaLabel?: string;
  panelClassName?: string;
  dialogClassName?: string;
  children: React.ReactNode;
}

/**
 * Accessible native <dialog>.showModal() wrapper with Esc cancellation,
 * closedby="any" + pointerdown/pointerup outside-backdrop click fallback,
 * and overscroll containment.
 */
export const NativeModalDialog: React.FC<NativeModalDialogProps> = ({
  isOpen,
  onClose,
  ariaLabelledBy,
  ariaLabel,
  panelClassName = 'relative w-full max-w-2xl max-h-[90dvh] flex flex-col overflow-hidden rounded-3xl shadow-2xl',
  dialogClassName = '',
  children
}) => {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const pointerDownOnBackdropRef = useRef(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open && typeof dialog.showModal === 'function') {
        try {
          dialog.showModal();
        } catch {
          dialog.setAttribute('open', '');
        }
      }
    } else if (dialog.open && typeof dialog.close === 'function') {
      dialog.close();
    }

    return () => {
      if (dialog.open && typeof dialog.close === 'function') {
        dialog.close();
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <dialog
      ref={dialogRef}
      aria-modal="true"
      aria-labelledby={ariaLabelledBy}
      aria-label={ariaLabel}
      {...({ closedby: 'any' } as Record<string, string>)}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onPointerDown={(e) => {
        pointerDownOnBackdropRef.current = e.target === dialogRef.current;
      }}
      onPointerUp={(e) => {
        const startedOnBackdrop = pointerDownOnBackdropRef.current;
        pointerDownOnBackdropRef.current = false;
        if (startedOnBackdrop && e.target === dialogRef.current) {
          onClose();
        }
      }}
      className={`open:flex items-center justify-center bg-transparent p-3 sm:p-4 m-0 max-w-none max-h-none w-screen h-dvh backdrop:bg-slate-950/55 backdrop:backdrop-blur-sm modal-overscroll-contain z-50 ${dialogClassName}`}
    >
      <div
        className={`modal-overscroll-contain ${panelClassName}`}
        onPointerDown={(e) => {
          pointerDownOnBackdropRef.current = false;
          e.stopPropagation();
        }}
      >
        {children}
      </div>
    </dialog>
  );
};

export default NativeModalDialog;
