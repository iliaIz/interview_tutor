/**
 * SpeechClarityAnalyzer.ts
 * Evaluates verbal fluency, disfluencies, and speech clarity percentage.
 * SLA: <= 120 lines (Rule 8 compliant).
 */

export interface SpeechClarityMetrics {
  totalWords: number;
  fillerWordsCount: number;
  detectedFillers: Array<{ word: string; count: number }>;
  clarityScorePercent: number;
  pacingState: 'optimal' | 'rushed' | 'slow';
  wpm: number;
}

export class SpeechClarityAnalyzer {
  public static readonly RUSSIAN_FILLERS = [
    'как бы', 'типа', 'короче', 'в общем', 'ну', 'э-э', 'ээ', 'мм', 'вот',
    'собственно', 'так сказать', 'значит', 'на самом деле', 'по сути', 'в принципе',
    'понимаешь', 'слушай', 'видишь ли', 'грубо говоря', 'как говорится',
    'то есть', 'ну вот', 'да ладно', 'скажем так'
  ];

  public static readonly ENGLISH_FILLERS = [
    'like', 'you know', 'um', 'uh', 'er', 'ah', 'actually', 'basically',
    'literally', 'honestly', 'sort of', 'kind of', 'i mean', 'right',
    'so yeah', 'obviously', 'to be honest'
  ];

  public static analyze(transcriptText: string, grossWpm: number = 0): SpeechClarityMetrics {
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

    const words = text.split(/\s+/).filter((w) => w.length > 0);
    const totalWords = words.length;
    const lowerText = text.toLowerCase();

    const fillerMap = new Map<string, number>();
    let totalFillers = 0;

    const allFillers = [...this.RUSSIAN_FILLERS, ...this.ENGLISH_FILLERS];
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

    let pacingState: 'optimal' | 'rushed' | 'slow' = 'optimal';
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
}
