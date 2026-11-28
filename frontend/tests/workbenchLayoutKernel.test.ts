/**
 * workbenchLayoutKernel.test.ts
 * Spec 61 Contract Test Suite:
 * - Adaptive Workbench Grid track computation & proportional viewport clamping
 * - Auto-collapse of Left Spec into 32px rail when Editor drops below 420px
 * - Bidirectional Spec re-expand clamp preserving HARD_MIN_EDITOR_WIDTH_PX (360px)
 * - Mode-Coupled Dock Memory (tutorWidthPx vs whiteboardWidthPx & wide expand toggle)
 * - Corrupted localStorage self-healing & Zustand slice state persistence
 */

import assert from 'assert';
import {
  WORKBENCH_BOUNDS,
  clampPanelWidth,
  computeExpandedWhiteboardWidth,
  computeTwoColumnWorkbenchTracks,
  computeWorkbenchGridTracks,
  resolveWidthsForExplicitSpecExpand
} from '../src/components/practice/arena/workbenchLayoutKernel';
import {
  DEFAULT_WORKBENCH_LAYOUT,
  WORKBENCH_DOCK_STORAGE_KEY,
  readWorkbenchLayoutFromStorage,
  sanitizePersistedWorkbenchLayout
} from '../src/store/slices/workbenchDockSlice';
import { createPracticeTutorStore } from '../src/store/usePracticeTutorStore';
import type { TutorTransportPort } from '../src/store/tutorTransport';

const noopTransport: TutorTransportPort = {
  streamChat: async () => ({ fullText: 'ok', leakDetected: false, similarity: 0 }),
  fetchHint: async () => ({ hintTier: 1, content: 'hint', leakDetected: false }),
  groundRule: async (ruleId) => ({ ruleId, ruleName: ruleId, content: 'rule', leakDetected: false })
};

