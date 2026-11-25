import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { SystemDesignEvaluation } from '../../types/nextgen';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { ArchitectureGraphPayload } from '../../types/systemDesignCanvas';
import { CapacityMathCoach } from './CapacityMathCoach';
import { SystemDesignVoiceHUD } from './defense/SystemDesignVoiceHUD';
import { SystemDesignTopBar } from './arena/SystemDesignTopBar';
import { SystemDesignSpecTab } from './arena/SystemDesignSpecTab';
import { SystemDesignArchitectureTab } from './arena/SystemDesignArchitectureTab';
import { SystemDesignStaffChatTab } from './arena/SystemDesignStaffChatTab';
import { SystemDesignModalCoordinator } from './arena/SystemDesignModalCoordinator';
import { useSystemDesignVoiceDefense } from './arena/useSystemDesignVoiceDefense';
import { useSystemDesignDraft } from './arena/useSystemDesignDraft';
import { useSystemDesignStaffChat } from './hooks/useSystemDesignStaffChat';
import { usePracticeTutorStore } from '../../store/usePracticeTutorStore';
import { normalizeSystemDesignContext } from '@interview-prep/shared';

const INITIAL_MERMAID = 'graph TD\n  Client[🌐 Client] --> LB[⚖️ LB] --> Gateway[🚪 Gateway] --> ServiceA[⚙️ Core Service] --> DB[(🗄️ Primary DB)]';

