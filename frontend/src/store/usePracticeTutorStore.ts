import { create } from 'zustand';
import { TutorActiveContext } from '@interview-prep/shared';
import { MutantDefinition } from '../types/practice';
import { TutorDomain } from '../components/practice/tutor/TutorDomain';
import { getDomainWelcomeMessage } from '../components/practice/tutor/tutorWelcomeMessages';
import {
  TutorContextInput,
  streamTutorChat,
  fetchTutorHint,
  fetchTutorRuleGrounding
} from './tutorTransport';

export type TutorPersona =
  | 'junior_explainer'
  | 'middle_scaffold'
  | 'senior_socratic'
  | 'faang_interviewer'
  | 'company_interviewer';

export interface TutorMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  leakDetected?: boolean;
  similarity?: number;
}

export interface PracticeTutorContextPayload {
  kataId: string;
  kataTitle: string;
  kataCategory: string;
  kataInstructions: string;
  activeFilePath: string;
  activeFileContent: string;
  selectedCodeSnippet?: string;
  cursorLine?: number;
  cursorColumn?: number;
  survivingMutants?: MutantDefinition[];
  compilerError?: string;
  testFailureMessage?: string;
  activeCompassRuleId?: string;
  activeWhiteboardSnippet?: {
    title: string;
    code: string;
    language: string;
  };
  workspaceManifest?: any;
  academyBridgeContext?: {
    courseId?: string;
    stepId?: string;
    moduleTitle?: string;
    learningObjective?: string;
    targetConcepts?: string[];
  };
}

export interface PracticeTutorState {
  isOpen: boolean;
  isCompassOpen: boolean;
  activeCompassRuleId: string | null;
  modality: 'text' | 'voice';
  persona: TutorPersona;
  assistanceLevel: number;
  messages: TutorMessage[];
  isLoading: boolean;
  currentStreamingText: string;
  abortController: AbortController | null;

  // Polymorphic Active Context (Pillar 11 Hub-and-Spoke)
  activeContext: TutorActiveContext | null;

  // Actions
  toggleOpen: (open?: boolean) => void;
  toggleCompass: (open?: boolean) => void;
  setActiveCompassRuleId: (ruleId: string | null) => void;
  setModality: (modality: 'text' | 'voice') => void;
  setPersona: (persona: TutorPersona) => void;
  setAssistanceLevel: (level: number) => void;
  setActiveContext: (context: TutorActiveContext | null) => void;
  clearMessages: () => void;
  initChallengeContext: (domain: TutorDomain, challengeTitle?: string) => void;
  abortGeneration: () => void;

  sendMessage: (text: string, context?: TutorContextInput) => Promise<void>;
  requestHint: (hintTier: number, context?: TutorContextInput) => Promise<void>;
  groundRule: (ruleId: string, context?: TutorContextInput) => Promise<void>;
}

