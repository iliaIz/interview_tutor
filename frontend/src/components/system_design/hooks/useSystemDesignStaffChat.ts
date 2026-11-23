import { useState, useMemo, useCallback } from 'react';
import { TutorMode } from '../arena/SystemDesignStaffChatTab';
import { buildSystemDesignVoicePrompt } from '../arena/systemDesignVoicePrompt';

export interface UseSystemDesignStaffChatProps {
  scenario: any;
  currentTopology: string;
  candidateNotes: string;
  isVoiceConnected: boolean;
  disconnectVoiceSession: () => void;
  showToast: (toast: { type: 'success' | 'error' | 'warning' | 'info'; title: string; message: string }) => void;
}

export interface UseSystemDesignStaffChatReturn {
  tutorMode: TutorMode;
  setTutorMode: (mode: TutorMode) => void;
  chatMessages: Array<{ role: 'user' | 'assistant'; content: string }>;
  inputMessage: string;
  setInputMessage: (val: string) => void;
  isSendingMessage: boolean;
  handleSendMessage: (textOverride?: string) => Promise<void>;
  isVoiceTutorOpen: boolean;
  setIsVoiceTutorOpen: (open: boolean) => void;
  voiceTutorSessionId: string | null;
  handleStartVoiceTutor: () => void;
  systemDesignVoicePrompt: string;
}

export function useSystemDesignStaffChat(props: UseSystemDesignStaffChatProps): UseSystemDesignStaffChatReturn {
  const {
    scenario,
    currentTopology,
    candidateNotes,
    isVoiceConnected,
    disconnectVoiceSession,
    showToast
  } = props;

  const defaultMode = useMemo<TutorMode>(() => {
    const lvl = scenario?.target_level;
    if (lvl === 'L3_JUNIOR') return 'eli5';
    if (lvl === 'L4_MIDDLE') return 'socratic';
    return 'deep_dive';
  }, [scenario?.target_level]);

  const [tutorMode, setTutorMode] = useState<TutorMode>(defaultMode);
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([
    {
      role: 'assistant',
      content: `Здравствуйте! Я Staff-интервьюер по System Design. Расскажите, как вы планируете построить архитектуру для «${scenario?.title || 'этого сервиса'}»? С каких ключевых компонентов вы начнете?`
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);

  const [isVoiceTutorOpen, setIsVoiceTutorOpen] = useState(false);
  const [voiceTutorSessionId, setVoiceTutorSessionId] = useState<string | null>(null);

  const handleStartVoiceTutor = useCallback(() => {
    if (!scenario) return;
    if (isVoiceConnected) disconnectVoiceSession();
    setVoiceTutorSessionId(`voice_sd_tutor_${scenario.id}_${Date.now()}`);
    setIsVoiceTutorOpen(true);
  }, [scenario, isVoiceConnected, disconnectVoiceSession]);

  const systemDesignVoicePrompt = useMemo(() => {
    return buildSystemDesignVoicePrompt(scenario, currentTopology, candidateNotes);
  }, [scenario, currentTopology, candidateNotes]);

  const handleSendMessage = useCallback(
    async (textOverride?: string) => {
      const userMsg = (textOverride || inputMessage).trim();
      if (!userMsg || isSendingMessage || !scenario) return;
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
            scenarioId: scenario.id,
            userMessage: userMsg,
            mode: tutorMode,
            conversationHistory: updatedChat.slice(-6),
            currentTopology,
            candidateNotes
          })
        });

        if (res.ok) {
          const data = await res.json();
          setChatMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
        } else {
          showToast({ type: 'error', title: 'Ошибка AI', message: 'Не удалось получить ответ от Staff AI' });
        }
      } catch {
        showToast({ type: 'error', title: 'Сетевая ошибка', message: 'Ошибка связи с сервером' });
      } finally {
        setIsSendingMessage(false);
      }
    },
    [inputMessage, isSendingMessage, scenario, chatMessages, tutorMode, currentTopology, candidateNotes, showToast]
  );

  return {
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
  };
}
