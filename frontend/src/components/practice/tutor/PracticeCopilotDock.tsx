import React, { useEffect, useState } from 'react';
import { Bot, Maximize2, Minimize2, Sparkles, X } from 'lucide-react';
import { usePracticeTutorStore } from '../../../store/usePracticeTutorStore';
import { useAppStore } from '../../../store/useAppStore';
import { PracticeTutorPanelContent } from './PracticeTutorDrawer';
import { WhiteboardPanelContent } from '../../WhiteboardPanelContent';
import { NativeModalDialog } from '../../shared/NativeModalDialog';

function useIsDesktopLg(): boolean {
  const [isDesktop, setIsDesktop] = useState<boolean>(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true;
    return window.matchMedia('(min-width: 1024px)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia('(min-width: 1024px)');
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    setIsDesktop(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return isDesktop;
}

export const PracticeCopilotDock: React.FC = () => {
  const isOpen = usePracticeTutorStore((s) => s.isOpen);
  const isCopilotStealth = usePracticeTutorStore((s) => s.isCopilotStealth);
  const rightDockTab = usePracticeTutorStore((s) => s.rightDockTab);
  const setRightDockTab = usePracticeTutorStore((s) => s.setRightDockTab);
  const toggleOpen = usePracticeTutorStore((s) => s.toggleOpen);
  const isWhiteboardExpanded = usePracticeTutorStore((s) => s.isWhiteboardExpanded);
  const toggleWhiteboardExpanded = usePracticeTutorStore((s) => s.toggleWhiteboardExpanded);

  const activeWhiteboardState = useAppStore((s) => s.activeWhiteboardState);
  const [hasEverOpened, setHasEverOpened] = useState(false);
  const isDesktopLg = useIsDesktopLg();

  useEffect(() => {
    if (isOpen) {
      setHasEverOpened(true);
    }
  }, [isOpen]);

  const isVisible = isOpen && !isCopilotStealth;

  // Preserve mounted state non-destructively while in stealth mode
  if (!isVisible && !hasEverOpened) {
    return null;
  }

  const dockTabsBar = (showCloseButton: boolean) => (
    <div className="px-2.5 py-1.5 border-b border-pastel-border bg-pastel-bg flex items-center justify-between gap-2 shrink-0">
      <div
        role="tablist"
        aria-label="Панель AI-Напарника и Доски ИИ"
        className="flex items-center bg-white p-0.5 rounded-xl border border-pastel-border gap-0.5"
      >
        <button
          type="button"
          role="tab"
          aria-selected={rightDockTab === 'tutor'}
          onClick={() => setRightDockTab('tutor')}
          className={`touch-target-44 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
            rightDockTab === 'tutor'
              ? 'bg-[#B5433E] text-white shadow-2xs'
              : 'text-pastel-muted hover:text-pastel-text'
          }`}
        >
          <Bot className="w-3.5 h-3.5 text-current" />
          <span>Напарник</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={rightDockTab === 'whiteboard'}
          onClick={() => setRightDockTab('whiteboard')}
          className={`touch-target-44 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
            rightDockTab === 'whiteboard'
              ? 'bg-slate-900 text-white shadow-2xs'
              : 'text-pastel-muted hover:text-pastel-text'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-current" />
          <span>Доска ИИ</span>
        </button>
      </div>

      {showCloseButton && (
        <div className="flex items-center gap-1 shrink-0">
          {isDesktopLg && rightDockTab === 'whiteboard' && (
            <button
              type="button"
              onClick={() => toggleWhiteboardExpanded()}
              aria-pressed={isWhiteboardExpanded}
              aria-label={isWhiteboardExpanded ? 'Обычная ширина' : 'Широкая доска'}
              title={isWhiteboardExpanded ? 'Обычная ширина' : 'Широкая доска'}
              data-testid="whiteboard-expand-toggle"
              className={`touch-target-44 p-1.5 rounded-lg transition cursor-pointer flex items-center justify-center ${
                isWhiteboardExpanded
                  ? 'bg-violet-100 text-violet-700 hover:bg-violet-200'
                  : 'text-pastel-muted hover:text-pastel-text hover:bg-white'
              }`}
            >
              {isWhiteboardExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          )}
          <button
            type="button"
            onClick={() => toggleOpen(false)}
            aria-label="Свернуть боковую панель"
            className="touch-target-44 p-1.5 rounded-lg text-pastel-muted hover:text-pastel-text hover:bg-white transition cursor-pointer flex items-center justify-center"
            title="Свернуть панель"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );

  const dockBody = (
    <div role="tabpanel" className="flex-1 min-h-0 flex flex-col overflow-hidden">
      <div className={rightDockTab === 'tutor' ? 'flex-1 min-h-0 flex flex-col overflow-hidden' : 'hidden'}>
        <PracticeTutorPanelContent mode="dock" />
      </div>
      {rightDockTab === 'whiteboard' && (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <WhiteboardPanelContent
            mode="dock"
            state={activeWhiteboardState}
            onClose={() => toggleOpen(false)}
            onSwitchToTutor={() => setRightDockTab('tutor')}
          />
        </div>
      )}
    </div>
  );

  // Mount ONLY the desktop <aside> OR the mobile/tablet <dialog> so dialog.showModal()
  // never marks the desktop page inert when hidden under a CSS media query.
  if (isDesktopLg) {
    return (
      <aside
        aria-label="Панель AI Co-Pilot"
        data-testid="practice-copilot-dock"
        className={
          isVisible
            ? 'flex flex-col w-full border-l border-pastel-border bg-white h-full min-h-0 overflow-hidden'
            : 'hidden'
        }
      >
        {dockTabsBar(true)}
        {dockBody}
      </aside>
    );
  }

  return (
    <NativeModalDialog
      isOpen={isVisible}
      onClose={() => toggleOpen(false)}
      ariaLabel="AI-Напарник и Доска ИИ"
      panelClassName="w-full max-w-lg h-[88dvh] bg-white rounded-3xl border border-pastel-border shadow-2xl flex flex-col overflow-hidden"
    >
      {dockTabsBar(true)}
      {dockBody}
    </NativeModalDialog>
  );
};

export default PracticeCopilotDock;
