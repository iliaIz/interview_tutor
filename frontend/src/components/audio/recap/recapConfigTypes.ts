export interface AudioRecapConfig {
  mode: 'duo' | 'solo';
  voice1: string;
  voice2: string;
  length: string;
  tone: string;
  systemPrompt: string;
  userPrompt: string;
}

export const DURATION_OPTIONS = [
  { id: 'Short (5-7 min)', label: '⚡ Краткий', desc: '5–7 минут' },
  { id: 'Medium (10-15 min)', label: '☕ Средний', desc: '10–15 минут' },
  { id: 'Long (20+ min)', label: '🎙️ Глубокий', desc: '20+ минут' },
] as const;

export const TONE_OPTIONS = [
  { id: 'Fun', label: '🔥 Непринужденный', desc: 'Живой, с юмором' },
  { id: 'Informative', label: '💡 Экспертный', desc: 'Четко по делу' },
  { id: 'Formal', label: '🎓 Академический', desc: 'Строго по стандартам' },
] as const;
