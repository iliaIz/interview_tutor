import { create } from 'zustand';
import { MutantDefinition } from '../types/practice';
import { ChallengeDomain } from '../utils/challengeDomain';

export type TutorPersona = 'junior_explainer' | 'middle_scaffold' | 'senior_socratic' | 'faang_interviewer';

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
}

interface PracticeTutorState {
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

  // Actions
  toggleOpen: (open?: boolean) => void;
  toggleCompass: (open?: boolean) => void;
  setActiveCompassRuleId: (ruleId: string | null) => void;
  setModality: (modality: 'text' | 'voice') => void;
  setPersona: (persona: TutorPersona) => void;
  setAssistanceLevel: (level: number) => void;
  initContextWelcome: (domain: ChallengeDomain, challengeTitle?: string) => void;
  clearMessages: () => void;
  abortGeneration: () => void;

  sendMessage: (text: string, context: PracticeTutorContextPayload) => Promise<void>;
  requestHint: (hintTier: number, context: PracticeTutorContextPayload) => Promise<void>;
  groundRule: (ruleId: string, context: PracticeTutorContextPayload) => Promise<void>;
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
      content: '👋 Привет! Я твой AI-напарник по парному программированию и мутационному тестированию. Я могу объяснить устройство любого теста, подсказать граничные случаи по модели RIPR или проверить твой код по Золотым Правилам Тестинг-Компаса (`Ctrl + /`). Чем помочь?',
      timestamp: Date.now()
    }
  ],
  isLoading: false,
  currentStreamingText: '',
  abortController: null,

  toggleOpen: (open) => set((state) => ({ isOpen: open !== undefined ? open : !state.isOpen })),
  toggleCompass: (open) => set((state) => ({ isCompassOpen: open !== undefined ? open : !state.isCompassOpen })),
  setActiveCompassRuleId: (ruleId) => set({ activeCompassRuleId: ruleId }),
  setModality: (modality) => set({ modality }),
  setPersona: (persona) => set({ persona }),
  setAssistanceLevel: (level) => {
    let persona: TutorPersona = 'middle_scaffold';
    if (level === 1) persona = 'junior_explainer';
    else if (level === 2) persona = 'middle_scaffold';
    else if (level === 3) persona = 'senior_socratic';
    else if (level === 4) persona = 'faang_interviewer';
    set({ assistanceLevel: level, persona });
  },
  initContextWelcome: (domain: ChallengeDomain, challengeTitle?: string) => {
    let welcomeContent = '👋 Привет! Я твой AI-напарник по парному программированию. Чем помочь?';
    if (domain === 'lld') {
      welcomeContent = `👋 Привет! Я твой AI-напарник по архитектурному проектированию (LLD & Machine Coding) для задачи «${challengeTitle || 'на экране'}». Помогу спроектировать чистые интерфейсы, проверить соблюдение SOLID, настроить инжекцию Clock, BigDecimal или безопасный захват блокировок. С чего начнем?`;
    } else if (domain === 'transactions') {
      welcomeContent = `👋 Привет! Я твой AI-напарник по транзакциям Spring и базам данных для задачи «${challengeTitle || 'на экране'}». Помогу разобрать уровни изоляции, аномалии конкурентного доступа и предотвратить Self-Invocation. Чем помочь?`;
    } else {
      welcomeContent = `👋 Привет! Я твой AI-напарник по парному программированию и тестированию для задачи «${challengeTitle || 'на экране'}». Могу объяснить устройство теста, подсказать граничные случаи по модели RIPR или проверить код по Тестинг-Компасу (Ctrl + /). Чем помочь?`;
    }

    set({
      messages: [
        {
          id: `welcome_${Date.now()}`,
          role: 'assistant',
          content: welcomeContent,
          timestamp: Date.now()
        }
      ]
    });
  },
  clearMessages: () => set({
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

  sendMessage: async (text: string, context: PracticeTutorContextPayload) => {
    const { persona, assistanceLevel, messages, abortGeneration } = get();
    abortGeneration();

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
      const response = await fetch('/api/practice-tutor/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        signal: controller.signal,
        body: JSON.stringify({
          persona,
          assistanceLevel,
          ...context,
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          stream: true
        })
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({ error: 'Сетевая ошибка' }));
        throw new Error(errJson.error || `HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('Не удалось подключить поток данных');

      const decoder = new TextDecoder('utf-8');
      let fullAssistantText = '';
      let leakDetected = false;
      let similarity = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          try {
            const data = JSON.parse(trimmed.slice(5).trim());
            if (data.delta) {
              fullAssistantText += data.delta;
              set({ currentStreamingText: fullAssistantText });
            }
            if (data.done) {
              leakDetected = Boolean(data.leakDetected);
              similarity = data.maxSimilarity || 0;
            }
          } catch {
            // ignore JSON parse chunk errors
          }
        }
      }

      const assistantMessage: TutorMessage = {
        id: `ast_${Date.now()}`,
        role: 'assistant',
        content: fullAssistantText,
        timestamp: Date.now(),
        leakDetected,
        similarity
      };

      set((state) => ({
        messages: [...state.messages, assistantMessage],
        isLoading: false,
        currentStreamingText: '',
        abortController: null
      }));
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error('Practice tutor send error:', err);
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

  requestHint: async (hintTier: number, context: PracticeTutorContextPayload) => {
    const { abortGeneration } = get();
    abortGeneration();

    const userMessage: TutorMessage = {
      id: `usr_${Date.now()}`,
      role: 'user',
      content: `💡 Запрос подсказки уровня ${hintTier} (RIPR Model)`,
      timestamp: Date.now()
    };

    set((state) => ({
      messages: [...state.messages, userMessage],
      isLoading: true,
      isOpen: true,
      currentStreamingText: ''
    }));

    try {
      const response = await fetch('/api/practice-tutor/hint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          hintTier,
          ...context
        })
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({ error: 'Сетевая ошибка' }));
        throw new Error(errJson.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
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
      console.error('Hint request error:', err);
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

  groundRule: async (ruleId: string, context: PracticeTutorContextPayload) => {
    const { abortGeneration } = get();
    abortGeneration();

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
      const response = await fetch('/api/practice-tutor/rule-grounding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ruleId,
          ...context
        })
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({ error: 'Сетевая ошибка' }));
        throw new Error(errJson.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
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
      console.error('Rule grounding error:', err);
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