function runTests(): void {
  console.log('🧪 Running Spec 61 Adaptive Workbench Grid Contract Tests...\n');

  // 1. Standard 1440px layout with Dock hidden & Spec open
  {
    const tracks = computeWorkbenchGridTracks({
      viewportWidth: 1440,
      isSpecCollapsed: false,
      isDockVisible: false,
      rightDockTab: 'tutor',
      isWhiteboardExpanded: false,
      specWidthPx: WORKBENCH_BOUNDS.DEFAULT_SPEC_WIDTH_PX,
      tutorWidthPx: WORKBENCH_BOUNDS.DEFAULT_TUTOR_WIDTH_PX,
      whiteboardWidthPx: WORKBENCH_BOUNDS.DEFAULT_WHITEBOARD_WIDTH_PX
    });
    assert.strictEqual(tracks.effectiveSpecCollapsed, false);
    assert.strictEqual(tracks.specTrack, '390px');
    assert.strictEqual(tracks.copilotTrack, '0px');
    assert.strictEqual(tracks.resolvedCopilotPx, 0);
    assert.ok(tracks.editorAvailablePx >= WORKBENCH_BOUNDS.MIN_EDITOR_WIDTH_PX);
  }

  // 2. Mode-Coupled Dock Memory at 1440px (Tutor 380px vs Whiteboard 520px)
  {
    const tutorTracks = computeWorkbenchGridTracks({
      viewportWidth: 1440,
      isSpecCollapsed: false,
      isDockVisible: true,
      rightDockTab: 'tutor',
      isWhiteboardExpanded: false,
      specWidthPx: 390,
      tutorWidthPx: 380,
      whiteboardWidthPx: 520
    });
    assert.strictEqual(tutorTracks.resolvedCopilotPx, 380);
    assert.strictEqual(tutorTracks.effectiveSpecCollapsed, false, '1440-390-380-12 = 658 >= 420');

    const wbTracks = computeWorkbenchGridTracks({
      viewportWidth: 1440,
      isSpecCollapsed: false,
      isDockVisible: true,
      rightDockTab: 'whiteboard',
      isWhiteboardExpanded: false,
      specWidthPx: 390,
      tutorWidthPx: 380,
      whiteboardWidthPx: 520
    });
    assert.strictEqual(wbTracks.resolvedCopilotPx, 520);
    assert.strictEqual(wbTracks.effectiveSpecCollapsed, false, '1440-390-520-12 = 518 >= 420');
  }

  // 3. Expanded Доска ИИ triggers Spec Auto-Collapse when Editor < 420px
  {
    const expandedW = computeExpandedWhiteboardWidth(1440);
    assert.ok(expandedW >= 690 && expandedW <= Math.floor(1440 * WORKBENCH_BOUNDS.MAX_COPILOT_VIEWPORT_RATIO));

    const tracks = computeWorkbenchGridTracks({
      viewportWidth: 1440,
      isSpecCollapsed: false,
      isDockVisible: true,
      rightDockTab: 'whiteboard',
      isWhiteboardExpanded: true,
      specWidthPx: 390,
      tutorWidthPx: 380,
      whiteboardWidthPx: 520
    });
    assert.strictEqual(tracks.effectiveSpecCollapsed, true);
    assert.strictEqual(tracks.resolvedSpecPx, WORKBENCH_BOUNDS.SPEC_RAIL_PX);
    assert.ok(tracks.editorAvailablePx >= WORKBENCH_BOUNDS.HARD_MIN_EDITOR_WIDTH_PX);
  }

  // 4. 1280px & 1024px clamping guarantees Editor >= 360px
  for (const vp of [1280, 1024]) {
    const expanded = computeWorkbenchGridTracks({
      viewportWidth: vp,
      isSpecCollapsed: false,
      isDockVisible: true,
      rightDockTab: 'whiteboard',
      isWhiteboardExpanded: true,
      specWidthPx: 390,
      tutorWidthPx: 380,
      whiteboardWidthPx: 520
    });
    assert.strictEqual(expanded.effectiveSpecCollapsed, true, `Auto-collapses Spec at ${vp}px when wide`);
    assert.ok(
      expanded.editorAvailablePx >= WORKBENCH_BOUNDS.HARD_MIN_EDITOR_WIDTH_PX,
      `Editor ${expanded.editorAvailablePx} >= 360 at ${vp}px`
    );

    const reExpanded = resolveWidthsForExplicitSpecExpand(vp, 'whiteboard', true, 390, 380, 690);
    const reExpandedTracks = computeWorkbenchGridTracks({
      viewportWidth: vp,
      isSpecCollapsed: false,
      isDockVisible: true,
      rightDockTab: 'whiteboard',
      isWhiteboardExpanded: false,
      ...reExpanded
    });
    assert.strictEqual(reExpandedTracks.effectiveSpecCollapsed, false, `Explicit Spec re-expand succeeds at ${vp}px`);
    assert.ok(
      reExpandedTracks.editorAvailablePx >= WORKBENCH_BOUNDS.HARD_MIN_EDITOR_WIDTH_PX,
      `Editor >= 360 after Spec re-expand at ${vp}px`
    );
  }

  // 5. clampPanelWidth bounds check
  assert.strictEqual(clampPanelWidth('spec', 100, 1440, false), WORKBENCH_BOUNDS.MIN_SPEC_WIDTH_PX);
  assert.strictEqual(clampPanelWidth('spec', 900, 1440, false), WORKBENCH_BOUNDS.MAX_SPEC_WIDTH_PX);
  assert.strictEqual(clampPanelWidth('tutor', 100, 1440, false), WORKBENCH_BOUNDS.MIN_COPILOT_WIDTH_PX);
  assert.strictEqual(clampPanelWidth('tutor', 900, 1440, false), WORKBENCH_BOUNDS.MAX_TUTOR_WIDTH_PX);
  assert.strictEqual(
    clampPanelWidth('whiteboard', 1200, 1440, true),
    Math.floor(1440 * WORKBENCH_BOUNDS.MAX_COPILOT_VIEWPORT_RATIO)
  );

  // 6. Corrupted storage self-healing & Zustand slice state tests
  {
    const healed = sanitizePersistedWorkbenchLayout(
      {
        isSpecCollapsed: true,
        isWhiteboardExpanded: false,
        specWidthPx: -500,
        tutorWidthPx: Number.NaN,
        whiteboardWidthPx: 99999
      },
      1440
    );
    assert.strictEqual(healed.isSpecCollapsed, true);
    assert.strictEqual(healed.specWidthPx, DEFAULT_WORKBENCH_LAYOUT.specWidthPx);
    assert.strictEqual(healed.tutorWidthPx, DEFAULT_WORKBENCH_LAYOUT.tutorWidthPx);
    assert.strictEqual(healed.whiteboardWidthPx, Math.floor(1440 * WORKBENCH_BOUNDS.MAX_COPILOT_VIEWPORT_RATIO));

    const fakeStorage = new Map<string, string>();
    (globalThis as Record<string, unknown>).localStorage = {
      getItem: (k: string) => fakeStorage.get(k) ?? null,
      setItem: (k: string, v: string) => {
        fakeStorage.set(k, v);
      },
      removeItem: (k: string) => {
        fakeStorage.delete(k);
      }
    };
    fakeStorage.set(WORKBENCH_DOCK_STORAGE_KEY, '{corrupt json');
    assert.deepStrictEqual(readWorkbenchLayoutFromStorage(1440), DEFAULT_WORKBENCH_LAYOUT);

    const store = createPracticeTutorStore(noopTransport);
    store.getState().setPanelWidth('tutor', 440, 1440);
    store.getState().setPanelWidth('whiteboard', 640, 1440);
    assert.strictEqual(store.getState().tutorWidthPx, 440);
    assert.strictEqual(store.getState().whiteboardWidthPx, 640);

    store.getState().toggleWhiteboardExpanded(true);
    assert.strictEqual(store.getState().isWhiteboardExpanded, true);
    store.getState().toggleOpen(true);
    store.getState().setRightDockTab('whiteboard');
    store.getState().setSpecCollapsed(false, 1280);
    assert.strictEqual(store.getState().isSpecCollapsed, false);
    assert.strictEqual(store.getState().isWhiteboardExpanded, false);

    delete (globalThis as Record<string, unknown>).localStorage;
  }

  // 7. Spec 62: 2-Column Bug Hunt / Code Review layout invariants
  {
    const tracks = computeTwoColumnWorkbenchTracks({
      viewportWidth: 1440,
      isDockVisible: true,
      rightDockTab: 'tutor',
      isWhiteboardExpanded: false,
      tutorWidthPx: 380,
      whiteboardWidthPx: 520
    });
    assert.strictEqual(tracks.resolvedCopilotPx, 380);
    assert.ok(tracks.primaryAvailablePx >= WORKBENCH_BOUNDS.MIN_EDITOR_WIDTH_PX);

    const stealth = computeTwoColumnWorkbenchTracks({
      viewportWidth: 1440,
      isDockVisible: false,
      rightDockTab: 'tutor',
      isWhiteboardExpanded: false,
      tutorWidthPx: 380,
      whiteboardWidthPx: 520
    });
    assert.strictEqual(stealth.resolvedCopilotPx, 0);
    assert.strictEqual(stealth.copilotTrack, '0px');
    assert.strictEqual(stealth.primaryAvailablePx, 1440);

    const expanded1024 = computeTwoColumnWorkbenchTracks({
      viewportWidth: 1024,
      isDockVisible: true,
      rightDockTab: 'whiteboard',
      isWhiteboardExpanded: true,
      tutorWidthPx: 380,
      whiteboardWidthPx: 900
    });
    assert.ok(expanded1024.resolvedCopilotPx <= Math.floor(1024 * WORKBENCH_BOUNDS.MAX_COPILOT_VIEWPORT_RATIO));
    assert.ok(expanded1024.primaryAvailablePx >= WORKBENCH_BOUNDS.HARD_MIN_EDITOR_WIDTH_PX);
  }

  console.log('✅ All Spec 61 & Spec 62 Adaptive Workbench Grid contract tests passed!');
}

runTests();
