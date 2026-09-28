/**
 * dialogueTurnManager.ts
 * Manages conversation turn history and transcript state.
 * Cognitive bounding limit: <= 50 lines.
 */

import { DialogueTurnItem } from './types';

export class DialogueTurnManager {
  private dialogueTurns: DialogueTurnItem[] = [];

  constructor(private onUpdate?: (turns: DialogueTurnItem[]) => void) {}

  public getTurns(): DialogueTurnItem[] {
    return [...this.dialogueTurns];
  }

  public appendTurn(role: 'ai' | 'user' | 'system', text: string): void {
    this.dialogueTurns.push({
      id: `turn_${Date.now()}_${Math.random()}`,
      role,
      text,
      timestamp: Date.now()
    });
    this.onUpdate?.([...this.dialogueTurns]);
  }

  public updateLastAiTurn(fullText: string): void {
    const last = this.dialogueTurns[this.dialogueTurns.length - 1];
    if (last && last.role === 'ai') {
      last.text = fullText;
    } else {
      this.dialogueTurns.push({
        id: `turn_${Date.now()}`,
        role: 'ai',
        text: fullText,
        timestamp: Date.now()
      });
    }
    this.onUpdate?.([...this.dialogueTurns]);
  }

  public clear(): void {
    this.dialogueTurns = [];
  }
}
