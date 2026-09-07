import React from 'react';
import { Send } from 'lucide-react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface TriageIncidentCommanderChatProps {
  chatMessages: ChatMessage[];
  inputMessage: string;
  setInputMessage: (val: string) => void;
  isSendingMessage: boolean;
  handleSendMessage: () => Promise<void>;
}

export const TriageIncidentCommanderChat: React.FC<TriageIncidentCommanderChatProps> = ({
  chatMessages,
  inputMessage,
  setInputMessage,
  isSendingMessage,
  handleSendMessage
}) => {
  return (
    <div className="max-w-3xl mx-auto flex flex-col h-[560px] bg-white/95 border border-pastel-border/80 rounded-2xl overflow-hidden shadow-sm">
      {/* Header info */}
      <div className="px-4 py-3 border-b border-pastel-border/80 bg-slate-50/80 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs">
            IC
          </div>
          <div>
            <span className="font-bold text-xs text-slate-800 block">Lead Incident Commander (War Room)</span>
            <span className="text-[10px] text-slate-500">Сократический триаж: научный метод, фальсификация, минимизация Blast Radius</span>
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
                  : 'bg-pastel-bg text-pastel-text border border-pastel-border rounded-tl-none'
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

      {/* Input Bar */}
      <div className="p-3 border-t border-pastel-border bg-white flex gap-2">
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void handleSendMessage()}
          placeholder="Задайте вопрос дежурному лиду, запросите телеметрию или сформулируйте гипотезу..."
          className="flex-1 bg-pastel-bg border border-pastel-border rounded-xl px-3.5 py-2 text-xs text-pastel-text placeholder:text-pastel-muted/50 focus:outline-hidden focus:border-amber-500 font-sans"
        />
        <button
          onClick={() => void handleSendMessage()}
          disabled={!inputMessage.trim() || isSendingMessage}
          className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white transition disabled:opacity-40 cursor-pointer shadow-2xs"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
