import http from 'http';
import url from 'url';
import { envConfig } from '../../config/env';
import { db } from '../db';
import { authService } from '../authService';
import { parseCookies } from '../../middleware/auth';
import { findRelevantCandidateGaps, getUserProfile, CandidateGap } from '../vectorMemoryService';
import { TargetGrade } from '../../prompts/personas';
import { StrictnessLevel } from '../../prompts/core/antiSycophancy';
import { extractDefaultAnchors } from './livePromptBuilder';

export interface LiveWsSessionParams {
  authenticatedUser: any;
  sessionType: 'interview' | 'tutor' | 'system_design';
  tutorMode: any;
  bugTitle: string;
  bugExplanation: string;
  codeSnippet: string;
  fixedCode: string;
  unitTest: string;
  incidentContext: any;
  parsedHints: string[];
  sessionId: string;
  questionId: string;
  topic: string;
  questionText: string;
  referenceAnswer: string;
  voiceName: string;
  userGender: 'female' | 'male' | 'neutral';
  turnMode: 'manual' | 'auto';
  strategy: 'adaptive_probing' | 'socratic_tutoring';
  persona: any;
  targetGrade: TargetGrade;
  maxProbes: number;
  deepDive: boolean;
  liveCoaching: boolean;
  strictness?: StrictnessLevel;
  customPromptOverride: string;
  questionIndex: number;
  totalQuestions: number;
  isRetry: boolean;
  isResumed: boolean;
  initialProbesCount: number;
  initialUserMessage: string;
  challengeCategory: string;
  challengeTrack: string;
  activeCodeArtifact: any;
  codeRevisionsSummary: any;
  anchors: string[];
  candidateGaps: CandidateGap[];
  relevantGapIds: string[];
  userProfile: any;
  liveModel: string;
  upstreamWsUrl: string;
  vadPauseMs: number;
  enableSilenceClarification: boolean;
  debugStep?: number;
  temperature?: number;
  academyCourse?: string;
  academyStep?: string;
}

export function authenticateWsRequest(req: http.IncomingMessage, query: any): any | null {
  const ticket = (query.ticket as string) || '';
  if (ticket) {
    const ticketResult = authService.verifyAndConsumeWsTicket(ticket);
    if (ticketResult) return ticketResult.user;
  }

  const cookies = parseCookies(req.headers.cookie);
  const sessionToken = cookies['session_token'];
  if (sessionToken) {
    const sessionResult = authService.validateSession(sessionToken);
    if (sessionResult) return sessionResult.user;
  }

  const authHeader = (req.headers['authorization'] as string) || '';
  const queryToken = (query.token as string) || (query.auth_token as string) || '';
  const expectedKey = envConfig.proxy.apiKey;
  if (expectedKey && (authHeader === `Bearer ${expectedKey}` || queryToken === expectedKey)) {
    return {
      id: 'user_master',
      name: 'Automated Test Runner',
      role: 'owner',
      created_at: new Date().toISOString()
    };
  }

  return null;
}

