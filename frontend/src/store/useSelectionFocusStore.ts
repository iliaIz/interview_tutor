import { create } from 'zustand';

export interface SelectionFocus {
  zone: 'question' | 'reference_answer' | 'code' | 'term' | 'incident' | 'hint' | 'terminal';
  text: string;
  revisionIndex?: number;
  revisionTitle?: string;
  revisionId?: string;
  fileName?: string;
  startLine?: number;
  endLine?: number;
  language?: string;
  timestamp: number;
}

interface SelectionFocusState {
  activeFocus: SelectionFocus | null;
  setFocus: (focus: SelectionFocus | null) => void;
  clearFocus: () => void;
}

export const useSelectionFocusStore = create<SelectionFocusState>((set) => ({
  activeFocus: null,
  setFocus: (focus) => set({ activeFocus: focus }),
  clearFocus: () => set({ activeFocus: null })
}));
