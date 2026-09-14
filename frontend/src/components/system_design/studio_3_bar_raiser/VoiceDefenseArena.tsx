import React, { useState } from 'react';
import { 
  Radio, Award, ShieldCheck, Sparkles, MessageSquare, 
  CheckCircle2, Send, PhoneOff, SlidersHorizontal 
} from 'lucide-react';
import { TactileVoiceCircle } from './TactileVoiceCircle';
import { LiveCompetencyRadar, CompetencyScores } from './LiveCompetencyRadar';
import { EvaluationVerdictModal } from './EvaluationVerdictModal';
import { HiringCommitteePacket } from '../defense/HiringCommitteeVerdictModal';

export interface VoiceDefenseArenaProps {
  scenarioManifest: any;
  onBackToTopology?: () => void;
}

export const VoiceDefenseArena: React.FC<VoiceDefenseArenaProps> = ({
  scenarioManifest,
  onBackToTopology
}) => {
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [transcriptHistory, setTranscriptHistory] = useState<Array<{ sender: 'ai' | 'user'; text: string }>>([
    {
      sender: 'ai',
      text: `Здравствуйте! Я Staff/Principal Bar-Raiser. Мы рассмотрели топологию для сценария «${scenarioManifest?.title || 'System Design'}». Защитите, пожалуйста, ваше решение по партиционированию данных и устранению узких мест при всплеске нагрузки.`
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [scores, setScores] = useState<CompetencyScores>({
    exploration: 78,
    architecture: 82,
    deep_dives: 70,
    operational_excellence: 75
  });

  const [verdictPacket, setVerdictPacket] = useState<HiringCommitteePacket | null>(null);

  const handleBargeIn = () => {
    setIsAiSpeaking(false);
    setIsRecording(true);
  };

  const handleToggleMic = () => {
    setIsRecording(!isRecording);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const userMsg = inputText.trim();
    setTranscriptHistory((prev) => [...prev, { sender: 'user', text: userMsg }]);
    setInputText('');

    // Simulate AI response & incremental score adjustment
    setTimeout(() => {
      setIsAiSpeaking(true);
      setTranscriptHistory((prev) => [
        ...prev,
        {
          sender: 'ai',
          text: `Отличный пойнт по поводу изоляции ячеек. А как именно вы обеспечите консистентность распределенного реестра при сбое мастер-ноды в первичном регионе?`
        }
      ]);
      setScores((prev) => ({
        ...prev,
        architecture: Math.min(95, prev.architecture + 3),
        deep_dives: Math.min(92, prev.deep_dives + 4)
      }));
    }, 1200);
  };

  const handleRequestVerdict = () => {
    setVerdictPacket({
      candidate_id: 'candidate_live',
      interview_timestamp: new Date().toISOString(),
      target_level: scenarioManifest?.target_level || 'L6_STAFF',
      calibrated_level: 'L6_STAFF',
      hiring_recommendation: 'HIRE',
      scores: {
        exploration: (scores.exploration / 100) * 4.0,
        architecture: (scores.architecture / 100) * 4.0,
        deep_dives: (scores.deep_dives / 100) * 4.0,
        operational_excellence: (scores.operational_excellence / 100) * 4.0
      },
      leveling_justification: `Кандидат продемонстрировал глубокое владение компромиссами распределенных систем, корректно оценил задержки межрегиональной репликации и защитил архитектуру с нулевым радиусом поражения.`
    });
  };

  return (
    <div className="flex flex-col h-full w-full bg-slate-950 text-slate-100 relative overflow-hidden font-sans select-none">
      {/* Top Floating Bar */}
      <div className="flex items-center justify-between px-6 py-3 bg-slate-900/90 border-b border-slate-800 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-950 text-purple-300 border border-purple-800 text-xs font-bold">
            <Radio className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
            <span>Студия 3: Multimodal Bar-Raiser Defense Arena</span>
          </div>
          <span className="text-xs text-slate-400 truncate hidden sm:inline">
            {scenarioManifest?.title}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {onBackToTopology && (
            <button
              onClick={onBackToTopology}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
            >
              Вернуться к холсту (Студия 2)
            </button>
          )}
          <button
            onClick={handleRequestVerdict}
            className="px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-md shadow-purple-600/30 transition cursor-pointer flex items-center gap-1.5"
          >
            <Award className="w-3.5 h-3.5" />
            <span>Вердикт комитета</span>
          </button>
        </div>
      </div>

      {/* Main Grid: 3-column layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 p-6 overflow-hidden">
        {/* Left Column: Competency Radar & Rubrics */}
        <div className="lg:col-span-4 flex flex-col gap-4 overflow-y-auto">
          <LiveCompetencyRadar
            scores={scores}
            targetLevel={scenarioManifest?.target_level || 'L6'}
          />

          {/* Scenario Problem Statement */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 text-xs flex flex-col gap-2">
            <span className="font-bold text-slate-200">Постановка задачи:</span>
            <p className="text-slate-400 leading-relaxed text-[11px]">
              {scenarioManifest?.problem_statement || 'Спроектируйте отказоустойчивую распределенную систему с заданными SLA.'}
            </p>
          </div>
        </div>

        {/* Center Column: Tactile Voice Circle & Transcript */}
        <div className="lg:col-span-5 flex flex-col items-center justify-between gap-4 bg-slate-900/50 rounded-3xl border border-slate-800/80 p-6 overflow-hidden">
          {/* Tactile Circle */}
          <TactileVoiceCircle
            isConnected={true}
            isAiSpeaking={isAiSpeaking}
            isRecording={isRecording}
            isMuted={isMuted}
            onBargeIn={handleBargeIn}
            onToggleMic={handleToggleMic}
          />

          {/* Transcript Scroll Area */}
          <div className="w-full flex-1 overflow-y-auto flex flex-col gap-3 p-3 bg-slate-950/60 rounded-2xl border border-slate-800/80 max-h-[260px]">
            {transcriptHistory.map((item, idx) => (
              <div
                key={idx}
                className={`flex gap-2.5 items-start text-xs ${
                  item.sender === 'ai' ? 'text-purple-200' : 'text-slate-200 justify-end'
                }`}
              >
                {item.sender === 'ai' && (
                  <div className="w-5 h-5 rounded-md bg-purple-900/60 flex items-center justify-center text-purple-300 shrink-0 text-[10px] font-bold">
                    AI
                  </div>
                )}
                <div
                  className={`p-3 rounded-2xl max-w-[85%] leading-relaxed ${
                    item.sender === 'ai'
                      ? 'bg-purple-950/40 border border-purple-800/40'
                      : 'bg-slate-800 border border-slate-700'
                  }`}
                >
                  {item.text}
                </div>
              </div>
            ))}
          </div>

          {/* Fallback Text Input */}
          <form onSubmit={handleSendMessage} className="w-full flex items-center gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Введите аргумент или используйте голос..."
              className="flex-1 p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-purple-500 transition"
            />
            <button
              type="submit"
              disabled={!inputText.trim()}
              className="p-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white transition cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* Right Column: Architectural Trade-Off Decisions */}
        <div className="lg:col-span-3 flex flex-col gap-3 overflow-y-auto">
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col gap-2.5">
            <div className="flex items-center gap-2 text-xs font-bold text-white">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Защищенные компромиссы:</span>
            </div>

            <div className="flex flex-col gap-2 text-[11px]">
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                <div className="font-semibold text-purple-300">Партиционирование</div>
                <div className="text-slate-400 mt-0.5">Consistent Hashing c 256 virtual nodes на шарду.</div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                <div className="font-semibold text-blue-300">Консенсус</div>
                <div className="text-slate-400 mt-0.5">Multi-Raft группы по шагом с lease read optimization.</div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                <div className="font-semibold text-emerald-300">Изоляция сбоев</div>
                <div className="text-slate-400 mt-0.5">Клеточная архитектура с радиусом поражения ≤ 10%.</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Hiring Committee Verdict Modal */}
      {verdictPacket && (
        <EvaluationVerdictModal
          isOpen={Boolean(verdictPacket)}
          packet={verdictPacket}
          scenarioTitle={scenarioManifest?.title || 'System Design Defense'}
          onClose={() => setVerdictPacket(null)}
          onRetry={() => setVerdictPacket(null)}
        />
      )}
    </div>
  );
};
