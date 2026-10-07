import React, { useState, useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { java } from '@codemirror/lang-java';
import { Lock } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useSelectionFocusStore } from '../../store/useSelectionFocusStore';
import { usePracticeVoice } from './tutor/PracticeVoiceContext';
import { evaluateAstRules } from '../../utils/astRules';
import { luxuryPastelTheme } from './editorTheme';
import { createJavaSnippetsExtension } from './javaSnippets';
import { useWorkspaceRunner } from './useWorkspaceRunner';
import { WorkspaceHeaderBar } from './WorkspaceHeaderBar';
import { WorkspaceFooterBar } from './WorkspaceFooterBar';
import { GoldenMasterDiffViewer } from './GoldenMasterDiffViewer';
import { SandboxTestConsole } from './SandboxTestConsole';

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

  const runner = useWorkspaceRunner();
  const currentFile = practiceWorkspaceFiles[activeWorkspaceFileIndex] || practiceWorkspaceFiles[0];

  // Notify Live Voice Co-Pilot when candidate switches between project files
  React.useEffect(() => {
    if (isVoiceConnected && injectActiveFocusGroundingFrame) {
      injectActiveFocusGroundingFrame();
    }
  }, [activeWorkspaceFileIndex, isVoiceConnected, injectActiveFocusGroundingFrame]);

  // Evaluate AST architectural rules against current code in real time
  const liveAstViolations = useMemo(() => {
    if (!currentFile || !currentFile.content) return [];
    return evaluateAstRules(currentFile.content, activePracticeChallenge?.astRules || []);
  }, [currentFile?.content, activePracticeChallenge?.astRules]);

  // Editor extensions with Java language & JUnit 5 / AssertJ autocomplete
  const editorExtensions = useMemo(() => {
    return [java(), createJavaSnippetsExtension()];
  }, []);

  if (!currentFile || !activePracticeChallenge) return null;

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 relative">
      {/* 1. File Tabs & Status Header */}
      <WorkspaceHeaderBar
        lastSavedTime={runner.lastSavedTime}
        syncStatus={runner.syncStatus}
        onResetWorkspace={runner.handleResetWorkspace}
      />

      {/* 2. CodeMirror 6 Editor Body with Ctrl+Enter shortcut */}
      <div
        className="flex-1 flex overflow-hidden relative font-mono text-xs"
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            runner.handleRunSandbox();
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
              syncEditorCode(value, currentFile.path.split('/').pop() || currentFile.path, 'java', false);
            }
          }}
        />

        {currentFile.readOnly && (
          <div className="absolute top-3 right-5 bg-slate-900/90 text-slate-400 text-[10px] font-bold px-2.5 py-1 rounded-md border border-slate-700 pointer-events-none flex items-center gap-1.5 shadow-md z-10">
            <Lock className="w-3 h-3 text-amber-400" /> Контракт (Read-Only)
          </div>
        )}
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

      {/* 4. Action Footer Bar */}
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
