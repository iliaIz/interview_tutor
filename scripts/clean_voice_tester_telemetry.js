/**
 * clean_voice_tester_telemetry.js
 * Comprehensive statistical telemetry recorder for Gemini 3.8 Live sessions.
 * Captures TTFA, frame bitrates, audio mutex durations, tool latencies, and exports JSON.
 */

class TesterTelemetry {
  constructor() {
    this.reset();
  }

  reset() {
    this.sessionId = 'ses_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    this.presetKey = '';
    this.sessionStartEpoch = Date.now();
    this.sessionEndEpoch = null;
    this.turns = [];
    this.currentTurnIndex = 0;
    this.currentTurn = null;
    this.userSpeechEndEpoch = null;
    this.toolCalls = [];
    this.pendingToolStartEpochs = {};
    this.audioMutexEvents = [];
    this.currentMutexStart = null;
    this.bargeInEvents = [];
    this.errors = [];
    this.totalAudioInBytes = 0;
    this.totalAudioOutBytes = 0;
    this.totalAudioInChunks = 0;
    this.totalAudioOutChunks = 0;
  }

  setPreset(key) {
    this.presetKey = key;
  }

  recordUserChunk(byteLength) {
    this.totalAudioInBytes += byteLength;
    this.totalAudioInChunks++;
    this.userSpeechEndEpoch = Date.now();
  }

  recordFirstAudio() {
    if (!this.userSpeechEndEpoch) return null;
    const ttfa = Date.now() - this.userSpeechEndEpoch;
    this.userSpeechEndEpoch = null;
    if (this.currentTurn) {
      this.currentTurn.ttfaMs = ttfa;
    }
    return ttfa;
  }

  recordModelChunk(byteLength) {
    this.totalAudioOutBytes += byteLength;
    this.totalAudioOutChunks++;
    if (this.currentTurn) {
      this.currentTurn.audioOutBytes = (this.currentTurn.audioOutBytes || 0) + byteLength;
    }
  }

  recordAudioMutex(isLocked) {
    const now = Date.now();
    if (isLocked) {
      this.currentMutexStart = now;
    } else if (this.currentMutexStart) {
      const durationMs = now - this.currentMutexStart;
      this.audioMutexEvents.push({ lockedAt: this.currentMutexStart, durationMs });
      this.currentMutexStart = null;
    }
  }

  recordToolCall(call) {
    const id = call.id || 'anon';
    this.pendingToolStartEpochs[id] = Date.now();
  }

  recordToolResponse(id, name, scheduling, success = true) {
    const start = this.pendingToolStartEpochs[id] || Date.now();
    const latencyMs = Date.now() - start;
    delete this.pendingToolStartEpochs[id];
    this.toolCalls.push({ id, name, latencyMs, scheduling, success, timestamp: Date.now() });
  }

  recordBargeIn() {
    this.bargeInEvents.push({ timestamp: Date.now() });
  }

  recordTurnComplete() {
    this.currentTurnIndex++;
    this.turns.push({
      turnIndex: this.currentTurnIndex,
      completedAt: Date.now(),
      ttfaMs: this.currentTurn?.ttfaMs || null
    });
    this.currentTurn = {};
  }

  recordError(err) {
    this.errors.push({ timestamp: Date.now(), message: String(err) });
  }

  getSummary() {
    const durationSec = ((Date.now() - this.sessionStartEpoch) / 1000).toFixed(1);
    const validTtfas = this.turns.map(t => t.ttfaMs).filter(t => typeof t === 'number');
    const avgTtfa = validTtfas.length ? Math.round(validTtfas.reduce((a, b) => a + b, 0) / validTtfas.length) : null;
    const minTtfa = validTtfas.length ? Math.min(...validTtfas) : null;
    const maxTtfa = validTtfas.length ? Math.max(...validTtfas) : null;

    return {
      sessionId: this.sessionId,
      preset: this.presetKey,
      durationSeconds: Number(durationSec),
      turnsCount: this.currentTurnIndex,
      avgTtfaMs: avgTtfa,
      minTtfaMs: minTtfa,
      maxTtfaMs: maxTtfa,
      audioInKB: Number((this.totalAudioInBytes / 1024).toFixed(1)),
      audioOutKB: Number((this.totalAudioOutBytes / 1024).toFixed(1)),
      audioInChunks: this.totalAudioInChunks,
      audioOutChunks: this.totalAudioOutChunks,
      bargeInCount: this.bargeInEvents.length,
      toolCallsCount: this.toolCalls.length,
      errorsCount: this.errors.length,
      toolCalls: this.toolCalls,
      audioMutexEvents: this.audioMutexEvents,
      turns: this.turns
    };
  }

  exportJson() {
    const summary = this.getSummary();
    const blob = new Blob([JSON.stringify(summary, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gemini_live_session_${summary.sessionId}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

window.TesterTelemetry = TesterTelemetry;
