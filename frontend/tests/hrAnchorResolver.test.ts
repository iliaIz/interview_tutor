import assert from 'node:assert/strict';
import type { HrQuestionRubricItem } from '@interview-prep/shared';
import {
  formatHrStartCtaLabel,
  resolveDisplayAnchors,
  resolveQuestionAnchorCards
} from '../src/store/hrAnchorResolver';

const sampleQuestion: HrQuestionRubricItem = {
  id: 'hr_q_sample',
  title: 'Sample Pitch',
  canonicalQuestion: 'Tell me about yourself.',
  referenceAnswer: 'I have 7+ years experience.',
  targetDurationSec: { minSec: 60, maxSec: 80, hardCapSec: 90 },
  forbiddenPatterns: ['пет-проект'],
  requiredAnchors: [
    { id: 'a1', label: 'Anchor 1', category: 'legal', matchStems: ['a1'], weight: 2, status: 'PENDING' },
    { id: 'a2', label: 'Anchor 2', category: 'metrics', matchStems: ['a2'], weight: 2, status: 'PENDING' },
    { id: 'a3', label: 'Anchor 3', category: 'architecture', matchStems: ['a3'], weight: 3, status: 'PENDING' }
  ],
  chunks: [
    { id: 'chunk_1', title: 'Chunk 1', anchorIds: ['a1', 'a2'], summaryMarkdown: '', targetDurationSec: { minSec: 20, maxSec: 35 } }
  ],
  microBeats: [
    {
      id: 'beat_1', chunkId: 'chunk_1', title: 'Beat One', anchorIds: ['a1'],
      immutableFacts: ['Fact 1'], spokenVariants: ['Phrase A', 'Phrase B'],
      hrTriggerPrompt: 'Prompt 1?', cueHints: ['a1']
    },
    {
      id: 'beat_2', chunkId: 'chunk_1', title: 'Beat Two', anchorIds: ['a3'],
      immutableFacts: ['Fact 3'], spokenVariants: ['Phrase C', 'Phrase D'],
      hrTriggerPrompt: 'Prompt 2?', cueHints: ['a3']
    }
  ]
};

// 1. Single-beat isolation filters anchors accurately (parity between initializeSession & resetForRetry)
const isoCards = resolveQuestionAnchorCards(sampleQuestion, {
  mode: 'guided_zero_start',
  beatScope: 'single_beat',
  startBeatId: 'beat_2',
  chunkId: 'chunk_1' // Stale chunkId must NOT override guided mode
});
assert.deepEqual(isoCards.map((c) => c.id), ['a3'], 'single_beat filters strictly to beat_2 anchorIds');

// 2. all_from_beat returns full requiredAnchors list
const routeCards = resolveQuestionAnchorCards(sampleQuestion, {
  mode: 'guided_zero_start',
  beatScope: 'all_from_beat',
  startBeatId: 'beat_2'
});
assert.deepEqual(routeCards.map((c) => c.id), ['a1', 'a2', 'a3']);

// 3. Rehearsal mode respects chunkId filter
const chunkCards = resolveQuestionAnchorCards(sampleQuestion, {
  mode: 'tutor_rehearsal',
  chunkId: 'chunk_1'
});
assert.deepEqual(chunkCards.map((c) => c.id), ['a1', 'a2']);

// 4. Display helper & CTA formatter parity
const disp = resolveDisplayAnchors(sampleQuestion, [], 'guided_zero_start', 'beat_1', 'single_beat');
assert.deepEqual(disp.map((a) => a.id), ['a1']);
assert.equal(formatHrStartCtaLabel(sampleQuestion, 'guided_zero_start', 'beat_2', 'single_beat'), 'Отработать только Блок 2: «Beat Two»');
assert.equal(formatHrStartCtaLabel(sampleQuestion, 'guided_zero_start', 'beat_2', 'all_from_beat'), 'Начать с Блока 2 из 2 (весь маршрут)');
assert.equal(formatHrStartCtaLabel(sampleQuestion, 'tutor_rehearsal', null, 'all_from_beat'), 'Начать репетицию (60–80с)');

console.log('✅ All hrAnchorResolver unit tests passed!');