export const usePracticeTutorStore = create<PracticeTutorState>((set, get) => ({
  isOpen: false,
  isCompassOpen: false,
  activeCompassRuleId: null,
  modality: 'text',
  persona: 'middle_scaffold',
  assistanceLevel: 2,
  messages: [
    {
      id: 'welcome',
      role: 'assistant',
      content: getDomainWelcomeMessage('testing'),
      timestamp: Date.now()
    }
  ],
  isLoading: false,
  currentStreamingText: '',
  abortController: null,
  activeContext: null,

  toggleOpen: (open) => set((state) => ({ isOpen: open !== undefined ? open : !state.isOpen })),
  toggleCompass: (open) => set((state) => ({ isCompassOpen: open !== undefined ? open : !state.isCompassOpen })),
  setActiveCompassRuleId: (ruleId) => set({ activeCompassRuleId: ruleId }),
  setModality: (modality) => set({ modality }),
  setPersona: (persona) => set({ persona }),
  setActiveContext: (activeContext) => set({ activeContext }),

  setAssistanceLevel: (level) => {
    let persona: TutorPersona = 'middle_scaffold';
    if (level === 1) persona = 'junior_explainer';
    else if (level === 2) persona = 'middle_scaffold';
    else if (level === 3) persona = 'senior_socratic';
    else if (level === 4) persona = 'faang_interviewer';
    set({ assistanceLevel: level, persona });
  },

  initChallengeContext: (domain: TutorDomain, challengeTitle?: string) => {
    const welcome = getDomainWelcomeMessage(domain, challengeTitle);
    set({
      messages: [
        {
          id: `welcome_${Date.now()}`,
          role: 'assistant',
          content: welcome,
          timestamp: Date.now()
        }
      ],
      currentStreamingText: '',
      isLoading: false
    });
  },

  clearMessages: () =>
    set({
      messages: [
        {
          id: `welcome_${Date.now()}`,
          role: 'assistant',
          content: 'История очищена. Задай новый вопрос по коду или выбери быструю подсказку!',
          timestamp: Date.now()
        }
      ]
    }),

  abortGeneration: () => {
    const { abortController } = get();
    if (abortController) {
      abortController.abort();
      set({ abortController: null, isLoading: false, currentStreamingText: '' });
    }
  },

  sendMessage: async (text: string, context?: TutorContextInput) => {
    const { persona, assistanceLevel, messages, activeContext, abortGeneration } = get();
    abortGeneration();

    const targetContext = context || activeContext || undefined;
    const userMessage: TutorMessage = {
      id: `usr_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now()
    };

    const newMessages = [...messages, userMessage];
    set({
      messages: newMessages,
      isLoading: true,
      isOpen: true,
      currentStreamingText: ''
    });

    const controller = new AbortController();
    set({ abortController: controller });

    try {
      const result = await streamTutorChat({
        persona,
        assistanceLevel,
        messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        context: targetContext,
        signal: controller.signal,
        onChunk: (delta) => set({ currentStreamingText: delta })
      });

      const assistantMessage: TutorMessage = {
        id: `ast_${Date.now()}`,
        role: 'assistant',
        content: result.fullText,
        timestamp: Date.now(),
        leakDetected: result.leakDetected,
        similarity: result.similarity
      };

      set((state) => ({
        messages: [...state.messages, assistantMessage],
        isLoading: false,
        currentStreamingText: '',
        abortController: null
      }));
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error('[TutorStore] Send error:', err);
      const errorMessage: TutorMessage = {
        id: `err_${Date.now()}`,
        role: 'system',
        content: `⚠️ Не удалось получить ответ: ${err.message || 'Ошибка связи с напарником'}`,
        timestamp: Date.now()
      };
      set((state) => ({
        messages: [...state.messages, errorMessage],
        isLoading: false,
        currentStreamingText: '',
        abortController: null
      }));
    }
  },

  requestHint: async (hintTier: number, context?: TutorContextInput) => {
    const { abortGeneration, activeContext } = get();
    abortGeneration();

    const targetContext = context || activeContext || undefined;
    const userMessage: TutorMessage = {
      id: `usr_${Date.now()}`,
      role: 'user',
      content: `💡 Запрос подсказки уровня ${hintTier} (Socratic Scaffold)`,
      timestamp: Date.now()
    };

    set((state) => ({
      messages: [...state.messages, userMessage],
      isLoading: true,
      isOpen: true,
      currentStreamingText: ''
    }));

    try {
      const data = await fetchTutorHint(hintTier, targetContext);
      const assistantMessage: TutorMessage = {
        id: `ast_${Date.now()}`,
        role: 'assistant',
        content: data.content,
        timestamp: Date.now(),
        leakDetected: data.leakDetected
      };
      set((state) => ({
        messages: [...state.messages, assistantMessage],
        isLoading: false
      }));
    } catch (err: any) {
      console.error('[TutorStore] Hint error:', err);
      const errorMessage: TutorMessage = {
        id: `err_${Date.now()}`,
        role: 'system',
        content: `⚠️ Не удалось получить подсказку: ${err.message || 'Ошибка'}`,
        timestamp: Date.now()
      };
      set((state) => ({
        messages: [...state.messages, errorMessage],
        isLoading: false
      }));
    }
  },

  groundRule: async (ruleId: string, context?: TutorContextInput) => {
    const { abortGeneration, activeContext } = get();
    abortGeneration();

    const targetContext = context || activeContext || undefined;
    const userMessage: TutorMessage = {
      id: `usr_${Date.now()}`,
      role: 'user',
      content: `🧭 Проверка кода по правилу Тестинг-Компаса: ${ruleId}`,
      timestamp: Date.now()
    };

    set((state) => ({
      messages: [...state.messages, userMessage],
      isLoading: true,
      isOpen: true,
      isCompassOpen: false,
      currentStreamingText: ''
    }));

    try {
      const data = await fetchTutorRuleGrounding(ruleId, targetContext);
      const assistantMessage: TutorMessage = {
        id: `ast_${Date.now()}`,
        role: 'assistant',
        content: data.content,
        timestamp: Date.now()
      };
      set((state) => ({
        messages: [...state.messages, assistantMessage],
        isLoading: false
      }));
    } catch (err: any) {
      console.error('[TutorStore] Rule grounding error:', err);
      const errorMessage: TutorMessage = {
        id: `err_${Date.now()}`,
        role: 'system',
        content: `⚠️ Ошибка проверки правила: ${err.message || 'Ошибка'}`,
        timestamp: Date.now()
      };
      set((state) => ({
        messages: [...state.messages, errorMessage],
        isLoading: false
      }));
    }
  }
}));

// Pillar 11 SSOT alias for Omnipresent Copilot
export const useTutorStore = usePracticeTutorStore;
