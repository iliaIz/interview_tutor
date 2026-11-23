/**
 * liveRubricBuilder.ts
 * Extraction of semantic evaluation anchors and weighted scoring rubrics.
 * Cognitive Bounding Limit: <= 120 lines (Rule 8 compliant).
 */

export interface WeightedAnchor {
  id: string;
  title: string;
  weight: number;
  description: string;
}

/**
 * Extracts up to 10 semantic evaluation anchors from reference answer
 */
export function extractDefaultAnchors(referenceAnswer: string, questionText?: string): string[] {
  if (!referenceAnswer || referenceAnswer.trim().length === 0) {
    return [
      'Понимание базового определения и терминологии',
      'Архитектурные компоненты и их назначение',
      'Практическое применение и примеры использования'
    ];
  }

  const rawLines = referenceAnswer
    .split(/\n+/)
    .map((l) => l.replace(/^[-*•\d.)\s]+/, '').trim())
    .filter((l) => l.length > 10 && !l.startsWith('#') && !l.startsWith('```'));

  if (rawLines.length >= 2) {
    return rawLines.slice(0, 10);
  }

  const sentences = referenceAnswer
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 12);

  if (sentences.length >= 2) {
    return sentences.slice(0, 10);
  }

  return [referenceAnswer.slice(0, 120)];
}

/**
 * Builds weighted scoring rubric by question typology:
 * Behavioral -> STAR (30/40/30)
 * Trade-off -> PREP (30/40/30)
 * Definitional / Under-the-hood -> Rule of 3 (35/35/30)
 */
export function buildWeightedRubric(referenceAnswer: string, questionText: string, defaultAnchors?: string[]): WeightedAnchor[] {
  const qLower = (questionText || '').toLowerCase();

  // 1. Behavioral -> STAR (30 / 40 / 30)
  const isBehavioral = ['опыт', 'инцидент', 'авария', 'баг', 'конфликт', 'проект', 'failure', 'incident', 'tell me about', 'ситуаци'].some(w => qLower.includes(w));
  if (isBehavioral) {
    return [
      { id: 'c1_situation_task', title: 'Situation & Task (Контекст, масштаб и цели)', weight: 30, description: 'Четкое описание контекста проблемы, бизнес-ограничений и стоящих задач' },
      { id: 'c2_action', title: 'Action (Инженерные действия и архитектурные решения)', weight: 40, description: 'Конкретные личные действия, выбор технологий, паттернов и реализация' },
      { id: 'c3_result', title: 'Result & Learnings (Измеримый итог и выводы)', weight: 30, description: 'Метрики, эффект для продакшена и ретроспективные архитектурные выводы' }
    ];
  }

  // 2. Trade-off -> PREP (30 / 40 / 30)
  const isTradeoff = [' vs ', 'или', 'разниц', 'сравните', 'почему', 'выбрать', 'компромисс', 'trade-off', 'difference'].some(w => qLower.includes(w));
  if (isTradeoff) {
    return [
      { id: 'c1_point', title: 'Point (Ключевой тезис и критерии выбора)', weight: 30, description: 'Понятный выбор позиции и ясные критерии сравнения технологий' },
      { id: 'c2_reason', title: 'Reason (Техническое обоснование компромиссов)', weight: 40, description: 'Архитектурные плюсы и минусы, latency, throughput, memory, сложность поддержки' },
      { id: 'c3_example', title: 'Example & Best Practice (Кейс из практики и итог)', weight: 30, description: 'Реальный production-сценарий применения и итоговая инженерная рекомендация' }
    ];
  }

  // 3. Definitional / Under-the-hood -> Rule of 3 (35 / 35 / 30)
  return [
    { id: 'c1_definition', title: 'Определение и ключевые концепции (Rule of 3: Шаг 1)', weight: 35, description: 'Точная терминология, базовое назначение и ключевые концепции обсуждаемой темы' },
    { id: 'c2_internals', title: 'Механика под капотом и архитектура (Rule of 3: Шаг 2)', weight: 35, description: 'Внутреннее устройство, структуры данных, жизненный цикл и механизмы работы в рантайме' },
    { id: 'c3_pitfalls', title: 'Подводные камни и Best Practices (Rule of 3: Шаг 3)', weight: 30, description: 'Типовые ошибки, граничные случаи, отказоустойчивость, влияние на производительность и production-рекомендации' }
  ];
}
