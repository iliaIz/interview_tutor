import crypto from 'crypto';
import dotenv from 'dotenv';
import { db } from './db';
import { TOPIC_MAP } from './topics';
import { LlmExecutionEngine, LlmGatewayUnavailableError } from './LlmExecutionEngine';
import { wrapUntrustedContext } from '../prompts/core/sandboxDirectives';
import { ANTI_SYCOPHANCY_DIRECTIVES } from '../prompts/core/antiSycophancy';
import {
  TechStackInfo,
  ProductionContext,
  BugChallenge,
  GenerateBugChallengeParams,
  TECH_STACK_ARCHETYPES,
  DEFECT_FOCUS_MAP
} from './bugChallengeTypes';
import {
  saveBugChallengeToDb,
  getSavedBugChallenges,
  updateBugChallengeStatus
} from './bugChallengeRepository';
import {
  buildBugChallengeSystemPrompt,
  BugChallengeSystemPromptParams
} from './bugChallengePromptBuilder';

dotenv.config();

export {
  TechStackInfo,
  ProductionContext,
  BugChallenge,
  GenerateBugChallengeParams,
  TECH_STACK_ARCHETYPES,
  DEFECT_FOCUS_MAP,
  getSavedBugChallenges,
  updateBugChallengeStatus,
  buildBugChallengeSystemPrompt,
  BugChallengeSystemPromptParams
};

