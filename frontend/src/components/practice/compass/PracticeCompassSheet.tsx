import React from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { usePracticeTutorStore } from '../../../store/usePracticeTutorStore';
import { TestingCompassSheet } from './TestingCompassSheet';
import { LldCompassSheet } from './LldCompassSheet';
import { TransactionCompassSheet } from './TransactionCompassSheet';

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

  const isLld =
    category.includes('lld') ||
    track.includes('lld') ||
    category.includes('machine coding') ||
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

