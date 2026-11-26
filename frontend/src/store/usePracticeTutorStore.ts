import { create } from 'zustand';
import {
  TutorActiveContext,
  TutorPersona,
  normalizePracticeContext
} from '@interview-prep/shared';
import { TutorDomain } from '../components/practice/tutor/TutorDomain';
import { getDomainWelcomeMessage } from '../components/practice/tutor/tutorWelcomeMessages';
import { TutorTransportPort, httpTutorTransport } from './tutorTransport';

export type { TutorPersona };
export type AssistanceLevel = 1 | 2 | 3 | 4;

export interface TutorMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  leakDetected?: boolean;
  similarity?: number;
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

  sendMessage: (text: string, context?: TutorActiveContext) => Promise<void>;
  requestHint: (hintTier: number, context?: TutorActiveContext) => Promise<void>;
  groundRule: (ruleId: string, context?: TutorActiveContext) => Promise<void>;
}

const ASSISTANCE_TO_PERSONA: Record<number, TutorPersona> = {
  1: 'junior_explainer',
  2: 'middle_scaffold',
  3: 'senior_socratic',
  4: 'faang_interviewer'
};

function resolveTargetContext(
  provided: TutorActiveContext | undefined,
  activeContext: TutorActiveContext | null,
  persona: TutorPersona,
  assistanceLevel: number,
  patch?: { hintTier?: number; activeCompassRuleId?: string }
): TutorActiveContext {
  const base =
    provided ||
    activeContext ||
    normalizePracticeContext({
      kataId: 'practice-kata',
      kataTitle: 'Practice Kata',
      persona,
      assistanceLevel
    });

  return {
    ...base,
    persona,
    assistanceLevel,
    ...(patch?.hintTier !== undefined ? { hintTier: patch.hintTier } : {}),
    ...(patch?.activeCompassRuleId !== undefined ? { activeCompassRuleId: patch.activeCompassRuleId } : {})
  };
}

export const DEFAULT_TUTOR_TRANSPORT: TutorTransportPort = httpTutorTransport;
let activeSingletonTransport: TutorTransportPort = DEFAULT_TUTOR_TRANSPORT;

export function setTutorTransportPort(transport: TutorTransportPort): void {
  activeSingletonTransport = transport;
}

const singletonTransportProxy: TutorTransportPort = {
  streamChat: (opts) => activeSingletonTransport.streamChat(opts),
  fetchHint: (ctx, persona, lvl, signal) => activeSingletonTransport.fetchHint(ctx, persona, lvl, signal),
  groundRule: (ruleId, ctx, persona, lvl, signal) => activeSingletonTransport.groundRule(ruleId, ctx, persona, lvl, signal)
};

