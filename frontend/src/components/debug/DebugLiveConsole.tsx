import React, { useState, useEffect, useRef } from 'react';
import { useLiveVoiceSession, LiveAudioSessionParams } from '../../audio/useLiveVoiceSession';
import { DEBUG_STEPS } from './debugStepDefinitions';
import { DebugVoiceControls } from './DebugVoiceControls';
import { useInterviewConfig } from '../../hooks/useInterviewConfig';
import { VOICE_DEFAULTS } from '../../config/voiceDefaults';
import { Play, Square, Mic, MicOff, Volume2, Activity, Zap, RefreshCw, Terminal, MessageSquare } from 'lucide-react';

interface DebugLiveConsoleProps {
  selectedStep: number;
  onStepResult: (step: number, status: 'success' | 'error') => void;
}

interface LogEntry {
  id: string;
  time: string;
  type: 'info' | 'audio' | 'vad' | 'ws' | 'error';
  text: string;
}

/**
 * DebugLiveConsole (SOTA Late 2026).
 * Interactive test harness, RMS visualizer, telemetry metrics and live WebSocket monitor.
 * Cognitive bounding limit: <= 350 lines.
 */
export const DebugLiveConsole: React.FC<DebugLiveConsoleProps> = ({ selectedStep, onStepResult }) => {
  const session = useLiveVoiceSession();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [ttfaMs, setTtfaMs] = useState<number | null>(null);
  const [ttftMs, setTtftMs] = useState<number | null>(null);
  const [connectTime, setConnectTime] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'dialogue' | 'logs'>('dialogue');
  const logContainerRef = useRef<HTMLDivElement | null>(null);

  const stepDef = DEBUG_STEPS.find((s) => s.step === selectedStep) || DEBUG_STEPS[0];
  const isRunning = session.state !== 'IDLE' && session.state !== 'COMPLETED' && session.state !== 'ERROR';
  const { config: interviewConfig } = useInterviewConfig();
  const [voice, setVoice] = useState<string>(() => interviewConfig.voice || VOICE_DEFAULTS.voice);
  const [temperature, setTemperature] = useState<number>(1.0);

  useEffect(() => {
    if (!isRunning && interviewConfig.voice) {
      setVoice(interviewConfig.voice);
    }
  }, [interviewConfig.voice, isRunning]);

  const addLog = (type: LogEntry['type'], text: string) => {
    const time = new Date().toISOString().substring(11, 23);
    setLogs((prev) => [...prev.slice(-150), { id: `${Date.now()}-${Math.random()}`, time, type, text }]);
  };

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  // Track state transitions & TTFA
  useEffect(() => {
    addLog('info', `Статус FSM: ${session.state}${session.statusMessage ? ` (${session.statusMessage})` : ''}`);

    if (session.state === 'AI_SPEAKING' && connectTime && ttfaMs === null) {
      const diff = Date.now() - connectTime;
      setTtfaMs(diff);
      addLog('audio', `Первый аудиотрек получен (TTFA): ${diff} ms`);
      onStepResult(selectedStep, 'success');
    }

    if (session.state === 'ERROR') {
      addLog('error', `Ошибка сессии: ${session.statusMessage || 'Неизвестная ошибка'}`);
      onStepResult(selectedStep, 'error');
    }
  }, [session.state, session.statusMessage]);

  // Track TTFT when turns appear
  useEffect(() => {
    if (session.dialogueTurns.length > 0 && connectTime && ttftMs === null) {
      const diff = Date.now() - connectTime;
      setTtftMs(diff);
      addLog('ws', `Первый текстовый токен получен (TTFT): ${diff} ms`);
    }
  }, [session.dialogueTurns]);

  const handleStartTest = async () => {
    setLogs([]);
    setTtfaMs(null);
    setTtftMs(null);
    const now = Date.now();
    setConnectTime(now);

    addLog('info', `▶ Инициализация теста: ${stepDef.title} (Шаг ${selectedStep})`);

    const cfg: LiveAudioSessionParams = {
      sessionId: `debug_step_${selectedStep}_${now}`,
      questionId: `debug_step_${selectedStep}`,
      sessionType: 'tutor',
      tutorMode: 'practice_pair',
      topic: 'Тестирование Live голосового тракта',
      questionText: 'Проверка звукового тракта и VAD',
      voice,
      temperature,
      debugStep: selectedStep,
      challengeTrack: 'debug',
      challengeDomain: 'debug'
    };

    if (selectedStep >= 2) {
      cfg.codeSnippet = 'public class Solution {\n    public static void main(String[] args) {\n        System.out.println("VAD Test OK");\n    }\n}';
      cfg.workspaceManifest = {
        activeFile: { path: 'src/main/java/Solution.java', content: cfg.codeSnippet },
        fileCount: 1,
        xmlManifest: '<project><file path="src/main/java/Solution.java"/></project>'
      };
    }

    try {
      await session.connect(cfg);
      addLog('ws', `WebSocket соединение открыто с параметром debugStep=${selectedStep}`);
    } catch (err: any) {
      addLog('error', `Не удалось запустить шаг: ${err?.message || err}`);
      onStepResult(selectedStep, 'error');
    }
  };

  const handleStopTest = () => {
    addLog('info', '⏹ Сессия остановлена пользователем');
    session.disconnect();
  };

  const [isMuted, setIsMuted] = useState(false);

  // Convert RMS dB (-100 to 0) to 0-100 percentage
  const rmsPercent = Math.max(0, Math.min(100, Math.round(((session.metrics.rmsDb + 60) / 60) * 100)));

  return (
    <div className="bg-white/80 backdrop-blur-md border border-pastel-rose/80 rounded-3xl p-5 shadow-xl space-y-4">
      {/* Header with Control Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-pastel-border/60">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-pink-500 to-rose-500 flex items-center justify-center text-white font-bold shadow-sm shadow-pink-500/20">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-pastel-text">Тестовый стенд шага {selectedStep}</h3>
            <span className="text-[10px] text-pastel-muted font-mono">{stepDef.badge}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isRunning ? (
            <button
              onClick={handleStartTest}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-violet-600 via-purple-600 to-pink-600 hover:opacity-95 transition shadow-sm shadow-violet-500/30 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Запустить тест шага {selectedStep}</span>
            </button>
          ) : (
            <>
              <button
                onClick={session.handleInteraction}
                title="Тактильный Barge-in"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-violet-800 bg-violet-100 hover:bg-violet-200 transition cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5 text-violet-600" />
                <span>Barge-in</span>
              </button>

              <button
                onClick={() => {
                  setIsMuted(!isMuted);
                  session.toggleMic();
                }}
                title={isMuted ? 'Включить микрофон' : 'Заглушить микрофон'}
                className={`p-2 rounded-xl transition cursor-pointer ${
                  isMuted ? 'bg-rose-100 text-rose-700' : 'bg-pastel-bg text-slate-700 hover:bg-pastel-rose/40'
                }`}
              >
                {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              </button>

              <button
                onClick={handleStopTest}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition cursor-pointer"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Прервать</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Voice & Temperature Selector Bar */}
      <DebugVoiceControls
        voice={voice}
        temperature={temperature}
        isRunning={isRunning}
        onVoiceChange={setVoice}
        onTempChange={setTemperature}
      />

      {/* Real-time Telemetry Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="p-2.5 rounded-2xl bg-pastel-bg/80 border border-pastel-border/80 flex flex-col">
          <span className="text-[10px] text-pastel-muted">Состояние FSM</span>
          <span className="text-xs font-bold font-mono text-pastel-text capitalize">{session.state}</span>
        </div>

        <div className="p-2.5 rounded-2xl bg-pastel-bg/80 border border-pastel-border/80 flex flex-col">
          <span className="text-[10px] text-pastel-muted">TTFA (Время до аудио)</span>
          <span className="text-xs font-bold font-mono text-violet-700">
            {ttfaMs !== null ? `${ttfaMs} ms` : isRunning ? 'Замер...' : '—'}
          </span>
        </div>

        <div className="p-2.5 rounded-2xl bg-pastel-bg/80 border border-pastel-border/80 flex flex-col">
          <span className="text-[10px] text-pastel-muted">TTFT (Время до текста)</span>
          <span className="text-xs font-bold font-mono text-purple-700">
            {ttftMs !== null ? `${ttftMs} ms` : isRunning ? 'Замер...' : '—'}
          </span>
        </div>

        <div className="p-2.5 rounded-2xl bg-pastel-bg/80 border border-pastel-border/80 flex flex-col">
          <div className="flex items-center justify-between text-[10px] text-pastel-muted">
            <span>Аудио RMS</span>
            <span>{session.metrics.rmsDb > -90 ? `${Math.round(session.metrics.rmsDb)} dB` : 'Тишина'}</span>
          </div>
          <div className="w-full bg-slate-200 h-2 rounded-full mt-1.5 overflow-hidden">
            <div
              className={`h-full transition-all duration-75 ${
                rmsPercent > 50 ? 'bg-gradient-to-r from-emerald-500 to-rose-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${rmsPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Tabs: Dialogue Subtitles vs Real-time WS Logs */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 bg-pastel-bg p-1 rounded-xl border border-pastel-border/60">
            <button
              onClick={() => setActiveTab('dialogue')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                activeTab === 'dialogue'
                  ? 'bg-white text-violet-700 shadow-2xs'
                  : 'text-pastel-muted hover:text-pastel-text'
              }`}
            >
              <MessageSquare className="w-3 h-3" />
              <span>Диалог ({session.dialogueTurns.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                activeTab === 'logs'
                  ? 'bg-white text-violet-700 shadow-2xs'
                  : 'text-pastel-muted hover:text-pastel-text'
              }`}
            >
              <Terminal className="w-3 h-3" />
              <span>Логи ({logs.length})</span>
            </button>
          </div>

          {activeTab === 'logs' && (
            <button
              onClick={() => setLogs([])}
              className="text-[10px] text-pastel-muted hover:text-pastel-text transition cursor-pointer"
            >
              Очистить логи
            </button>
          )}
        </div>

        {activeTab === 'dialogue' ? (
          <div className="h-52 overflow-y-auto p-3 rounded-2xl bg-pastel-bg/60 border border-pastel-border/60 space-y-2.5">
            {session.dialogueTurns.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-pastel-muted text-xs text-center">
                <Volume2 className="w-6 h-6 mb-1 opacity-40 text-violet-500" />
                <span>Запустите тест шага, чтобы услышать и увидеть ответ Gemini Live</span>
              </div>
            ) : (
              session.dialogueTurns.map((turn) => (
                <div
                  key={turn.id}
                  className={`p-2.5 rounded-2xl text-xs max-w-[85%] ${
                    turn.role === 'ai'
                      ? 'bg-white border border-pastel-border text-pastel-text shadow-2xs'
                      : 'ml-auto bg-gradient-to-r from-violet-600 to-pink-600 text-white shadow-2xs'
                  }`}
                >
                  <div className="text-[9px] opacity-70 mb-0.5 font-bold uppercase tracking-wider">
                    {turn.role === 'ai' ? 'ИИ-Собеседник' : 'Кандидат'}
                  </div>
                  <div className="leading-relaxed font-sans">{turn.text}</div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div
            ref={logContainerRef}
            className="h-52 overflow-y-auto p-3 rounded-2xl bg-slate-950 font-mono text-[10px] space-y-1 text-slate-300 border border-slate-800"
          >
            {logs.length === 0 ? (
              <div className="text-slate-600 py-4 text-center">Ожидание запуска сессии...</div>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="flex items-start gap-2 leading-relaxed">
                  <span className="text-slate-500 shrink-0">{log.time}</span>
                  <span
                    className={`font-bold shrink-0 ${
                      log.type === 'error'
                        ? 'text-rose-400'
                        : log.type === 'audio'
                        ? 'text-emerald-400'
                        : log.type === 'ws'
                        ? 'text-purple-400'
                        : 'text-sky-400'
                    }`}
                  >
                    [{log.type.toUpperCase()}]
                  </span>
                  <span className="text-slate-200 break-all">{log.text}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
