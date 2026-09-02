// Automated unit test for Acoustic & Speech Clarity logic
const assert = require('assert');

// Port the logic directly to test the algorithms
const RUSSIAN_FILLERS = [
  'эээ', 'ээ', 'ммм', 'мм', 'как бы', 'типа', 'ну', 'в общем-то',
  'в общем', 'короче', 'так сказать', 'значит', 'собственно',
  'в принципе', 'вот', 'слушай'
];

const ENGLISH_FILLERS = [
  'um', 'uh', 'er', 'ah', 'like', 'you know', 'basically',
  'sort of', 'kind of', 'actually', 'literally', 'i mean', 'right'
];

function analyzeSpeechClarity(transcriptText, grossWpm = 0) {
  const text = (transcriptText || '').trim();
  if (!text) {
    return {
      totalWords: 0,
      fillerWordsCount: 0,
      detectedFillers: [],
      clarityScorePercent: 100,
      pacingState: 'optimal',
      wpm: grossWpm
    };
  }

  const words = text.split(/\s+/).filter(w => w.length > 0);
  const totalWords = words.length;
  const lowerText = text.toLowerCase();

  const fillerMap = new Map();
  let totalFillers = 0;

  const allFillers = [...RUSSIAN_FILLERS, ...ENGLISH_FILLERS];
  for (const filler of allFillers) {
    const escaped = filler.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?:^|[\\s,.;:!?"'«»(—–-])${escaped}(?=[\\s,.;:!?"'«»)—–-]|$|\\n)`, 'gi');
    const matches = lowerText.match(regex);
    if (matches && matches.length > 0) {
      fillerMap.set(filler, (fillerMap.get(filler) || 0) + matches.length);
      totalFillers += matches.length;
    }
  }

  const detectedFillers = Array.from(fillerMap.entries())
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count);

  const clarityScorePercent = totalWords > 0
    ? Math.max(0, Math.min(100, Math.round(100 - (totalFillers / totalWords) * 150)))
    : 100;

  let pacingState = 'optimal';
  if (grossWpm > 170) pacingState = 'rushed';
  else if (grossWpm > 0 && grossWpm < 100) pacingState = 'slow';

  return {
    totalWords,
    fillerWordsCount: totalFillers,
    detectedFillers,
    clarityScorePercent,
    pacingState,
    wpm: grossWpm
  };
}

function classifyQuestionStructure(questionText, topic) {
  const qLower = (questionText || '').toLowerCase();
  const tLower = (topic || '').toLowerCase();

  const behavioralKeywords = [
    'инцидент', 'авари', 'опыт', 'расскажите о', 'случай', 'баг', 'проблем',
    'утечк', 'падени', 'дедлок', 'сбой', 'поломк', 'сложный баг', 'ошибк',
    'incident', 'outage', 'failure', 'tell me about', 'experience', 'situation',
    'debugged', 'debug', 'post-mortem', 'rca', 'root cause'
  ];

  const isBehavioral = behavioralKeywords.some(kw => qLower.includes(kw) || tLower.includes(kw));
  if (isBehavioral) {
    return {
      category: 'behavioral',
      title: 'Опыт / Инцидент (STAR)',
      recommendedFramework: 'STAR'
    };
  }

  const tradeoffKeywords = [
    ' vs ', 'или', 'разниц', 'сравните', 'почему', 'выбрать', 'компромисс',
    'когда использовать', 'в чем отличие', 'плюсы и минусы', 'trade-off',
    'difference between', 'compare', 'prefer', 'pros and cons', 'when to use'
  ];

  const isTradeoff = tradeoffKeywords.some(kw => qLower.includes(kw));
  if (isTradeoff) {
    return {
      category: 'tradeoff',
      title: 'Архитектурный выбор (PREP)',
      recommendedFramework: 'PREP'
    };
  }

  return {
    category: 'definitional',
    title: 'Теория и кишки (Rule of 3)',
    recommendedFramework: 'RULE_OF_3'
  };
}

console.log('--- Test 1: Clean Speech ---');
const clean = analyzeSpeechClarity('ConcurrentHashMap использует массив сегментов и Compare-And-Swap операции для бесконфликтной записи.', 140);
console.log('Clean clarity:', clean.clarityScorePercent, 'Fillers:', clean.fillerWordsCount, 'Pacing:', clean.pacingState);
assert.strictEqual(clean.fillerWordsCount, 0);
assert.strictEqual(clean.clarityScorePercent, 100);
assert.strictEqual(clean.pacingState, 'optimal');

console.log('--- Test 2: Disfluent Speech with Russian Fillers ---');
const disfluentRu = analyzeSpeechClarity('Ну, как бы, ConcurrentHashMap, типа, короче, использует CAS, эээ, в общем-то вот так.', 180);
console.log('Disfluent RU clarity:', disfluentRu.clarityScorePercent, 'Fillers:', disfluentRu.fillerWordsCount, 'Detected:', disfluentRu.detectedFillers, 'Pacing:', disfluentRu.pacingState);
assert(disfluentRu.fillerWordsCount >= 4, 'Expected at least 4 filler words detected');
assert(disfluentRu.clarityScorePercent < 70, 'Clarity score should reflect penalty');
assert.strictEqual(disfluentRu.pacingState, 'rushed');

console.log('--- Test 3: Disfluent Speech with English Fillers ---');
const disfluentEn = analyzeSpeechClarity('Um, basically, like, you know, we used optimistic locking actually.', 90);
console.log('Disfluent EN clarity:', disfluentEn.clarityScorePercent, 'Fillers:', disfluentEn.fillerWordsCount, 'Detected:', disfluentEn.detectedFillers, 'Pacing:', disfluentEn.pacingState);
assert(disfluentEn.fillerWordsCount >= 4, 'Expected at least 4 English fillers detected');
assert.strictEqual(disfluentEn.pacingState, 'slow');

console.log('--- Test 4: Adaptive Question Categorization ---');
const qBehavioral = classifyQuestionStructure('Расскажите о самом сложном инциденте в проде, когда произошел дедлок БД.');
console.log('Question 1:', qBehavioral);
assert.strictEqual(qBehavioral.recommendedFramework, 'STAR');

const qTradeoff = classifyQuestionStructure('Kafka vs RabbitMQ: когда выбрать один брокер вместо другого и в чем разница?');
console.log('Question 2:', qTradeoff);
assert.strictEqual(qTradeoff.recommendedFramework, 'PREP');

const qTheory = classifyQuestionStructure('Как устроен ConcurrentHashMap в Java 8 и как работает ресайз таблицы?');
console.log('Question 3:', qTheory);
assert.strictEqual(qTheory.recommendedFramework, 'RULE_OF_3');

console.log('✅ ALL SPEECH & ADAPTIVE COACHING TESTS PASSED PERFECTLY!');
