/**
 * LiveVoiceFrameParser.ts
 * SOTA Late September 2026 Protocol Frame Parser for Gemini 3.8 Live & LiteLLM Gateway.
 * 
 * Features:
 * - Direct UTF-8 decoding and resilient JSON normalization
 * - Symmetrical model text extraction from BOTH modelTurn.parts[].text AND outputTranscription.text
 * - Extraction of PCM 24kHz audio chunks, tool calls, evaluations, and terminal signals
 * 
 * Cognitive bounding limit: <= 120 lines.
 */

import { VoiceEvaluationResult } from './types';

export interface ParsedLiveFrameResult {
  type?: string;
  hasAudio: boolean;
  audioChunks: string[];
  hasText: boolean;
  textDeltas: string[];
  isTurnDone: boolean;
  interactionStatus?: string;
  isInterrupted: boolean;
  voiceActivity?: 'ACTIVITY_START' | 'ACTIVITY_END';
  evaluation?: VoiceEvaluationResult;
  toolCallPayload?: any;
  whiteboardPayload?: any;
  chaosPayload?: any;
  verdictPayload?: any;
  rawParsed?: any;
}

export class LiveVoiceFrameParser {
  public static parse(rawData: any): ParsedLiveFrameResult | null {
    try {
      const text = typeof rawData === 'string' ? rawData : rawData.toString('utf8');
      const data = JSON.parse(text);

      const result: ParsedLiveFrameResult = {
        type: data.type,
        hasAudio: false,
        audioChunks: [],
        hasText: false,
        textDeltas: [],
        isTurnDone: false,
        interactionStatus: data.serverContent?.interactionStatus,
        isInterrupted: Boolean(data.serverContent?.interrupted),
        voiceActivity: data.serverContent?.voiceActivity,
        rawParsed: data
      };

      if (data.type === 'evaluation_completed' || data.type === 'evaluation') {
        result.evaluation = (data.evaluation || data.payload) as VoiceEvaluationResult;
        return result;
      }

      if (data.type === 'whiteboard_update') {
        result.whiteboardPayload = data.payload;
        return result;
      }

      if (data.type === 'chaos_injected') {
        result.chaosPayload = data.payload;
        return result;
      }

      if (data.type === 'hiring_committee_verdict') {
        result.verdictPayload = data.payload;
        return result;
      }

      if (data.type === 'tool_call') {
        result.toolCallPayload = data;
        return result;
      }

      // 1. Extract audio chunks and text from modelTurn.parts
      if (data.serverContent?.modelTurn?.parts) {
        for (const part of data.serverContent.modelTurn.parts) {
          if ((part as any).thought || (part as any).isThought) continue;

          if (typeof part.text === 'string' && part.text.length > 0) {
            const clean = sanitizeModelText(part.text);
            if (clean.length > 0) {
              result.hasText = true;
              result.textDeltas.push(clean);
            }
          }

          const pcm = part.inlineData?.data || part.inline_data?.data;
          if (pcm) {
            result.hasAudio = true;
            result.audioChunks.push(pcm);
          }
        }
      }

      // 2. Extract synthesized speech transcription tokens from outputTranscription (SOTA Gemini 3.8 Live Audio)
      const outputTranscriptionText =
        data.serverContent?.outputTranscription?.text ||
        data.serverContent?.output_transcription?.text;

      if (typeof outputTranscriptionText === 'string' && outputTranscriptionText.length > 0) {
        const clean = sanitizeModelText(outputTranscriptionText);
        if (clean.length > 0) {
          result.hasText = true;
          result.textDeltas.push(clean);
        }
      }

      // 3. Terminal turn signals: generationComplete or turnComplete
      result.isTurnDone = Boolean(
        data.serverContent?.turnComplete ||
        data.serverContent?.generationComplete
      );

      return result;
    } catch {
      return null;
    }
  }
}

function sanitizeModelText(text: string): string {
  return text
    .replace(/<no\s*speech>/gi, '')
    .replace(/\{pause\}/gi, '')
    .replace(/\[no\s*speech\]/gi, '')
    .replace(/<pause>/gi, '');
}

