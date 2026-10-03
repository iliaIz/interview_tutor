import React from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { usePracticeTutorStore } from '../../../store/usePracticeTutorStore';
import { TestingCompassSheet } from './TestingCompassSheet';
import { LldCompassSheet } from './LldCompassSheet';
import { TransactionCompassSheet } from './TransactionCompassSheet';
import { ConcurrencyCompassSheet } from './ConcurrencyCompassSheet';
import { RefactoringCompassSheet } from './RefactoringCompassSheet';

export const PracticeCompassSheet: React.FC = () => {
  const { activePracticeChallenge, activeTransactionLabScenarioId } = useAppStore();
  const { isCompassOpen, toggleCompass } = usePracticeTutorStore();

  if (activeTransactionLabScenarioId) {
    return (
      <TransactionCompassSheet
        isOpen={isCompassOpen}
        onClose={() => toggleCompass(false)}
      />
    );
  }

  const category = (activePracticeChallenge?.category || '').toLowerCase();
  const track = (activePracticeChallenge?.track || '').toLowerCase();
  const title = (activePracticeChallenge?.title || '').toLowerCase();

  const isConcurrency =
    category.includes('concurrency') ||
    track.includes('concurrency') ||
    category.includes('deadlock') ||
    title.includes('deadlock') ||
    title.includes('virtual-thread') ||
    title.includes('ringbuffer') ||
    title.includes('barrier') ||
    title.includes('awaitility') ||
    title.includes('loom');

  if (isConcurrency) {
    return <ConcurrencyCompassSheet />;
  }

  const isRefactoring =
    category.includes('refactoring') ||
    track.includes('refactoring') ||
    category.includes('legacy') ||
    title.includes('trip-service') ||
    title.includes('gilded-rose') ||
    title.includes('legacy-invoice') ||
    title.includes('legacy-tax') ||
    title.includes('overloaded-constructor');

  if (isRefactoring) {
    return <RefactoringCompassSheet />;
  }

  const isLld =
    category.includes('lld') ||
    track.includes('lld') ||
    category.includes('machine coding') ||
    category.includes('java21') ||
    track.includes('java21') ||
    title.includes('rate limiter') ||
    title.includes('matching engine') ||
    title.includes('parking lot') ||
    title.includes('cache') ||
    title.includes('sliding window');

  if (isLld) {
    return <LldCompassSheet />;
  }

  if (category.includes('transaction') || track.includes('transaction')) {
    return (
      <TransactionCompassSheet
        isOpen={isCompassOpen}
        onClose={() => toggleCompass(false)}
      />
    );
  }

  return <TestingCompassSheet />;
};

