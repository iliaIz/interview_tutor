import { create } from 'zustand';
import type {
  TutorActiveContext,
  TutorPersona,
  TutorRole,
  TutorVerifyDiagnosisResponse
} from '@interview-prep/shared/tutor';
import { TutorDomain } from '../components/practice/tutor/TutorDomain';
import { getDomainWelcomeMessage } from '../components/practice/tutor/tutorWelcomeMessages';
import { TutorTransportPort } from './tutorTransport';
import {
  buildWorkbenchDockSlice,
  type WorkbenchDockStateSlice
} from './slices/workbenchDockSlice';
import {
  ASSISTANCE_TO_PERSONA,
  DEFAULT_TUTOR_TRANSPORT,
  resolveTargetContext,
  setTutorTransportPort,
  singletonTransportProxy,
  type AssistanceLevel,
  type CopilotDockTab,
  type TutorMessage
} from './tutorStoreHelpers';

export type { TutorPersona, TutorRole, WorkbenchDockStateSlice, AssistanceLevel, CopilotDockTab, TutorMessage };
export { DEFAULT_TUTOR_TRANSPORT, setTutorTransportPort };

export interface PracticeTutorState extends WorkbenchDockStateSlice {
  isOpen: boolean;
  rightDockTab: CopilotDockTab;
  isCopilotStealth: boolean;
  draftInput: string;
  isCompassOpen: boolean;
  activeCompassRuleId: string | null;
  modality: 'text' | 'voice';
  persona: TutorPersona;
  assistanceLevel: number;
  tutorRole: TutorRole;
  isVerifyingDiagnosis: boolean;
  messages: TutorMessage[];
  isLoading: boolean;
  currentStreamingText: string;
  abortController: AbortController | null;
  activeContext: TutorActiveContext | null;

  toggleOpen: (open?: boolean) => void;
  setRightDockTab: (tab: CopilotDockTab) => void;
  enterStealthMode: () => void;
  exitStealthMode: (tab?: CopilotDockTab) => void;
  setDraftInput: (text: string) => void;
  toggleCompass: (open?: boolean) => void;
  setActiveCompassRuleId: (ruleId: string | null) => void;
  setModality: (modality: 'text' | 'voice') => void;
  setPersona: (persona: TutorPersona) => void;
  setAssistanceLevel: (level: number) => void;
  setTutorRole: (role: TutorRole) => void;
  setActiveContext: (context: TutorActiveContext | null) => void;
  clearMessages: () => void;
  initChallengeContext: (domain: TutorDomain, challengeTitle?: string, arena?: 'practice' | 'incidents') => void;
  abortGeneration: () => void;