export function createPracticeTutorStore(transport: TutorTransportPort = DEFAULT_TUTOR_TRANSPORT) {
  return create<PracticeTutorState>((set, get) => {
    const startAbortableTurn = (
      userContent: string,
      extraState?: Partial<PracticeTutorState>
    ): { controller: AbortController; messages: TutorMessage[] } => {
      get().abortGeneration();
      const userMessage: TutorMessage = {
        id: `usr_${Date.now()}`,
        role: 'user',
        content: userContent,
        timestamp: Date.now()
      };
      const controller = new AbortController();
      const nextMessages = [...get().messages, userMessage];
      set({
        messages: nextMessages,
        isLoading: true,
        isOpen: true,
        currentStreamingText: '',
        abortController: controller,
        ...extraState
      });
      return { controller, messages: nextMessages };
    };

    const completeTurn = (controller: AbortController, assistantMessage: TutorMessage) => {
      if (controller.signal.aborted || get().abortController !== controller) return;
      set((state) => ({
        messages: [...state.messages, assistantMessage],
        isLoading: false,
        currentStreamingText: '',
        abortController: null
      }));
    };

    const failTurn = (controller: AbortController, err: any, prefix: string, fallback: string) => {
      if (err?.name === 'AbortError' || controller.signal.aborted) {
        if (get().abortController === controller) {
          set({ abortController: null, isLoading: false, currentStreamingText: '' });
        }
        return;
      }
      if (get().abortController !== controller) return;
      console.error(`[TutorStore] ${prefix}:`, err);
      const errorMessage: TutorMessage = {
        id: `err_${Date.now()}`,
        role: 'system',
        content: `⚠️ ${prefix}: ${err?.message || fallback}`,
        timestamp: Date.now()
      };
      set((state) => ({
        messages: [...state.messages, errorMessage],
        isLoading: false,
        currentStreamingText: '',
        abortController: null
      }));
    };

    return {
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

      setPersona: (persona) =>
        set((state) => ({
          persona,
          activeContext: state.activeContext ? { ...state.activeContext, persona } : null
        })),

      setAssistanceLevel: (level) => {
        const persona: TutorPersona = ASSISTANCE_TO_PERSONA[level] || 'middle_scaffold';
        set((state) => ({
          assistanceLevel: level,
          persona,
          activeContext: state.activeContext
            ? { ...state.activeContext, assistanceLevel: level, persona }
            : null
        }));
      },

      setActiveContext: (activeContext) =>
        set((state) => {
          if (!activeContext) {
            return { activeContext: null };
          }
          const isContextSwitch =
            !state.activeContext ||
            state.activeContext.arena !== activeContext.arena ||
            state.activeContext.entityId !== activeContext.entityId;
          if (isContextSwitch) {
            return {
              activeContext,
              persona: activeContext.persona,
              assistanceLevel: activeContext.assistanceLevel
            };
          }
          return {
            activeContext: {
              ...activeContext,
              persona: state.persona,
              assistanceLevel: state.assistanceLevel
            }
          };
        }),

      initChallengeContext: (domain: TutorDomain, challengeTitle?: string) => {
        get().abortGeneration();
        const welcome = getDomainWelcomeMessage(domain, challengeTitle);
        const resetCompanyPersona = get().persona === 'company_interviewer';
        set({
          activeContext: null,
          activeCompassRuleId: null,
          ...(resetCompanyPersona ? { persona: 'middle_scaffold', assistanceLevel: 2 } : {}),
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

      sendMessage: async (text: string, context?: TutorActiveContext) => {
        const { persona, assistanceLevel, activeContext } = get();
        const targetContext = resolveTargetContext(context, activeContext, persona, assistanceLevel);
        const { controller, messages } = startAbortableTurn(text);
        let streamedText = '';
        let doneMeta: { leakDetected?: boolean; maxSimilarity?: number } = {};

        try {
          const result = await transport.streamChat({
            persona,
            assistanceLevel,
            messages: messages.map((m) => ({ role: m.role, content: m.content })),
            context: targetContext,
            signal: controller.signal,
            onChunk: (delta) => {
              streamedText = delta;
              if (get().abortController === controller) {
                set({ currentStreamingText: delta });
              }
            },
            onDone: (meta) => {
              doneMeta = meta;
            }
          });

          completeTurn(controller, {
            id: `ast_${Date.now()}`,
            role: 'assistant',
            content: result?.fullText ?? streamedText,
            timestamp: Date.now(),
            leakDetected: result?.leakDetected ?? Boolean(doneMeta.leakDetected),
            similarity: result?.similarity ?? doneMeta.maxSimilarity ?? 0
          });
        } catch (err: any) {
          failTurn(controller, err, 'Не удалось получить ответ', 'Ошибка связи с напарником');
        }
      },

      requestHint: async (hintTier: number, context?: TutorActiveContext) => {
        const { persona, assistanceLevel, activeContext } = get();
        const targetContext = resolveTargetContext(context, activeContext, persona, assistanceLevel, { hintTier });
        const { controller } = startAbortableTurn(`💡 Запрос подсказки уровня ${hintTier} (Socratic Scaffold)`);

        try {
          const data = await transport.fetchHint(targetContext, persona, assistanceLevel, controller.signal);
          completeTurn(controller, {
            id: `ast_${Date.now()}`,
            role: 'assistant',
            content: data.content,
            timestamp: Date.now(),
            leakDetected: data.leakDetected
          });
        } catch (err: any) {
          failTurn(controller, err, 'Не удалось получить подсказку', 'Ошибка');
        }
      },

      groundRule: async (ruleId: string, context?: TutorActiveContext) => {
        const { persona, assistanceLevel, activeContext } = get();
        const targetContext = resolveTargetContext(
          context,
          activeContext,
          persona,
          assistanceLevel,
          { activeCompassRuleId: ruleId }
        );
        const { controller } = startAbortableTurn(
          `🧭 Проверка кода по правилу Компаса: ${ruleId}`,
          { isCompassOpen: false, activeCompassRuleId: ruleId }
        );

        try {
          const data = await transport.groundRule(ruleId, targetContext, persona, assistanceLevel, controller.signal);
          completeTurn(controller, {
            id: `ast_${Date.now()}`,
            role: 'assistant',
            content: data.content,
            timestamp: Date.now(),
            leakDetected: data.leakDetected
          });
        } catch (err: any) {
          failTurn(controller, err, 'Ошибка проверки правила', 'Ошибка');
        }
      }
    };
  });
}

export const usePracticeTutorStore = createPracticeTutorStore(singletonTransportProxy);

// Pillar 11 SSOT alias for Omnipresent Copilot
export const useTutorStore = usePracticeTutorStore;
