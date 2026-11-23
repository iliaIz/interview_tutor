import React from 'react';
import { SystemDesignEvaluation } from '../../../types/nextgen';
import { SystemDesignEvaluationModal } from './SystemDesignEvaluationModal';
import { HiringCommitteeVerdictModal } from '../defense/HiringCommitteeVerdictModal';
import { SystemDesignCompassSheet } from '../compass/SystemDesignCompassSheet';
import { VoiceModal } from '../../VoiceModal';
import { TutorMode } from './SystemDesignStaffChatTab';

export interface SystemDesignModalCoordinatorProps {
  evaluationResult: SystemDesignEvaluation | null;
  onCloseEvaluation: () => void;
  hiringCommitteePacket: any | null;
  scenarioTitle: string;
  observations: any[];
  onCloseVerdict: () => void;
  onRetryDefense: () => void;
  isCompassOpen: boolean;
  onCloseCompass: () => void;
  onAskTutorAboutRule: (ruleTitle: string, ruleSummary: string) => void;
  isVoiceTutorOpen: boolean;
  voiceTutorSessionId: string | null;
  onCloseVoiceTutor: () => void;
  problemStatement?: string;
  referenceAnswer?: string;
  tutorMode: TutorMode;
  systemDesignVoicePrompt: string;
}

export const SystemDesignModalCoordinator: React.FC<SystemDesignModalCoordinatorProps> = ({
  evaluationResult,
  onCloseEvaluation,
  hiringCommitteePacket,
  scenarioTitle,
  observations,
  onCloseVerdict,
  onRetryDefense,
  isCompassOpen,
  onCloseCompass,
  onAskTutorAboutRule,
  isVoiceTutorOpen,
  voiceTutorSessionId,
  onCloseVoiceTutor,
  problemStatement,
  referenceAnswer,
  tutorMode,
  systemDesignVoicePrompt
}) => {
  return (
    <>
      {evaluationResult && (
        <SystemDesignEvaluationModal
          evaluationResult={evaluationResult}
          onClose={onCloseEvaluation}
        />
      )}

      {hiringCommitteePacket && (
        <HiringCommitteeVerdictModal
          packet={hiringCommitteePacket}
          scenarioTitle={scenarioTitle}
          observations={observations}
          onClose={onCloseVerdict}
          onRetry={onRetryDefense}
        />
      )}

      <SystemDesignCompassSheet
        isOpen={isCompassOpen}
        onClose={onCloseCompass}
        onAskTutorAboutRule={onAskTutorAboutRule}
      />

      {isVoiceTutorOpen && voiceTutorSessionId && (
        <VoiceModal
          key={voiceTutorSessionId}
          isOpen={isVoiceTutorOpen}
          onClose={onCloseVoiceTutor}
          topic={`System Design: ${scenarioTitle}`}
          currentQuestionText={problemStatement || scenarioTitle}
          referenceAnswer={referenceAnswer}
          initialSessionType="tutor"
          initialTutorMode={tutorMode}
          customPromptOverride={systemDesignVoicePrompt}
        />
      )}
    </>
  );
};
