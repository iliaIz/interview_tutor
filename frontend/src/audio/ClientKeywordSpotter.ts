/**
 * ClientKeywordSpotter.ts
 * Browser-native On-Device Zero-Latency Keyword Spotting (KWS).
 * Fast-Path Tier 1: Sub-150ms visual trigger using interim SpeechRecognition.
 * SOTA Late 2026 Engine vs. Payload isolation.
 */

import { HrAnchorCard } from '@interview-prep/shared';

export interface KeywordSpotterCallbacks {
  onAnchorHit: (anchorId: string, latencyMs: number) => void;
  onInterimText?: (text: string) => void;
  onError?: (err: Error) => void;
}

export class ClientKeywordSpotter {
  private recognition: any = null;
  private isActive = false;
  private anchorCards: HrAnchorCard[] = [];
  private hitAnchorIds = new Set<string>();
  private speechStartEpoch = 0;

  constructor(private callbacks: KeywordSpotterCallbacks) {
    this.initRecognition();
  }

  private initRecognition(): void {
    if (typeof window === 'undefined') return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn('⚠️ [KWS_FALLBACK] Web Speech API not supported in this browser. Tier-2 server deltas will be used.');
      return;
    }

    try {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'ru-RU';
      this.recognition.maxAlternatives = 1;

      this.recognition.onresult = (event: any) => this.handleRecognitionResult(event);
      this.recognition.onerror = (event: any) => {
        if (event.error !== 'no-speech') {
          console.debug('[KWS] SpeechRecognition error:', event.error);
        }
      };
      this.recognition.onend = () => {
        if (this.isActive) {
          try {
            this.recognition?.start();
          } catch {
            // Browser might throw if restarted too fast, silence safely
          }
        }
      };
    } catch (e: any) {
      console.warn('⚠️ [KWS] Could not initialize Web Speech API:', e?.message);
    }
  }

  public setAnchorCards(cards: HrAnchorCard[]): void {
    this.anchorCards = cards;
    this.hitAnchorIds.clear();
  }

  public start(): void {
    if (this.isActive || !this.recognition) return;
    this.isActive = true;
    this.speechStartEpoch = Date.now();
    try {
      this.recognition.start();
      console.log('🎤 [KWS] Client on-device keyword spotter started (<150ms Tier 1).');
    } catch {
      // Already running or permission issue
    }
  }

  public stop(): void {
    this.isActive = false;
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {}
    }
  }

  public reset(): void {
    this.hitAnchorIds.clear();
    this.speechStartEpoch = Date.now();
  }

  private handleRecognitionResult(event: any): void {
    if (!event.results || this.anchorCards.length === 0) return;

    let interimTranscript = '';
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      const transcriptPiece = event.results[i][0]?.transcript || '';
      interimTranscript += ' ' + transcriptPiece;
    }

    const normalizedSpeech = interimTranscript.toLowerCase().trim();
    if (!normalizedSpeech) return;

    this.callbacks.onInterimText?.(normalizedSpeech);
    this.matchKeywords(normalizedSpeech);
  }

  private matchKeywords(speechText: string): void {
    const now = Date.now();
    const latencyMs = Math.max(40, now - this.speechStartEpoch);

    for (const card of this.anchorCards) {
      if (this.hitAnchorIds.has(card.id)) continue;

      let matched = false;

      // 1. Direct stem match (all stems must be present in speech)
      const allStemsMatch = card.matchStems.every((stem) => speechText.includes(stem.toLowerCase()));
      if (allStemsMatch) {
        matched = true;
      }

      // 2. Synonyms match (any alternative synonym list matches completely)
      if (!matched && card.synonymStems && card.synonymStems.length > 0) {
        for (const synonymList of card.synonymStems) {
          const allSynonymsMatch = synonymList.every((syn) => speechText.includes(syn.toLowerCase()));
          if (allSynonymsMatch) {
            matched = true;
            break;
          }
        }
      }

      if (matched) {
        this.hitAnchorIds.add(card.id);
        console.log(`⚡ [KWS_HIT] Anchor spotted: "${card.label}" (id: ${card.id}) in ${latencyMs}ms!`);
        this.callbacks.onAnchorHit(card.id, latencyMs);
      }
    }
  }
}
