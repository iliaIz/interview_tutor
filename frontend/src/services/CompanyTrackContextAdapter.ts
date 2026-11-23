/**
 * CompanyTrackContextAdapter.ts
 * Deep polymorphic adapter grounding company preparation into Copilot and Gemini Live Voice.
 * Adheres strictly to ADR 0003, ADR 0004, and Rule 8 file hygiene (<= 200 lines).
 */

import { TutorActiveContext, TutorQuickActionChip, CompanyProfile } from '@interview-prep/shared';

export interface CompanyQuestionSummary {
  id: string;
  global_id?: string | number;
  num?: number;
  module?: string;
  topic: string;
  question: string;
  depthProbe?: string[];
  answer: string;
  redFlags?: string[];
  isMastered?: boolean;
  userScore?: number;
}

export class CompanyTrackContextAdapter {
  /**
   * Normalizes a company theory question into canonical TutorActiveContext without eager message dispatch.
   */
  static createTheoryQuestionContext(
    company: CompanyProfile,
    question: CompanyQuestionSummary
  ): TutorActiveContext {
    const probeStr = question.depthProbe && question.depthProbe.length > 0
      ? `\nТочки углубления: ${question.depthProbe.join(', ')}`
      : '';
    const redFlagsStr = question.redFlags && question.redFlags.length > 0
      ? `\nКрасные флаги: ${question.redFlags.join(', ')}`
      : '';

    const chips: TutorQuickActionChip[] = [
      {
        id: 'explain_physics',
        label: '💡 Объяснить физику концепции',
        promptMessage: `Объясни физику и первопричины по вопросу «${question.question}» (Тема: ${question.topic}). Разбери, как это работает на уровне JVM/OS/DB.`
      },
      {
        id: 'depth_probes',
        label: '🎯 Что спросит сеньор?',
        promptMessage: `Какие каверзные вопросы и точки углубления задаст Lead-интервьюер в ${company.name} по теме «${question.topic}»?${probeStr}`
      },
      {
        id: 'red_flags',
        label: '❌ Красные флаги',
        promptMessage: `Какие ответы или формулировки по вопросу «${question.question}» сразу приведут к отказу (Red Flags) в ${company.name}?${redFlagsStr}`
      },
      {
        id: 'socratic_drill',
        label: '⚡ Сократический блиц',
        promptMessage: `Задай мне наводящий вопрос первого уровня по вопросу «${question.question}», чтобы проверить мое понимание без подсказок.`
      }
    ];

    return {
      domain: 'company_track',
      domainLabel: `${company.name}: ${question.module || question.topic}`,
      activeEntityTitle: question.question,
      groundingSummary: `Вопрос из программы ${company.name}: «${question.question}» (${question.topic}).${probeStr}${redFlagsStr}`,
      quickActionChips: chips,
      allowedPersonas: ['junior_explainer', 'senior_socratic', 'faang_interviewer', 'company_interviewer'],
      defaultPersona: 'company_interviewer',
      meta: {
        companyId: company.id,
        questionId: question.id,
        topic: question.topic
      }
    };
  }

  /**
   * Constructs typed VoiceModal configuration for Live Gemini Voice sessions.
   */
  static createVoiceSessionProps(
    company: CompanyProfile,
    question: CompanyQuestionSummary,
    mode: 'tutor' | 'interview'
  ) {
    const isAlfa = company.id === 'alfa_digital';
    const probeStr = question.depthProbe?.length ? ` Точки углубления: ${question.depthProbe.join('; ')}.` : '';
    const redFlagStr = question.redFlags?.length ? ` Красные флаги: ${question.redFlags.join('; ')}.` : '';

    const rolePrompt = isAlfa
      ? `РОЛЬ: Lead Java-архитектор в АО «Альфа-Банк» (Alfa Digital & А-Токен). ${
          mode === 'tutor'
            ? 'Режим Тьютора: разбирай физику процессов, память JVM, HotSpot, задавай сократические наводящие вопросы, помогай разобраться.'
            : 'Режим Скрининга: проведи жесткий технический блиц, оцени глубину ответа на уровне байткода и JMM.'
        }${probeStr}${redFlagStr}`
      : `РОЛЬ: Product Engineer Lead в ${company.name}. ${
          mode === 'tutor'
            ? 'Режим Тьютора: помоги разобрать тему, задавай сократические вопросы по STAR и метрикам.'
            : 'Режим Скрининга: проведи Fit/STAR собеседование с оценкой.'
        }${probeStr}${redFlagStr}`;

    return {
      topic: `${company.name}: ${question.module || question.topic}`,
      currentQuestionText: question.question,
      referenceAnswer: question.answer,
      initialSessionType: mode,
      initialTutorMode: 'deep_dive' as const,
      customPromptOverride: rolePrompt
    };
  }
}
