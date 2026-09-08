import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { SystemDesignEvaluation } from '../../types/nextgen';
import { 
  ArrowLeft, BookOpen, Layers, MessageSquare, Send, Award,
  Sparkles, ShieldAlert, Cpu, Database, CheckCircle2, RotateCcw, X, Loader2,
  Eye, Edit3, Code2, Calculator, Compass, Radio
} from 'lucide-react';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { MermaidPreview } from './MermaidPreview';
import { MarkdownRenderer } from '../MarkdownRenderer';
import { ArchitectureCanvas } from './canvas/ArchitectureCanvas';
import { ArchitectureGraphPayload } from '../../types/systemDesignCanvas';
import { CapacityMathCoach } from './CapacityMathCoach';
import { SystemDesignCompassSheet } from './compass/SystemDesignCompassSheet';
import { useLiveAudioSession } from '../../hooks/useLiveAudioSession';
import { SystemDesignVoiceHUD } from './defense/SystemDesignVoiceHUD';
import { HiringCommitteeVerdictModal, HiringCommitteePacket } from './defense/HiringCommitteeVerdictModal';

const cleanScenarioText = (text?: string): string => {
  if (!text) return '';
  return text
    .replace(/\\?\[cite:\s*[^\]]+\]/g, '')
    .replace(/\\cite:\s*\d+\\?/g, '')
    .replace(/\\_/g, '_')
    .replace(/merchant_id\d+/g, 'merchant_id')
    .replace(/Circuit Breaker\d+/g, 'Circuit Breaker')
    .trim();
};

const renderCalculationsBlock = (rawText?: string) => {
  if (!rawText) return null;
  const cleaned = cleanScenarioText(rawText);
  return (
    <div className="text-xs text-pastel-text leading-relaxed">
      <MarkdownRenderer content={cleaned} />
    </div>
  );
};

