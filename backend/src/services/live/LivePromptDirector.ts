/**
 * LivePromptDirector.ts
 * Deep director module encapsulating system prompt assembly, tool declarations,
 * Turn 0 tool lockdown invariant, and Gemini Live setup message construction.
 * Cognitive Bounding Limit: <= 220 lines (Rule 8 compliant).
 */

import { buildSystemPrompt } from './livePromptBuilder';
import { getLiveToolDeclarations } from './liveToolDeclarations';
import { buildGeminiLiveSetupMessage } from './liveGeminiConfigBuilder';
import { ProxySession } from './liveSessionTypes';
import { LiveSessionConfig } from './liveSessionConfigTypes';

export interface SetupDirectives {
  systemPromptText: string;
  toolDeclarations: any[];
  setupMessage: any;
}

export class LivePromptDirector {
  /**
   * Deep entrypoint consolidating prompt directives, tool schemas, and setup message
   */
  static buildSetupDirectives(config: LiveSessionConfig, session: ProxySession): SetupDirectives {
    const systemPromptText = buildSystemPrompt({
      topic: config.topic,
      questionText: config.questionText,
      referenceAnswer: config.referenceAnswer,
      strategy: config.strategy,
      voiceName: config.voiceName,
      userGender: config.userGender,
      turnMode: config.turnMode,
      maxProbes: config.maxProbes,
      anchors: config.anchors,
      deepDive: config.deepDive,
      liveCoaching: config.liveCoaching,
      customPromptOverride: config.customPromptOverride,
      questionIndex: config.questionIndex,
      totalQuestions: config.totalQuestions,
      sessionType: config.sessionType,
      tutorMode: config.tutorMode,
      bugTitle: config.bugTitle,
      bugExplanation: config.bugExplanation,
      codeSnippet: config.codeSnippet,
      fixedCode: config.fixedCode,
      unitTest: config.unitTest,
      incidentContext: config.incidentContext,
      hints: config.parsedHints,
      targetSeniority: config.userProfile?.targetSeniority,
      primaryStack: config.userProfile?.primaryStack,
      candidateGaps: config.candidateGaps,
      activeCodeArtifact: config.activeCodeArtifact,
      codeRevisionsSummary: config.codeRevisionsSummary,
      persona: config.persona,
      targetGrade: config.targetGrade,
      strictness: config.strictness,
      challengeCategory: config.challengeCategory,
      challengeTrack: config.challengeTrack,
      workspaceManifest: session.workspaceManifest,
      academyBridgeContext: session.academyBridgeContext || (config.academyCourse ? { courseId: config.academyCourse, stepId: config.academyStep } : undefined),
      seniorReview: session.seniorReview
    });

    const toolDeclarations = getLiveToolDeclarations(config.sessionType, config.tutorMode);

    const setupMessage = buildGeminiLiveSetupMessage({
      liveModel: config.liveModel,
      voiceName: config.voiceName,
      systemPromptText,
      sessionType: config.sessionType,
      strategy: config.strategy,
      normalizedTools: toolDeclarations,
      vadPauseMs: session.vadPauseMs,
      turnMode: config.turnMode,
      temperature: config.temperature
    });

    return {
      systemPromptText,
      toolDeclarations,
      setupMessage
    };
  }
}
