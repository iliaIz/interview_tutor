import React from 'react';
import { Sparkles, Radio, Send } from 'lucide-react';

export type TutorMode = 'free_chat' | 'deep_dive' | 'eli5' | 'socratic';

interface SystemDesignStaffChatTabProps {
  targetLevel?: string;
  tutorMode: TutorMode;
  setTutorMode: (mode: TutorMode) => void;
  chatMessages: Array<{ role: 'user' | 'assistant'; content: string }>;
  isSendingMessage: boolean;
  inputMessage: string;
  setInputMessage: (val: string) => void;
  onSendMessage: (textOverride?: string) => void;
  onStartVoiceTutor: () => void;
}

export const SystemDesignStaffChatTab: React.FC<SystemDesignStaffChatTabProps> = ({
  targetLevel,
  tutorMode,
  setTutorMode,
  chatMessages,
  isSendingMessage,
  inputMessage,
  setInputMessage,
  onSendMessage,
  onStartVoiceTutor
}) => {
  return (
    <div className="max-w-4xl mx-auto flex flex-col h-[580px] bg-white/95 border border-pastel-border/80 rounded-3xl overflow-hidden shadow-sm font-sans">
      {/* Multi-Mode Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 sm:p-4 border-b border-pastel-border/80 bg-pastel-bg/50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-pastel-accentRose to-pastel-accentViolet text-white flex items-center justify-center font-bold text-xs shadow-xs">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-xs text-pastel-text flex items-center gap-1.5">
              <span>AI-Тьютор по System Design</span>
              <span className="text-[10px] font-mono px-2 py-0.2 rounded-full bg-white border border-pastel-border font-bold text-pastel-accentRose">
                {targetLevel || 'L4'}
              </span>
            </div>
            <p className="text-[10px] text-pastel-muted mt-0.5">
              {tutorMode === 'eli5' && '👶 На пальцах: простые жизненные аналогии без сложного академического жаргона'}
              {tutorMode === 'deep_dive' && '🔬 Под капотом: устройство СУБД, LSM/B-Tree, сетевой стек, распределенный консенсус'}
              {tutorMode === 'socratic' && '💡 Сократ: наводящие вопросы для самостоятельного поиска узких мест и SPOF'}
              {tutorMode === 'free_chat' && '💬 Просто тьютор: доброжелательный диалог, разбор ТЗ и ответы на любые вопросы'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <div className="flex items-center bg-white p-0.5 rounded-xl border border-pastel-border shadow-2xs gap-0.5 overflow-x-auto no-scrollbar">
            {[
              { id: 'free_chat' as const, label: '💬 Просто тьютор' },
              { id: 'deep_dive' as const, label: '🔬 Под капотом' },
              { id: 'eli5' as const, label: '👶 На пальцах' },
              { id: 'socratic' as const, label: '💡 Сократ' }
            ].map(m => (
              <button
                key={m.id}
                onClick={() => setTutorMode(m.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  tutorMode === m.id
                    ? 'bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet text-white shadow-xs'
                    : 'text-pastel-muted hover:text-pastel-text hover:bg-pastel-bg'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onStartVoiceTutor}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet text-white text-xs font-bold transition shadow-xs hover:opacity-95 active:scale-95 cursor-pointer shrink-0"
            title="Запустить двусторонний голосовой диалог с Gemini Live Тьютором"
          >
            <Radio className="w-3.5 h-3.5 animate-pulse text-white" />
            <span className="hidden sm:inline">Live Голос</span>
          </button>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3 font-sans text-xs">
        {chatMessages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl p-3.5 leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet text-white rounded-tr-none shadow-2xs font-medium'
                  : 'bg-pastel-bg text-pastel-text border border-pastel-border rounded-tl-none whitespace-pre-line'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {isSendingMessage && (
          <div className="flex items-center gap-2 text-pastel-muted text-xs font-mono pl-1">
            <div className="w-4 h-4 border-2 border-pastel-accentRose border-t-transparent rounded-full animate-spin" />
            <span>AI-тьютор формулирует ответ...</span>
          </div>
        )}
      </div>

      {/* Quick Prompt Chips */}
      <div className="flex items-center gap-1.5 px-3 py-2 bg-pastel-bg/60 border-t border-pastel-border/60 overflow-x-auto no-scrollbar text-[11px]">
        <span className="text-[10px] font-bold text-pastel-muted shrink-0 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-pastel-accentRose" />
          Быстрый вопрос:
        </span>
        <button
          type="button"
          onClick={() => void onSendMessage('Объясни архитектурные требования и ключевую сложность этой системы простыми словами «на пальцах».')}
          className="px-2.5 py-1 rounded-lg bg-white hover:bg-pastel-rose text-pastel-text border border-pastel-border text-[11px] font-medium transition shrink-0 cursor-pointer shadow-2xs"
        >
          👶 Объясни на пальцах ТЗ
        </button>
        <button
          type="button"
          onClick={() => void onSendMessage('Что происходит под капотом при сетевом разделении (Network Partition) между узлами этой системы?')}
          className="px-2.5 py-1 rounded-lg bg-white hover:bg-pastel-rose text-pastel-text border border-pastel-border text-[11px] font-medium transition shrink-0 cursor-pointer shadow-2xs"
        >
          🔬 Что под капотом при сетевом сбое?
        </button>
        <button
          type="button"
          onClick={() => void onSendMessage('Задай мне один точечный наводящий вопрос, чтобы проверить, нет ли в моей архитектуре скрытого SPOF или узкого места.')}
          className="px-2.5 py-1 rounded-lg bg-white hover:bg-pastel-rose text-pastel-text border border-pastel-border text-[11px] font-medium transition shrink-0 cursor-pointer shadow-2xs"
        >
          💡 Задай вопрос на поиск SPOF
        </button>
        <button
          type="button"
          onClick={() => void onSendMessage('Оцени компромисс между задержкой (Latency) и строгой согласованностью (Strong Consistency) для данного кейса.')}
          className="px-2.5 py-1 rounded-lg bg-white hover:bg-pastel-rose text-pastel-text border border-pastel-border text-[11px] font-medium transition shrink-0 cursor-pointer shadow-2xs"
        >
          💬 Оцени компромисс Latency vs Consistency
        </button>
      </div>

      {/* Input Bar */}
      <div className="p-3 border-t border-pastel-border bg-white flex gap-2">
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void onSendMessage()}
          placeholder="Ответьте тьютору или задайте вопрос по архитектуре..."
          className="flex-1 bg-pastel-bg border border-pastel-border rounded-xl px-3.5 py-2 text-xs text-pastel-text placeholder-pastel-muted/50 focus:outline-hidden focus:border-pastel-accentRose font-sans"
        />
        <button
          onClick={() => void onSendMessage()}
          disabled={!inputMessage.trim() || isSendingMessage}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet text-white transition disabled:opacity-40 cursor-pointer shadow-2xs active:scale-95 font-bold text-xs flex items-center gap-1.5"
        >
          <Send className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Отправить</span>
        </button>
      </div>
    </div>
  );
};