export async function generateBugChallenge(params: GenerateBugChallengeParams): Promise<BugChallenge> {
  let topicName = params.topic || 'Java & Spring Framework';
  const topicId = params.topicId || (params.topic ? params.topic.toLowerCase().replace(/\s+/g, '-') : 'general');
  let contextInfo = '';
  let sampledQuestionId: string | undefined = undefined;
  let totalTopicQuestions = 0;
  let remainingCount = 0;

  const preset = params.workoutPreset || 'exhaustive';
  const difficulty = params.difficulty || (preset === 'senior_multi' ? 'senior' : 'middle');
  const defectFocusKey = params.defectFocus || 'all';
  const defectFocusInstruction = DEFECT_FOCUS_MAP[defectFocusKey] || DEFECT_FOCUS_MAP.all;

  // Resolve target tech stack
  const stackProfileKey = params.techStackProfile || 'modern_cloud';
  let targetTechStackPrompt = TECH_STACK_ARCHETYPES[stackProfileKey]?.stackPrompt || TECH_STACK_ARCHETYPES.modern_cloud.stackPrompt;

  if (stackProfileKey === 'custom' && params.customTechStack) {
    targetTechStackPrompt = `Пользовательский стек: ${params.customTechStack}`;
  }

  const customInstructionsPrompt = params.customInstructions
    ? `\nДОПОЛНИТЕЛЬНЫЕ ИНСТРУКЦИИ ПОЛЬЗОВАТЕЛЯ:\n${params.customInstructions}`
    : '';

  // Case 1: Topic-level bug hunt (from TopicSelector / Bug Hunt Arena)
  if (params.topicId && !params.questionId && !params.questionText) {
    const dbTopicName = TOPIC_MAP[params.topicId.toLowerCase()] || params.topicId;
    topicName = dbTopicName;

    try {
      const countStmt = db.prepare('SELECT COUNT(*) as count FROM questions WHERE topic = ?');
      const totalRow = countStmt.get(dbTopicName) as { count: number };
      totalTopicQuestions = totalRow?.count || 0;

      // Handle Exhaustive Mode with excludeIds
      const excludeIds = params.excludeIds || [];
      const effectiveExclude = preset === 'exhaustive' ? excludeIds : [];

      let queryStr = 'SELECT id, question FROM questions WHERE topic = ?';
      const queryParams: any[] = [dbTopicName];

      if (effectiveExclude.length > 0) {
        const placeholders = effectiveExclude.map(() => '?').join(',');
        queryStr += ` AND id NOT IN (${placeholders})`;
        queryParams.push(...effectiveExclude);
      }

      queryStr += ' ORDER BY RANDOM() LIMIT 5';

      const sampleStmt = db.prepare(queryStr);
      const sampledRows = sampleStmt.all(...queryParams) as { id: string; question: string }[];

      if (preset === 'exhaustive' && sampledRows.length === 0 && totalTopicQuestions > 0) {
        console.log(`🎉 Topic ${topicName} is 100% exhausted (${effectiveExclude.length}/${totalTopicQuestions})!`);
        return {
          id: `exhausted_${Date.now()}`,
          title: 'Тема полностью пройдена!',
          subtopic: topicName,
          language: 'java',
          codeSnippet: '// Все разделы темы успешно отработаны на 100%!',
          bugExplanation: 'Вы закрыли все подразделы и вопросы данной темы без повторов.',
          fixedCode: '// 100% Topic Mastery Achieved',
          hints: ['Тема завершена.'],
          isTopicExhausted: true,
          totalTopicQuestions,
          remainingCount: 0
        };
      }

      if (sampledRows && sampledRows.length > 0) {
        sampledQuestionId = sampledRows[0].id;
        remainingCount = Math.max(0, totalTopicQuestions - effectiveExclude.length);
        contextInfo = `Подтемы и концепции для вдохновения:\n` + sampledRows.map((r) => `- ${r.question}`).join('\n');
      }
    } catch (e) {
      console.warn('Could not sample questions from DB for topic bug hunt:', e);
    }
  } 
  // Case 2: Question-specific bug hunt (from StudyDeck)
  else if (params.questionText || params.referenceAnswer) {
    contextInfo = `Конкретный вопрос темы: "${params.questionText || ''}"\nЭталонная теория:\n${params.referenceAnswer ? params.referenceAnswer.slice(0, 500) : ''}`;
    sampledQuestionId = params.questionId;
  } else if (params.questionId) {
    try {
      const qStmt = db.prepare('SELECT topic, question, answer FROM questions WHERE id = ?');
      const qRow = qStmt.get(params.questionId) as { topic: string; question: string; answer: string };
      if (qRow) {
        topicName = qRow.topic;
        contextInfo = `Конкретный вопрос темы: "${qRow.question}"\nЭталонная теория:\n${qRow.answer.slice(0, 500)}`;
        sampledQuestionId = params.questionId;
      }
    } catch (e) {
      console.warn('Could not fetch question from DB for bug hunt:', e);
    }
  }

  const isSeniorMulti = preset === 'senior_multi' || difficulty === 'senior';
  const bugCountInstruction = isSeniorMulti
    ? `Сгенерируй код уровня Senior/Lead/Staff с РОВНО 2 взаимосвязанными или скрытыми дефектами (например, concurrency race condition + пропуск отката транзакции при checked exception или carrier thread pinning).`
    : `Сгенерируй код с РОВНО 1 фундаментальной архитектурной, логической или concurrency ошибкой.`;

  const systemPrompt = buildBugChallengeSystemPrompt({
    targetTechStackPrompt,
    bugCountInstruction,
    defectFocusInstruction,
    customInstructionsPrompt,
    isSeniorMulti
  });

  const prompt = `Тема: ${topicName}
${contextInfo}

Сгенерируй реалистичную задачу на поиск бага (Production Incident Code Review Challenge) в строгом JSON-формате.`;

  try {
    console.log(`🐛 Generating bug challenge via LiteLLM Proxy [Model: ${modelName}, Topic: ${topicName}, Preset: ${preset}, Stack: ${stackProfileKey}, Diff: ${difficulty}]...`);
    
    const parsed = await LlmExecutionEngine.executeJson<any>({
      systemPrompt,
      userPrompt: prompt,
      presetKey: 'deepIncidentSynthesis',
      timeoutMs: 90_000
    });

    const challengeId = `bug_${crypto.randomBytes(8).toString('hex')}`;

    const generatedChallenge: BugChallenge = {
      id: challengeId,
      topicId,
      topicName,
      title: parsed.title || 'Поиск ошибки в коде',
      subtopic: parsed.subtopic || topicName,
      language: parsed.language || 'java',
      codeSnippet: parsed.codeSnippet || '// Код недоступен',
      bugExplanation: parsed.bugExplanation || 'Неочевидная ошибка в логике работы компонента.',
      fixedCode: parsed.fixedCode || parsed.codeSnippet || '',
      hints: Array.isArray(parsed.hints) && parsed.hints.length > 0 
        ? parsed.hints 
        : ['Обратите внимание на взаимодействие потоков и синхронизацию.', 'Посмотрите на метод обновления состояния.'],
      categoryBadge: parsed.categoryBadge || '⚡ Concurrency',
      difficultyBadge: parsed.difficultyBadge || (isSeniorMulti ? 'Senior' : 'Middle'),
      keyTakeaways: Array.isArray(parsed.keyTakeaways) && parsed.keyTakeaways.length > 0 ? parsed.keyTakeaways : undefined,
      techStack: parsed.techStack || {
        language: 'Java 21',
        javaVersion: 'Java 21 LTS',
        framework: 'Spring Boot 3.4.x',
        keyLibraries: ['Spring WebMVC', 'PostgreSQL 16', 'Hibernate 6.6']
      },
      productionContext: parsed.productionContext || undefined,
      sampledQuestionId,
      isTopicExhausted: false,
      remainingCount,
      totalTopicQuestions
    };

    // Save to SQLite Persistent Problem Bank
    saveBugChallengeToDb(generatedChallenge, topicId, topicName, preset, difficulty);

    return generatedChallenge;
  } catch (err: any) {
    console.error('Error generating bug challenge via LiteLLM Proxy:', err);
    if (err instanceof LlmGatewayUnavailableError) {
      throw err;
    }
    const reason = err.name === 'TimeoutError' || err.message?.includes('timeout')
      ? 'upstream_timeout'
      : err.message?.includes('ECONNREFUSED') || err.message?.includes('Failed to fetch')
      ? 'proxy_unreachable'
      : err.message?.includes('429')
      ? 'rate_limit_exceeded'
      : 'proxy_unreachable';
    throw new LlmGatewayUnavailableError(reason, err.message);
  }
}
