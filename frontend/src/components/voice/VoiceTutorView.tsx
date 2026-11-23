/**
 * VoiceTutorView.tsx
 * Slim coordinator component for split-screen Voice Tutor view.
 * Cognitive Bounding Limit: <= 200 lines (Rule 8 compliant).
 */

import React from 'react';
import { BookOpen, Mic } from 'lucide-react';
import { DialogueTurn } from '../../audio/useLiveVoiceSession';
import { InterviewConfig } from '../../types/interviewConfig';
import { useVoiceTutorSession } from '../../audio/useVoiceTutorSession';
import { VoiceTutorTheoryPanel } from './VoiceTutorTheoryPanel';
import { VoiceTutorControls } from './VoiceTutorControls';

export interface VoiceTutorViewProps {
  stage: 'lobby' | 'active';
  activeTopic: string;
  activeQuestionNum: number;
  activeBatchIndex: number;
  totalQuestions: number;
  isBatchMode: boolean;
  activeQuestionText: string;
  activeReferenceAnswer?: string;
  tutorMode: 'deep_dive' | 'socratic' | 'eli5' | 'free_chat';
  setTutorMode: (mode: 'deep_dive' | 'socratic' | 'eli5' | 'free_chat') => void;
  startLiveInterview: () => void;
  systemHealth: { isAiReady: boolean };
  setIsSettingsOpen: (open: boolean) => void;
  interviewConfig: InterviewConfig;
  isAiSpeaking: boolean;
  isThinking: boolean;
  thinkingStage: 'critical' | 'delayed' | 'idle' | 'processing';
  isRecording: boolean;
  isUserSpeaking: boolean;
  isPauseHolding: boolean;
  rmsDb: number;
  onInterruption: () => void;
  triggerEndTurn: () => void;
  toggleMic: () => void;
  dialogueTurns: DialogueTurn[];
  inputText?: string;
  setInputText?: (text: string) => void;
  handleInputKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  handleSendCustomText?: (text?: string) => void;
  isMuted: boolean;
  toggleMute: () => void;
  retryCurrentQuestionCleanly: () => void;
  onClose: () => void;
  onSwitchToInterview: () => void;
  textInputRef?: React.RefObject<HTMLInputElement>;
  isSessionPaused?: boolean;
  onToggleSessionPause?: () => void;
  onSwitchQuestion?: (newIndex: number) => void;
}

