import React, { useState, useRef, useEffect } from 'react';
import { Bot, User, RefreshCw, Send, Radio, Lightbulb } from 'lucide-react';
import { TutorMode, TUTOR_MODES_CONFIG, MathScenario } from './MathCoachPresets';
import { CapacityResults } from '../../../utils/capacityMath';
import { VoiceModal } from '../../VoiceModal';

interface MathCoachAiChatProps {
  scenario: MathScenario;
  mathResults: CapacityResults;
  userPeakQps: string;
  userStorageTb: string;
  userHotRamGb: string;
  isVoiceTutorOpen: boolean;
  setIsVoiceTutorOpen: (open: boolean) => void;
  voiceSessionId: string | null;
  setVoiceSessionId: (id: string | null) => void;
  mathVoicePrompt: string;
}

export const MathCoachAiChat: React.FC<MathCoachAiChatProps> = ({
  scenario,
  mathResults,
  userPeakQps,
  userStorageTb,
  userHotRamGb,
  isVoiceTutorOpen,
  setIsVoiceTutorOpen,
  voiceSessionId,
  setVoiceSessionId,
  mathVoicePrompt
}) => {
  const [tutorMode, setTutorMode] = useState<TutorMode>('free_chat');
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([
    {
      role: 'assistant',
      content: `Привет! Я твой наставник по расчетам на салфетке. Разбираем емкость для «${scenario.title}». Можем прикинуть QPS, диски или кэш по закону 80/20. С чего начнем?`
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSendTutorMessage = async (textOverride?: string) => {
    const textToSend = (textOverride || inputMessage).trim();
    if (!textToSend || isSending) return;

    if (!textOverride) setInputMessage('');
    const newHistory = [...chatMessages, { role: 'user' as const, content: textToSend }];
    setChatMessages(newHistory);
    setIsSending(true);

    try {
      const res = await fetch('/api/system-design/probe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          contextType: 'math_coach',
          mode: tutorMode,
          userMessage: textToSend,
          conversationHistory: newHistory.slice(-6),
          mathContext: {
            scenarioTitle: scenario.title,
            dau: scenario.dau,
            writesPerUser: scenario.writesPerUser,
            readsPerUser: scenario.readsPerUser,
            avgWriteBytes: scenario.avgWriteBytes,
            avgReadBytes: scenario.avgReadBytes,
            retentionYears: scenario.retentionYears,
            calculatedMetrics: {
              writeRps: userPeakQps ? `${userPeakQps} QPS` : `~${mathResults.peakWriteQps} QPS`,
              readRps: `~${mathResults.peakReadQps} QPS`,
              writeBandwidth: `${((mathResults.peakWriteQps * scenario.avgWriteBytes * 8) / 1_000_000).toFixed(1)} Mbps`,
              readBandwidth: `${((mathResults.peakReadQps * scenario.avgReadBytes * 8) / 1_000_000).toFixed(1)} Mbps`,
              storage: userStorageTb ? `${userStorageTb} TB` : `~${mathResults.totalStorageTb} TB`,
              cacheRam: userHotRamGb ? `${userHotRamGb} GB` : `~${mathResults.hotRamGb} GB`
            }
          }
        })
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setChatMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
    } catch (err: any) {
      setChatMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `⚠️ Не удалось связаться с AI-тьютором: ${err.message || 'Ошибка сети'}. Попробуйте снова через несколько секунд.`
        }
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const handleStartVoiceTutor = () => {
    setVoiceSessionId(`voice_math_${scenario.id}_${Date.now()}`);
    setIsVoiceTutorOpen(true);
  };

  return (
    <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-b from-slate-50 to-violet-50/30 border border-violet-200/80 shadow-sm space-y-4 animate-in fade-in zoom-in-98 duration-150">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-violet-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-500 flex items-center justify-center text-white text-xs shadow-xs font-bold">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
              <span>Контекстный AI-Тьютор</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-white border border-violet-200 text-violet-700 font-bold">
                Math Coach
              </span>
            </h4>
            <p className="text-[10px] text-slate-500">
              {TUTOR_MODES_CONFIG[tutorMode].desc}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center bg-white p-1 rounded-2xl border border-violet-200 shadow-2xs gap-1 overflow-x-auto no-scrollbar">
            {(Object.keys(TUTOR_MODES_CONFIG) as TutorMode[]).map((modeKey) => {
              const cfg = TUTOR_MODES_CONFIG[modeKey];
              const isSelected = tutorMode === modeKey;
              return (
                <button
                  key={modeKey}
                  type="button"
                  onClick={() => setTutorMode(modeKey)}
                  className={`px-2.5 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                    isSelected
                      ? 'bg-violet-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <span>{cfg.label}</span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={handleStartVoiceTutor}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white text-xs font-bold transition shadow-xs cursor-pointer active:scale-95 shrink-0"
            title="Перейти в двусторонний голосовой диалог с Gemini Live"
          >
            <Radio className="w-3.5 h-3.5 animate-pulse text-violet-200" />
            <span className="hidden sm:inline">В Live Голос</span>
            <span className="sm:hidden">Голос</span>
          </button>
        </div>
      </div>

      {/* Quick Prompt Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 text-[11px]">
        <span className="text-[10px] font-bold text-slate-400 shrink-0 flex items-center gap-1">
          <Lightbulb className="w-3 h-3 text-amber-500" />
          Спросить быстро:
        </span>
        <button
          type="button"
          onClick={() => handleSendTutorMessage('Объясни на простых пальцах формулу перевода суточного трафика в QPS.')}
          className="px-2.5 py-1 rounded-lg bg-white hover:bg-violet-50 text-slate-700 border border-slate-200 hover:border-violet-300 font-medium transition shrink-0 cursor-pointer"
        >
          👶 Как считать QPS на пальцах?
        </button>
        <button
          type="button"
          onClick={() => handleSendTutorMessage('Зачем умножать средний QPS на 2 или 3 для расчета пиковой нагрузки? Откуда берется Peak Factor?')}
          className="px-2.5 py-1 rounded-lg bg-white hover:bg-violet-50 text-slate-700 border border-slate-200 hover:border-violet-300 font-medium transition shrink-0 cursor-pointer"
        >
          🔬 Откуда берется Peak Factor (2x–3x)?
        </button>
        <button
          type="button"
          onClick={() => handleSendTutorMessage('Как правильно посчитать объем оперативной памяти под кэш по закону Парето 80/20?')}
          className="px-2.5 py-1 rounded-lg bg-white hover:bg-violet-50 text-slate-700 border border-slate-200 hover:border-violet-300 font-medium transition shrink-0 cursor-pointer"
        >
          📐 Как считать память под кэш (80/20)?
        </button>
        <button
          type="button"
          onClick={() => handleSendTutorMessage('Посмотри мои введенные прикидки в инпуты выше и укажи, где я ошибся или что упустил.')}
          className="px-2.5 py-1 rounded-lg bg-white hover:bg-violet-50 text-slate-700 border border-slate-200 hover:border-violet-300 font-medium transition shrink-0 cursor-pointer"
        >
          💡 Проверь мои расчеты
        </button>
      </div>

      {/* Chat Messages */}
      <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1 no-scrollbar text-xs">
        {chatMessages.map((msg, idx) => {
          const isUser = msg.role === 'user';
          return (
            <div key={idx} className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}>
              {!isUser && (
                <div className="w-6 h-6 rounded-lg bg-violet-600 text-white flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5">
                  <Bot className="w-3.5 h-3.5" />
                </div>
              )}
              <div
                className={`p-3 rounded-2xl max-w-xl text-xs leading-relaxed whitespace-pre-line ${
                  isUser
                    ? 'bg-violet-600 text-white font-medium rounded-tr-xs'
                    : 'bg-white border border-violet-100 text-slate-800 shadow-2xs rounded-tl-xs'
                }`}
              >
                {msg.content}
              </div>
              {isUser && (
                <div className="w-6 h-6 rounded-lg bg-slate-200 text-slate-700 flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5">
                  <User className="w-3.5 h-3.5" />
                </div>
              )}
            </div>
          );
        })}
        {isSending && (
          <div className="flex items-center gap-2 text-violet-600 text-xs font-bold pl-8 py-1">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>AI-тьютор формулирует ответ в режиме «{TUTOR_MODES_CONFIG[tutorMode].label}»...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 pt-1">
        <input
          type="text"
          placeholder={`Задай вопрос по расчету («${TUTOR_MODES_CONFIG[tutorMode].label}»)...`}
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void handleSendTutorMessage();
            }
          }}
          className="flex-1 p-2.5 px-3.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-400"
        />
        <button
          type="button"
          onClick={() => void handleSendTutorMessage()}
          disabled={isSending || !inputMessage.trim()}
          className="p-2.5 px-4 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-bold text-xs transition flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
        >
          <Send className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Отправить</span>
        </button>
      </div>

      {/* Voice Modal */}
      {isVoiceTutorOpen && voiceSessionId && (
        <VoiceModal
          key={voiceSessionId}
          isOpen={isVoiceTutorOpen}
          onClose={() => {
            setIsVoiceTutorOpen(false);
            setVoiceSessionId(null);
          }}
          topic={`Math Coach: ${scenario.title}`}
          currentQuestionText={`Расчет емкости для ${scenario.title}. DAU: ${scenario.dau.toLocaleString()}, срок: ${scenario.retentionYears} лет.`}
          referenceAnswer={`Пиковый QPS: ${mathResults.peakTotalQps}, Хранилище: ${mathResults.totalStorageTb} TB, Кэш RAM: ${mathResults.hotRamGb} GB.`}
          initialSessionType="tutor"
          initialTutorMode={tutorMode}
          customPromptOverride={mathVoicePrompt}
        />
      )}
    </div>
  );
};
