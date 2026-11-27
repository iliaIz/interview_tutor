/**
 * workbenchLayoutKernel.ts
 * Pure Adaptive Workbench Grid layout solver (Spec 61 SSOT).
 * Zero React/DOM side effects — computes responsive CSS Grid tracks,
 * Mode-Coupled Dock Memory widths, and auto-collapse clamping invariants.
 */

export const WORKBENCH_BOUNDS = {
  MIN_SPEC_WIDTH_PX: 260,
  DEFAULT_SPEC_WIDTH_PX: 390,
  MAX_SPEC_WIDTH_PX: 540,
  SPEC_RAIL_PX: 32,
  MIN_EDITOR_WIDTH_PX: 420,
  HARD_MIN_EDITOR_WIDTH_PX: 360,
  MIN_COPILOT_WIDTH_PX: 320,
  DEFAULT_TUTOR_WIDTH_PX: 380,
  MAX_TUTOR_WIDTH_PX: 560,
  DEFAULT_WHITEBOARD_WIDTH_PX: 520,
  MAX_COPILOT_VIEWPORT_RATIO: 0.65,
  SASH_WIDTH_PX: 6
} as const;

export type WorkbenchPanelKey = 'spec' | 'tutor' | 'whiteboard';

export interface WorkbenchGridInput {
  viewportWidth: number;
  isSpecCollapsed: boolean;
  isDockVisible: boolean;
  rightDockTab: 'tutor' | 'whiteboard';
  isWhiteboardExpanded: boolean;
  specWidthPx: number;
  tutorWidthPx: number;
  whiteboardWidthPx: number;
}

export interface WorkbenchGridTracks {
  specTrack: string;
  editorTrack: string;
  copilotTrack: string;
  resolvedSpecPx: number;
  resolvedCopilotPx: number;
  effectiveSpecCollapsed: boolean;
  editorAvailablePx: number;
  maxSpecPx: number;
  maxCopilotPx: number;
}

export interface ExpandedSpecClampResult {
  specWidthPx: number;
  tutorWidthPx: number;
  whiteboardWidthPx: number;
}

export function clampNumeric(value: number, min: number, max: number): number {
  const safeMax = Math.max(min, max);
  return Math.min(safeMax, Math.max(min, Math.round(value)));
}

export function sanitizeWidthPx(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return Math.round(value);
}

export function computeExpandedWhiteboardWidth(viewportWidth: number): number {
  const safeVp = sanitizeWidthPx(viewportWidth, 1440);
  const ratioCeiling = Math.floor(safeVp * WORKBENCH_BOUNDS.MAX_COPILOT_VIEWPORT_RATIO);
  const hardSpaceCeiling =
    safeVp -
    WORKBENCH_BOUNDS.SPEC_RAIL_PX -
    WORKBENCH_BOUNDS.SASH_WIDTH_PX -
    WORKBENCH_BOUNDS.HARD_MIN_EDITOR_WIDTH_PX;
  const maxAllowed = Math.max(
    WORKBENCH_BOUNDS.MIN_COPILOT_WIDTH_PX,
    Math.min(ratioCeiling, hardSpaceCeiling)
  );
  const target = Math.max(
    WORKBENCH_BOUNDS.DEFAULT_WHITEBOARD_WIDTH_PX,
    Math.round(safeVp * 0.54)
  );
  return clampNumeric(target, WORKBENCH_BOUNDS.MIN_COPILOT_WIDTH_PX, maxAllowed);
}

