import React from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { TestingCompassSheet } from './TestingCompassSheet';
import { LldCompassSheet } from './LldCompassSheet';

export const PracticeCompassSheet: React.FC = () => {
  const { activePracticeChallenge } = useAppStore();

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

  return <TestingCompassSheet />;
};
