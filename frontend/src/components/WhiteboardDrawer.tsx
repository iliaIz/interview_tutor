import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WhiteboardState } from '../store/useAppStore';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { WhiteboardPanelContent } from './WhiteboardPanelContent';

export interface WhiteboardDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  state: WhiteboardState | null;
}

export const WhiteboardDrawer: React.FC<WhiteboardDrawerProps> = ({
  isOpen,
  onClose,
  state
}) => {
  useBodyScrollLock(isOpen);
  const [isExpanded, setIsExpanded] = React.useState(false);

  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="whiteboard-drawer-panel"
          initial={{ opacity: 0, x: 100 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 100 }}
          transition={{ duration: 0.2 }}
          className={`fixed z-50 bg-[#121622]/95 backdrop-blur-2xl border-t md:border border-pastel-accentViolet/30 shadow-2xl flex flex-col overflow-hidden text-slate-200 transition-all duration-300 inset-x-0 bottom-0 top-12 rounded-t-3xl md:inset-auto md:top-4 md:bottom-4 md:right-4 md:rounded-3xl ${
            isExpanded ? 'md:w-[calc(100vw-2rem)] md:max-w-4xl' : 'md:w-full md:max-w-lg'
          }`}
        >
          {/* Mobile Drag Handle */}
          <div className="md:hidden flex items-center justify-center pt-2.5 pb-1 select-none bg-[#181E2E]">
            <div className="w-10 h-1.5 rounded-full bg-slate-500/80" />
          </div>

          <WhiteboardPanelContent
            mode="drawer"
            state={state}
            onClose={onClose}
            isExpanded={isExpanded}
            onToggleExpand={() => setIsExpanded((v) => !v)}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default WhiteboardDrawer;