export const SystemDesignArena: React.FC = () => {
  const { 
    activeSystemDesignScenario, 
    closeSystemDesignScenario, 
    showToast,
    academyBreadcrumbContext,
    returnToAcademyStep,
    toggleAcademyStepProgress
  } = useAppStore();
  const [activeTab, setActiveTab] = useState<'spec' | 'architecture' | 'math_coach' | 'staff_ai'>('spec');
  const [architectureMode, setArchitectureMode] = useState<'canvas' | 'mermaid'>('canvas');
  const [canvasPayload, setCanvasPayload] = useState<ArchitectureGraphPayload | null>(null);
  const [isCompassOpen, setIsCompassOpen] = useState(false);

  // Global Hotkey for Compass (Ctrl + /)
  React.useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        setIsCompassOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);
  
  // Interactive Diagram & Candidate Solution State
  const [mermaidCode, setMermaidCode] = useState<string>(
    activeSystemDesignScenario?.initialMermaid || 
`graph TD
  Client[🌐 Web / Mobile Client] -->|HTTPS / TLS| LB[⚖️ Load Balancer]
  LB --> Gateway[🚪 API Gateway]
  Gateway --> ServiceA[⚙️ Core Service]
  ServiceA --> DB[(🗄️ Primary PostgreSQL)]
  ServiceA --> Cache[(⚡ Redis Cache)]
  ServiceA --> Kafka[/📨 Kafka Event Bus/]`
  );
  
  const [candidateNotes, setCandidateNotes] = useState<string>('');
  const [notesViewMode, setNotesViewMode] = useState<'edit' | 'preview'>('edit');

  // Interactive Staff AI Chat State
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([
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
  const [isDraftRestored, setIsDraftRestored] = useState(false);

  // Live Bar-Raiser Defense State
  const [chaosAlert, setChaosAlert] = useState<{ failureType: string; targetId: string; context: string } | null>(null);
  const [observations, setObservations] = useState<Array<{ dimension?: string; signal?: string; demonstrated_level?: string; evidence_transcript?: string }>>([]);
  const [hiringCommitteePacket, setHiringCommitteePacket] = useState<HiringCommitteePacket | null>(null);

  const {
    isConnected: isVoiceConnected,
    isAiSpeaking,
    isRecording,
    isMuted,
    isUserSpeaking,
    isPauseHolding,
    rmsDb,
    statusMessage: voiceStatus,
    startSession: startVoiceSession,
    disconnectSession: disconnectVoiceSession,
    toggleMic,
    finishManualTurn,
    sendCanvasDelta,
    handleBargeIn,
    playoutManagerRef
  } = useLiveAudioSession({
    onChaosInjected: (payload) => {
      setChaosAlert({
        failureType: payload.failureType,
        targetId: payload.targetComponentId,
        context: payload.technicalContext
      });
      showToast({
        type: 'error',
        title: `🔥 Chaos Injected: ${payload.failureType}`,
        message: `Узел: ${payload.targetComponentId}. ${payload.technicalContext}`
      });
    },
    onCandidateObservationRecorded: (obs) => {
      setObservations(prev => [obs, ...prev]);
    },
    onHiringCommitteeVerdict: (data) => {
      if (data.packet) {
        setHiringCommitteePacket(data.packet);
      }
    },
    onError: (err) => showToast({ type: 'error', title: 'Ошибка голосовой сессии', message: err })
  });

  const handleStartVoiceDefense = async () => {
    if (!activeSystemDesignScenario) return;
    try {
      await startVoiceSession({
        sessionType: 'system_design',
        topic: activeSystemDesignScenario.title,
        questionText: activeSystemDesignScenario.title,
        referenceAnswer: activeSystemDesignScenario.contextMarkdown,
        scenarioId: activeSystemDesignScenario.id
      });
      showToast({
        type: 'success',
        title: 'Защита начата',
        message: 'Соединение с Principal Bar-Raiser установлено'
      });
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Ошибка соединения',
        message: err?.message || 'Не удалось запустить Live сессию'
      });
    }
  };

  // Auto-restore saved draft and architecture from database
  React.useEffect(() => {
    if (!activeSystemDesignScenario?.id) return;
    let isCancelled = false;

    fetch(`/api/system-design/submissions/${activeSystemDesignScenario.id}`, { credentials: 'include' })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (isCancelled || !data?.submission) return;
        const sub = data.submission;
        if (sub.canvasTopology) {
          setCanvasPayload(sub.canvasTopology);
          setArchitectureMode('canvas');
        } else if (sub.architectureMermaid || sub.mermaid_diagram) {
          setMermaidCode(sub.architectureMermaid || sub.mermaid_diagram);
          setArchitectureMode('mermaid');
        }
        if (sub.candidateNotes || sub.candidate_notes || sub.architectureNotes) {
          setCandidateNotes(sub.candidateNotes || sub.candidate_notes || sub.architectureNotes);
        }
        if (sub.evaluation) {
          setEvaluationResult(sub.evaluation);
        } else if (sub.evaluation_json) {
          try {
            setEvaluationResult(JSON.parse(sub.evaluation_json));
          } catch {}
        }
        setIsDraftRestored(true);
      })
      .catch(() => {});

    return () => {
      isCancelled = true;
    };
  }, [activeSystemDesignScenario?.id]);

  useBodyScrollLock(Boolean(evaluationResult));

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
        credentials: 'include',
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
        showToast({ type: 'error', title: 'Ошибка AI', message: 'Не удалось получить ответ от Staff AI' });
      }
    } catch {
      showToast({ type: 'error', title: 'Сетевая ошибка', message: 'Ошибка связи с сервером' });
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleEvaluate = async () => {
    if (!activeSystemDesignScenario || isEvaluating) return;
    setIsEvaluating(true);

    try {
      const effectiveMermaid = architectureMode === 'canvas'
        ? (canvasPayload?.architectureMermaid || mermaidCode)
        : mermaidCode;

      const res = await fetch('/api/system-design/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          scenarioId: activeSystemDesignScenario.id,
          conversationHistory: chatMessages,
          architectureMermaid: effectiveMermaid,
          notesMarkdown: candidateNotes,
          canvasTopology: canvasPayload
        })
      });

      if (res.ok) {
        const result: SystemDesignEvaluation = await res.json();
        setEvaluationResult(result);
        if (result.totalScore >= 70 && academyBreadcrumbContext) {
          toggleAcademyStepProgress(
            academyBreadcrumbContext.courseId,
            academyBreadcrumbContext.stepNumber,
            true
          );
        }
      } else {
        showToast({ type: 'error', title: 'Ошибка оценки', message: 'Не удалось получить оценку архитектуры' });
      }
    } catch {
      showToast({ type: 'error', title: 'Сетевая ошибка', message: 'Ошибка связи с сервером' });
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      void handleEvaluate();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-4rem)] overflow-hidden bg-pastel-bg text-pastel-text relative font-sans">
      {/* Top Bar */}
      <div className="h-14 border-b border-pastel-border/80 bg-white/95 backdrop-blur-md px-3 sm:px-4 flex items-center justify-between shrink-0 z-10 shadow-2xs gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {academyBreadcrumbContext ? (
            <button
              onClick={returnToAcademyStep}
              className="flex items-center gap-1 text-xs font-bold text-pastel-accentRose bg-pastel-rose hover:bg-pastel-accentRose hover:text-white px-2.5 py-1.5 rounded-xl border border-pastel-accentRose/30 transition cursor-pointer shrink-0"
              title="Вернуться к шагу курса в Академии"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">← Назад в Академию: Шаг #{academyBreadcrumbContext.stepNumber}</span>
              <span className="sm:hidden">← Шаг #{academyBreadcrumbContext.stepNumber}</span>
            </button>
          ) : (
            <button
              onClick={closeSystemDesignScenario}
              className="flex items-center gap-1 text-xs font-bold text-pastel-muted hover:text-pastel-text px-2.5 py-1.5 rounded-xl hover:bg-pastel-rose/40 transition cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Каталог HLD</span>
            </button>
          )}

          <div className="h-4 w-px bg-pastel-border shrink-0" />

          <span className="font-bold text-xs text-pastel-text truncate max-w-[140px] sm:max-w-md">
            {activeSystemDesignScenario.title}
          </span>

          {isDraftRestored && (
            <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
              💾 Черновик восстановлен
            </span>
          )}
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-pastel-bg p-0.5 rounded-xl border border-pastel-border shrink-0">
          <button
            onClick={() => setActiveTab('spec')}
            className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'spec' ? 'bg-white text-pastel-accentRose shadow-2xs border border-pastel-border' : 'text-pastel-muted hover:text-pastel-text'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>ТЗ & Расчеты</span>
          </button>

          <button
            onClick={() => setActiveTab('math_coach')}
            className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'math_coach' ? 'bg-white text-pastel-accentRose shadow-2xs border border-pastel-border' : 'text-pastel-muted hover:text-pastel-text'
            }`}
          >
            <Calculator className="w-3.5 h-3.5" />
            <span>Math Coach</span>
          </button>

          <button
            onClick={() => setActiveTab('architecture')}
            className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'architecture' ? 'bg-white text-pastel-accentRose shadow-2xs border border-pastel-border' : 'text-pastel-muted hover:text-pastel-text'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Архитектура & Схема</span>
          </button>

          <button
            onClick={() => setActiveTab('staff_ai')}
            className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'staff_ai' ? 'bg-white text-pastel-accentRose shadow-2xs border border-pastel-border' : 'text-pastel-muted hover:text-pastel-text'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Staff AI</span>
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setIsCompassOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/80 transition cursor-pointer shadow-2xs"
            title="Шпаргалка System Design Compass (Ctrl + /)"
          >
            <Compass className="w-3.5 h-3.5 text-amber-600" />
            <span className="hidden sm:inline">Компас (Ctrl+/)</span>
          </button>

          {/* Live Bar-Raiser Defense Trigger */}
          <button
            onClick={() => {
              if (isVoiceConnected) {
                disconnectVoiceSession();
              } else {
                void handleStartVoiceDefense();
              }
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs ${
              isVoiceConnected 
                ? 'bg-purple-100 text-purple-900 border border-purple-300' 
                : 'bg-gradient-to-r from-purple-600 to-pastel-accentViolet text-white hover:opacity-95'
            }`}
            title="Запустить голосовую защиту с Bar-Raiser (Live Audio)"
          >
            <Radio className={`w-3.5 h-3.5 ${isVoiceConnected ? 'text-purple-600 animate-pulse' : 'text-white'}`} />
            <span className="hidden sm:inline">{isVoiceConnected ? 'Защита активна' : '🎙️ Защита Bar-Raiser'}</span>
            <span className="sm:hidden">{isVoiceConnected ? 'Активна' : '🎙️ Голос'}</span>
          </button>

          <button
            onClick={handleEvaluate}
            disabled={isEvaluating}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-pastel-accentRose via-pink-500 to-pastel-accentViolet text-white transition shadow-sm shadow-pastel-accentRose/20 cursor-pointer disabled:opacity-50 shrink-0 touch-manipulation active:scale-95"
          >
            {isEvaluating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Award className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isEvaluating ? 'Оценка...' : 'Сдать проект (Ctrl+↵)'}</span>
            <span className="sm:hidden">{isEvaluating ? '...' : 'Сдать'}</span>
          </button>
        </div>
      </div>

      {/* Live Bar-Raiser Defense HUD */}
      {isVoiceConnected && (
        <div className="px-4 pt-3 shrink-0 z-20">
          <SystemDesignVoiceHUD
            isConnected={isVoiceConnected}
            isAiSpeaking={isAiSpeaking}
            isRecording={isRecording}
            isMuted={isMuted}
            isUserSpeaking={isUserSpeaking}
            isPauseHolding={isPauseHolding}
            rmsDb={rmsDb}
            statusMessage={voiceStatus}
            chaosAlert={chaosAlert}
            observationCount={observations.length}
            onDismissChaos={() => setChaosAlert(null)}
            onToggleMic={toggleMic}
            onFinishTurn={finishManualTurn}
            onDisconnect={disconnectVoiceSession}
            onBargeIn={() => {
              if (isAiSpeaking) {
                handleBargeIn();
              }
            }}
          />
        </div>
      )}

      {/* Main Content Body */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6" onKeyDown={handleKeyDown}>
        {activeTab === 'spec' && (
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Traffic Profile */}
            {activeSystemDesignScenario.trafficProfile && (
              <div className="bg-white/95 border border-pastel-border/80 rounded-2xl p-4 sm:p-5 shadow-2xs">
                <h3 className="text-xs font-bold uppercase tracking-wider text-purple-700 mb-3 flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-pastel-accentViolet" />
                  <span>Профиль Нагрузки & SLA</span>
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                  <div className="bg-pastel-bg p-2.5 rounded-xl border border-pastel-border">
                    <span className="text-pastel-muted block text-[10px]">Аудитория DAU</span>
                    <span className="font-bold text-pastel-text">{activeSystemDesignScenario.trafficProfile.targetDAU}</span>
                  </div>
                  <div className="bg-pastel-bg p-2.5 rounded-xl border border-pastel-border">
                    <span className="text-pastel-muted block text-[10px]">Пиковый RPS</span>
                    <span className="font-bold text-blue-600">{activeSystemDesignScenario.trafficProfile.estimatedPeakRPS}</span>
                  </div>
                  <div className="bg-pastel-bg p-2.5 rounded-xl border border-pastel-border">
                    <span className="text-pastel-muted block text-[10px]">Хранение</span>
                    <span className="font-bold text-pastel-text">{activeSystemDesignScenario.trafficProfile.dailyStorageGrowth}</span>
                  </div>
                  <div className="bg-pastel-bg p-2.5 rounded-xl border border-pastel-border">
                    <span className="text-pastel-muted block text-[10px]">Целевой SLA</span>
                    <span className="font-bold text-emerald-600">{activeSystemDesignScenario.trafficProfile.slaAvailability}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Context & Data Flow */}
            <div className="bg-white/95 border border-pastel-border/80 rounded-2xl p-5 space-y-3 shadow-2xs">
              <h3 className="text-sm font-bold text-pastel-text">Контекст и Архитектурный поток данных</h3>
              <p className="text-xs text-pastel-muted leading-relaxed whitespace-pre-line">
                {cleanScenarioText(activeSystemDesignScenario.contextMarkdown)}
              </p>
            </div>

            {/* Calculations & Topo with Structured Table Renderer */}
            {activeSystemDesignScenario.calculationsMarkdown && (
              <div className="bg-white/95 border border-pastel-border/80 rounded-2xl p-5 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-pastel-text">Нагрузочные расчеты (Back-of-the-Envelope)</h3>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                    SLA & Throughput
                  </span>
                </div>
                {renderCalculationsBlock(activeSystemDesignScenario.calculationsMarkdown)}
              </div>
            )}

            {/* Bottlenecks */}
            {activeSystemDesignScenario.bottlenecksMarkdown && (
              <div className="bg-white/95 border border-amber-200 rounded-2xl p-5 space-y-3 shadow-2xs">
                <h3 className="text-sm font-bold text-amber-800 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-600" />
                  <span>Анализ узких мест и системных сбоев (SPOF, Dual-Write, Split-Brain)</span>
                </h3>
                <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">
                  {cleanScenarioText(activeSystemDesignScenario.bottlenecksMarkdown)}
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'math_coach' && (
          <div className="max-w-5xl mx-auto space-y-4">
            <CapacityMathCoach
              onApplyCalculations={(summary) => {
                setCandidateNotes(prev => {
                  const prefix = prev ? prev + '\n\n' : '';
                  return prefix + '### Оценки Capacity Math Coach:\n' + summary;
                });
                showToast({ type: 'success', title: 'Расчеты скопированы', message: 'Оценки добавлены в пояснительную записку' });
                setActiveTab('architecture');
              }}
            />
          </div>
        )}

        {activeTab === 'architecture' && (
          <div className="max-w-7xl 2xl:max-w-[2200px] mx-auto space-y-4">
            {/* Mode Switcher Header */}
            <div className="flex items-center justify-between bg-white/95 dark:bg-slate-900/95 border border-pastel-border/80 rounded-2xl p-2.5 shadow-2xs">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-pastel-text">Режим архитектора:</span>
                <div className="flex items-center bg-pastel-bg p-0.5 rounded-xl border border-pastel-border">
                  <button
                    type="button"
                    onClick={() => setArchitectureMode('canvas')}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      architectureMode === 'canvas' ? 'bg-white text-pastel-accentRose shadow-2xs border border-pastel-border' : 'text-pastel-muted hover:text-pastel-text'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Интерактивный холст (SOTA 2026)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setArchitectureMode('mermaid')}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      architectureMode === 'mermaid' ? 'bg-white text-pastel-accentRose shadow-2xs border border-pastel-border' : 'text-pastel-muted hover:text-pastel-text'
                    }`}
                  >
                    <Code2 className="w-3.5 h-3.5" />
                    <span>Mermaid редактор</span>
                  </button>
                </div>
              </div>

              <div className="text-[11px] text-pastel-muted font-mono hidden sm:block">
                {architectureMode === 'canvas'
                  ? '⚡ 60 FPS Web Worker DES Engine • Drag & Drop • Chaos Monkey'
                  : '📜 Ручной ввод кода Mermaid'}
              </div>
            </div>

            {architectureMode === 'canvas' ? (
              <div className="h-[calc(100vh-14rem)] min-h-[640px] w-full rounded-2xl overflow-hidden border border-pastel-border/80 shadow-2xs relative">
                <ArchitectureCanvas 
                  scenarioTitle={activeSystemDesignScenario.title}
                  onExportPayload={setCanvasPayload}
                  onDeicticContextChange={sendCanvasDelta}
                />
              </div>
            ) : (
              /* Split Arena: Left Code & Notes Editor, Right Live Mermaid Canvas */
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 min-h-[580px]">
              
              {/* Left Column (5 cols): Mermaid Code & Candidate Notes */}
              <div className="lg:col-span-6 flex flex-col gap-4">
                
                {/* 1. Mermaid Code Editor */}
                <div className="bg-white/95 border border-pastel-border/80 rounded-2xl p-4 flex flex-col shadow-2xs space-y-2">
                  <div className="flex items-center justify-between border-b border-pastel-border/60 pb-2">
                    <span className="text-xs font-bold text-pastel-text font-mono flex items-center gap-1.5">
                      <Code2 className="w-4 h-4 text-pastel-accentRose" />
                      <span>Mermaid Код Топологии:</span>
                    </span>
                    <span className="text-[10px] text-pastel-muted font-mono">graph TD / C4 / Sequence</span>
                  </div>

                  <textarea
                    value={mermaidCode}
                    onChange={(e) => setMermaidCode(e.target.value)}
                    className="w-full h-56 bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono text-blue-300 focus:outline-hidden focus:border-pastel-accentRose resize-none leading-relaxed selection:bg-[#3D3558]"
                    placeholder="graph TD..."
                    spellCheck={false}
                  />
                </div>

                {/* 2. Candidate Design Notes with Notion-Style Preview */}
                <div className="bg-white/95 border border-pastel-border/80 rounded-2xl p-4 flex flex-col shadow-2xs space-y-2 flex-1">
                  <div className="flex items-center justify-between border-b border-pastel-border/60 pb-2">
                    <span className="text-xs font-bold text-pastel-text font-mono">
                      Пояснительная записка (CAP, Шардирование, Кэш):
                    </span>

                    <div className="flex items-center bg-pastel-bg p-0.5 rounded-lg border border-pastel-border">
                      <button
                        onClick={() => setNotesViewMode('edit')}
                        className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold transition cursor-pointer ${
                          notesViewMode === 'edit' ? 'bg-white text-pastel-text shadow-2xs' : 'text-pastel-muted hover:text-pastel-text'
                        }`}
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Редактор</span>
                      </button>
                      <button
                        onClick={() => setNotesViewMode('preview')}
                        className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold transition cursor-pointer ${
                          notesViewMode === 'preview' ? 'bg-white text-pastel-accentRose shadow-2xs' : 'text-pastel-muted hover:text-pastel-text'
                        }`}
                      >
                        <Eye className="w-3 h-3" />
                        <span>Предпросмотр</span>
                      </button>
                    </div>
                  </div>

                  {notesViewMode === 'edit' ? (
                    <textarea
                      value={candidateNotes}
                      onChange={(e) => setCandidateNotes(e.target.value)}
                      className="flex-1 min-h-[160px] w-full bg-pastel-bg border border-pastel-border rounded-xl p-3 text-xs font-mono text-pastel-text focus:outline-hidden focus:border-pastel-accentRose resize-none"
                      placeholder="Опишите стратегию партиционирования, выбор СУБД, схему репликации и защиту от сбоев (поддерживается Markdown)..."
                    />
                  ) : (
                    <div className="flex-1 min-h-[160px] p-3 rounded-xl bg-pastel-bg/60 border border-pastel-border overflow-y-auto">
                      {candidateNotes.trim() ? (
                        <MarkdownRenderer content={candidateNotes} />
                      ) : (
                        <span className="text-xs text-pastel-muted italic">Пояснительная записка пока пуста.</span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column (6 cols): Live Interactive Mermaid SVG Canvas */}
              <div className="lg:col-span-6 flex flex-col min-h-[500px]">
                <MermaidPreview code={mermaidCode} className="flex-1" />
              </div>

            </div>
            )}
          </div>
        )}

        {activeTab === 'staff_ai' && (
          <div className="max-w-3xl mx-auto flex flex-col h-[550px] bg-white/95 border border-pastel-border/80 rounded-2xl overflow-hidden shadow-sm">
            <div className="flex-1 p-4 overflow-y-auto space-y-3 font-sans text-xs">
              {chatMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl p-3.5 leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet text-white rounded-tr-none shadow-2xs'
                        : 'bg-pastel-bg text-pastel-text border border-pastel-border rounded-tl-none'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              {isSendingMessage && (
                <div className="flex items-center gap-2 text-pastel-muted text-xs font-mono">
                  <div className="w-4 h-4 border-2 border-pastel-accentRose border-t-transparent rounded-full animate-spin" />
                  <span>Staff-интервьюер анализирует ваш ответ...</span>
                </div>
              )}
            </div>

            <div className="p-3 border-t border-pastel-border bg-white flex gap-2">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Ответьте интервьюеру или задайте уточняющий вопрос..."
                className="flex-1 bg-pastel-bg border border-pastel-border rounded-xl px-3.5 py-2 text-xs text-pastel-text placeholder-pastel-muted/50 focus:outline-hidden focus:border-pastel-accentRose font-sans"
              />
              <button
                onClick={handleSendMessage}
                disabled={!inputMessage.trim() || isSendingMessage}
                className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet text-white transition disabled:opacity-40 cursor-pointer shadow-2xs"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Evaluation Modal in Soft Luxury Pastel */}
      {evaluationResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md overflow-y-auto">
          <div className="bg-white/95 border border-pastel-rose/80 rounded-3xl p-6 max-w-2xl w-full max-h-[90dvh] overflow-y-auto space-y-5 shadow-2xl relative overflow-hidden font-sans my-auto">
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-500 to-pastel-accentViolet text-white flex items-center justify-center shadow-sm">
                  <Award className="w-5 h-5" />
                </div>
                <h2 className="text-base font-bold text-pastel-text">Вердикт Комитета по System Design</h2>
              </div>
              <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-purple-50 text-pastel-accentViolet border border-purple-200">
                {evaluationResult.verdict} ({evaluationResult.totalScore}/100)
              </span>
            </div>

            {/* Radar Metrics */}
            {evaluationResult.radarMetrics && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs font-mono">
                {Object.entries(evaluationResult.radarMetrics).map(([key, val]) => (
                  <div key={key} className="bg-pastel-bg p-2.5 rounded-xl border border-pastel-border">
                    <span className="text-pastel-muted block text-[10px] uppercase">{key}</span>
                    <span className="font-bold text-pastel-text">{val}%</span>
                  </div>
                ))}
              </div>
            )}

            {/* Strengths & Vulnerabilities */}
            <div className="space-y-3 text-xs">
              <div className="bg-emerald-50/60 p-3.5 rounded-xl border border-emerald-200">
                <span className="font-bold text-emerald-800 block mb-1.5">Сильные стороны решения:</span>
                <ul className="list-disc pl-4 space-y-1 text-slate-700">
                  {evaluationResult.strengths?.map((s, idx) => <li key={idx}>{s}</li>)}
                </ul>
              </div>

              <div className="bg-amber-50/60 p-3.5 rounded-xl border border-amber-200">
                <span className="font-bold text-amber-800 block mb-1.5">Узкие места и риски:</span>
                <ul className="list-disc pl-4 space-y-1 text-slate-700">
                  {evaluationResult.vulnerabilities?.map((v, idx) => <li key={idx}>{v}</li>)}
                </ul>
              </div>

              <div className="bg-pastel-bg p-3.5 rounded-xl border border-pastel-border">
                <span className="font-bold text-pastel-text block mb-1">Финальный фидбек Bar-Raiser:</span>
                <p className="text-pastel-muted leading-relaxed">{evaluationResult.barRaiserFeedback}</p>
              </div>
            </div>

            <button
              onClick={() => setEvaluationResult(null)}
              className="w-full py-2.5 rounded-xl bg-pastel-card hover:bg-pastel-rose/40 text-pastel-text border border-pastel-border text-xs font-bold transition cursor-pointer"
            >
              Закрыть отчёт
            </button>
          </div>
        </div>
      )}

      {/* Hiring Committee SOTA Scorecard Modal */}
      {hiringCommitteePacket && (
        <HiringCommitteeVerdictModal
          packet={hiringCommitteePacket}
          scenarioTitle={activeSystemDesignScenario.title}
          observations={observations}
          onClose={() => setHiringCommitteePacket(null)}
          onRetry={() => {
            setHiringCommitteePacket(null);
            setChaosAlert(null);
            setObservations([]);
            void handleStartVoiceDefense();
          }}
        />
      )}

      {/* System Design Compass Modal Sheet (5 Golden Rules) */}
      <SystemDesignCompassSheet
        isOpen={isCompassOpen}
        onClose={() => setIsCompassOpen(false)}
        onAskTutorAboutRule={(ruleTitle, ruleSummary) => {
          setIsCompassOpen(false);
          setActiveTab('staff_ai');
          setInputMessage(`Объясните подробнее золотое правило «${ruleTitle}» в контексте нашей системы «${activeSystemDesignScenario.title}»:\n${ruleSummary}`);
        }}
      />
    </div>
  );
};
