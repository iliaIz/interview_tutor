import { CodingChallenge } from '../challengeSeedData';
import { L0_PRIMITIVES_PART1 } from './l0PrimitivesPart1';
import { L0_PRIMITIVES_PART2 } from './l0PrimitivesPart2';
import { L0_PRIMITIVES_PART3 } from './l0PrimitivesPart3';
import { L1_REVERSE_TESTING_CHALLENGES } from './reverseTestingChallenges';

// ============================================================================
// L0: FUNDAMENTALS & PRIMITIVES (Worked Examples & Micro-Completions)
// ============================================================================

export const L0_PRIMITIVES_CHALLENGES: CodingChallenge[] = [
  ...L0_PRIMITIVES_PART1,
  ...L0_PRIMITIVES_PART2,
  ...L0_PRIMITIVES_PART3
];

// Backwards-compatible re-export
export { L1_REVERSE_TESTING_CHALLENGES };
