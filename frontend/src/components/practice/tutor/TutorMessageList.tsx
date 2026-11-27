/**
 * TutorMessageList.tsx
 * Renders the scrollable AI tutor chat history with live streaming delta.
 * Single Responsibility: message bubble rendering and streaming indicator.
 */

import React, { useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Bot, User, ShieldAlert } from 'lucide-react';
import { PracticeVoiceHUD } from './PracticeVoiceHUD';
import { PracticeVoiceErrorBoundary } from './PracticeVoiceErrorBoundary';

interface TutorMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  leakDetected?: boolean;
}

interface Props {
  modality: 'text' | 'voice';
  messages: TutorMessage[];
  isLoading: boolean;
  currentStreamingText: string;
  onFallbackToText: () => void;
}

export const TutorMessageList: React.FC<Props> = ({
  modality,
  messages,
  isLoading,
  currentStreamingText,
  onFallbackToText
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentStreamingText]);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-3.5 space-y-3 custom-scrollbar">
      {modality === 'voice' && (
        <div className="mb-3">
          <PracticeVoiceErrorBoundary onFallbackToText={onFallbackToText}>
            <PracticeVoiceHUD />
          </PracticeVoiceErrorBoundary>
        </div>
      )}

      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
        >
          <div className="flex items-center gap-1.5 mb-1 px-1 text-[10px] font-semibold text-pastel-muted">
            {msg.role === 'user' ? (
              <>
                <span>Вы</span>
                <User className="w-3 h-3" />
              </>
            ) : (
              <>
                <Bot className="w-3 h-3 text-pastel-accentRoseText" />
                <span>AI-Напарник</span>
              </>
            )}
          </div>

          <div
            className={`p-3 rounded-2xl text-xs leading-relaxed max-w-[92%] shadow-xs break-anywhere ${
              msg.role === 'user'
                ? 'bg-[#B5433E] text-white rounded-tr-xs whitespace-pre-wrap'
                : msg.role === 'system'
                ? 'bg-rose-50 text-rose-900 border border-rose-200 rounded-tl-xs'
                : 'bg-white text-pastel-text border border-pastel-border rounded-tl-xs'
            }`}
          >
            {msg.role === 'user' ? (
              msg.content
            ) : (
              <div className="spec-markdown text-xs">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
              </div>
            )}

            {msg.leakDetected && (
              <div className="mt-2.5 p-2 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-1.5 text-[10px] text-amber-900 font-semibold">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                <span>Socratic Anti-Cheat: Прямой код скрыт для тренировки самостоятельного мышления.</span>
              </div>
            )}
          </div>
        </div>
      ))}

      {/* Live Streaming Delta */}
      {isLoading && currentStreamingText && (
        <div className="flex flex-col items-start">
          <div className="flex items-center gap-1.5 mb-1 px-1 text-[10px] font-semibold text-pastel-muted">
            <Bot className="w-3 h-3 text-pastel-accentRoseText" />
            <span>AI-Напарник печатает...</span>
          </div>
          <div className="p-3 rounded-2xl text-xs leading-relaxed max-w-[92%] bg-white text-pastel-text border border-pastel-accentRose/50 shadow-xs rounded-tl-xs break-anywhere">
            <div className="spec-markdown text-xs">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{currentStreamingText}</ReactMarkdown>
            </div>
          </div>
        </div>
      )}

      {isLoading && !currentStreamingText && (
        <div className="flex items-center gap-2 text-xs text-pastel-muted italic p-2">
          <Bot className="w-4 h-4 text-pastel-accentRoseText" />
          <span>AI-напарник анализирует код...</span>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
};
