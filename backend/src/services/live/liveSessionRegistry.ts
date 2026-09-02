export interface LiveTurn {
  role: 'user' | 'model';
  text: string;
}

export interface LiveSessionMemory {
  sessionId: string;
  questionId: string;
  turns: LiveTurn[];
  lastSpeaker: 'user' | 'model' | 'none';
  updatedAt: number;
}

export const liveSessionRegistry = new Map<string, LiveSessionMemory>();

// Auto-cleanup registry every 10 minutes (remove sessions idle > 30 mins)
setInterval(() => {
  const now = Date.now();
  for (const [key, mem] of liveSessionRegistry.entries()) {
    if (now - mem.updatedAt > 30 * 60 * 1000) {
      liveSessionRegistry.delete(key);
    }
  }
}, 10 * 60 * 1000).unref();

export function getOrCreateSessionMemory(sessionId: string, questionId: string): LiveSessionMemory {
  let mem = liveSessionRegistry.get(sessionId);
  if (!mem) {
    mem = {
      sessionId,
      questionId,
      turns: [],
      lastSpeaker: 'none',
      updatedAt: Date.now()
    };
    liveSessionRegistry.set(sessionId, mem);
  }
  return mem;
}
