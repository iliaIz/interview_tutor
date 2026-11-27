import React, { useState, useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { java } from '@codemirror/lang-java';
import { EditorView } from '@codemirror/view';
import { useAppStore } from '../../store/useAppStore';
import { useSelectionFocusStore } from '../../store/useSelectionFocusStore';
import { usePracticeVoice } from './tutor/PracticeVoiceContext';
import { evaluateAstRules, filterActiveAstViolations } from '../../utils/astRules';
import { luxuryPastelTheme } from './editorTheme';
import { createJavaSnippetsExtension } from './javaSnippets';
import { useWorkspaceRunner } from './useWorkspaceRunner';
import { WorkspaceHeaderBar } from './WorkspaceHeaderBar';
import { WorkspaceFooterBar } from './WorkspaceFooterBar';
import { GoldenMasterDiffViewer } from './GoldenMasterDiffViewer';
import { SandboxTestConsole } from './SandboxTestConsole';
import { ReviewProgressConsole } from './ReviewProgressConsole';

/**
 * WorkspaceEditor.tsx (SOTA Late 2026 Decomposed).
 * Single responsibility: editor layout, CodeMirror coordinator, and arena orchestrator.
 * Cognitive bounding limit: <= 350 lines.
 */
export const WorkspaceEditor: React.FC = () => {
  const {
    activePracticeChallenge,
    practiceWorkspaceFiles,
    activeWorkspaceFileIndex,
    updateWorkspaceFileContent,
    isPracticeEvaluating
  } = useAppStore();

  const {
    isConnected: isVoiceConnected,
    syncEditorCode,
    injectActiveFocusGroundingFrame
  } = usePracticeVoice();

  const [isDiffOpen, setIsDiffOpen] = useState(false);
  const [manualSaveBanner, setManualSaveBanner] = useState(false);

  const runner = useWorkspaceRunner();
  const currentFile = practiceWorkspaceFiles[activeWorkspaceFileIndex] || practiceWorkspaceFiles[0];

  // Notify Live Voice Co-Pilot when candidate switches between project files
  React.useEffect(() => {
    if (isVoiceConnected && injectActiveFocusGroundingFrame) {
      injectActiveFocusGroundingFrame();
    }
  }, [activeWorkspaceFileIndex, isVoiceConnected, injectActiveFocusGroundingFrame]);

  // Evaluate AST architectural rules against current code in real time (only active violations)
  const liveAstViolations = useMemo(() => {
    if (!currentFile || !currentFile.content) return [];
    return filterActiveAstViolations(
      evaluateAstRules(currentFile.content, activePracticeChallenge?.astRules || [])
    );
  }, [currentFile?.content, activePracticeChallenge?.astRules]);

  // Editor extensions with Java language, JUnit 5 autocomplete & accessible label
  const editorExtensions = useMemo(() => {
    const fileName = currentFile?.path?.split('/').pop() || 'Solution.java';
    return [
      java(),
      createJavaSnippetsExtension(),
      EditorView.contentAttributes.of({
        'aria-label': `Редактор Java кода: ${fileName}`
      })
    ];
  }, [currentFile?.path]);

  if (!currentFile || !activePracticeChallenge) return null;

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full bg-slate-950 text-slate-100 relative">
      {/* 1. File Tabs & Status Header */}
      <WorkspaceHeaderBar
        lastSavedTime={runner.lastSavedTime}
        syncStatus={runner.syncStatus}
        manualSaveBanner={manualSaveBanner}
      />

      {/* 2. CodeMirror 6 Editor Body with Ctrl+Enter & Ctrl+S shortcuts */}
      <div
        className="flex-1 min-h-0 flex overflow-hidden relative font-mono text-xs"
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            runner.handleRunSandbox();
          } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
            e.preventDefault();
            setManualSaveBanner(true);
            setTimeout(() => setManualSaveBanner(false), 1800);
            void runner.handleSaveDraft();
          }
        }}
      >
        <CodeMirror
          value={currentFile.content}
          height="100%"
          className="w-full h-full custom-codemirror-container"
          theme={luxuryPastelTheme}
          extensions={editorExtensions}
          readOnly={currentFile.readOnly}
          editable={!currentFile.readOnly}
          indentWithTab={true}
          basicSetup={{
            lineNumbers: true,
            highlightActiveLineGutter: true,
            highlightSpecialChars: true,
            history: true,
            foldGutter: true,
            drawSelection: true,
            dropCursor: true,
            allowMultipleSelections: true,
            indentOnInput: true,
            syntaxHighlighting: true,
            bracketMatching: true,
            closeBrackets: true,
            autocompletion: true,
            rectangularSelection: true,
            crosshairCursor: true,
            highlightActiveLine: true,
            highlightSelectionMatches: true,
            closeBracketsKeymap: true,
            defaultKeymap: true,
            searchKeymap: true,
            historyKeymap: true,
            foldKeymap: true,
            completionKeymap: true,
            lintKeymap: true
          }}
          onUpdate={(viewUpdate) => {
            if (viewUpdate.selectionSet) {
              const main = viewUpdate.state.selection.main;
              if (!main.empty) {
                const doc = viewUpdate.state.doc;
                const text = doc.sliceString(main.from, main.to).trim();
                if (text.length >= 2) {
                  const startLine = doc.lineAt(main.from).number;
                  const endLine = doc.lineAt(main.to).number;
                  useSelectionFocusStore.getState().setFocus({
                    zone: 'code',
                    text,
                    fileName: currentFile.path.split('/').pop() || currentFile.path,
                    language: 'java',
                    startLine: Math.min(startLine, endLine),
                    endLine: Math.max(startLine, endLine),
                    timestamp: Date.now()
                  });
                }
              }
            }
          }}
          onChange={(value) => {
            updateWorkspaceFileContent(activeWorkspaceFileIndex, value);
            if (isVoiceConnected && syncEditorCode) {
              syncEditorCode(value, currentFile.path, 'java', false);
            }
          }}
        />
      </div>

      {/* 3. Slide-Up In-Memory Sandbox Test Console (< 80ms) */}
      <SandboxTestConsole
        result={runner.sandboxResult}
        mutationResult={runner.mutationResult}
        isRunning={runner.isSandboxRunning}
        onClose={() => {
          runner.setSandboxResult(null);
          runner.setMutationResult(null);
        }}
        requiredMutationScore={activePracticeChallenge.requiredMutationScore || 85}
      />

      {/* 4. Slide-Up Senior AI Review Progress Console & Stepper */}
      <ReviewProgressConsole
        isOpen={runner.evalPipeline.isConsoleOpen}
        isEvaluating={runner.evalPipeline.isEvaluating}
        currentStage={runner.evalPipeline.currentStage}
        evaluationTimer={runner.evalPipeline.evaluationTimer}
        stepperState={runner.evalPipeline.stepperState}
        reviewLogs={runner.evalPipeline.reviewLogs}
        activeError={runner.evalPipeline.activeError}
        onClose={() => runner.evalPipeline.setIsConsoleOpen(false)}
        onAbort={runner.evalPipeline.handleAbortEvaluation}
        onRetry={() => runner.evalPipeline.handleStartEvaluation()}
      />

      {/* 5. Action Footer Bar */}
      <WorkspaceFooterBar
        hasGoldenMaster={Boolean(activePracticeChallenge.goldenMasterConfig?.enabled)}
        onOpenDiff={() => setIsDiffOpen(true)}
        onSaveDraft={runner.handleSaveDraft}
        onResetWorkspace={runner.handleResetWorkspace}
        isSavingDraft={runner.isSavingDraft}
        isSandboxRunning={runner.isSandboxRunning}
        isPracticeEvaluating={isPracticeEvaluating}
        isWriteTheTestsMode={runner.isWriteTheTestsMode}
        liveAstViolations={liveAstViolations}
        evaluationStage={runner.evaluationStage}
        evaluationTimer={runner.evaluationTimer}
        onRunSandbox={runner.handleRunSandbox}
        onStartEvaluation={runner.handleStartEvaluation}
        onToggleReviewConsole={() => runner.evalPipeline.setIsConsoleOpen(!runner.evalPipeline.isConsoleOpen)}
      />

      {/* 5. Golden Master Diff Modal */}
      {activePracticeChallenge.goldenMasterConfig && (
        <GoldenMasterDiffViewer
          config={activePracticeChallenge.goldenMasterConfig}
          isOpen={isDiffOpen}
          onClose={() => setIsDiffOpen(false)}
        />
      )}
    </div>
  );
};
