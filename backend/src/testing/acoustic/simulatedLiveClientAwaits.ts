/**
 * simulatedLiveClientAwaits.ts
 * Await helpers for SimulatedLiveClient (Greeting, TurnComplete, Playout, Interruption, Thinking).
 */

import { ClientTelemetry } from './simulatedLiveClientTypes';

export interface AwaitContext {
  telemetry: ClientTelemetry;
  firstAudioReceivedAt: number | null;
  messageListeners: Array<(msg: any) => void>;
  closeListeners: Array<(code: number, reason: string) => void>;
}

export class SimulatedLiveClientAwaits {
  public static async waitForGreeting(
    ctx: AwaitContext,
    effectiveTimeout: number = 40000
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      let greetingText = '';
      let greetingAudioBytes = 0;
      let firstAudioAt: number | null = null;

      const timer = setTimeout(() => {
        cleanup();
        if (greetingText.length > 0 || greetingAudioBytes > 0) {
          resolve(greetingText || `[Audio Greeting: ${greetingAudioBytes} bytes]`);
        } else {
          reject(new Error(`Greeting timeout: no greeting received within ${effectiveTimeout}ms`));
        }
      }, effectiveTimeout);

      const listener = (msg: any) => {
        const parts = msg.serverContent?.modelTurn?.parts || [];
        for (const p of parts) {
          if (p.text && !p.thought) {
            greetingText += p.text;
          }
          const pcmBase64 = p.inlineData?.data || p.inline_data?.data;
          if (pcmBase64) {
            if (!firstAudioAt) firstAudioAt = Date.now();
            greetingAudioBytes += Buffer.from(pcmBase64, 'base64').length;
          }
        }
        if (msg.serverContent?.turnComplete) {
          const hasSubstantiveGreeting = greetingAudioBytes >= 1000 || greetingText.trim().length >= 10;
          if (!hasSubstantiveGreeting) {
            // Ignore preamble or empty frame turnComplete; await real greeting audio/text
            return;
          }
          cleanup();
          const totalPlayoutMs = greetingAudioBytes > 0
            ? Math.round((greetingAudioBytes / 48000) * 1000)
            : 0;
          const streamingElapsedMs = firstAudioAt ? (Date.now() - firstAudioAt) : 0;
          const remainingMs = Math.min(25000, Math.max(0, totalPlayoutMs - streamingElapsedMs) + 450);

          if (remainingMs > 0) {
            setTimeout(() => {
              resolve(greetingText || `[Audio Greeting: ${greetingAudioBytes} bytes]`);
            }, remainingMs);
          } else {
            resolve(greetingText || `[Audio Greeting: ${greetingAudioBytes} bytes]`);
          }
        }
      };

      const closeHandler = (code: number, reason: string) => {
        cleanup();
        reject(new Error(`WebSocket closed before greeting completed (code ${code}: ${reason || 'no reason'})`));
      };

      const cleanup = () => {
        clearTimeout(timer);
        ctx.messageListeners = ctx.messageListeners.filter((l) => l !== listener);
        ctx.closeListeners = ctx.closeListeners.filter((l) => l !== closeHandler);
      };

      ctx.messageListeners.push(listener);
      ctx.closeListeners.push(closeHandler);
    });
  }

  public static async waitForAudioPlayoutToDrain(
    ctx: AwaitContext,
    reverbBufferMs: number = 450
  ): Promise<void> {
    const totalDurationMs = ctx.telemetry.audioBytesReceived > 0
      ? Math.round((ctx.telemetry.audioBytesReceived / 48000) * 1000)
      : 0;
    const streamingElapsedMs = ctx.firstAudioReceivedAt ? (Date.now() - ctx.firstAudioReceivedAt) : 0;
    const remainingMs = Math.min(6000, Math.max(0, totalDurationMs - streamingElapsedMs) + reverbBufferMs);
    ctx.firstAudioReceivedAt = null;
    if (remainingMs > 0) {
      await new Promise((r) => setTimeout(r, remainingMs));
    }
  }

  public static async waitForTurnComplete(
    ctx: AwaitContext,
    timeoutMs: number = 25000
  ): Promise<ClientTelemetry> {
    const isNonSpeechInitial = ctx.telemetry.replyText.includes('<no speech>') || ctx.telemetry.replyText.includes('{pause}');
    const hasValidInitial = (ctx.telemetry.audioBytesReceived >= 1000 || ctx.telemetry.replyText.length >= 10) && !isNonSpeechInitial;
    if (ctx.telemetry.isTurnComplete && hasValidInitial) {
      return { ...ctx.telemetry };
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup();
        const isNonSpeech = ctx.telemetry.replyText.includes('<no speech>') || ctx.telemetry.replyText.includes('{pause}');
        if (!isNonSpeech && (ctx.telemetry.replyText.length >= 10 || ctx.telemetry.audioBytesReceived >= 1000)) {
          resolve({ ...ctx.telemetry });
        } else {
          reject(new Error(`Turn completion timeout: AI did not complete turn with valid speech within ${timeoutMs}ms (audio: ${ctx.telemetry.audioBytesReceived}B, text: "${ctx.telemetry.replyText.slice(0, 40)}")`));
        }
      }, timeoutMs);

      const listener = (msg: any) => {
        if (msg.serverContent?.turnComplete) {
          const isNonSpeech = ctx.telemetry.replyText.includes('<no speech>') || ctx.telemetry.replyText.includes('{pause}');
          const currentHasContent = (ctx.telemetry.audioBytesReceived >= 1000 || ctx.telemetry.replyText.length >= 10) && !isNonSpeech;
          if (!currentHasContent) {
            // Await conversational recovery turn or audio playout
            return;
          }
          cleanup();
          resolve({ ...ctx.telemetry });
        }
      };

      const closeHandler = (code: number, reason: string) => {
        cleanup();
        reject(new Error(`WebSocket closed before turn completed (code ${code}: ${reason || 'no reason'})`));
      };

      const cleanup = () => {
        clearTimeout(timer);
        ctx.messageListeners = ctx.messageListeners.filter((l) => l !== listener);
        ctx.closeListeners = ctx.closeListeners.filter((l) => l !== closeHandler);
      };

      ctx.messageListeners.push(listener);
      ctx.closeListeners.push(closeHandler);
    });
  }

  public static async waitForInterruption(
    ctx: AwaitContext,
    timeoutMs: number = 5000
  ): Promise<number> {
    if (ctx.telemetry.isInterrupted && ctx.telemetry.interruptionLatencyMs !== null) {
      return ctx.telemetry.interruptionLatencyMs;
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error(`Interruption timeout: server did not emit interrupted: true within ${timeoutMs}ms`));
      }, timeoutMs);

      const listener = (msg: any) => {
        if (msg.serverContent?.interrupted) {
          cleanup();
          resolve(ctx.telemetry.interruptionLatencyMs || 200);
        }
      };

      const cleanup = () => {
        clearTimeout(timer);
        ctx.messageListeners = ctx.messageListeners.filter((l) => l !== listener);
      };

      ctx.messageListeners.push(listener);
    });
  }

  public static async waitForFirstThought(
    ctx: AwaitContext,
    timeoutMs: number = 8000
  ): Promise<string> {
    if (ctx.telemetry.thoughtTokens.length > 0) {
      return ctx.telemetry.thoughtTokens[0];
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup();
        if (ctx.telemetry.thoughtTokens.length > 0) {
          resolve(ctx.telemetry.thoughtTokens[0]);
        } else {
          reject(new Error(`Model did not enter thinking state within ${timeoutMs}ms`));
        }
      }, timeoutMs);

      const listener = (msg: any) => {
        const parts = msg.serverContent?.modelTurn?.parts || [];
        for (const p of parts) {
          if (p.thought || p.isThought) {
            cleanup();
            resolve(p.text || (typeof p.thought === 'string' ? p.thought : 'thought'));
            return;
          }
        }
      };

      const cleanup = () => {
        clearTimeout(timer);
        ctx.messageListeners = ctx.messageListeners.filter((l) => l !== listener);
      };

      ctx.messageListeners.push(listener);
    });
  }
}