export async function resolveLiveWsSessionParams(
  req: http.IncomingMessage
): Promise<LiveWsSessionParams | null> {
  const parsedUrl = url.parse(req.url || '', true);
  const query = parsedUrl.query;

  const authenticatedUser = authenticateWsRequest(req, query);
  if (!authenticatedUser) return null;

  const rawSessionType = (query.sessionType as string) || '';
  const sessionType = (
    rawSessionType === 'tutor'
      ? 'tutor'
      : rawSessionType === 'system_design'
        ? 'system_design'
        : 'interview'
  ) as 'interview' | 'tutor' | 'system_design';

  const tutorMode = (query.tutorMode as any) || 'deep_dive';
  let bugTitle = (query.bugTitle as string) || '';
  let bugExplanation = (query.bugExplanation as string) || '';
  let codeSnippet = (query.codeSnippet as string) || '';
  let fixedCode = (query.fixedCode as string) || '';
  let unitTest = (query.unitTest as string) || '';
  let challengeCategory = (query.category as string) || (query.challengeCategory as string) || '';
  let challengeTrack = (query.track as string) || (query.challengeTrack as string) || '';

  let incidentContext: any = null;
  if (query.incidentContext) {
    try {
      incidentContext = JSON.parse(query.incidentContext as string);
    } catch {}
  }

  let parsedHints: string[] = [];
  if (query.hints) {
    try {
      const h = JSON.parse(query.hints as string);
      if (Array.isArray(h)) parsedHints = h.map(String);
    } catch {}
  }

  const questionId = (query.questionId as string) || (query.challengeId as string) || '';
  const challengeId = (query.challengeId as string) || (query.questionId as string) || '';
  let topic = (query.topic as string) || 'Java & Spring Framework';
  let questionText = (query.questionText as string) || '';
  let referenceAnswer = (query.referenceAnswer as string) || '';

  // Canonical SQLite SSOT resolution (SOTA Late 2026: Multi-Studio Context Grounding)
  // 1. Coding challenges (Machine Coding & LLD Arena)
  if (challengeId) {
    try {
      const cRow = db.prepare('SELECT id, slug, title, category, track, target_stack, short_description, instructions_markdown FROM coding_challenges WHERE id = ? OR slug = ?').get(challengeId, challengeId) as any;
      if (cRow) {
        if (!topic || topic === 'Java & Spring Framework' || topic === 'Тема') {
          topic = cRow.category || 'Machine Coding & LLD';
        }
        if (!bugTitle) bugTitle = cRow.title;
        if (!questionText) questionText = `${cRow.title}: ${cRow.short_description || ''}`;
        if (!referenceAnswer) referenceAnswer = cRow.instructions_markdown;
        if (!bugExplanation) bugExplanation = cRow.instructions_markdown;
        if (!challengeCategory) challengeCategory = cRow.category;
        if (!challengeTrack) challengeTrack = cRow.track;
      }
    } catch (err) {
      console.warn(`[resolveLiveWsSessionParams] Could not fetch coding challenge ${challengeId}:`, err);
    }
  }

  // 2. Bug challenges (Bug Hunt Arena)
  if (challengeId && (!bugExplanation || !codeSnippet)) {
    try {
      const bRow = db.prepare('SELECT id, title, subtopic, code_snippet, bug_explanation, fixed_code, hints_json FROM bug_challenges WHERE id = ?').get(challengeId) as any;
      if (bRow) {
        if (!bugTitle) bugTitle = bRow.title;
        if (!bugExplanation) bugExplanation = bRow.bug_explanation;
        if (!fixedCode) fixedCode = bRow.fixed_code;
        if (!codeSnippet) codeSnippet = bRow.code_snippet;
        if (!topic || topic === 'Java & Spring Framework' || topic === 'Тема') topic = bRow.subtopic || topic;
      }
    } catch (err) {
      console.warn(`[resolveLiveWsSessionParams] Could not fetch bug challenge ${challengeId}:`, err);
    }
  }

  // 3. Theory questions (Questions Table)
  if (questionId && (!questionText || !referenceAnswer)) {
    try {
      const qRow = db.prepare('SELECT topic, question, answer FROM questions WHERE id = ?').get(questionId) as any;
      if (qRow) {
        if (!topic || topic === 'Java & Spring Framework' || topic === 'Тема') {
          topic = qRow.topic || topic;
        }
        if (!questionText) {
          questionText = qRow.question || questionText;
        }
        if (!referenceAnswer) {
          referenceAnswer = qRow.answer || referenceAnswer;
        }
      }
    } catch (err) {
      console.warn(`[resolveLiveWsSessionParams] Could not fetch question by id ${questionId}:`, err);
    }
  }

  // Safety safeguard: sanitize referenceAnswer if passed via query to prevent memory explosion
  if (referenceAnswer && referenceAnswer.length > 20000) {
    referenceAnswer = referenceAnswer.slice(0, 20000);
  }
  const voiceName = (query.voice as string) || 'Kore';
  const userGender = ((query.userGender as string) === 'male' || (query.userGender as string) === 'neutral' ? query.userGender : 'female') as 'female' | 'male' | 'neutral';
  const turnMode = ((query.turnMode as string) === 'manual' ? 'manual' : 'auto') as 'manual' | 'auto';
  const strategy = ((query.strategy as string) === 'socratic_tutoring' ? 'socratic_tutoring' : 'adaptive_probing') as 'adaptive_probing' | 'socratic_tutoring';
  const persona = ((query.persona as string) || 'mentor') as any;
  const targetGrade = ((query.targetGrade as string) || 'L5_SENIOR') as TargetGrade;
  const maxProbes = Math.max(1, Math.min(5, parseInt((query.maxProbes as string) || '3', 10) || 3));
  const deepDive = query.deepDive === 'true';
  const liveCoaching = query.liveCoaching === 'true';
  const rawStrictness = ((query.strictness as string) || '').toLowerCase();
  const strictness: StrictnessLevel | undefined = ['learning', 'standard', 'hardcore'].includes(rawStrictness)
    ? (rawStrictness as StrictnessLevel)
    : undefined;
  const customPromptOverride = (query.customPrompt as string) || '';
  const questionIndex = Math.max(0, parseInt((query.questionIndex as string) || '0', 10) || 0);
  const totalQuestions = Math.max(1, parseInt((query.totalQuestions as string) || '1', 10) || 1);
  const isRetry = query.isRetry === 'true';
  const isResumed = query.isResumed === 'true';
  const initialProbesCount = Math.max(0, parseInt((query.probesCount as string) || '0', 10) || 0);
  const initialUserMessage = ((query.initialUserMessage as string) || '').trim();

  let activeCodeArtifact: any = null;
  if (query.activeCodeArtifact) {
    try {
      activeCodeArtifact = JSON.parse(query.activeCodeArtifact as string);
    } catch {}
  }

  let codeRevisionsSummary: any = null;
  if (query.codeRevisionsSummary) {
    try {
      codeRevisionsSummary = JSON.parse(query.codeRevisionsSummary as string);
    } catch {}
  }

  let customAnchors: string[] = [];
  if (query.customAnchors) {
    try {
      const parsed = JSON.parse(query.customAnchors as string);
      if (Array.isArray(parsed) && parsed.length > 0) {
        customAnchors = parsed.slice(0, 10).map((a) => String(a).trim()).filter((a) => a.length > 0);
      }
    } catch {}
  }

  const anchors = customAnchors.length > 0 ? customAnchors : extractDefaultAnchors(referenceAnswer, questionText);

  let candidateGaps: CandidateGap[] = [];
  try {
    candidateGaps = await findRelevantCandidateGaps(questionText || bugTitle || topic, topic, questionId);
    if (candidateGaps.length > 0) {
      console.log(`🧠 Injected ${candidateGaps.length} relevant vector gaps into Live prompt for "${topic}"`);
    }
  } catch (gapErr) {
    console.warn('Could not pre-warm candidate gaps:', gapErr);
  }

  const userProfile = getUserProfile();
  const relevantGapIds = candidateGaps.map((g) => g.id);

  const proxyApiKey = envConfig.proxy.apiKey;
  const requestedModel = (query.liveModel as string) || '';
  const isSupported = envConfig.models.supportedLiveModels.includes(requestedModel);
  const liveModel = isSupported ? requestedModel : envConfig.models.live;
  if (requestedModel && !isSupported) {
    console.warn(`⚠️ Requested Live model "${requestedModel}" is not in supported list. Falling back to default "${envConfig.models.live}".`);
  }

  const cleanProxyWs = envConfig.proxy.baseUrl.replace(/^http/, 'ws');
  const upstreamWsUrl = `${cleanProxyWs}/ws/live?model=${encodeURIComponent(liveModel)}&token=${encodeURIComponent(proxyApiKey)}&session_id=${encodeURIComponent(sessionId)}`;

  return {
    authenticatedUser,
    sessionType,
    tutorMode,
    bugTitle,
    bugExplanation,
    codeSnippet,
    fixedCode,
    unitTest,
    incidentContext,
    parsedHints,
    sessionId,
    questionId,
    topic,
    questionText,
    referenceAnswer,
    voiceName,
    userGender,
    turnMode,
    strategy,
    persona,
    targetGrade,
    maxProbes,
    deepDive,
    liveCoaching,
    strictness,
    customPromptOverride,
    questionIndex,
    totalQuestions,
    isRetry,
    isResumed,
    initialProbesCount,
    initialUserMessage,
    challengeCategory,
    challengeTrack,
    activeCodeArtifact,
    codeRevisionsSummary,
    anchors,
    candidateGaps,
    relevantGapIds,
    userProfile,
    liveModel,
    upstreamWsUrl,
    vadPauseMs: Number(query.vadPauseMs) || 1800,
    enableSilenceClarification: query.enableSilenceClarification === 'true',
    debugStep: query.debugStep !== undefined ? parseInt(String(query.debugStep), 10) : undefined,
    temperature: query.temperature !== undefined ? parseFloat(String(query.temperature)) : undefined,
    academyCourse: (query.academyCourse as string) || undefined,
    academyStep: (query.academyStep as string) || undefined
  };
}
