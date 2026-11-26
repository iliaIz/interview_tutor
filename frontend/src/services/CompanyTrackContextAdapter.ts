/**
 * CompanyTrackContextAdapter.ts
 * Deep polymorphic adapter grounding company preparation into Copilot and Gemini Live Voice.
 * Adheres strictly to ADR 0003, ADR 0004, and Rule 8 file hygiene (<= 200 lines).
 */

import {
  normalizeCompanyContext,
  type TutorActiveContext,
  type TutorQuickActionChip,
  type CompanyProfile
} from '@interview-prep/shared/tutor';

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

    const instructions = `Вопрос из программы ${company.name}: «${question.question}» (${question.topic}).\nЭталонный ответ: ${question.answer || ''}${probeStr}${redFlagsStr}`;
    const base = normalizeCompanyContext({
      profile: company,
      activeStage: {
        id: question.id,
        title: question.module || question.topic,
        description: instructions
      },
      activeTaskTitle: question.question
    });

    return {
      ...base,
      entityId: `${company.id}:${question.id}`,
      domain: `${company.name}: ${question.module || question.topic}`,
      instructions,
      quickActionChips: chips
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
    const probeStr = question.depthProbe?.length ? ` Точки углубления: ${question.depthProbe.join('; ')}.` : '';
    const redFlagStr = question.redFlags?.length ? ` Красные флаги: ${question.redFlags.join('; ')}.` : '';
    const paradigm = company.culture?.engineeringParadigm ? ` Фокус: ${company.culture.engineeringParadigm}.` : '';

    const rolePrompt = `РОЛЬ: Lead Engineer / Технический интервьюер в ${company.name}.${paradigm} ${
      mode === 'tutor'
        ? 'Режим Тьютора: разбирай первопричины и физику концепций, задавай сократические наводящие вопросы, помогай разобраться.'
        : 'Режим Скрининга: проведи жесткий технический блиц, проверь глубину понимания инвариантов, метрик и красных флагов.'
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