export function clampPanelWidth(
  panel: WorkbenchPanelKey,
  px: number,
  viewportWidth: number,
  isSpecCollapsed: boolean
): number {
  const safeVp = sanitizeWidthPx(viewportWidth, 1440);
  if (panel === 'spec') {
    const raw = sanitizeWidthPx(px, WORKBENCH_BOUNDS.DEFAULT_SPEC_WIDTH_PX);
    const vpCeiling =
      safeVp -
      WORKBENCH_BOUNDS.HARD_MIN_EDITOR_WIDTH_PX -
      WORKBENCH_BOUNDS.SASH_WIDTH_PX;
    const maxSpec = Math.min(
      WORKBENCH_BOUNDS.MAX_SPEC_WIDTH_PX,
      Math.max(WORKBENCH_BOUNDS.MIN_SPEC_WIDTH_PX, vpCeiling)
    );
    return clampNumeric(raw, WORKBENCH_BOUNDS.MIN_SPEC_WIDTH_PX, maxSpec);
  }

  const ratioCeiling = Math.floor(safeVp * WORKBENCH_BOUNDS.MAX_COPILOT_VIEWPORT_RATIO);
  const leftReserve = isSpecCollapsed
    ? WORKBENCH_BOUNDS.SPEC_RAIL_PX + WORKBENCH_BOUNDS.SASH_WIDTH_PX
    : WORKBENCH_BOUNDS.SPEC_RAIL_PX + WORKBENCH_BOUNDS.SASH_WIDTH_PX;
  const hardSpaceCeiling = Math.max(
    WORKBENCH_BOUNDS.MIN_COPILOT_WIDTH_PX,
    safeVp - leftReserve - WORKBENCH_BOUNDS.HARD_MIN_EDITOR_WIDTH_PX
  );

  if (panel === 'tutor') {
    const raw = sanitizeWidthPx(px, WORKBENCH_BOUNDS.DEFAULT_TUTOR_WIDTH_PX);
    const maxTutor = Math.min(WORKBENCH_BOUNDS.MAX_TUTOR_WIDTH_PX, ratioCeiling, hardSpaceCeiling);
    return clampNumeric(raw, WORKBENCH_BOUNDS.MIN_COPILOT_WIDTH_PX, maxTutor);
  }

  const raw = sanitizeWidthPx(px, WORKBENCH_BOUNDS.DEFAULT_WHITEBOARD_WIDTH_PX);
  const maxWhiteboard = Math.min(ratioCeiling, hardSpaceCeiling);
  return clampNumeric(raw, WORKBENCH_BOUNDS.MIN_COPILOT_WIDTH_PX, maxWhiteboard);
}

/**
 * Bidirectional Spec Re-Expand Clamp:
 * When the user explicitly clicks Spatial Spec Rail / Ctrl+B to open Left Spec while
 * the right dock is wide, trim the active dock width (and only if needed Spec width)
 * so Spec opens cleanly and Editor never drops below MIN_EDITOR_WIDTH_PX (420) / 360.
 */
export function resolveWidthsForExplicitSpecExpand(
  viewportWidth: number,
  rightDockTab: 'tutor' | 'whiteboard',
  isDockVisible: boolean,
  specWidthPx: number,
  tutorWidthPx: number,
  whiteboardWidthPx: number
): ExpandedSpecClampResult {
  const safeVp = sanitizeWidthPx(viewportWidth, 1440);
  let nextSpec = clampPanelWidth('spec', specWidthPx, safeVp, false);
  let nextTutor = clampPanelWidth('tutor', tutorWidthPx, safeVp, false);
  let nextWhiteboard = clampPanelWidth('whiteboard', whiteboardWidthPx, safeVp, false);

  if (!isDockVisible) {
    return { specWidthPx: nextSpec, tutorWidthPx: nextTutor, whiteboardWidthPx: nextWhiteboard };
  }

  const twoSashes = 2 * WORKBENCH_BOUNDS.SASH_WIDTH_PX;
  const currentDock = rightDockTab === 'whiteboard' ? nextWhiteboard : nextTutor;
  const maxCombined = safeVp - twoSashes - WORKBENCH_BOUNDS.MIN_EDITOR_WIDTH_PX;

  if (nextSpec + currentDock > maxCombined) {
    const allowedDock = Math.max(WORKBENCH_BOUNDS.MIN_COPILOT_WIDTH_PX, maxCombined - nextSpec);
    if (rightDockTab === 'whiteboard') {
      nextWhiteboard = Math.min(nextWhiteboard, allowedDock);
    } else {
      nextTutor = Math.min(nextTutor, allowedDock);
    }

    const updatedDock = rightDockTab === 'whiteboard' ? nextWhiteboard : nextTutor;
    if (nextSpec + updatedDock > maxCombined) {
      nextSpec = clampNumeric(
        maxCombined - updatedDock,
        WORKBENCH_BOUNDS.MIN_SPEC_WIDTH_PX,
        WORKBENCH_BOUNDS.MAX_SPEC_WIDTH_PX
      );
    }
  }

  return {
    specWidthPx: nextSpec,
    tutorWidthPx: nextTutor,
    whiteboardWidthPx: nextWhiteboard
  };
}

