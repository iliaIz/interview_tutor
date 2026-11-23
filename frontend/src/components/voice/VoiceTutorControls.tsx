/**
 * VoiceTutorControls.tsx
 * Router between Voice Tutor Lobby and Active HUD.
 * Cognitive Bounding Limit: <= 120 lines (Rule 8 compliant).
 */

import React from 'react';
import { VoiceTutorLobbyView } from './VoiceTutorLobbyView';
import { VoiceTutorActiveHUD, VoiceTutorActiveHUDProps } from './VoiceTutorActiveHUD';
import { InterviewConfig } from '../../types/interviewConfig';

export interface VoiceTutorControlsProps extends VoiceTutorActiveHUDProps {
  stage: 'lobby' | 'active';
  startLiveInterview: () => void;
  systemHealth: { isAiReady: boolean };
  setIsSettingsOpen: (open: boolean) => void;
  interviewConfig: InterviewConfig;
}

export const VoiceTutorControls: React.FC<VoiceTutorControlsProps> = (props) => {
  if (props.stage === 'lobby') {
    return (
      <VoiceTutorLobbyView
        tutorMode={props.tutorMode}
        setTutorMode={props.setTutorMode}
        startLiveInterview={props.startLiveInterview}
        systemHealth={props.systemHealth}
        setIsSettingsOpen={props.setIsSettingsOpen}
        interviewConfig={props.interviewConfig}
      />
    );
  }

  return <VoiceTutorActiveHUD {...props} />;
};
