/**
 * whiteboardSlice.ts
 * AI Live Whiteboard State & Revision History (10-slot Ring Buffer with Non-Eviction GC).
 * Cognitive Bounding Limit: <= 350 lines (Rule 8 compliant).
 */

import { StateCreator } from 'zustand';

export interface WhiteboardState {
  action: 'write' | 'patch' | 'highlight' | 'clear';
  title?: string;
  language?: string;
  code?: string;
  explanation?: string;
  highlightLines?: number[];
  updatedAt?: number;
}

export interface CodeArtifactRevision {
  id: string;
  index: number;
  title: string;
  language: string;
  code: string;
  explanation?: string;
  highlightLines?: number[];
  timestamp: number;
  author: 'ai' | 'user';
  isPinned?: boolean;
  isIdeTracked?: boolean;
}

export interface ActiveWhiteboardArtifact {
  id: string;
  title: string;
  language: string;
  code: string;
  explanation?: string;
  highlightLines?: number[];
  action?: 'write' | 'patch' | 'highlight' | 'clear';
}

export function pruneCodeRevisionsWithNonEviction(
  allRevs: CodeArtifactRevision[],
  activeIdeRevisionId?: string | null
): CodeArtifactRevision[] {
  if (!Array.isArray(allRevs) || allRevs.length <= 10) return allRevs || [];
  const isProtected = (r: CodeArtifactRevision) =>
    Boolean(r.isPinned || (activeIdeRevisionId && r.id === activeIdeRevisionId));

  const pinned = allRevs.filter(isProtected);
  const unpinned = allRevs.filter((r) => !isProtected(r));
  const retainedUnpinned = unpinned.slice(-10);

  return [...pinned, ...retainedUnpinned].sort((a, b) => a.index - b.index);
}

export function selectActiveWhiteboardArtifact(state: {
  codeRevisions?: CodeArtifactRevision[];
  activeRevisionId?: string | null;
  activeWhiteboardState?: WhiteboardState | null;
}): ActiveWhiteboardArtifact | null {
  const revs = Array.isArray(state?.codeRevisions) ? state.codeRevisions : [];
  if (revs.length > 0) {
    const rev =
      (state?.activeRevisionId ? revs.find((r) => r && r.id === state.activeRevisionId) : null) ||
      revs[revs.length - 1];
    if (rev && typeof rev.code === 'string' && rev.code.trim().length > 0) {
      return {
        id: rev.id || 'rev_active',
        title: rev.title || 'Артефакт кода',
        language: rev.language || 'java',
        code: rev.code,
        explanation: rev.explanation || state?.activeWhiteboardState?.explanation,
        highlightLines: Array.isArray(rev.highlightLines)
          ? rev.highlightLines
          : Array.isArray(state?.activeWhiteboardState?.highlightLines)
          ? state.activeWhiteboardState.highlightLines
          : [],
        action: state?.activeWhiteboardState?.action || 'write'
      };
    }
  }

  const wb = state?.activeWhiteboardState;
  if (wb && typeof wb.code === 'string' && wb.code.trim().length > 0) {
    return {
      id: state?.activeRevisionId || 'initial',
      title: wb.title || 'Демонстрация кода',
      language: wb.language || 'java',
      code: wb.code,
      explanation: wb.explanation,
      highlightLines: Array.isArray(wb.highlightLines) ? wb.highlightLines : [],
      action: wb.action || 'write'
    };
  }

  return null;
}

export interface WhiteboardSlice {
  activeWhiteboardState: WhiteboardState | null;
  isWhiteboardOpen: boolean;
  codeRevisions: CodeArtifactRevision[];
  activeRevisionId: string | null;
  activeIdeRevisionId: string | null;

  setWhiteboardState: (wb: WhiteboardState | null) => void;
  setIsWhiteboardOpen: (open: boolean) => void;
  addCodeRevision: (rev: { title: string; language?: string; code: string; author?: 'ai' | 'user' }) => void;
  setActiveRevision: (id: string) => void;
  setActiveIdeRevisionId: (id: string | null) => void;
  updateIdeTrackedContent: (content: string) => void;
  checkoutRevisionToIde: (revisionId: string) => void;
  clearCodeRevisions: () => void;
}