export const VoiceTutorView: React.FC<VoiceTutorViewProps> = (props) => {
  const {
    stage,
    activeTopic,
    activeQuestionNum,
    activeBatchIndex,
    totalQuestions,
    isBatchMode,
    activeQuestionText,
    activeReferenceAnswer,
    tutorMode,
    setTutorMode,
    startLiveInterview,
    systemHealth,
    setIsSettingsOpen,
    interviewConfig,
    isAiSpeaking,
    isThinking,
    thinkingStage,
    isRecording,
    isUserSpeaking,
    isPauseHolding,
    rmsDb,
    onInterruption,
    triggerEndTurn,
    toggleMic,
    dialogueTurns,
    isMuted,
    toggleMute,
    retryCurrentQuestionCleanly,
    onClose,
    onSwitchToInterview,
    isSessionPaused,
    onToggleSessionPause,
    onSwitchQuestion
  } = props;

  const session = useVoiceTutorSession({
    isBatchMode,
    totalQuestions,
    activeBatchIndex,
    onSwitchQuestion,
    onSendCustomText: props.handleSendCustomText
  });

  const effectiveInputText = props.inputText !== undefined ? props.inputText : session.inputText;
  const effectiveSetInputText = props.setInputText || session.setInputText;
  const effectiveInputKeyDown = props.handleInputKeyDown || session.handleInputKeyDown;
  const effectiveSendCustomText = props.handleSendCustomText || session.handleSendText;
  const effectiveTextInputRef = props.textInputRef || session.textInputRef;

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden my-2">
      {/* Mobile Segmented Navigation Tabs (< lg) */}
      <div className="lg:hidden flex items-center p-1 rounded-2xl bg-slate-100/90 border border-pastel-border/80 mb-2 shrink-0">
        <button
          type="button"
          onClick={() => session.setMobileActiveTab('theory')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
            session.mobileActiveTab === 'theory'
              ? 'bg-white text-pastel-accentViolet shadow-xs border border-pastel-accentViolet/20'
              : 'text-pastel-muted hover:text-pastel-text'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Материал и ответ</span>
        </button>
        <button
          type="button"
          onClick={() => session.setMobileActiveTab('tutor')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer relative ${
            session.mobileActiveTab === 'tutor'
              ? 'bg-white text-pastel-accentRose shadow-xs border border-pastel-accentRose/20'
              : 'text-pastel-muted hover:text-pastel-text'
          }`}
        >
          <Mic className="w-3.5 h-3.5" />
          <span>AI-Тьютор</span>
          {(isAiSpeaking || isUserSpeaking || isRecording) && (
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse ml-0.5" />
          )}
        </button>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-0 overflow-hidden">
        {/* Left Panel: Study Material & Reference Theory */}
        <div className={`lg:col-span-7 flex flex-col min-h-0 ${session.mobileActiveTab === 'theory' ? 'flex-1 flex' : 'hidden lg:flex'}`}>
          <VoiceTutorTheoryPanel
            isBatchMode={isBatchMode}
            activeBatchIndex={activeBatchIndex}
            totalQuestions={totalQuestions}
            activeQuestionNum={activeQuestionNum}
            activeTopic={activeTopic}
            activeQuestionText={activeQuestionText}
            activeReferenceAnswer={activeReferenceAnswer}
            onSwitchQuestion={onSwitchQuestion}
            activeFocus={session.activeFocus}
            setFocus={session.setFocus}
            clearFocus={session.clearFocus}
            isAiSpeaking={isAiSpeaking}
            isRecording={isRecording}
            isUserSpeaking={isUserSpeaking}
            onSwitchToTutorTab={() => session.setMobileActiveTab('tutor')}
          />
        </div>

        {/* Right Panel: Voice Tutor HUD */}
        <div className={`lg:col-span-5 flex flex-col min-h-0 ${session.mobileActiveTab === 'tutor' ? 'flex-1 flex' : 'hidden lg:flex'}`}>
          <VoiceTutorControls
            stage={stage}
            tutorMode={tutorMode}
            setTutorMode={setTutorMode}
            startLiveInterview={startLiveInterview}
            systemHealth={systemHealth}
            setIsSettingsOpen={setIsSettingsOpen}
            interviewConfig={interviewConfig}
            isAiSpeaking={isAiSpeaking}
            isThinking={isThinking}
            thinkingStage={thinkingStage}
            isRecording={isRecording}
            isUserSpeaking={isUserSpeaking}
            isPauseHolding={isPauseHolding}
            rmsDb={rmsDb}
            onInterruption={onInterruption}
            triggerEndTurn={triggerEndTurn}
            toggleMic={toggleMic}
            dialogueTurns={dialogueTurns}
            inputText={effectiveInputText}
            setInputText={effectiveSetInputText}
            handleInputKeyDown={effectiveInputKeyDown}
            handleSendCustomText={effectiveSendCustomText}
            isMuted={isMuted}
            toggleMute={toggleMute}
            retryCurrentQuestionCleanly={retryCurrentQuestionCleanly}
            onClose={onClose}
            onSwitchToInterview={onSwitchToInterview}
            textInputRef={effectiveTextInputRef}
            isSessionPaused={isSessionPaused}
            onToggleSessionPause={onToggleSessionPause}
            activeFocus={session.activeFocus}
            clearFocus={session.clearFocus}
          />
        </div>
      </div>
    </div>
  );
};
