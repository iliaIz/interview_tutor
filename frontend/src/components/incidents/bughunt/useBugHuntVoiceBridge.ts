import { useState, useRef, useCallback } from 'react';
import { useLiveVoiceSession, DialogueTurn } from '../../../audio/useLiveVoiceSession';
import { BugChallenge } from '../../BugChallengeCard';
import { TutorRole } from './BugHuntVoiceMentor';

export interface BugHuntVoiceMentorController {
  tutorRole: TutorRole;
  onSelectTutorRole: (role: TutorRole) => void;
  isMuted: boolean;
  toggleMute: () => void;
  isConnected: boolean;
  isAiSpeaking: boolean;
  isRecording: boolean;
  isPauseHolding: boolean;
  isUserSpeaking: boolean;
  dialogueTurns: DialogueTurn[];
  inputText: string;
  setInputText: (text: string) => void;
  handleSendBugText: (textToSend?: string) => void;
  toggleMic: () => void;
  startBugVoiceSession: () => void;
}

export interface UseBugHuntVoiceBridgeProps {
  topicName: string;
  challenge: BugChallenge | null;
  onBugSolved: () => void;
}

export interface UseBugHuntVoiceBridgeReturn {
  controller: BugHuntVoiceMentorController;
  isConnected: boolean;
  disconnectSession: () => void;
  startBugVoiceSession: (targetChallenge?: BugChallenge | null) => void;
}

export function useBugHuntVoiceBridge(props: UseBugHuntVoiceBridgeProps): UseBugHuntVoiceBridgeReturn {
  const { topicName, challenge, onBugSolved } = props;

  const [tutorRole, setTutorRole] = useState<TutorRole>('bug_hunt');
  const [inputText, setInputText] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const visitedChallengesRef = useRef<Set<string>>(new Set());

  const {
    state: voiceState,
    metrics: voiceMetrics,
    statusMessage: _voiceStatus,
    dialogueTurns,
    connect: startSession,
    disconnect: disconnectSession,
    toggleMic: toggleVoiceMic
  } = useLiveVoiceSession({
    enableGlobalSelection: true,
    onBugSolved
  });

  const isConnected = voiceState !== 'IDLE' && voiceState !== 'ERROR' && voiceState !== 'COMPLETED';
  const isAiSpeaking = voiceState === 'AI_SPEAKING';
  const isRecording = voiceState === 'LISTENING';
  const isUserSpeaking = voiceMetrics.vadActive;
  const isPauseHolding = voiceState === 'AI_THINKING' || voiceState === 'COMMITTING';

  const toggleMic = useCallback(() => {
    setIsMuted((prev) => !prev);
    toggleVoiceMic();
  }, [toggleVoiceMic]);

  const toggleMute = toggleMic;

  const startBugVoiceSession = useCallback(
    (targetChallenge?: BugChallenge | null) => {
      const ch = targetChallenge || challenge;
      if (!ch) return;

      const chId = ch.id;
      const isRevisit = visitedChallengesRef.current.has(chId);
      visitedChallengesRef.current.add(chId);

      const bridgeMessage = isRevisit
        ? `[ВОЗВРАТ К ПРЕДЫДУЩЕМУ КЕЙСУ «${ch.title}»]: Кандидат вернулся назад к этой задаче. Кратко (1 предложение в доброжелательной манере напарника) напомни, какую гипотезу мы обсуждали, и спроси, готов ли он продолжить.`
        : undefined;

      return startSession({
        sessionType: 'tutor',
        tutorMode: tutorRole,
        topic: topicName,
        bugTitle: ch.title || '',
        bugExplanation: ch.bugExplanation || '',
        codeSnippet: ch.codeSnippet || '',
        fixedCode: ch.fixedCode || '',
        unitTest: ch.testSuite || '',
        incidentContext: ch.productionContext
          ? {
              systemName: ch.productionContext.systemName,
              architectureType: ch.productionContext.architectureType,
              incidentSymptoms: ch.productionContext.incidentSymptoms,
              businessImpact: ch.productionContext.businessImpact,
              prReviewContext: ch.productionContext.prReviewContext
            }
          : undefined,
        hints: ch.hints || [],
        questionId: chId,
        sessionId: chId ? `session_bughunt_${chId}` : undefined,
        initialUserMessage: bridgeMessage
      });
    },
    [challenge, startSession, topicName, tutorRole]
  );

  const handleSendBugText = useCallback(
    (textToSend?: string) => {
      const text = (textToSend !== undefined ? textToSend : inputText).trim();
      if (!text) return;

      if (!isConnected) {
        void startBugVoiceSession();
      }
      setInputText('');
    },
    [inputText, isConnected, startBugVoiceSession]
  );

  const onSelectTutorRole = useCallback(
    (role: TutorRole) => {
      setTutorRole(role);
      disconnectSession();
    },
    [disconnectSession]
  );

  const controller: BugHuntVoiceMentorController = {
    tutorRole,
    onSelectTutorRole,
    isMuted,
    toggleMute,
    isConnected,
    isAiSpeaking,
    isRecording,
    isPauseHolding,
    isUserSpeaking,
    dialogueTurns,
    inputText,
    setInputText,
    handleSendBugText,
    toggleMic,
    startBugVoiceSession: () => void startBugVoiceSession()
  };

  return {
    controller,
    isConnected,
    disconnectSession,
    startBugVoiceSession
  };
}
