import React from 'react';
import { Send, Sparkles, MessageSquare } from 'lucide-react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface IncidentCommanderChatTabProps {
  chatMessages: ChatMessage[];
  inputMessage: string;
  setInputMessage: (val: string) => void;
  handleSendMessage: () => void;
  isSendingMessage: boolean;
  incidentTitle: string;
}

export const IncidentCommanderChatTab: React.FC<IncidentCommanderChatTabProps> = ({
  chatMessages,
  inputMessage,
  setInputMessage,
  handleSendMessage,
  isSendingMessage,
  incidentTitle
}) => {
  return (
    <div className="max-w-3xl mx-auto flex flex-col h-[560px] bg-white/95 border border-pastel-border/80 rounded-2xl overflow-hidden shadow-sm">
      {/* Header Info */}
      <div className="px-4 py-3 border-b border-pastel-border/80 bg-slate-50/80 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs">
            IC
          </div>
          <div>
            <span className="font-bold text-xs text-slate-800 block">Lead Incident Commander (War Room)</span>
            <span className="text-[10px] text-slate-500">
              Сократический триаж: научный метод, фальсификация, минимизация Blast Radius
            </span>
          </div>
        </div>
        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
          ● Live Bridge
        </span>
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
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-tr-none shadow-2xs'
                  : 'bg-pastel-bg text-pastel-text border border-pastel-border rounded-tl-none whitespace-pre-wrap'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {isSendingMessage && (
          <div className="flex items-center gap-2 text-pastel-muted text-xs font-mono">
            <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            <span>Incident Commander анализирует ваш шаг и телеметрию...</span>
          </div>
        )}
      </div>

      {/* Quick Prompts Bar */}
      <div className="px-3 py-1.5 bg-pastel-bg/50 border-t border-pastel-border/50 flex items-center gap-1.5 overflow-x-auto text-[11px]">
        <button
          type="button"
          onClick={() => setInputMessage('Какие метрики RED (Rate, Errors, Duration) сейчас зашкаливают?')}
          className="px-2 py-1 rounded-lg bg-white border border-pastel-border text-pastel-muted hover:text-pastel-text whitespace-nowrap cursor-pointer transition"
        >
          Метрики RED
        </button>
        <button
          type="button"
          onClick={() => setInputMessage('Какой поток удерживает монитор, блокирующий worker-пул?')}
          className="px-2 py-1 rounded-lg bg-white border border-pastel-border text-pastel-muted hover:text-pastel-text whitespace-nowrap cursor-pointer transition"
        >
          Кто держит монитор?
        </button>
        <button
          type="button"
          onClick={() => setInputMessage('Помоги верифицировать гипотезу: безопасен ли временный перезапуск пода?')}
          className="px-2 py-1 rounded-lg bg-white border border-pastel-border text-pastel-muted hover:text-pastel-text whitespace-nowrap cursor-pointer transition"
        >
          Безопасен ли перезапуск?
        </button>
      </div>

      {/* Input Bar */}
      <div className="p-3 border-t border-pastel-border bg-white flex gap-2">
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
          placeholder="Задайте вопрос дежурному лиду, запросите телеметрию или сформулируйте гипотезу..."
          className="flex-1 bg-pastel-bg border border-pastel-border rounded-xl px-3.5 py-2 text-xs text-pastel-text placeholder-pastel-muted/50 focus:outline-hidden focus:border-amber-500 font-sans"
        />
        <button
          onClick={handleSendMessage}
          disabled={!inputMessage.trim() || isSendingMessage}
          className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white transition disabled:opacity-40 cursor-pointer shadow-2xs hover:from-amber-600 hover:to-orange-600 active:scale-95"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
