/**
 * PodcastScriptGenerator.ts
 * Generates structured dialogue scripts for audio recaps using LlmGatewayClient (SPEC-27).
 * Cognitive Bounding SLA: <= 200 lines (Rule 8 compliant).
 */

import { db } from '../db';
import { envConfig } from '../../config/env';
import { llmGateway } from '../LlmGatewayClient';

export interface GeneratePodcastOptions {
  questionIds?: string[];
  topicId?: string;
  topicName?: string;
  tone?: string;
  length?: string;
  language?: string;
  systemPrompt?: string;
  userPrompt?: string;
  mode?: 'solo' | 'duo';
  voice1?: string;
  voice2?: string;
}

export interface QuestionRow {
  id: string;
  global_id: number;
  num: number;
  topic: string;
  question: string;
  answer: string;
}

export interface DialogueItem {
  speaker: 'Host' | 'Guest';
  text: string;
}

export const DEFAULT_STRICT_SYSTEM_PROMPT = `Ты — ведущий технический архитектор и автор обучающих IT-подкастов по подготовке к техническим собеседованиям.
Перед тобой структурированный список вопросов с ЭТАЛОННЫМИ профессиональными ответами (Answer) из нашей базы знаний.

КРИТИЧЕСКИЕ ПРАВИЛА СОЗДАНИЯ СЦЕНАРИЯ:
1. ОБЯЗАТЕЛЬНАЯ ПОЛНОТА: Ты ОБЯЗАН последовательно и глубоко разобрать КАЖДЫЙ вопрос из списка (от первого до последнего) без единого пропуска и без поверхностных объединений.
2. СООТВЕТСТВИЕ ЭТАЛОНУ: В репликах эксперта ОБЯЗАТЕЛЬНО должны прозвучать все ключевые концепции, названия классов, аннотаций, интерфейсов, фаз жизненного цикла, исключений и архитектурных нюансов, содержащихся в блоке "Answer".
3. СТРУКТУРА ДИАЛОГА: На каждый вопрос выдели от 2 до 4 связанных реплик:
   - Ведущий (Host) четко формулирует вопрос, озвучивает практический контекст или задает каверзные вопросы интервьюера.
   - Эксперт (Guest) дает исчерпывающий, структурированный и глубокий ответ, опираясь на эталонные факты и приводя жизненные аналогии из коммерческой разработки.
4. ЖИВАЯ И ПОНЯТНАЯ ПОДАЧА: Веди диалог на безупречном русском языке с естественными интонациями, но никогда не жертвуй технической точностью ради сокращения объема.`;

export const DEFAULT_STRICT_USER_PROMPT = `Создай глубокий, увлекательный и на 100% соответствующий эталонным ответам аудиоразбор. Раскрой все технические термины и архитектурные концепции, чтобы слушатель идеально сдал эту тему на собеседовании.`;

export function buildPodcastText(
  questionIds?: string[],
  topicName?: string
): { text: string; topic: string; questionsCount: number } {
  let questions: QuestionRow[] = [];

  if (questionIds && questionIds.length > 0) {
    const placeholders = questionIds.map(() => '?').join(',');
    const stmt = db.prepare(`SELECT * FROM questions WHERE id IN (${placeholders}) ORDER BY num ASC`);
    questions = stmt.all(...questionIds) as QuestionRow[];
  } else if (topicName) {
    const stmt = db.prepare(`SELECT * FROM questions WHERE topic = ? ORDER BY num ASC LIMIT 10`);
    questions = stmt.all(topicName) as QuestionRow[];
  }

  if (questions.length === 0) {
    throw new Error('No questions found for podcast generation.');
  }

  const topic = topicName || questions[0].topic || 'Java & Spring Interview Prep';

  let text = `Тема пересказа: ${topic}\n`;
  text += `Всего вопросов: ${questions.length}\n\n`;
  text += `Ниже представлены вопросы для собеседования и ЭТАЛОННЫЕ ответы из базы знаний, которые ОБЯЗАТЕЛЬНО должны быть последовательно и полностью раскрыты в диалоге:\n\n`;

  questions.forEach((q, idx) => {
    text += `────────────────────────────────────────────────────────────────\n`;
    text += `ВОПРОС #${idx + 1} (${q.topic}): ${q.question}\n`;
    text += `ЭТАЛОННЫЙ ОТВЕТ (ANSWER):\n${q.answer}\n\n`;
  });

  return { text, topic, questionsCount: questions.length };
}

export async function generateDialogueScript(
  text: string,
  options: GeneratePodcastOptions,
  questionsCount: number
): Promise<{ name_of_guest: string; dialogue: DialogueItem[] }> {
  const isDuo = options.mode !== 'solo';
  const systemPrompt = options.systemPrompt || DEFAULT_STRICT_SYSTEM_PROMPT;
  const userPrompt = options.userPrompt || DEFAULT_STRICT_USER_PROMPT;

  const scriptPrompt = `${systemPrompt}

${userPrompt}

ИНСТРУКЦИИ К ФОРМАТУ ВЫВОДА:
Верни ответ СТРОГО в JSON формате без символов markdown:
{
  "name_of_guest": "${isDuo ? 'Эксперт' : 'Ведущий'}",
  "dialogue": [
    ${isDuo 
      ? '{"speaker": "Host", "text": "Вопрос/вводная ведущего..."}, {"speaker": "Guest", "text": "Развернутый ответ эксперта с опорой на эталон..."}' 
      : '{"speaker": "Host", "text": "Структурированный разбор вопроса..."}'}
  ]
}

ВАЖНО: В диалоге должно быть последовательно раскрыто ВСЕ ${questionsCount} вопросов с опорой на эталонный блок Answer!

Исходный материал для разбора:
${text}`;

  const parsed = await llmGateway.completeJson<{ name_of_guest: string; dialogue: DialogueItem[] }>({
    userPrompt: scriptPrompt,
    model: envConfig.models.text,
    presetKey: 'podcastDramaturgy',
    timeoutMs: 60_000
  });

  if (!parsed.dialogue || !Array.isArray(parsed.dialogue) || parsed.dialogue.length === 0) {
    throw new Error('ИИ вернул пустой или некорректный список реплик в сценарии.');
  }

  return parsed;
}
