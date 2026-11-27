import React from 'react';
import { CompassDialogShell } from './CompassDialogShell';

interface TransactionCompassSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onAskTutorAboutRule?: (ruleTitle: string, ruleSummary: string) => void;
}

export const TransactionCompassSheet: React.FC<TransactionCompassSheetProps> = ({
  isOpen,
  onClose,
  onAskTutorAboutRule
}) => {
  return (
    <CompassDialogShell
      isOpen={isOpen}
      onClose={onClose}
      domain="transaction"
      onGroundRule={(rule) => {
        onClose();
        onAskTutorAboutRule?.(rule.title, rule.shortFormula);
      }}
    />
  );
};