export const SystemDesignArena: React.FC = () => {
  const {
    activeSystemDesignScenario,
    closeSystemDesignScenario,
    showToast,
    academyBreadcrumbContext,
    returnToAcademyStep,
    toggleAcademyStepProgress
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<'spec' | 'architecture' | 'math_coach' | 'staff_ai'>('spec');
  const [architectureMode, setArchitectureMode] = useState<'canvas' | 'mermaid'>('canvas');
  const [canvasPayload, setCanvasPayload] = useState<ArchitectureGraphPayload | null>(null);
  const [isCompassOpen, setIsCompassOpen] = useState(false);

  // Global Hotkey for Compass (Ctrl + /)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        setIsCompassOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const [mermaidCode, setMermaidCode] = useState<string>(
    activeSystemDesignScenario?.initialMermaid || INITIAL_MERMAID
  );
  const [candidateNotes, setCandidateNotes] = useState<string>('');

  // Evaluation & Draft State
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState<SystemDesignEvaluation | null>(null);

  const { isDraftRestored } = useSystemDesignDraft({
    scenarioId: activeSystemDesignScenario?.id,
    onRestore: (sub) => {
      if (sub.canvasTopology) {
        setCanvasPayload(sub.canvasTopology);
        setArchitectureMode('canvas');
      } else if (sub.architectureMermaid) {
        setMermaidCode(sub.architectureMermaid);
        setArchitectureMode('mermaid');
      }
      if (sub.candidateNotes) setCandidateNotes(sub.candidateNotes);
      if (sub.evaluation) setEvaluationResult(sub.evaluation);
    }
  });

  const currentTopology = architectureMode === 'canvas'
    ? (canvasPayload?.architectureMermaid || mermaidCode)
    : mermaidCode;

  // Voice Defense Hook
  const {
    isVoiceConnected,
    isAiSpeaking,
    isRecording,
    isMuted,
    isUserSpeaking,
    isPauseHolding,
    subscribeAudioLevel,
    voiceStatus,
    chaosAlert,
    setChaosAlert,
    observations,
    setObservations,
    hiringCommitteePacket,
    setHiringCommitteePacket,
    toggleMic,
    handleInteraction,
    disconnectVoiceSession,
    handleStartVoiceDefense,
    sendCanvasDelta
  } = useSystemDesignVoiceDefense({
    activeScenario: activeSystemDesignScenario,
    architectureMode,
    canvasPayload,
    mermaidCode,
    candidateNotes,
    showToast
  });

  // Staff AI Chat & Gemini Live Voice Tutor Hook
  const {
    tutorMode,
    setTutorMode,
    chatMessages,
    inputMessage,
    setInputMessage,
    isSendingMessage,
    handleSendMessage,
    isVoiceTutorOpen,
    setIsVoiceTutorOpen,
    voiceTutorSessionId,
    handleStartVoiceTutor,
    systemDesignVoicePrompt
  } = useSystemDesignStaffChat({
    scenario: activeSystemDesignScenario,
    currentTopology,
    candidateNotes,
    isVoiceConnected,
    disconnectVoiceSession,
    showToast
  });

  useBodyScrollLock(Boolean(evaluationResult));

  // Dynamic Omnipresent Copilot Context Streaming (SPEC-13 §4.2.1)
  useEffect(() => {
    if (!activeSystemDesignScenario) return;

    const payload = normalizeSystemDesignContext({
      scenarioId: activeSystemDesignScenario.id,
      scenarioTitle: activeSystemDesignScenario.title,
      targetLevel: activeSystemDesignScenario.target_level,
      activeStudioTab: activeTab,
      topologySummary: currentTopology,
      capacityMathSummary: candidateNotes,
      companyContextName: 'System Design Track'
    });

    usePracticeTutorStore.getState().setActiveContext(payload);
  }, [activeSystemDesignScenario, activeTab, currentTopology, candidateNotes]);

  useEffect(() => {
    return () => {
      const store = usePracticeTutorStore.getState();
      if (store.activeContext?.arena === 'system_design') {
        store.setActiveContext(null);
      }
    };
  }, []);

  if (!activeSystemDesignScenario) return null;

  const handleEvaluate = async () => {
    if (!activeSystemDesignScenario || isEvaluating) return;
    setIsEvaluating(true);

    try {
      const res = await fetch('/api/system-design/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          scenarioId: activeSystemDesignScenario.id,
          conversationHistory: chatMessages,
          architectureMermaid: currentTopology,
          notesMarkdown: candidateNotes,
          canvasTopology: canvasPayload
        })
      });

      if (res.ok) {
        const result: SystemDesignEvaluation = await res.json();
        setEvaluationResult(result);
        if (result.totalScore >= 70 && academyBreadcrumbContext) {
          toggleAcademyStepProgress(
            academyBreadcrumbContext.courseId,
            academyBreadcrumbContext.stepNumber,
            true
          );
        }
      } else {
        showToast({ type: 'error', title: 'Ошибка оценки', message: 'Не удалось получить оценку архитектуры' });
      }
    } catch {
      showToast({ type: 'error', title: 'Сетевая ошибка', message: 'Ошибка связи с сервером' });
    } finally {
      setIsEvaluating(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-4rem)] overflow-hidden bg-pastel-bg text-pastel-text relative font-sans">
      <SystemDesignTopBar
        title={activeSystemDesignScenario.title}
        academyBreadcrumbContext={academyBreadcrumbContext}
        returnToAcademyStep={returnToAcademyStep}
        closeSystemDesignScenario={closeSystemDesignScenario}
        isDraftRestored={isDraftRestored}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenCompass={() => setIsCompassOpen(true)}
        isVoiceConnected={isVoiceConnected}
        onToggleVoiceDefense={() => {
          if (isVoiceConnected) disconnectVoiceSession();
          else void handleStartVoiceDefense();
        }}
        onEvaluate={handleEvaluate}
        isEvaluating={isEvaluating}
      />

      {isVoiceConnected && (
        <div className="px-4 pt-3 shrink-0 z-20">
          <SystemDesignVoiceHUD
            isConnected={isVoiceConnected}
            isAiSpeaking={isAiSpeaking}
            isRecording={isRecording}
            isMuted={isMuted}
            isUserSpeaking={isUserSpeaking}
            isPauseHolding={isPauseHolding}
            subscribeAudioLevel={subscribeAudioLevel}
            statusMessage={voiceStatus}
            chaosAlert={chaosAlert}
            observationCount={observations.length}
            onDismissChaos={() => setChaosAlert(null)}
            onToggleMic={toggleMic}
            onFinishTurn={handleInteraction}
            onDisconnect={disconnectVoiceSession}
            onBargeIn={handleInteraction}
          />
        </div>
      )}

      {/* Main Content Body */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        {activeTab === 'spec' && <SystemDesignSpecTab scenario={activeSystemDesignScenario} />}

        {activeTab === 'math_coach' && (
          <div className="max-w-5xl mx-auto space-y-4">
            <CapacityMathCoach
              onApplyCalculations={(summary) => {
                setCandidateNotes(prev => {
                  const prefix = prev ? prev + '\n\n' : '';
                  return prefix + '### Оценки Capacity Math Coach:\n' + summary;
                });
                showToast({ type: 'success', title: 'Расчеты скопированы', message: 'Оценки добавлены в пояснительную записку' });
                setActiveTab('architecture');
              }}
              onCalculationChange={(calcText) => {
                if (isVoiceConnected) sendCanvasDelta({ mutationSummary: calcText });
              }}
            />
          </div>
        )}

        {activeTab === 'architecture' && (
          <SystemDesignArchitectureTab
            scenarioTitle={activeSystemDesignScenario.title}
            architectureMode={architectureMode}
            setArchitectureMode={setArchitectureMode}
            mermaidCode={mermaidCode}
            setMermaidCode={setMermaidCode}
            candidateNotes={candidateNotes}
            setCandidateNotes={setCandidateNotes}
            onExportPayload={setCanvasPayload}
            onDeicticContextChange={sendCanvasDelta}
          />
        )}

        {activeTab === 'staff_ai' && (
          <SystemDesignStaffChatTab
            targetLevel={activeSystemDesignScenario.target_level}
            tutorMode={tutorMode}
            setTutorMode={setTutorMode}
            chatMessages={chatMessages}
            isSendingMessage={isSendingMessage}
            inputMessage={inputMessage}
            setInputMessage={setInputMessage}
            onSendMessage={handleSendMessage}
            onStartVoiceTutor={handleStartVoiceTutor}
          />
        )}
      </div>

      <SystemDesignModalCoordinator
        evaluationResult={evaluationResult}
        onCloseEvaluation={() => setEvaluationResult(null)}
        hiringCommitteePacket={hiringCommitteePacket}
        scenarioTitle={activeSystemDesignScenario.title}
        observations={observations}
        onCloseVerdict={() => setHiringCommitteePacket(null)}
        onRetryDefense={() => {
          setHiringCommitteePacket(null);
          setChaosAlert(null);
          setObservations([]);
          void handleStartVoiceDefense();
        }}
        isCompassOpen={isCompassOpen}
        onCloseCompass={() => setIsCompassOpen(false)}
        onAskTutorAboutRule={(ruleTitle, ruleSummary) => {
          setIsCompassOpen(false);
          setActiveTab('staff_ai');
          setInputMessage(`Объясните подробнее золотое правило «${ruleTitle}» в контексте нашей системы «${activeSystemDesignScenario.title}»:\n${ruleSummary}`);
        }}
        isVoiceTutorOpen={isVoiceTutorOpen}
        voiceTutorSessionId={voiceTutorSessionId}
        onCloseVoiceTutor={() => {
          setIsVoiceTutorOpen(false);
        }}
        problemStatement={activeSystemDesignScenario.problem_statement}
        referenceAnswer={activeSystemDesignScenario.contextMarkdown}
        tutorMode={tutorMode}
        systemDesignVoicePrompt={systemDesignVoicePrompt}
      />
    </div>
  );
};
