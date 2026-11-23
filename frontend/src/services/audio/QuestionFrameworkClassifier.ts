/**
 * QuestionFrameworkClassifier.ts
 * Categorizes technical questions into Definitional (Rule of 3), Trade-off (PREP), or Behavioral (STAR).
 * SLA: <= 100 lines (Rule 8 compliant).
 */

export type QuestionCategoryType = 'definitional' | 'tradeoff' | 'behavioral';

export interface QuestionStructureFormat {
  category: QuestionCategoryType;
  title: string;
  recommendedFramework: 'STAR' | 'PREP' | 'RULE_OF_3';
  description: string;
  badgeStyle: string;
}

export class QuestionFrameworkClassifier {
  public static classify(questionText: string, topic?: string): QuestionStructureFormat {
    const qLower = (questionText || '').toLowerCase();
    const tLower = (topic || '').toLowerCase();

    // 1. Behavioral & Incident questions (Experience, failures, war stories) -> STAR
    const behavioralKeywords = [
      'инцидент', 'авари', 'опыт', 'расскажите о', 'случай', 'баг', 'проблем',
      'утечк', 'падени', 'дедлок', 'сбой', 'поломк', 'сложный баг', 'ошибк',
      'incident', 'outage', 'failure', 'tell me about', 'experience', 'situation',
      'debugged', 'debug', 'post-mortem', 'rca', 'root cause'
    ];

    const isBehavioral = behavioralKeywords.some((kw) => qLower.includes(kw) || tLower.includes(kw));
    if (isBehavioral) {
      return {
        category: 'behavioral',
        title: 'Опыт / Инцидент (STAR)',
        recommendedFramework: 'STAR',
        description: 'Рекомендуется структура STAR: Situation (Контекст) -> Task (Задача) -> Action (Ваши действия) -> Result (Измеримый итог).',
        badgeStyle: 'bg-rose-50 text-pastel-accentRoseText border-pastel-accentRose/30'
      };
    }

    // 2. Trade-off & Architectural choice questions -> PREP
    const tradeoffKeywords = [
      ' vs ', 'или', 'разниц', 'сравните', 'почему', 'выбрать', 'компромисс',
      'когда использовать', 'в чем отличие', 'плюсы и минусы', 'trade-off',
      'difference between', 'compare', 'prefer', 'pros and cons', 'when to use'
    ];

    const isTradeoff = tradeoffKeywords.some((kw) => qLower.includes(kw));
    if (isTradeoff) {
      return {
        category: 'tradeoff',
        title: 'Архитектурный выбор (PREP)',
        recommendedFramework: 'PREP',
        description: 'Рекомендуется структура PREP: Point (Тезис) -> Reason (Причина) -> Example (Пример из практики) -> Point (Итоговый вывод).',
        badgeStyle: 'bg-purple-50 text-purple-700 border-purple-200/80'
      };
    }

    // 3. Definitional & Under-the-Hood questions -> Rule of 3
    return {
      category: 'definitional',
      title: 'Теория и кишки (Rule of 3)',
      recommendedFramework: 'RULE_OF_3',
      description: 'Рекомендуется структура Rule of 3: 1) Определение -> 2) Механика под капотом (JMM/Spring) -> 3) Подводный камень / Best practice.',
      badgeStyle: 'bg-blue-50 text-blue-700 border-blue-200/80'
    };
  }
}
