import { StateCreator } from 'zustand';
import { AppState, WhiteboardSlice, WhiteboardState, CodeArtifactRevision } from '../types';

export const createWhiteboardSlice: StateCreator<AppState, [], [], WhiteboardSlice> = (set) => ({
  activeWhiteboardState: null,
  isWhiteboardOpen: false,
  codeRevisions: [],
  activeRevisionId: null,
  hasUnseenWhiteboardUpdate: false,
  activeWorkspaceView: 'editor',

  setWhiteboardState: (wb: WhiteboardState | null) => {
    set((state) => {
      const isMeaningfulUpdate = Boolean(wb && (wb.code?.trim() || wb.explanation?.trim() || wb.title?.trim()));
      const shouldFlagUnseen = isMeaningfulUpdate && state.activeWorkspaceView !== 'whiteboard';

      const newState = {
        activeWhiteboardState: wb,
        isWhiteboardOpen: wb ? (wb.action !== 'clear') : false,
        hasUnseenWhiteboardUpdate: shouldFlagUnseen ? true : state.hasUnseenWhiteboardUpdate
      };

      // If code is supplied, record as revision if distinct
      if (wb?.code && wb.code.trim().length > 0) {
        const currentRevs = state.codeRevisions || [];
        const lastRev = currentRevs[currentRevs.length - 1];
        if (!lastRev || lastRev.code !== wb.code) {
          const nextIndex = (lastRev ? lastRev.index : 0) + 1;
          const revId = `rev_${Date.now().toString(36)}_${nextIndex}`;
          const newRev: CodeArtifactRevision = {
            id: revId,
            index: nextIndex,
            title: wb.title || `Версия ${nextIndex}`,
            language: wb.language || 'java',
            code: wb.code,
            timestamp: Date.now(),
            author: 'ai'
          };
          const updatedRevs = [...currentRevs, newRev].slice(-10); // Keep last 10
          return {
            ...newState,
            codeRevisions: updatedRevs,
            activeRevisionId: revId
          };
        }
      }
      return newState;
    });
  },

  setIsWhiteboardOpen: (open: boolean) => set({ isWhiteboardOpen: open }),

  setActiveWorkspaceView: (view: 'editor' | 'whiteboard') =>
    set((state) => ({
      activeWorkspaceView: view,
      hasUnseenWhiteboardUpdate: view === 'whiteboard' ? false : state.hasUnseenWhiteboardUpdate
    })),

  markWhiteboardSeen: () => set({ hasUnseenWhiteboardUpdate: false }),

  addCodeRevision: ({ title, language = 'java', code, author = 'ai' }) => {
    if (!code || !code.trim()) return;
    set((state) => {
      const currentRevs = state.codeRevisions || [];
      const lastRev = currentRevs[currentRevs.length - 1];
      if (lastRev && lastRev.code === code) return state;

      const nextIndex = (lastRev ? lastRev.index : 0) + 1;
      const revId = `rev_${Date.now().toString(36)}_${nextIndex}`;
      const newRev: CodeArtifactRevision = {
        id: revId,
        index: nextIndex,
        title: title || `Версия ${nextIndex}`,
        language,
        code,
        timestamp: Date.now(),
        author
      };
      const updatedRevs = [...currentRevs, newRev].slice(-10);
      return {
        codeRevisions: updatedRevs,
        activeRevisionId: revId
      };
    });
  },

  setActiveRevision: (id: string) => set({ activeRevisionId: id }),
  clearCodeRevisions: () => set({ codeRevisions: [], activeRevisionId: null })
});
