import React, { useState, useMemo, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { SystemDesignEvaluation } from '../../types/nextgen';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { ArchitectureGraphPayload } from '../../types/systemDesignCanvas';
import { CapacityMathCoach } from './CapacityMathCoach';
import { SystemDesignCompassSheet } from './compass/SystemDesignCompassSheet';
import { SystemDesignVoiceHUD } from './defense/SystemDesignVoiceHUD';
import { HiringCommitteeVerdictModal } from './defense/HiringCommitteeVerdictModal';
import { VoiceModal } from '../VoiceModal';
import { SystemDesignTopBar } from './arena/SystemDesignTopBar';
import { SystemDesignSpecTab } from './arena/SystemDesignSpecTab';
import { SystemDesignArchitectureTab } from './arena/SystemDesignArchitectureTab';
import { SystemDesignStaffChatTab, TutorMode } from './arena/SystemDesignStaffChatTab';
import { SystemDesignEvaluationModal } from './arena/SystemDesignEvaluationModal';
import { useSystemDesignVoiceDefense } from './arena/useSystemDesignVoiceDefense';
import { useSystemDesignDraft } from './arena/useSystemDesignDraft';
import { buildSystemDesignVoicePrompt } from './arena/systemDesignVoicePrompt';
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

  const defaultMode = useMemo<TutorMode>(() => {
    const lvl = activeSystemDesignScenario?.target_level;
    if (lvl === 'L3_JUNIOR') return 'eli5';
    if (lvl === 'L4_MIDDLE') return 'socratic';
    return 'deep_dive';
  }, [activeSystemDesignScenario?.target_level]);

  const [tutorMode, setTutorMode] = useState<TutorMode>(defaultMode);
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([
    {
      role: 'assistant',
      content: `Здравствуйте! Я Staff-интервьюер по System Design. Расскажите, как вы планируете построить архитектуру для «${activeSystemDesignScenario?.title || 'этого сервиса'}»? С каких ключевых компонентов вы начнете?`
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);

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

  // Voice Defense Hook
  const {
    isVoiceConnected,
    isAiSpeaking,
    isRecording,
    isMuted,
    isUserSpeaking,
    isPauseHolding,
    rmsDb,
    voiceStatus,
    chaosAlert,
    setChaosAlert,
    observations,
    setObservations,
    hiringCommitteePacket,
    setHiringCommitteePacket,
    toggleMic,
    finishManualTurn,
    disconnectVoiceSession,
    handleStartVoiceDefense,
    sendCanvasDelta,
    playoutManagerRef
  } = useSystemDesignVoiceDefense({
    activeScenario: activeSystemDesignScenario,
    architectureMode,
    canvasPayload,
    mermaidCode,
    candidateNotes,
    showToast
  });

  // Gemini Live Voice Tutor State
  const [isVoiceTutorOpen, setIsVoiceTutorOpen] = useState(false);
  const [voiceTutorSessionId, setVoiceTutorSessionId] = useState<string | null>(null);

  const handleStartVoiceTutor = () => {
    if (!activeSystemDesignScenario) return;
    if (isVoiceConnected) disconnectVoiceSession();
    setVoiceTutorSessionId(`voice_sd_tutor_${activeSystemDesignScenario.id}_${Date.now()}`);
    setIsVoiceTutorOpen(true);
  };

  const currentTopology = architectureMode === 'canvas'
    ? (canvasPayload?.architectureMermaid || mermaidCode)
    : mermaidCode;

  const systemDesignVoicePrompt = useMemo(() => {
    return buildSystemDesignVoicePrompt(activeSystemDesignScenario, currentTopology, candidateNotes);
  }, [activeSystemDesignScenario, currentTopology, candidateNotes]);

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

  const handleSendMessage = async (textOverride?: string) => {
    const userMsg = (textOverride || inputMessage).trim();
    if (!userMsg || isSendingMessage) return;
    if (!textOverride) setInputMessage('');
    
    const updatedChat = [...chatMessages, { role: 'user' as const, content: userMsg }];
    setChatMessages(updatedChat);
    setIsSendingMessage(true);

    try {
      const res = await fetch('/api/system-design/probe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          scenarioId: activeSystemDesignScenario.id,
          userMessage: userMsg,
          mode: tutorMode,
          conversationHistory: updatedChat.slice(-6),
          currentTopology,
          candidateNotes
        })
      });

      if (res.ok) {
        const data = await res.json();
        setChatMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
      } else {
        showToast({ type: 'error', title: 'Ошибка AI', message: 'Не удалось получить ответ от Staff AI' });
      }
    } catch {
      showToast({ type: 'error', title: 'Сетевая ошибка', message: 'Ошибка связи с сервером' });
    } finally {
      setIsSendingMessage(false);
    }
  };

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
            rmsDb={rmsDb}
            statusMessage={voiceStatus}
            chaosAlert={chaosAlert}
            observationCount={observations.length}
            onDismissChaos={() => setChaosAlert(null)}
            onToggleMic={toggleMic}
            onFinishTurn={finishManualTurn}
            onDisconnect={disconnectVoiceSession}
            onBargeIn={() => {
              if (isAiSpeaking && playoutManagerRef.current) {
                playoutManagerRef.current.handleInterruption();
              }
            }}
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

      {evaluationResult && (
        <SystemDesignEvaluationModal
          evaluationResult={evaluationResult}
          onClose={() => setEvaluationResult(null)}
        />
      )}

      {hiringCommitteePacket && (
        <HiringCommitteeVerdictModal
          packet={hiringCommitteePacket}
          scenarioTitle={activeSystemDesignScenario.title}
          observations={observations}
          onClose={() => setHiringCommitteePacket(null)}
          onRetry={() => {
            setHiringCommitteePacket(null);
            setChaosAlert(null);
            setObservations([]);
            void handleStartVoiceDefense();
          }}
        />
      )}

      <SystemDesignCompassSheet
        isOpen={isCompassOpen}
        onClose={() => setIsCompassOpen(false)}
        onAskTutorAboutRule={(ruleTitle, ruleSummary) => {
          setIsCompassOpen(false);
          setActiveTab('staff_ai');
          setInputMessage(`Объясните подробнее золотое правило «${ruleTitle}» в контексте нашей системы «${activeSystemDesignScenario.title}»:\n${ruleSummary}`);
        }}
      />

      {isVoiceTutorOpen && voiceTutorSessionId && activeSystemDesignScenario && (
        <VoiceModal
          key={voiceTutorSessionId}
          isOpen={isVoiceTutorOpen}
          onClose={() => {
            setIsVoiceTutorOpen(false);
            setVoiceTutorSessionId(null);
          }}
          topic={`System Design: ${activeSystemDesignScenario.title}`}
          currentQuestionText={activeSystemDesignScenario.problem_statement || activeSystemDesignScenario.title}
          referenceAnswer={activeSystemDesignScenario.contextMarkdown}
          initialSessionType="tutor"
          initialTutorMode={tutorMode}
          customPromptOverride={systemDesignVoicePrompt}
        />
      )}
    </div>
  );
};
