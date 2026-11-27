/**
 * workbenchDockSlice.ts
 * Spec 61 persisted Workbench Dock layout state & Mode-Coupled Dock Memory.
 * Safely self-heals corrupted localStorage values and works headless in Node tests.
 */

import {
  WORKBENCH_BOUNDS,
  clampPanelWidth,
  resolveWidthsForExplicitSpecExpand,
  sanitizeWidthPx,
  type WorkbenchPanelKey
} from '../../components/practice/arena/workbenchLayoutKernel';

export const WORKBENCH_DOCK_STORAGE_KEY = 'interview_tutor.workbench_dock_layout.v1';

export interface PersistedWorkbenchLayout {
  isSpecCollapsed: boolean;
  isWhiteboardExpanded: boolean;
  specWidthPx: number;
  tutorWidthPx: number;
  whiteboardWidthPx: number;
}

export interface WorkbenchDockStateSlice extends PersistedWorkbenchLayout {
  setSpecCollapsed: (collapsed?: boolean, viewportWidth?: number) => void;
  toggleWhiteboardExpanded: (expanded?: boolean) => void;
  setPanelWidth: (panel: WorkbenchPanelKey, px: number, viewportWidth?: number) => void;
}

export const DEFAULT_WORKBENCH_LAYOUT: PersistedWorkbenchLayout = {
  isSpecCollapsed: false,
  isWhiteboardExpanded: false,
  specWidthPx: WORKBENCH_BOUNDS.DEFAULT_SPEC_WIDTH_PX,
  tutorWidthPx: WORKBENCH_BOUNDS.DEFAULT_TUTOR_WIDTH_PX,
  whiteboardWidthPx: WORKBENCH_BOUNDS.DEFAULT_WHITEBOARD_WIDTH_PX
};

function getSafeViewportWidth(explicitWidth?: number): number {
  if (typeof explicitWidth === 'number' && Number.isFinite(explicitWidth) && explicitWidth > 0) {
    return Math.round(explicitWidth);
  }
  if (typeof window !== 'undefined' && Number.isFinite(window.innerWidth) && window.innerWidth > 0) {
    return Math.round(window.innerWidth);
  }
  return 1440;
}

export function sanitizePersistedWorkbenchLayout(
  raw: Partial<PersistedWorkbenchLayout> | null | undefined,
  viewportWidth?: number
): PersistedWorkbenchLayout {
  const vp = getSafeViewportWidth(viewportWidth);
  const specRaw = sanitizeWidthPx(raw?.specWidthPx, DEFAULT_WORKBENCH_LAYOUT.specWidthPx);
  const tutorRaw = sanitizeWidthPx(raw?.tutorWidthPx, DEFAULT_WORKBENCH_LAYOUT.tutorWidthPx);
  const wbRaw = sanitizeWidthPx(raw?.whiteboardWidthPx, DEFAULT_WORKBENCH_LAYOUT.whiteboardWidthPx);
  const isSpecCollapsed = Boolean(raw?.isSpecCollapsed);
  return {
    isSpecCollapsed,
    isWhiteboardExpanded: Boolean(raw?.isWhiteboardExpanded),
    specWidthPx: clampPanelWidth('spec', specRaw, vp, isSpecCollapsed),
    tutorWidthPx: clampPanelWidth('tutor', tutorRaw, vp, isSpecCollapsed),
    whiteboardWidthPx: clampPanelWidth('whiteboard', wbRaw, vp, isSpecCollapsed)
  };
}

export function readWorkbenchLayoutFromStorage(viewportWidth?: number): PersistedWorkbenchLayout {
  try {
    if (typeof localStorage === 'undefined') {
      return { ...DEFAULT_WORKBENCH_LAYOUT };
    }
    const rawJson = localStorage.getItem(WORKBENCH_DOCK_STORAGE_KEY);
    if (!rawJson) return { ...DEFAULT_WORKBENCH_LAYOUT };
    const parsed = JSON.parse(rawJson) as Partial<PersistedWorkbenchLayout>;
    return sanitizePersistedWorkbenchLayout(parsed, viewportWidth);
  } catch {
    return { ...DEFAULT_WORKBENCH_LAYOUT };
  }
}

