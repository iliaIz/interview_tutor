import React from 'react';
import { Bot, Sparkles, X } from 'lucide-react';
import { usePracticeTutorStore } from '../../../store/usePracticeTutorStore';
import { useAppStore } from '../../../store/useAppStore';
import { PracticeTutorPanelContent } from './PracticeTutorDrawer';
import { WhiteboardPanelContent } from '../../WhiteboardPanelContent';
import { NativeModalDialog } from '../../shared/NativeModalDialog';

export const PracticeCopilotDock: React.FC = () => {
  const isOpen = usePracticeTutorStore((s) => s.isOpen);
  const isCopilotStealth = usePracticeTutorStore((s) => s.isCopilotStealth);
  const rightDockTab = usePracticeTutorStore((s) => s.rightDockTab);
  const setRightDockTab = usePracticeTutorStore((s) => s.setRightDockTab);
  const toggleOpen = usePracticeTutorStore((s) => s.toggleOpen);

  const activeWhiteboardState = useAppStore((s) => s.activeWhiteboardState);
  const [hasEverOpened, setHasEverOpened] = React.useState(false);

  React.useEffect(() => {
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
        <button
          type="button"
          onClick={() => toggleOpen(false)}
          aria-label="Свернуть боковую панель"
          className="touch-target-44 p-1.5 rounded-lg text-pastel-muted hover:text-pastel-text hover:bg-white transition cursor-pointer flex items-center justify-center"
          title="Свернуть панель"
        >
          <X className="w-4 h-4" />
        </button>
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

  return (
    <>
      {/* Desktop >= lg: Docked sibling rail inside Workspace (never overlaps header/footer) */}
      <aside
        aria-label="Панель AI Co-Pilot"
        className={
          isVisible
            ? 'hidden lg:flex flex-col w-[380px] xl:w-[420px] shrink-0 border-l border-pastel-border bg-white h-full min-h-0 overflow-hidden'
            : 'hidden'
        }
      >
        {dockTabsBar(true)}
        {dockBody}
      </aside>

      {/* Mobile / Tablet < lg: Top-layer native <dialog> drawer */}
      <div className="lg:hidden">
        <NativeModalDialog
          isOpen={isVisible}
          onClose={() => toggleOpen(false)}
          ariaLabel="AI-Напарник и Доска ИИ"
          panelClassName="w-full max-w-lg h-[88dvh] bg-white rounded-3xl border border-pastel-border shadow-2xl flex flex-col overflow-hidden"
        >
          {dockTabsBar(true)}
          {dockBody}
        </NativeModalDialog>
      </div>
    </>
  );
};

export default PracticeCopilotDock;
