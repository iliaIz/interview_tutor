/**
 * verifyCacheEvictSycophancy.ts
 *
 * Automated verification of the exact scenario reported by user:
 * Candidate: "В метод с аннотацией CacheEvict передается объект"
 * Verifies Epistemic Vigilance, Zero False Affirmation, and Causal Mechanics.
 */

import { buildSystemPrompt } from '../services/live/livePromptBuilder';
import { PromptRegistry, getStrictnessDirectives } from '../prompts';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`✅ ${msg}`);
}

console.log('🔬 Verifying Anti-Sycophancy & @CacheEvict Calibration Invariants...\n');

// 1. Deep Dive Mode Prompt Verification
const deepDivePrompt = buildSystemPrompt({
  topic: 'Spring Caching & @CacheEvict',
  questionText: 'Как работает аннотация @CacheEvict и как инвалидировать запись по ключу?',
  referenceAnswer: 'Аннотация @CacheEvict удаляет запись из кэша. По умолчанию SimpleKeyGenerator формирует ключ из параметров метода. Если передается id сущности, ключ будет id. Если передать объект целиком без key SpEL, ключом станет хэш объекта, и инвалидация по id не произойдет.',
  strategy: 'socratic_tutoring',
  voiceName: 'Kore',
  maxProbes: 2,
  anchors: ['Ключ кэширования', 'SimpleKeyGenerator', 'SpEL выражение key', 'allEntries'],
  sessionType: 'tutor',
  tutorMode: 'deep_dive',
  strictness: 'standard'
});

assert(
  deepDivePrompt.includes('TRIVIA IMMUNITY') || deepDivePrompt.includes('ЗАЩИТА ОТ БУКВОЕДСТВА'),
  'Deep-dive tutor prompt includes Trivia Immunity invariant'
);
assert(
  deepDivePrompt.includes('BANNED SYCOPHANTIC OPENERS') || deepDivePrompt.includes('ЗАПРЕТ УГОДНИЧЕСТВА'),
  'Deep-dive tutor prompt bans false sycophantic openers'
);
assert(
  deepDivePrompt.includes('THOUGHT CHAIN-OF-VERIFICATION') || deepDivePrompt.includes('CoVe'),
  'Deep-dive tutor prompt enforces Thought Chain-of-Verification'
);
assert(
  deepDivePrompt.includes('SimpleKeyGenerator'),
  'Deep-dive tutor prompt explicitly documents SimpleKeyGenerator key mismatch causal risk'
);

// 2. Strictness Level Calibration Matrix
const learningDirective = getStrictnessDirectives('learning');
assert(learningDirective.includes('ОБУЧЕНИЕ И ПОДДЕРЖКА'), 'Learning strictness directive correctly identified');
assert(learningDirective.includes('SimpleKeyGenerator'), 'Learning strictness explains causal mechanics gently');

const standardDirective = getStrictnessDirectives('standard');
assert(standardDirective.includes('РЕАЛИСТИЧНОЕ СОБЕСЕДОВАНИЕ'), 'Standard L5 strictness directive correctly identified');
assert(standardDirective.includes('SimpleKeyGenerator'), 'Standard strictness probes key generation causality');

const hardcoreDirective = getStrictnessDirectives('hardcore');
assert(hardcoreDirective.includes('BAR-RAISER'), 'Hardcore L6 strictness directive correctly identified');
assert(hardcoreDirective.includes('зомби-записи'), 'Hardcore strictness stress-tests incident impact');

// 3. Interview Session Mode Prompt Verification
const interviewPrompt = buildSystemPrompt({
  topic: 'Spring Cache Eviction',
  questionText: 'Как правильно инвалидировать кэш в Spring?',
  referenceAnswer: 'Использовать @CacheEvict с указанием ключа или передачи id.',
  strategy: 'adaptive_probing',
  voiceName: 'Aoede',
  maxProbes: 2,
  anchors: ['@CacheEvict', 'Ключ', 'SpEL'],
  sessionType: 'interview',
  strictness: 'standard'
});

assert(
  interviewPrompt.includes('TRIVIA IMMUNITY'),
  'Interview prompt includes Trivia Immunity invariant'
);
assert(
  interviewPrompt.includes('EXAM ANTI-SYCOPHANCY'),
  'Interview prompt includes Exam Anti-Sycophancy directive'
);
assert(
  interviewPrompt.includes('THOUGHT CHAIN-OF-VERIFICATION'),
  'Interview prompt enforces CoVe in reasoning thoughts'
);

console.log('\n🎉 All @CacheEvict & Epistemic Vigilance calibration checks passed!');