export function writeWorkbenchLayoutToStorage(layout: PersistedWorkbenchLayout): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(WORKBENCH_DOCK_STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // Storage quota or private browsing; keep in-memory state intact
  }
}

export function buildWorkbenchDockSlice<
  TState extends WorkbenchDockStateSlice & {
    isOpen: boolean;
    isCopilotStealth: boolean;
    rightDockTab: 'tutor' | 'whiteboard';
  }
>(
  set: (partial: Partial<TState> | ((state: TState) => Partial<TState>)) => void,
  initialViewportWidth?: number
): WorkbenchDockStateSlice {
  const initial = readWorkbenchLayoutFromStorage(initialViewportWidth);

  const persistSnapshot = (state: WorkbenchDockStateSlice) => {
    writeWorkbenchLayoutToStorage({
      isSpecCollapsed: state.isSpecCollapsed,
      isWhiteboardExpanded: state.isWhiteboardExpanded,
      specWidthPx: state.specWidthPx,
      tutorWidthPx: state.tutorWidthPx,
      whiteboardWidthPx: state.whiteboardWidthPx
    });
  };

  return {
    ...initial,

    setSpecCollapsed: (collapsed, viewportWidth) =>
      set((state) => {
        const nextCollapsed = collapsed !== undefined ? collapsed : !state.isSpecCollapsed;
        if (nextCollapsed) {
          const nextState = {
            ...state,
            isSpecCollapsed: true
          };
          persistSnapshot(nextState);
          return { isSpecCollapsed: true } as Partial<TState>;
        }

        const vp = getSafeViewportWidth(viewportWidth);
        const isDockVisible = state.isOpen && !state.isCopilotStealth;
        const resolved = resolveWidthsForExplicitSpecExpand(
          vp,
          state.rightDockTab,
          isDockVisible,
          state.specWidthPx,
          state.tutorWidthPx,
          state.whiteboardWidthPx
        );
        const nextState = {
          ...state,
          isSpecCollapsed: false,
          isWhiteboardExpanded: false,
          specWidthPx: resolved.specWidthPx,
          tutorWidthPx: resolved.tutorWidthPx,
          whiteboardWidthPx: resolved.whiteboardWidthPx
        };
        persistSnapshot(nextState);
        return {
          isSpecCollapsed: false,
          isWhiteboardExpanded: false,
          specWidthPx: resolved.specWidthPx,
          tutorWidthPx: resolved.tutorWidthPx,
          whiteboardWidthPx: resolved.whiteboardWidthPx
        } as Partial<TState>;
      }),

    toggleWhiteboardExpanded: (expanded) =>
      set((state) => {
        const nextExpanded = expanded !== undefined ? expanded : !state.isWhiteboardExpanded;
        const nextState = {
          ...state,
          isWhiteboardExpanded: nextExpanded
        };
        persistSnapshot(nextState);
        return { isWhiteboardExpanded: nextExpanded } as Partial<TState>;
      }),

    setPanelWidth: (panel, px, viewportWidth) =>
      set((state) => {
        const vp = getSafeViewportWidth(viewportWidth);
        const clamped = clampPanelWidth(panel, px, vp, state.isSpecCollapsed);
        const patch: Partial<WorkbenchDockStateSlice> =
          panel === 'spec'
            ? { specWidthPx: clamped }
            : panel === 'tutor'
              ? { tutorWidthPx: clamped }
              : { whiteboardWidthPx: clamped, isWhiteboardExpanded: false };
        persistSnapshot({ ...state, ...patch });
        return patch as Partial<TState>;
      })
  };
}
