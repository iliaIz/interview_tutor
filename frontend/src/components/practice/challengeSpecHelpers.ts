/**
 * challengeSpecHelpers.ts
 * Pure domain hint derivation and scoring weight normalization for ChallengeSpecPanel.
 */

import type { CodingChallenge } from '../../types/practice';

export interface HintItem {
  title: string;
  content: string;
}

export function buildDomainHints(challenge: CodingChallenge): HintItem[] {
  if (Array.isArray(challenge.hints) && challenge.hints.length > 0) {
    return challenge.hints.map((h, i) => ({
      title: `Подсказка ${i + 1}`,
      content: h
    }));
  }

  if (challenge.designPatternContext) {
    const dp = challenge.designPatternContext;
    return [
      {
        title: `Подсказка 1: Устранение запаха (${dp.antiPatternSmell.name})`,
        content: dp.antiPatternSmell.description
      },
      {
        title: `Подсказка 2: Целевой паттерн (${dp.targetPattern})`,
        content: dp.modernAlternativeTip || 'Разделите контракты на интерфейсы и инъектируйте зависимости через конструктор.'
      },
      {
        title: 'Подсказка 3: Защита контрактов',
        content: 'Все публичные сигнатуры, проверяемые существующими тестами, должны оставаться совместимыми во время рефакторинга.'
      }
    ];
  }

  if (challenge.challengeMode === 'write_the_tests' || challenge.track === 'testing_mutation') {
    return [
      {
        title: 'Подсказка 1: Граничные значения и эквивалентность',
        content: 'Проверьте нули, отрицательные значения, границы диапазонов (< vs <=) и null/empty входы, чтобы убивать мутантов границ.'
      },
      {
        title: 'Подсказка 2: Изоляция и детерминизм',
        content: 'Передавайте фиксированный java.time.Clock и проверяйте точные вызовы зависимостей и возвращаемые BigDecimal значения.'
      },
      {
        title: 'Подсказка 3: Антипаттерны AssertJ',
        content: 'Избегайте общих проверок isNotNull() без проверки полей. Каждый @Test должен проверять конкретный инвариант домена.'
      }
    ];
  }

  if (Array.isArray(challenge.smellsChecklist) && challenge.smellsChecklist.length > 0) {
    return challenge.smellsChecklist.slice(0, 3).map((s, idx) => ({
      title: `Подсказка ${idx + 1}: ${s.name}`,
      content: s.description
    }));
  }

  return [
    {
      title: 'Подсказка 1: Детерминизм и инварианты времени',
      content: 'Внедряйте java.time.Clock через конструктор и избегайте прямых вызовов Instant.now() или System.currentTimeMillis().'
    },
    {
      title: 'Подсказка 2: Финансовая точность и контракты',
      content: 'Используйте BigDecimal с RoundingMode.HALF_EVEN для денежных расчетов и не блокируйте поток I/O внутри synchronized.'
    },
    {
      title: 'Подсказка 3: Чистая структура модулей',
      content: 'Разделяйте публичные интерфейсы, доменную модель и детали хранения, сохраняя публичные контракты тестов.'
    }
  ];
}

export function normalizeFourWeights(weights?: CodingChallenge['scoringWeights']): [number, number, number, number] {
  if (!weights) return [35, 25, 25, 15];
  const raw = [
    weights.functionalCorrectness ?? 0.35,
    weights.concurrencySafety ?? 0.25,
    weights.architectureAndCleanCode ?? 0.25,
    weights.modernIdioms ?? 0.15
  ];
  const sum = raw.reduce((a, b) => a + b, 0);
  if (sum <= 0) return [35, 25, 25, 15];
  const p1 = Math.round((raw[0] / sum) * 100);
  const p2 = Math.round((raw[1] / sum) * 100);
  const p3 = Math.round((raw[2] / sum) * 100);
  const p4 = Math.max(0, 100 - p1 - p2 - p3);
  return [p1, p2, p3, p4];
}
