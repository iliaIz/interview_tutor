import React from 'react';
import { normalizePracticeContext } from '@interview-prep/shared';
import { useAppStore } from '../../../store/useAppStore';
import { usePracticeTutorStore } from '../../../store/usePracticeTutorStore';
import { resolveTutorDomain } from '../tutor/TutorDomain';
import { CompassDialogShell } from './CompassDialogShell';
import { resolveCompassDomainKey } from './compassDomains';

export const PracticeCompassSheet: React.FC = () => {
  const activePracticeChallenge = useAppStore((s) => s.activePracticeChallenge);
  const activeTransactionLabScenarioId = useAppStore((s) => s.activeTransactionLabScenarioId);
  const practiceWorkspaceFiles = useAppStore((s) => s.practiceWorkspaceFiles);
  const activeWorkspaceFileIndex = useAppStore((s) => s.activeWorkspaceFileIndex);

  const isCompassOpen = usePracticeTutorStore((s) => s.isCompassOpen);
  const toggleCompass = usePracticeTutorStore((s) => s.toggleCompass);
  const groundRule = usePracticeTutorStore((s) => s.groundRule);
  const exitStealthMode = usePracticeTutorStore((s) => s.exitStealthMode);

  const tutorDomain = resolveTutorDomain({
    category: activePracticeChallenge?.category,
    track: activePracticeChallenge?.track,
    title: activePracticeChallenge?.title,
    hasActiveTxScenario: Boolean(activeTransactionLabScenarioId)
  });

  const compassDomain = resolveCompassDomainKey(tutorDomain);
  const currentFile = practiceWorkspaceFiles[activeWorkspaceFileIndex] || practiceWorkspaceFiles[0];

  return (
    <CompassDialogShell
      isOpen={isCompassOpen}
      onClose={() => toggleCompass(false)}
      domain={compassDomain}
      onGroundRule={(rule) => {
        toggleCompass(false);
        exitStealthMode('tutor');
        const { persona, assistanceLevel } = usePracticeTutorStore.getState();
        const context = normalizePracticeContext({
          kataId: activePracticeChallenge?.id || `${compassDomain}-kata`,
          kataTitle: activePracticeChallenge?.title || 'Practice Challenge',
          kataCategory: activePracticeChallenge?.category || compassDomain,
          kataInstructions: activePracticeChallenge?.instructionsMarkdown || '',
          activeFilePath: currentFile?.path || 'src/main/java/Solution.java',
          activeFileContent: currentFile?.content || '',
          survivingMutants: activePracticeChallenge?.mutants,
          activeCompassRuleId: rule.id,
          persona,
          assistanceLevel
        });
        void groundRule(rule.id, context);
      }}
    />
  );
};
