/**
 * verifyPrompts.ts
 *
 * Automated verification entrypoint for the Centralized Prompt Architecture,
 * Anti-Sycophancy, Indirect Prompt Injection Defense,
 * Zero-Phantom Deductions Ledger, and Audio Bloat Clamp (Spec 55 <= 200L).
 */

import { PromptRegistry, getPersonaPromptDirectives, isLanguageDrifted } from '../prompts';
import { getSafeSpokenText, TurnReasoningResult } from '../routes/interviewTurn';
import { HR_ANTI_SYCOPHANCY_DIRECTIVES } from '../services/live/hrPromptBuilder';
import { runPromptTextAssertions } from './verifyPromptTextAssertions';
import { runPromptLiveAssertions } from './verifyPromptLiveAssertions';

function assert(condition: boolean, msg: string): void {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`✅ ${msg}`);
}

console.log('🚀 Running SOTA Prompt Architecture & Anti-Sycophancy Verification...\n');

// Text-mode prompts, compass rules, sandboxing, System Design, Triage, and Spec 21 Evaluators
runPromptTextAssertions(assert);

// LiveVoice prompts, LivePromptComposer, tool capability invariants, Turn 0 lockdown, and HR matrix integration
runPromptLiveAssertions(assert);

// Socratic Forward-Probing Invariants
const invariants = PromptRegistry.getInvariants();
assert(
  invariants.socraticForwardProbing.includes('FORWARD-PROPELLING STRESS FACTORS'),
  'Socratic forward-probing invariant enforces stress factors and bans echoing'
);
assert(
  invariants.socraticForwardProbing.includes('BANNED ECHOING PATTERNS'),
  'Socratic forward-probing bans repeating the candidate words'
);

// TTS Audio Bloat Clamp (getSafeSpokenText)
const probeResult: TurnReasoningResult = {
  action: 'probe',
  replyText: 'Каким образом вы обеспечите детерминизм времени в тестах?'
};
assert(
  getSafeSpokenText(probeResult) === probeResult.replyText,
  'getSafeSpokenText returns replyText for probe action'
);

const shortEvalResult: TurnReasoningResult = {
  action: 'evaluate',
  score: 85,
  spokenFeedback: 'Отличный ответ! Вы точно раскрыли тему и учли инварианты.'
};
assert(
  getSafeSpokenText(shortEvalResult) === shortEvalResult.spokenFeedback,
  'getSafeSpokenText returns short spokenFeedback without modification'
);

const runawayFeedback = 'Раз два три четыре пять '.repeat(15);
const clampedSpeech = getSafeSpokenText({ action: 'evaluate', score: 75, spokenFeedback: runawayFeedback });
const clampedWordCount = clampedSpeech.split(/\s+/).length;
assert(
  clampedWordCount <= 45,
  `getSafeSpokenText clamps runaway spokenFeedback to safe length (got ${clampedWordCount} words)`
);
assert(
  clampedSpeech.includes('... Подробный разбор открыт на экране.'),
  'getSafeSpokenText appends safe visual screen redirection when clamped'
);

const fallbackSpeech = getSafeSpokenText({
  action: 'evaluate',
  score: 90,
  feedback: 'Очень длинный письменный разбор на три страницы текста с деталями...'
});
assert(
  fallbackSpeech.includes('90 баллов') && !fallbackSpeech.includes('Очень длинный письменный разбор'),
  'getSafeSpokenText avoids reading out written feedback essay and provides clean score announcement'
);

// Persona Radical Candor & Demarcation
const mentorDirectives = getPersonaPromptDirectives({
  persona: 'mentor',
  targetGrade: 'L5_SENIOR',
  topic: 'Concurrency'
});
assert(
  mentorDirectives.evaluationRubricDirective.includes('ZERO PHANTOM DEDUCTIONS'),
  'Mentor persona enforces ZERO PHANTOM DEDUCTIONS'
);
assert(
  mentorDirectives.roleDirective.includes('RADICAL CANDOR'),
  'Mentor persona implements Radical Candor (supportive tone with zero grade inflation)'
);
assert(
  mentorDirectives.roleDirective.includes('ПРОТОКОЛ ДЕМАРКАЦИИ ПРАВОТЫ'),
  'mentor persona contains mandatory truth demarcation protocol'
);

assert(
  HR_ANTI_SYCOPHANCY_DIRECTIVES.includes('АКСИОМА ЭПИСТЕМИЧЕСКОЙ ЗАБОТЫ И ДЕМАРКАЦИЯ'),
  'HR_ANTI_SYCOPHANCY_DIRECTIVES includes Rule 5 Epistemic Benevolence & Demarcation'
);

const friendlySourcerDirectives = getPersonaPromptDirectives({
  persona: 'friendly_sourcer',
  targetGrade: 'L5_SENIOR',
  topic: 'HR Screening'
});
assert(
  friendlySourcerDirectives.roleDirective.includes('РАЗДЕЛЕНИЕ ДРУЖЕЛЮБИЯ И КАЛИБРОВКИ (ZERO FLATTERY)'),
  'friendly_sourcer persona strictly separates warmth from grading rigor'
);

// Language Contamination Guard Tests
assert(
  !isLanguageDrifted('Привет, давай разберем устройство ConcurrentHashMap под капотом'),
  'Russian sentence with English technical terms is NOT flagged as language drift'
);
assert(
  isLanguageDrifted('Sure, let us explore the ConcurrentHashMap implementation and its internal mechanisms in detail.'),
  'English sentence is flagged as language drift'
);
assert(
  !isLanguageDrifted('Короткая фраза'),
  'Short Russian phrase is not flagged as language drift'
);

console.log('\n🎉 All 45+ automated prompt, anti-sycophancy, sandboxing, Extended Thinking invariants, tool boundaries, and score calibration assertions passed successfully!');
process.exit(0);