export const createWhiteboardSlice: StateCreator<any, [], [], WhiteboardSlice> = (set) => ({
  activeWhiteboardState: null,
  isWhiteboardOpen: false,
  codeRevisions: [],
  activeRevisionId: null,
  activeIdeRevisionId: null,

  setWhiteboardState: (wb) => {
    set((state: any) => {
      const newState = {
        activeWhiteboardState: wb,
        isWhiteboardOpen: wb ? (wb.action !== 'clear') : false
      };

      if (wb?.code && wb.code.trim().length > 0) {
        const currentRevs = state.codeRevisions || [];
        const lastRev = currentRevs[currentRevs.length - 1];
        if (!lastRev || lastRev.code !== wb.code) {
          const nextIndex = (lastRev ? lastRev.index : 0) + 1;
          const revId = `rev_${Date.now().toString(36)}_${nextIndex}`;
          const newRev: CodeArtifactRevision = {
            id: revId,
            index: nextIndex,
            title: wb.title || `v${nextIndex}`,
            language: wb.language || 'java',
            code: wb.code,
            explanation: wb.explanation,
            highlightLines: wb.highlightLines,
            timestamp: Date.now(),
            author: 'ai'
          };
          const updatedRevs = pruneCodeRevisionsWithNonEviction([...currentRevs, newRev], state.activeIdeRevisionId);
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

  setIsWhiteboardOpen: (open) => set({ isWhiteboardOpen: open }),

  addCodeRevision: ({ title, language = 'java', code, author = 'ai' }) => {
    if (!code || !code.trim()) return;
    set((state: any) => {
      const currentRevs = state.codeRevisions || [];
      const lastRev = currentRevs[currentRevs.length - 1];
      if (lastRev && lastRev.code === code) return state;

      const nextIndex = (lastRev ? lastRev.index : 0) + 1;
      const revId = `rev_${Date.now().toString(36)}_${nextIndex}`;
      const newRev: CodeArtifactRevision = {
        id: revId,
        index: nextIndex,
        title: title || `v${nextIndex}`,
        language,
        code,
        timestamp: Date.now(),
        author
      };
      const updatedRevs = pruneCodeRevisionsWithNonEviction([...currentRevs, newRev], state.activeIdeRevisionId);
      return {
        codeRevisions: updatedRevs,
        activeRevisionId: revId
      };
    });
  },

  setActiveRevision: (id) => {
    set((state: any) => {
      const revs = state.codeRevisions || [];
      const targetRev = revs.find((r: any) => r.id === id);
      if (!targetRev) {
        return { activeRevisionId: id };
      }
      const updatedWb: WhiteboardState = {
        action: 'write',
        title: targetRev.title,
        language: targetRev.language || 'java',
        code: targetRev.code,
        explanation: targetRev.explanation ?? state.activeWhiteboardState?.explanation,
        highlightLines: targetRev.highlightLines ?? [],
        updatedAt: Date.now()
      };
      return {
        activeRevisionId: id,
        activeWhiteboardState: updatedWb
      };
    });
  },

  setActiveIdeRevisionId: (id) => set({ activeIdeRevisionId: id }),

  updateIdeTrackedContent: (content) => {
    if (typeof content !== 'string') return;
    set((state: any) => {
      const currentRevs = state.codeRevisions || [];
      const trackedId = state.activeIdeRevisionId;
      const existingIdx = trackedId ? currentRevs.findIndex((r: any) => r.id === trackedId) : -1;

      if (existingIdx !== -1) {
        const existing = currentRevs[existingIdx];
        if (existing.code === content) return state;

        const updated = [...currentRevs];
        updated[existingIdx] = {
          ...existing,
          code: content,
          timestamp: Date.now(),
          author: 'user',
          isPinned: true,
          isIdeTracked: true
        };

        const updatedWb: WhiteboardState | null = state.activeRevisionId === trackedId
          ? {
              action: 'write',
              title: existing.title || `v${existing.index}`,
              language: existing.language || 'java',
              code: content,
              updatedAt: Date.now()
            }
          : state.activeWhiteboardState;

        return {
          codeRevisions: updated,
          activeWhiteboardState: updatedWb
        };
      } else {
        const lastRev = currentRevs[currentRevs.length - 1];
        const nextIndex = (lastRev ? lastRev.index : 0) + 1;
        const revId = `rev_${Date.now().toString(36)}_${nextIndex}`;
        const newRev: CodeArtifactRevision = {
          id: revId,
          index: nextIndex,
          title: `v${nextIndex}`,
          language: 'java',
          code: content,
          timestamp: Date.now(),
          author: 'user',
          isPinned: true,
          isIdeTracked: true
        };

        const allRevs = pruneCodeRevisionsWithNonEviction([...currentRevs, newRev], revId);
        const updatedWb: WhiteboardState = {
          action: 'write',
          title: `v${nextIndex}`,
          language: 'java',
          code: content,
          updatedAt: Date.now()
        };

        return {
          codeRevisions: allRevs,
          activeRevisionId: revId,
          activeIdeRevisionId: revId,
          activeWhiteboardState: updatedWb
        };
      }
    });
  },

  checkoutRevisionToIde: (revisionId) => {
    set((state: any) => {
      const revs = state.codeRevisions || [];
      const target = revs.find((r: any) => r.id === revisionId);
      if (!target) return state;

      const updated = revs.map((r: any) => ({
        ...r,
        isIdeTracked: r.id === revisionId,
        isPinned: r.id === revisionId ? true : r.isPinned
      }));

      return {
        codeRevisions: updated,
        activeIdeRevisionId: revisionId,
        activeRevisionId: revisionId
      };
    });
  },

  clearCodeRevisions: () => set({
    codeRevisions: [],
    activeRevisionId: null,
    activeIdeRevisionId: null,
    activeWhiteboardState: null
  })
});