export function computeWorkbenchGridTracks(input: WorkbenchGridInput): WorkbenchGridTracks {
  const safeVp = sanitizeWidthPx(input.viewportWidth, 1440);
  const requestedSpec = clampPanelWidth('spec', input.specWidthPx, safeVp, input.isSpecCollapsed);
  const editorTrack = `minmax(${WORKBENCH_BOUNDS.HARD_MIN_EDITOR_WIDTH_PX}px, 1fr)`;

  if (!input.isDockVisible) {
    const effectiveSpecCollapsed = input.isSpecCollapsed;
    const maxSpecNoDock = Math.min(
      WORKBENCH_BOUNDS.MAX_SPEC_WIDTH_PX,
      Math.max(
        WORKBENCH_BOUNDS.MIN_SPEC_WIDTH_PX,
        safeVp - WORKBENCH_BOUNDS.HARD_MIN_EDITOR_WIDTH_PX - WORKBENCH_BOUNDS.SASH_WIDTH_PX
      )
    );
    const resolvedSpecPx = effectiveSpecCollapsed
      ? WORKBENCH_BOUNDS.SPEC_RAIL_PX
      : Math.min(requestedSpec, maxSpecNoDock);
    const activeSash = effectiveSpecCollapsed ? 0 : WORKBENCH_BOUNDS.SASH_WIDTH_PX;
    return {
      specTrack: `${resolvedSpecPx}px`,
      editorTrack,
      copilotTrack: '0px',
      resolvedSpecPx,
      resolvedCopilotPx: 0,
      effectiveSpecCollapsed,
      editorAvailablePx: Math.max(0, safeVp - resolvedSpecPx - activeSash),
      maxSpecPx: maxSpecNoDock,
      maxCopilotPx: 0
    };
  }

  const ratioCeiling = Math.floor(safeVp * WORKBENCH_BOUNDS.MAX_COPILOT_VIEWPORT_RATIO);
  const hardMaxCopilotCollapsed = Math.max(
    WORKBENCH_BOUNDS.MIN_COPILOT_WIDTH_PX,
    safeVp - WORKBENCH_BOUNDS.SPEC_RAIL_PX - WORKBENCH_BOUNDS.SASH_WIDTH_PX - WORKBENCH_BOUNDS.HARD_MIN_EDITOR_WIDTH_PX
  );

  const requestedCopilot =
    input.rightDockTab === 'whiteboard'
      ? input.isWhiteboardExpanded
        ? computeExpandedWhiteboardWidth(safeVp)
        : clampPanelWidth('whiteboard', input.whiteboardWidthPx, safeVp, input.isSpecCollapsed)
      : clampPanelWidth('tutor', input.tutorWidthPx, safeVp, input.isSpecCollapsed);

  const twoSashes = 2 * WORKBENCH_BOUNDS.SASH_WIDTH_PX;
  const availableWithOpenSpec = safeVp - requestedSpec - requestedCopilot - twoSashes;
  const shouldAutoCollapseSpec = availableWithOpenSpec < WORKBENCH_BOUNDS.MIN_EDITOR_WIDTH_PX;
  const effectiveSpecCollapsed = input.isSpecCollapsed || shouldAutoCollapseSpec;

  const resolvedSpecPx = effectiveSpecCollapsed
    ? WORKBENCH_BOUNDS.SPEC_RAIL_PX
    : requestedSpec;

  const activeSashes = effectiveSpecCollapsed
    ? WORKBENCH_BOUNDS.SASH_WIDTH_PX
    : twoSashes;

  const dockTypeMax =
    input.rightDockTab === 'tutor'
      ? Math.min(WORKBENCH_BOUNDS.MAX_TUTOR_WIDTH_PX, ratioCeiling)
      : ratioCeiling;

  const maxCopilotPx = Math.max(
    WORKBENCH_BOUNDS.MIN_COPILOT_WIDTH_PX,
    Math.min(
      dockTypeMax,
      safeVp - resolvedSpecPx - activeSashes - WORKBENCH_BOUNDS.HARD_MIN_EDITOR_WIDTH_PX
    )
  );

  // If viewport is narrower than collapsed + min copilot + hard min editor, preserve hard min editor first
  const absoluteMaxCopilot = Math.max(0, safeVp - resolvedSpecPx - activeSashes - WORKBENCH_BOUNDS.HARD_MIN_EDITOR_WIDTH_PX);
  const resolvedCopilotPx =
    absoluteMaxCopilot < WORKBENCH_BOUNDS.MIN_COPILOT_WIDTH_PX
      ? absoluteMaxCopilot
      : clampNumeric(requestedCopilot, WORKBENCH_BOUNDS.MIN_COPILOT_WIDTH_PX, Math.min(maxCopilotPx, hardMaxCopilotCollapsed));

  const maxSpecPx = Math.min(
    WORKBENCH_BOUNDS.MAX_SPEC_WIDTH_PX,
    Math.max(
      WORKBENCH_BOUNDS.MIN_SPEC_WIDTH_PX,
      safeVp - resolvedCopilotPx - twoSashes - WORKBENCH_BOUNDS.HARD_MIN_EDITOR_WIDTH_PX
    )
  );

  return {
    specTrack: `${resolvedSpecPx}px`,
    editorTrack,
    copilotTrack: `${resolvedCopilotPx}px`,
    resolvedSpecPx,
    resolvedCopilotPx,
    effectiveSpecCollapsed,
    editorAvailablePx: Math.max(0, safeVp - resolvedSpecPx - resolvedCopilotPx - activeSashes),
    maxSpecPx,
    maxCopilotPx
  };
}