  sendMessage: (text: string, context?: TutorActiveContext) => Promise<void>;
  requestHint: (hintTier: number, context?: TutorActiveContext) => Promise<void>;
  groundRule: (ruleId: string, context?: TutorActiveContext) => Promise<void>;
  verifyBugDiagnosis: (diagnosis: string, context?: TutorActiveContext) => Promise<TutorVerifyDiagnosisResponse | null>;
}

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
        isCopilotStealth: false,
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
        isVerifyingDiagnosis: false,
        currentStreamingText: '',
        abortController: null
      }));
    };

    const failTurn = (controller: AbortController, err: any, prefix: string, fallback: string) => {
      if (err?.name === 'AbortError' || controller.signal.aborted) {
        if (get().abortController === controller) {
          set({ abortController: null, isLoading: false, isVerifyingDiagnosis: false, currentStreamingText: '' });
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
        isVerifyingDiagnosis: false,
        currentStreamingText: '',
        abortController: null
      }));
    };

    return {
      ...buildWorkbenchDockSlice(set),
      isOpen: false,
      rightDockTab: 'tutor',
      isCopilotStealth: false,
      draftInput: '',
      isCompassOpen: false,
      activeCompassRuleId: null,
      modality: 'text',
      persona: 'middle_scaffold',
      assistanceLevel: 2,
      tutorRole: 'code_review',
      isVerifyingDiagnosis: false,
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

      toggleOpen: (open) =>
        set((state) => {
          const nextOpen = open !== undefined ? open : !state.isOpen;
          return {
            isOpen: nextOpen,
            ...(nextOpen ? { isCopilotStealth: false } : {})
          };
        }),
      setRightDockTab: (rightDockTab) => set({ rightDockTab }),
      enterStealthMode: () => set({ isOpen: false, isCopilotStealth: true }),
      exitStealthMode: (tab) =>
        set((state) => ({
          isCopilotStealth: false,
          isOpen: true,
          rightDockTab: tab ?? state.rightDockTab
        })),
      setDraftInput: (draftInput) => set({ draftInput }),
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

      setTutorRole: (tutorRole) =>
        set((state) => ({
          tutorRole,
          activeContext:
            state.activeContext && state.activeContext.arena === 'incidents'
              ? { ...state.activeContext, tutorRole }
              : state.activeContext
        })),

      setActiveContext: (activeContext) =>
        set((state) => {
          if (!activeContext) return { activeContext: null };
          const isContextSwitch =
            !state.activeContext ||
            state.activeContext.arena !== activeContext.arena ||
            state.activeContext.entityId !== activeContext.entityId;
          if (isContextSwitch) {
            return {
              activeContext,
              persona: activeContext.persona,
              assistanceLevel: activeContext.assistanceLevel,
              ...(activeContext.tutorRole ? { tutorRole: activeContext.tutorRole } : {})
            };
          }
          return {
            activeContext: {
              ...activeContext,
              persona: state.persona,
              assistanceLevel: state.assistanceLevel,
              ...(activeContext.arena === 'incidents' ? { tutorRole: state.tutorRole } : {})
            }
          };
        }),

      initChallengeContext: (domain: TutorDomain, challengeTitle?: string, arena?: 'practice' | 'incidents') => {
        get().abortGeneration();
        const welcome = getDomainWelcomeMessage(domain, challengeTitle, arena);
        const resetCompanyPersona = get().persona === 'company_interviewer';
        set({
          activeContext: null,
          activeCompassRuleId: null,
          isCopilotStealth: false,
          rightDockTab: 'tutor',
          tutorRole: 'code_review',
          isVerifyingDiagnosis: false,
          ...(resetCompanyPersona ? { persona: 'middle_scaffold', assistanceLevel: 2 } : {}),
          messages: [{ id: `welcome_${Date.now()}`, role: 'assistant', content: welcome, timestamp: Date.now() }],
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
          set({ abortController: null, isLoading: false, isVerifyingDiagnosis: false, currentStreamingText: '' });
        }
      },

      sendMessage: async (text: string, context?: TutorActiveContext) => {
        const { persona, assistanceLevel, activeContext, tutorRole } = get();
        const targetContext = resolveTargetContext(context, activeContext, persona, assistanceLevel, tutorRole);
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
        const { persona, assistanceLevel, activeContext, tutorRole } = get();
        const targetContext = resolveTargetContext(context, activeContext, persona, assistanceLevel, tutorRole, { hintTier });
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
        const { persona, assistanceLevel, activeContext, tutorRole } = get();
        const targetContext = resolveTargetContext(context, activeContext, persona, assistanceLevel, tutorRole, {
          activeCompassRuleId: ruleId
        });
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
      },

      verifyBugDiagnosis: async (diagnosis: string, context?: TutorActiveContext) => {
        const trimmed = diagnosis.trim();
        if (!trimmed || !transport.verifyBugDiagnosis) return null;
        const { persona, assistanceLevel, activeContext, tutorRole } = get();
        const targetContext = resolveTargetContext(context, activeContext, persona, assistanceLevel, tutorRole);
        const { controller } = startAbortableTurn(`🧪 Проверка диагноза:\n${trimmed}`, { isVerifyingDiagnosis: true });

        try {
          const result = await transport.verifyBugDiagnosis(trimmed, targetContext, controller.signal);
          const badge =
            result.verdict === 'solved'
              ? '✅ **Диагноз подтверждён!**'
              : result.verdict === 'partial'
                ? '🟡 **На верном пути (нужно уточнение):**'
                : '❌ **Гипотеза пока не подтвердилась:**';
          const explanationBlock = result.revealedExplanation
            ? `\n\n---\n**Разбор причины:** ${result.revealedExplanation}`
            : '';
          completeTurn(controller, {
            id: `diag_${Date.now()}`,
            role: 'assistant',
            content: `${badge}\n\n${result.feedback}${explanationBlock}`,
            timestamp: Date.now()
          });
          return result;
        } catch (err: any) {
          failTurn(controller, err, 'Не удалось проверить диагноз', 'Ошибка проверки диагноза');
          return null;
        }
      }
    };
  });
}

export const usePracticeTutorStore = createPracticeTutorStore(singletonTransportProxy);
export const useTutorStore = usePracticeTutorStore;
