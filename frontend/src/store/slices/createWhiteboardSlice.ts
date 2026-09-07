import { StateCreator } from 'zustand';
import { AppState, WhiteboardSlice, WhiteboardState, CodeArtifactRevision } from '../types';

export const createWhiteboardSlice: StateCreator<AppState, [], [], WhiteboardSlice> = (set) => ({
  activeWhiteboardState: null,
  isWhiteboardOpen: false,
  codeRevisions: [],
  activeRevisionId: null,

  setWhiteboardState: (wb: WhiteboardState | null) => {
    set((state) => {
      const newState = {
        activeWhiteboardState: wb,
        isWhiteboardOpen: wb ? (wb.action !== 'clear') : false
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
