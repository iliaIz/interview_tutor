import React from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { usePracticeTutorStore } from '../../../store/usePracticeTutorStore';
import { resolveTutorDomain } from '../tutor/TutorDomain';
import { TestingCompassSheet } from './TestingCompassSheet';
import { LldCompassSheet } from './LldCompassSheet';
import { TransactionCompassSheet } from './TransactionCompassSheet';
import { ConcurrencyCompassSheet } from './ConcurrencyCompassSheet';
import { RefactoringCompassSheet } from './RefactoringCompassSheet';

export const PracticeCompassSheet: React.FC = () => {
  const { activePracticeChallenge, activeTransactionLabScenarioId } = useAppStore();
  const { isCompassOpen, toggleCompass } = usePracticeTutorStore();

  const domain = resolveTutorDomain({
    category: activePracticeChallenge?.category,
    track: activePracticeChallenge?.track,
    title: activePracticeChallenge?.title,
    hasActiveTxScenario: !!activeTransactionLabScenarioId,
  });

  switch (domain) {
    case 'transactions':
      return (
        <TransactionCompassSheet
          isOpen={isCompassOpen}
          onClose={() => toggleCompass(false)}
        />
      );
    case 'concurrency':
      return <ConcurrencyCompassSheet />;
    case 'refactoring':
      return <RefactoringCompassSheet />;
    case 'lld':
    case 'java21':
      return <LldCompassSheet />;
    case 'testing':
    default:
      return <TestingCompassSheet />;
  }
};

