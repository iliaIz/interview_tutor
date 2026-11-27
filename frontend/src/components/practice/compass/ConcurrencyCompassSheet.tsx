import React from 'react';
import { normalizePracticeContext } from '@interview-prep/shared';
import { usePracticeTutorStore } from '../../../store/usePracticeTutorStore';
import { useAppStore } from '../../../store/useAppStore';
import { CompassDialogShell } from './CompassDialogShell';

export const ConcurrencyCompassSheet: React.FC = () => {
  const isCompassOpen = usePracticeTutorStore((s) => s.isCompassOpen);
  const toggleCompass = usePracticeTutorStore((s) => s.toggleCompass);
  const groundRule = usePracticeTutorStore((s) => s.groundRule);
  const exitStealthMode = usePracticeTutorStore((s) => s.exitStealthMode);
  const activePracticeChallenge = useAppStore((s) => s.activePracticeChallenge);
  const practiceWorkspaceFiles = useAppStore((s) => s.practiceWorkspaceFiles);
  const activeWorkspaceFileIndex = useAppStore((s) => s.activeWorkspaceFileIndex);

  const currentFile = practiceWorkspaceFiles[activeWorkspaceFileIndex] || practiceWorkspaceFiles[0];

  return (
    <CompassDialogShell
      isOpen={isCompassOpen}
      onClose={() => toggleCompass(false)}
      domain="concurrency"
      onGroundRule={(rule) => {
        toggleCompass(false);
        exitStealthMode('tutor');
        const { persona, assistanceLevel } = usePracticeTutorStore.getState();
        void groundRule(
          rule.id,
          normalizePracticeContext({
            kataId: activePracticeChallenge?.id || 'concurrency',
            kataTitle: activePracticeChallenge?.title || 'Concurrency & Loom Challenge',
            kataCategory: 'Concurrency Lab',
            kataInstructions: activePracticeChallenge?.instructionsMarkdown || '',
            activeFilePath: currentFile?.path || 'src/main/java/ConcurrentService.java',
            activeFileContent: currentFile?.content || '',
            activeCompassRuleId: rule.id,
            persona,
            assistanceLevel
          })
        );
      }}
    />
  );
};
