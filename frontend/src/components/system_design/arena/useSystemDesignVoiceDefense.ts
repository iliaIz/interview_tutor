import { useState, useRef, useEffect, useCallback } from 'react';
import { useLiveVoiceSession } from '../../../audio/useLiveVoiceSession';
import { fastHashCode } from '../../../services/DeicticGroundingManager';
import { HiringCommitteePacket } from '../defense/HiringCommitteeVerdictModal';
import { ArchitectureGraphPayload } from '../../../types/systemDesignCanvas';

interface UseSystemDesignVoiceDefenseProps {
  activeScenario: any;
  architectureMode: 'canvas' | 'mermaid';
  canvasPayload: ArchitectureGraphPayload | null;
  mermaidCode: string;
  candidateNotes: string;
  showToast: (toast: { type: 'success' | 'error' | 'info'; title: string; message: string }) => void;
}

export function useSystemDesignVoiceDefense({
  activeScenario,
  architectureMode,
  canvasPayload,
  mermaidCode,
  candidateNotes,
  showToast
}: UseSystemDesignVoiceDefenseProps) {
  const [chaosAlert, setChaosAlert] = useState<{ failureType: string; targetId: string; context: string } | null>(null);
  const [observations, setObservations] = useState<Array<{ dimension?: string; signal?: string; demonstrated_level?: string; evidence_transcript?: string }>>([]);
  const [hiringCommitteePacket, setHiringCommitteePacket] = useState<HiringCommitteePacket | null>(null);

  const {
    isConnected: isVoiceConnected,
    isAiSpeaking,
    isRecording,
    isMuted,
    isUserSpeaking,
    isPauseHolding,
    rmsDb,
    statusMessage: voiceStatus,
    startSession: startVoiceSession,
    disconnectSession: disconnectVoiceSession,
    toggleMic,
    finishManualTurn,
    sendCanvasDelta,
    handleBargeIn
  } = useLiveVoiceSession({
    getActiveCode: () => {
      return architectureMode === 'canvas'
        ? (canvasPayload?.architectureMermaid || mermaidCode)
        : mermaidCode;
    },
    getActiveFileName: () => 'architecture.mmd',
    enableGlobalSelection: true,
    onChaosInjected: (payload) => {
      setChaosAlert({
        failureType: payload.failureType,
        targetId: payload.targetComponentId,
        context: payload.technicalContext
      });
      showToast({
        type: 'error',
        title: `🔥 Chaos Injected: ${payload.failureType}`,
        message: `Узел: ${payload.targetComponentId}. ${payload.technicalContext}`
      });
    },
    onCandidateObservationRecorded: (obs) => {
      setObservations((prev) => [obs, ...prev]);
    },
    onHiringCommitteeVerdict: (data) => {
      if (data.packet) setHiringCommitteePacket(data.packet);
    },
    onError: (err) => showToast({ type: 'error', title: 'Ошибка голосовой сессии', message: err })
  });

  const handleStartVoiceDefense = useCallback(async () => {
    if (!activeScenario) return;
    try {
      const currentTopology = architectureMode === 'canvas'
        ? (canvasPayload?.architectureMermaid || mermaidCode)
        : mermaidCode;

      await startVoiceSession({
        sessionType: 'system_design',
        topic: activeScenario.title,
        questionText: activeScenario.title,
        referenceAnswer: activeScenario.contextMarkdown,
        scenarioId: activeScenario.id,
        codeSnippet: currentTopology,
        customPrompt: candidateNotes.trim()
          ? `=== ПОЯСНИТЕЛЬНАЯ ЗАПИСКА КАНДИДАТА ПО АРХИТЕКТУРЕ ===\n${candidateNotes.trim()}\n`
          : undefined
      });
      showToast({
        type: 'success',
        title: 'Защита начата',
        message: 'Соединение с Principal Bar-Raiser установлено'
      });
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Ошибка соединения',
        message: err?.message || 'Не удалось запустить Live сессию'
      });
    }
  }, [activeScenario, architectureMode, canvasPayload, mermaidCode, candidateNotes, startVoiceSession, showToast]);

  // In-Flight Grounding of Mermaid Code & Candidate Design Notes
  const lastSyncedMermaidHashRef = useRef<string>('');
  const lastSyncedNotesHashRef = useRef<string>('');
  const arenaSyncTimerRef = useRef<any>(null);

  useEffect(() => {
    if (!isVoiceConnected) return;
    if (arenaSyncTimerRef.current) clearTimeout(arenaSyncTimerRef.current);

    arenaSyncTimerRef.current = setTimeout(() => {
      if (architectureMode === 'mermaid' && mermaidCode) {
        const mHash = fastHashCode(mermaidCode);
        if (mHash !== lastSyncedMermaidHashRef.current) {
          lastSyncedMermaidHashRef.current = mHash;
          sendCanvasDelta({
            mutationSummary: `[АКТУАЛЬНЫЙ MERMAID КОД ТОПОЛОГИИ]:\n\`\`\`mermaid\n${mermaidCode}\n\`\`\``,
            architectureMermaid: mermaidCode
          });
        }
      }

      if (candidateNotes) {
        const nHash = fastHashCode(candidateNotes);
        if (nHash !== lastSyncedNotesHashRef.current) {
          lastSyncedNotesHashRef.current = nHash;
          sendCanvasDelta({
            mutationSummary: `📝 [ПОЯСНИТЕЛЬНАЯ ЗАПИСКА КАНДИДАТА]:\n${candidateNotes}`
          });
        }
      }
    }, 1200);

    return () => {
      if (arenaSyncTimerRef.current) clearTimeout(arenaSyncTimerRef.current);
    };
  }, [isVoiceConnected, architectureMode, mermaidCode, candidateNotes, sendCanvasDelta]);

  return {
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
    handleBargeIn
  };
}
