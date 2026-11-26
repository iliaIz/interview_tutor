/**
 * GreetingSynthesisService.ts
 * Deep domain service for initial interview & tutor voice greetings (SPEC-27).
 * Encapsulates greeting prompt generation, LLM reasoning, and TTS audio synthesis.
 * Cognitive Bounding SLA: <= 150 lines (Rule 8).
 */

import { envConfig } from '../../config/env';
import { DEFAULT_VOICE_NAME, sanitizeVoiceName } from '../../config/liveDefaults';
import { llmGateway } from '../LlmGatewayClient';
import { synthesizeTTSWithRetry } from '../podcast';

export interface GreetingInput {
  topic?: string;
  questionText: string;
  voice?: string;
  userGender?: 'female' | 'male' | 'neutral';
  strategy?: string;
  sessionType?: 'interview' | 'tutor';
  tutorMode?: 'deep_dive' | 'socratic' | 'eli5' | 'free_chat';
  initialUserMessage?: string;
  abortSignal?: AbortSignal;
}

export interface GreetingResult {
  text: string;
  audioBase64: string;
}

export function sanitizeVoice(v: unknown): string {
  return sanitizeVoiceName(v, DEFAULT_VOICE_NAME);
}

export class GreetingSynthesisService {
  public static async synthesizeGreeting(input: GreetingInput): Promise<GreetingResult> {
    const {
      topic = 'Java Core',
      questionText,
      voice: rawVoice = DEFAULT_VOICE_NAME,
      userGender: rawUserGender = 'female',
      sessionType: rawSessionType = 'interview',
      tutorMode: rawTutorMode = 'deep_dive',
      initialUserMessage = '',
      abortSignal
    } = input;

    const voice = sanitizeVoice(rawVoice);
    const userGender = rawUserGender === 'male' || rawUserGender === 'neutral' ? rawUserGender : 'female';
    const sessionType = rawSessionType === 'tutor' ? 'tutor' : 'interview';
    const tutorMode = ['deep_dive', 'socratic', 'eli5', 'free_chat'].includes(rawTutorMode) ? rawTutorMode : 'deep_dive';

    const genderDirective = userGender === 'female'
      ? 'Кандидат — ДЕВУШКА/ЖЕНЩИНА. Обращайся вежливо и поддерживающе, используя ЖЕНСКИЕ окончания в прошедшем времени («Ты готова», «Ты выбрала»).'
      : userGender === 'male'
      ? 'Кандидат — МУЖЧИНА. Обращайся вежливо и поддерживающе, используя МУЖСКИЕ окончания («Ты готов», «Ты выбрал»).'
      : 'Обращайся уважительно на «Вы».';

    let greetingPrompt = '';
    if (sessionType === 'tutor') {
      if (initialUserMessage) {
        greetingPrompt = `Ты доброжелательный Senior Java/Spring наставник по теме «${topic}».
${genderDirective}
Кандидат обратился к тебе с конкретным вопросом:
"${initialUserMessage}"

Ответь кандидату прямо, дружелюбно и емко (2-3 предложения), раскрывая суть вопроса под капотом.
Выдай ТОЛЬКО текст реплики для озвучивания, без кавычек и мета-тегов.`;
      } else {
        const modeLabel = tutorMode === 'deep_dive' ? 'под капотом (JVM, байткод, структуры данных)'
          : tutorMode === 'socratic' ? 'через наводящие вопросы'
          : tutorMode === 'eli5' ? 'на простых аналогиях'
          : 'в свободном диалоге';
        greetingPrompt = `Ты доброжелательный Senior Java/Spring наставник по теме «${topic}».
${genderDirective}
Твоя задача — поприветствовать кандидата одной короткой, естественной фразой (1-2 предложения) и предложить разобрать вопрос темы «${topic}» ${modeLabel}.
Вопрос: "${questionText}"
Выдай ТОЛЬКО текст реплики для озвучивания, без кавычек и мета-тегов.`;
      }
    } else {
      greetingPrompt = `Ты профессиональный и доброжелательный технический интервьюер.
${genderDirective}
Твоя задача — поприветствовать кандидата одной короткой, естественной живой фразой (максимум 1 предложение) и четко зачитать технический вопрос по теме «${topic}».

ВОПРОС ДЛЯ ОЗВУЧИВАНИЯ:
"${questionText}"

ВАЖНО:
- НЕ давай подсказок и не отвечай на вопрос.
- Выдай ТОЛЬКО текст реплики для озвучивания, без кавычек и мета-тегов.`;
    }

    const rawText = await llmGateway.completeText({
      userPrompt: greetingPrompt,
      model: envConfig.models.fast,
      temperature: 0.3,
      abortSignal
    });

    const greetingText = rawText.trim() || `Привет! Давайте разберем следующий вопрос: ${questionText}`;

    const { buffer: ttsBuf } = await synthesizeTTSWithRetry(greetingText, voice);
    return {
      text: greetingText,
      audioBase64: ttsBuf.toString('base64')
    };
  }
}
