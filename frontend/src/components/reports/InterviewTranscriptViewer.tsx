/**
 * InterviewTranscriptViewer.tsx
 * Presenter for interview transcript dialogue turns and collapsible reference answer.
 * SLA: <= 200 lines (Rule 8 compliant).
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, ChevronDown, ChevronUp, BookOpen } from 'lucide-react';
import { MarkdownRenderer } from '../MarkdownRenderer';
import { ExecutiveReportViewModel } from '../../services/reports/ExecutiveReportPresenter';

interface InterviewTranscriptViewerProps {
  transcript: ExecutiveReportViewModel['transcript'];
  userAnswer?: string;
  referenceAnswer?: string;
}

export const InterviewTranscriptViewer: React.FC<InterviewTranscriptViewerProps> = ({
  transcript,
  userAnswer,
  referenceAnswer
}) => {
  const [showTranscript, setShowTranscript] = useState(false);
  const [showReference, setShowReference] = useState(false);

  return (
    <div className="space-y-3 font-sans">
      {/* Transcript Accordion */}
      {transcript && (
        <div className="border border-pastel-border rounded-2xl overflow-hidden shadow-2xs">
          <button
            onClick={() => setShowTranscript(!showTranscript)}
            className="w-full p-3.5 bg-pastel-bg/50 hover:bg-pastel-bg/90 flex items-center justify-between text-xs font-bold text-pastel-text transition cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-pastel-accentViolet" />
              📜 Стенограмма диалога с интервьюером
              {transcript.deepgramAnswer && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  ✨ Deepgram Nova-3
                </span>
              )}
            </span>
            {showTranscript ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          <AnimatePresence>
            {showTranscript && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="bg-white border-t border-pastel-border/60 overflow-hidden"
              >
                <div className="p-4 space-y-3 max-h-72 overflow-y-auto">
                  {transcript.isStructured ? (
                    <>
                      {transcript.dialogueTurns
                        .filter((t) => t.role === 'ai' || t.role === 'system')
                        .map((turn, i) => (
                          <div key={i} className={`flex gap-2.5 text-xs ${turn.role === 'system' ? 'opacity-40' : ''}`}>
                            <span className="text-base shrink-0">{turn.role === 'ai' ? '🤖' : '⚙️'}</span>
                            <div>
                              <span className="font-bold text-pastel-accentViolet block text-[10px] mb-0.5">
                                {turn.role === 'ai' ? 'ИИ-Интервьюер' : 'Система'}
                              </span>
                              <p className="text-pastel-text/80 leading-relaxed">{turn.text}</p>
                            </div>
                          </div>
                        ))}

                      {transcript.deepgramAnswer && (
                        <div className="flex gap-2.5 text-xs border-t border-pastel-border/50 pt-3 mt-3">
                          <span className="text-base shrink-0">👤</span>
                          <div>
                            <span className="font-bold text-emerald-700 block text-[10px] mb-0.5">
                              Ваш ответ — Deepgram Nova-3 · Русский
                            </span>
                            <p className="text-pastel-text/90 leading-relaxed">{transcript.deepgramAnswer}</p>
                          </div>
                        </div>
                      )}

                      {!transcript.deepgramAnswer && userAnswer && userAnswer !== 'Устный ответ через Gemini Live' && (
                        <div className="flex gap-2.5 text-xs border-t border-pastel-border/50 pt-3 mt-3">
                          <span className="text-base shrink-0">👤</span>
                          <div>
                            <span className="font-bold text-pastel-sub block text-[10px] mb-0.5">Ответ кандидата</span>
                            <p className="text-pastel-text/90 leading-relaxed">{userAnswer}</p>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-pastel-text leading-relaxed whitespace-pre-wrap font-sans">
                      {transcript.rawText}
                    </p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Reference Model Answer Accordion */}
      {referenceAnswer && (
        <div className="border border-pastel-border rounded-2xl overflow-hidden shadow-2xs">
          <button
            onClick={() => setShowReference(!showReference)}
            className="w-full p-3.5 bg-pastel-bg/50 hover:bg-pastel-bg/90 flex items-center justify-between text-xs font-bold text-pastel-text transition cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-pastel-accentRose" />
              Эталонный ответ из базы знаний
            </span>
            {showReference ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          <AnimatePresence>
            {showReference && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="p-4 bg-white text-xs text-pastel-text leading-relaxed border-t border-pastel-border/60"
              >
                <div className="mt-1">
                  <MarkdownRenderer content={referenceAnswer} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};
