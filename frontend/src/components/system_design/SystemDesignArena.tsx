import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { SystemDesignEvaluation } from '../../types/nextgen';
import { 
  ArrowLeft, BookOpen, Layers, MessageSquare, Send, Award,
  Sparkles, ShieldAlert, Cpu, Database, CheckCircle2, RotateCcw
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export const SystemDesignArena: React.FC = () => {
  const { activeSystemDesignScenario, closeSystemDesignScenario, showToast } = useAppStore();
  const [activeTab, setActiveTab] = useState<'spec' | 'architecture' | 'staff_ai'>('spec');
  
  // Candidate Notes & Architecture State
  const [mermaidCode, setMermaidCode] = useState(activeSystemDesignScenario?.initialMermaid || '');
  const [candidateNotes, setCandidateNotes] = useState('');
  
  // Staff AI Chat State
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([
    {
      role: 'assistant',
      content: `Здравствуйте! Я Staff-интервьюер по System Design. Расскажите, как вы планируете построить архитектуру для «${activeSystemDesignScenario?.title || 'этого сервиса'}»? С каких ключевых компонентов вы начнете?`
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);

  // Evaluation State
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState<SystemDesignEvaluation | null>(null);

  if (!activeSystemDesignScenario) return null;

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isSendingMessage) return;
    const userMsg = inputMessage.trim();
    setInputMessage('');
    
    const updatedChat = [...chatMessages, { role: 'user' as const, content: userMsg }];
    setChatMessages(updatedChat);
    setIsSendingMessage(true);

    try {
      const res = await fetch('/api/system-design/probe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenarioId: activeSystemDesignScenario.id,
          userMessage: userMsg,
          conversationHistory: updatedChat.slice(-6)
        })
      });

      if (res.ok) {
        const data = await res.json();
        setChatMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
      } else {
        showToast({ type: 'error', title: 'Ошибка ИИ', message: 'Не удалось получить ответ Staff-интервьюера' });
      }
    } catch {
      showToast({ type: 'error', title: 'Сетевая ошибка', message: 'Проверьте соединение с сервером' });
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleEvaluate = async () => {
    setIsEvaluating(true);
    try {
      const res = await fetch('/api/system-design/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenarioId: activeSystemDesignScenario.id,
          architectureMermaid: mermaidCode,
          notesMarkdown: candidateNotes
        })
      });

      if (res.ok) {
        const result: SystemDesignEvaluation = await res.json();
        setEvaluationResult(result);
      } else {
        showToast({ type: 'error', title: 'Ошибка оценки', message: 'Не удалось получить оценку архитектуры' });
      }
    } catch {
      showToast({ type: 'error', title: 'Сетевая ошибка', message: 'Ошибка связи с сервером' });
    } finally {
      setIsEvaluating(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-4rem)] overflow-hidden bg-slate-950 text-slate-100 relative font-sans">
      {/* Top Bar */}
      <div className="h-12 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md px-3 sm:px-4 flex items-center justify-between shrink-0 z-10 shadow-sm gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={closeSystemDesignScenario}
            className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-slate-200 px-2 py-1.5 rounded-xl hover:bg-slate-800 transition cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Каталог HLD</span>
          </button>

          <div className="h-4 w-px bg-slate-800 shrink-0" />

          <span className="font-bold text-xs text-slate-200 truncate max-w-[140px] sm:max-w-md">
            {activeSystemDesignScenario.title}
          </span>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-slate-950 p-0.5 rounded-xl border border-slate-800 shrink-0">
          <button
            onClick={() => setActiveTab('spec')}
            className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'spec' ? 'bg-slate-800 text-blue-400 shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>ТЗ & Расчеты</span>
          </button>

          <button
            onClick={() => setActiveTab('architecture')}
            className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'architecture' ? 'bg-slate-800 text-blue-400 shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Архитектура</span>
          </button>

          <button
            onClick={() => setActiveTab('staff_ai')}
            className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'staff_ai' ? 'bg-slate-800 text-blue-400 shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Staff AI</span>
          </button>
        </div>

        {/* Action Button */}
        <button
          onClick={handleEvaluate}
          disabled={isEvaluating}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition shadow-sm cursor-pointer disabled:opacity-50 shrink-0"
        >
          <Award className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{isEvaluating ? 'Оценка...' : 'Сдать проект'}</span>
        </button>
      </div>

      {/* Main Content Body */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        {activeTab === 'spec' && (
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Traffic Profile */}
            {activeSystemDesignScenario.trafficProfile && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-blue-400 mb-3 flex items-center gap-2">
                  <Cpu className="w-4 h-4" />
                  <span>Профиль Нагрузки & SLA</span>
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                  <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-slate-500 block text-[10px]">Аудитория DAU</span>
                    <span className="font-bold text-slate-200">{activeSystemDesignScenario.trafficProfile.targetDAU}</span>
                  </div>
                  <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-slate-500 block text-[10px]">Пиковый RPS</span>
                    <span className="font-bold text-blue-400">{activeSystemDesignScenario.trafficProfile.estimatedPeakRPS}</span>
                  </div>
                  <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-slate-500 block text-[10px]">Хранение</span>
                    <span className="font-bold text-slate-200">{activeSystemDesignScenario.trafficProfile.dailyStorageGrowth}</span>
                  </div>
                  <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-slate-500 block text-[10px]">Целевой SLA</span>
                    <span className="font-bold text-emerald-400">{activeSystemDesignScenario.trafficProfile.slaAvailability}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Context & Data Flow */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
              <h3 className="text-sm font-bold text-slate-200">Контекст и Архитектурный поток данных</h3>
              <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
                {activeSystemDesignScenario.contextMarkdown}
              </p>
            </div>

            {/* Calculations & Topo */}
            {activeSystemDesignScenario.calculationsMarkdown && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
                <h3 className="text-sm font-bold text-slate-200">Нагрузочные расчеты (Back-of-the-Envelope)</h3>
                <div className="text-xs text-slate-300 leading-relaxed whitespace-pre-line font-mono bg-slate-950 p-4 rounded-xl border border-slate-800">
                  {activeSystemDesignScenario.calculationsMarkdown}
                </div>
              </div>
            )}

            {/* Bottlenecks */}
            {activeSystemDesignScenario.bottlenecksMarkdown && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
                <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4" />
                  <span>Анализ узких мест и системных сбоев (SPOF, Dual-Write, Split-Brain)</span>
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
                  {activeSystemDesignScenario.bottlenecksMarkdown}
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'architecture' && (
          <div className="max-w-5xl mx-auto space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Mermaid Editor */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col h-[500px]">
                <span className="text-xs font-bold text-slate-400 mb-2 font-mono">
                  Топология компонентов (Mermaid диаграмма):
                </span>
                <textarea
                  value={mermaidCode}
                  onChange={(e) => setMermaidCode(e.target.value)}
                  className="flex-1 w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono text-blue-300 focus:outline-none focus:border-blue-500/60 resize-none"
                  placeholder="graph TD..."
                />
              </div>

              {/* Candidate Design Notes */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col h-[500px]">
                <span className="text-xs font-bold text-slate-400 mb-2 font-mono">
                  Пояснительная записка кандидата (Шардирование, CAP, Кэш):
                </span>
                <textarea
                  value={candidateNotes}
                  onChange={(e) => setCandidateNotes(e.target.value)}
                  className="flex-1 w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500/60 resize-none"
                  placeholder="Опишите стратегии партиционирования, выбор СУБД, схему репликации и защиту от сбоев..."
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'staff_ai' && (
          <div className="max-w-3xl mx-auto flex flex-col h-[550px] bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="flex-1 p-4 overflow-y-auto space-y-3 font-sans text-xs">
              {chatMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl p-3.5 leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white rounded-tr-none'
                        : 'bg-slate-950 text-slate-200 border border-slate-800 rounded-tl-none'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              {isSendingMessage && (
                <div className="flex items-center gap-2 text-slate-500 text-xs font-mono">
                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <span>Staff-интервьюер анализирует ваш ответ...</span>
                </div>
              )}
            </div>

            <div className="p-3 border-t border-slate-800 bg-slate-950 flex gap-2">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Ответьте интервьюеру или задайте уточняющий вопрос..."
                className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 font-sans"
              />
              <button
                onClick={handleSendMessage}
                disabled={!inputMessage.trim() || isSendingMessage}
                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition disabled:opacity-40 cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Evaluation Modal */}
      {evaluationResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Award className="w-6 h-6 text-blue-400" />
                <h2 className="text-lg font-bold text-slate-100">Вердикт Комитета по System Design</h2>
              </div>
              <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                {evaluationResult.verdict} ({evaluationResult.totalScore}/100)
              </span>
            </div>

            {/* Radar Metrics */}
            {evaluationResult.radarMetrics && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs font-mono">
                {Object.entries(evaluationResult.radarMetrics).map(([key, val]) => (
                  <div key={key} className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-slate-500 block text-[10px] uppercase">{key}</span>
                    <span className="font-bold text-slate-200">{val}%</span>
                  </div>
                ))}
              </div>
            )}

            {/* Strengths & Vulnerabilities */}
            <div className="space-y-3 text-xs">
              <div className="bg-slate-950 p-3.5 rounded-xl border border-emerald-500/20">
                <span className="font-bold text-emerald-400 block mb-1.5">Сильные стороны решения:</span>
                <ul className="list-disc pl-4 space-y-1 text-slate-300">
                  {evaluationResult.strengths?.map((s, idx) => <li key={idx}>{s}</li>)}
                </ul>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-xl border border-amber-500/20">
                <span className="font-bold text-amber-400 block mb-1.5">Узкие места и риски:</span>
                <ul className="list-disc pl-4 space-y-1 text-slate-300">
                  {evaluationResult.vulnerabilities?.map((v, idx) => <li key={idx}>{v}</li>)}
                </ul>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                <span className="font-bold text-blue-400 block mb-1">Финальный фидбек Bar-Raiser:</span>
                <p className="text-slate-300 leading-relaxed">{evaluationResult.barRaiserFeedback}</p>
              </div>
            </div>

            <button
              onClick={() => setEvaluationResult(null)}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition cursor-pointer"
            >
              Закрыть отчёт
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
