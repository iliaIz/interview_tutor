/**
 * verifyPrompts.ts
 *
 * Automated verification of the Centralized Prompt Architecture & Anti-Sycophancy Engine.
 */

import { PromptRegistry } from '../prompts';
import { buildSystemPrompt } from '../services/live/livePromptBuilder';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`✅ ${msg}`);
}

console.log('🚀 Running Prompt Architecture & Anti-Sycophancy Verification...\n');

// 1. Check Registry Version and Rules
assert(PromptRegistry.version === '2026.9.1', 'PromptRegistry version is 2026.9.1');
const testingRules = PromptRegistry.getTestingRules();
assert(testingRules.length === 5, `Testing compass rules count is 5 (got ${testingRules.length})`);
const lldRules = PromptRegistry.getLldRules();
assert(lldRules.length === 5, `LLD compass rules count is 5 (got ${lldRules.length})`);

// 2. Check Text Tutor Prompt across Personas and Domains
const personas = ['junior_explainer', 'middle_scaffold', 'senior_socratic', 'faang_interviewer'] as const;
const domains = [
  { title: 'Concurrent Rate Limiter', category: 'Low-Level Design (LLD)' },
  { title: 'Spring Transaction Self-Invocation', category: 'Spring Transactions' },
  { title: 'Payment Service Unit Test', category: 'Testing & Mutation Katas' }
];

for (const d of domains) {
  for (const p of personas) {
    const prompt = PromptRegistry.buildTutorPrompt({
      persona: p,
      assistanceLevel: 2,
      kataTitle: d.title,
      kataCategory: d.category,
      kataInstructions: 'Implement solution',
      activeFilePath: 'src/main/java/Service.java',
      activeFileContent: 'public class Service {}'
    });

    assert(
      prompt.includes('ZERO FALSE AFFIRMATION'),
      `Tutor prompt for [${d.category} - ${p}] contains ZERO FALSE AFFIRMATION directive`
    );
    assert(
      prompt.includes('ADVERSARY COUNTEREXAMPLE'),
      `Tutor prompt for [${d.category} - ${p}] contains ADVERSARY COUNTEREXAMPLE directive`
    );
    assert(
      prompt.includes('TIME VIRTUALIZATION'),
      `Tutor prompt for [${d.category} - ${p}] contains Platform Invariants (Clock)`
    );
    assert(
      prompt.includes('FINANCIAL PRECISION'),
      `Tutor prompt for [${d.category} - ${p}] contains Platform Invariants (BigDecimal)`
    );
  }
}

// 3. Check Live Audio Pair Tutoring Prompt
const livePairPrompt = PromptRegistry.buildLivePairPrompt({
  domain: 'lld',
  persona: 'senior_socratic',
  isFemale: true,
  userGender: 'female',
  bugTitle: 'Rate Limiter',
  questionText: 'How to design Rate Limiter without Thread.sleep?',
  codeSnippet: 'class RateLimiter {}'
});

assert(
  livePairPrompt.includes('VOICE ANTI-SYCOPHANCY'),
  'Live pair prompt contains VOICE ANTI-SYCOPHANCY directive'
);
assert(
  livePairPrompt.includes('МУЛЬТИМОДАЛЬНЫЙ СИМБИОЗ') || livePairPrompt.includes('MULTIMODAL SYMBIOSIS'),
  'Live pair prompt contains MULTIMODAL SYMBIOSIS directive'
);
assert(
  livePairPrompt.includes('update_whiteboard'),
  'Live pair prompt instructs to use update_whiteboard'
);
assert(
  livePairPrompt.includes('ГРАММАТИЧЕСКИЙ РОД ИИ (СТРОГО ЖЕНСКИЙ)'),
  'Live pair prompt adheres to AI female voice gender rule'
);

// 4. Check Live System Prompt Builder Integration
const practicePairLivePrompt = buildSystemPrompt({
  topic: 'LLD',
  questionText: 'Parking Lot',
  referenceAnswer: 'Model parking spaces',
  strategy: 'socratic_tutoring',
  voiceName: 'Kore',
  maxProbes: 2,
  anchors: ['Classes', 'Locks'],
  tutorMode: 'practice_pair',
  challengeCategory: 'Low-Level Design (LLD)'
});

assert(
  practicePairLivePrompt.includes('VOICE ANTI-SYCOPHANCY'),
  'buildSystemPrompt(tutorMode: practice_pair) successfully delegates and includes VOICE ANTI-SYCOPHANCY'
);

const bugHuntLivePrompt = buildSystemPrompt({
  topic: 'Concurrency',
  questionText: 'Find Bug',
  referenceAnswer: 'Race condition on counter',
  strategy: 'socratic_tutoring',
  voiceName: 'Puck',
  maxProbes: 2,
  anchors: ['AtomicLong', 'Visibility'],
  tutorMode: 'bug_hunt'
});

assert(
  bugHuntLivePrompt.includes('VOICE ANTI-SYCOPHANCY'),
  'buildSystemPrompt(tutorMode: bug_hunt) includes VOICE ANTI-SYCOPHANCY'
);

const examLivePrompt = buildSystemPrompt({
  topic: 'Spring Boot',
  questionText: 'Explain @Transactional',
  referenceAnswer: 'AOP proxy, rollback on RuntimeException',
  strategy: 'socratic_tutoring',
  voiceName: 'Kore',
  maxProbes: 2,
  anchors: ['AOP', 'Propagation'],
  sessionType: 'interview'
});

assert(
  examLivePrompt.includes('EXAM ANTI-SYCOPHANCY'),
  'buildSystemPrompt(sessionType: interview) includes EXAM ANTI-SYCOPHANCY'
);

console.log('\n🎉 All 15+ automated prompt & anti-sycophancy assertions passed successfully!');
