import { TutorActiveContext, TutorArenaType, TutorPersona } from '@interview-prep/shared';
import { pruneTutorContext, PrunedTutorResult } from '../services/practiceContextPruner';
import { PracticeTutorContext, HintTier } from '../prompts/practiceTutorPrompts';

/**
 * tutorContextResolver.ts
 * Canonical cross-arena request normalizer for /api/practice-tutor (Spec 58).
 * Handles all 5 arenas (including arena === 'practice') + legacy PracticeTutorContextPayload fallback.
 * Cognitive bounding limit: <= 120 lines.
 */

const VALID_ARENAS = new Set<TutorArenaType>(['practice', 'sql_arena', 'companies', 'system_design', 'incidents']);

export interface ResolvedTutorRouteContext {
  arena: TutorArenaType;
  isPolymorphic: boolean;
  isPracticeArena: boolean;
  rawEntityId: string;
  context: TutorActiveContext;
  pruned: PrunedTutorResult;
  stream: boolean;
}

export function resolveTutorRouteContext(rawBody: Record<string, any> | undefined): ResolvedTutorRouteContext {
  const body = rawBody || {};
  const isCanonical = typeof body.arena === 'string' && VALID_ARENAS.has(body.arena as TutorArenaType);
  const arena: TutorArenaType = isCanonical ? (body.arena as TutorArenaType) : 'practice';
  const rawEntityId = String(body.entityId || body.kataId || '');
  const rawAssistance = Number(body.assistanceLevel);
  const assistanceLevel = Number.isFinite(rawAssistance) ? Math.min(4, Math.max(1, rawAssistance)) : 2;
  const persona = (typeof body.persona === 'string' && body.persona ? body.persona : 'middle_scaffold') as TutorPersona;
  const activeFilePath = body.activeFilePath || (arena === 'practice' ? 'src/test/java/ExampleTest.java' : undefined);
  const activeCodeOrQuery = typeof body.activeCodeOrQuery === 'string'
    ? body.activeCodeOrQuery
    : typeof body.activeFileContent === 'string'
    ? body.activeFileContent
    : '';
  const instructions = typeof body.instructions === 'string' && body.instructions.length > 0
    ? body.instructions
    : typeof body.kataInstructions === 'string'
    ? body.kataInstructions
    : '';
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const pruned = pruneTutorContext({
    messages,
    activeFilePath,
    activeFileContent: activeCodeOrQuery,
    workspaceManifest: body.workspaceManifest,
    academyBridgeContext: body.academyBridgeContext
  });
  const workspaceManifest = pruned.prunedXmlManifest
    ? { ...(body.workspaceManifest || {}), xmlManifest: pruned.prunedXmlManifest }
    : body.workspaceManifest;

  const context: TutorActiveContext = {
    arena,
    entityId: rawEntityId || 'practice-kata',
    entityTitle: String(body.entityTitle || body.kataTitle || rawEntityId || 'Practice Kata'),
    domain: String(body.domain || body.kataCategory || 'Testing & Mutation Katas'),
    persona,
    assistanceLevel,
    activeCodeOrQuery,
    activeFilePath,
    schemaOrDdl: body.schemaOrDdl,
    instructions,
    kataInstructions: typeof body.kataInstructions === 'string' ? body.kataInstructions : instructions,
    selectedCodeSnippet: body.selectedCodeSnippet,
    cursorLine: body.cursorLine,
    cursorColumn: body.cursorColumn,
    survivingMutants: body.survivingMutants,
    compilerError: body.compilerError,
    runtimeError: body.runtimeError ?? body.testFailureMessage,
    executionDiff: body.executionDiff,
    companyContext: body.companyContext,
    activeCompassRuleId: body.activeCompassRuleId,
    activeWhiteboardSnippet: body.activeWhiteboardSnippet,
    workspaceManifest,
    academyBridgeContext: body.academyBridgeContext,
    hintTier: body.hintTier !== undefined ? Number(body.hintTier) : undefined,
    tutorRole:
      body.tutorRole === 'free_chat'
        ? 'free_chat'
        : body.tutorRole === 'code_review'
        ? 'code_review'
        : undefined,
    incidentMeta:
      body.incidentMeta && typeof body.incidentMeta === 'object' ? body.incidentMeta : undefined,
    quickActionChips: Array.isArray(body.quickActionChips) ? body.quickActionChips : [],
    messages: pruned.prunedMessages as TutorActiveContext['messages']
  };

  return { arena, isPolymorphic: isCanonical, isPracticeArena: arena === 'practice', rawEntityId, context, pruned, stream: body.stream !== false };
}

export function toPracticeTutorContext(
  resolved: ResolvedTutorRouteContext,
  overrides: Partial<PracticeTutorContext> = {}
): PracticeTutorContext {
  const { context, pruned } = resolved;
  return {
    persona: context.persona,
    assistanceLevel: context.assistanceLevel,
    kataTitle: overrides.kataTitle ?? context.entityTitle,
    kataCategory: overrides.kataCategory ?? context.domain,
    kataInstructions: overrides.kataInstructions ?? context.kataInstructions ?? context.instructions ?? '',
    activeFilePath: context.activeFilePath || 'src/test/java/ExampleTest.java',
    activeFileContent: context.activeCodeOrQuery || '',
    selectedCodeSnippet: context.selectedCodeSnippet,
    cursorLine: context.cursorLine,
    cursorColumn: context.cursorColumn,
    survivingMutants: context.survivingMutants as PracticeTutorContext['survivingMutants'],
    compilerError: context.compilerError,
    testFailureMessage: context.runtimeError,
    activeCompassRuleId: overrides.activeCompassRuleId ?? context.activeCompassRuleId,
    activeWhiteboardSnippet: context.activeWhiteboardSnippet,
    hintTier: (overrides.hintTier ?? context.hintTier) as HintTier | undefined,
    workspaceManifest: context.workspaceManifest,
    academyBridgeContext: context.academyBridgeContext,
    earlierTurnsSummary: pruned.earlierTurnsSummary
  };
}
