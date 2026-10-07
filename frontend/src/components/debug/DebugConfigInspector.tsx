import React, { useState } from 'react';
import { DEBUG_STEPS, DebugStepDef } from './debugStepDefinitions';
import { Code2, Copy, Check, Eye, CheckCircle2, XCircle } from 'lucide-react';

interface DebugConfigInspectorProps {
  selectedStep: number;
}

/**
 * DebugConfigInspector (SOTA Late 2026).
 * Inspects exact setup payload, Turn 0 message, and active layer capabilities.
 * Cognitive bounding limit: <= 350 lines.
 */
export const DebugConfigInspector: React.FC<DebugConfigInspectorProps> = ({ selectedStep }) => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'payload' | 'capabilities'>('payload');

  const stepDef = DEBUG_STEPS.find((s) => s.step === selectedStep) || DEBUG_STEPS[0];

  const handleCopy = () => {
    void navigator.clipboard.writeText(JSON.stringify(stepDef.setupPayload, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const capabilities = [
    { label: 'WebSocket Network Transport', active: true, stepMin: 0 },
    { label: 'System Instructions (Role Prompt)', active: selectedStep >= 1, stepMin: 1 },
    { label: 'Russian Language Directive', active: selectedStep >= 1, stepMin: 1 },
    { label: 'Workspace XML Manifest & Files', active: selectedStep >= 2, stepMin: 2 },
    { label: 'Solution.java Grounding Turn', active: selectedStep >= 2, stepMin: 2 },
    { label: 'Tool Function Declarations', active: selectedStep >= 3, stepMin: 3 },
    { label: 'First-Turn Tool Lockdown', active: selectedStep >= 3, stepMin: 3 },
    { label: 'Cloud VAD (automaticActivityDetection)', active: selectedStep >= 4, stepMin: 4 },
    { label: 'Speech-to-Text Audio Transcription', active: selectedStep >= 4, stepMin: 4 },
    { label: 'Client Mic Capture & 16kHz PCM Stream', active: selectedStep >= 5, stepMin: 5 },
    { label: 'Silero VAD v5 Fast-Handoff (audioStreamEnd)', active: selectedStep >= 5, stepMin: 5 },
    { label: 'LiveDeadAirGuard Silence Clamping', active: selectedStep >= 6, stepMin: 6 },
    { label: 'Two-Phase Watchdog (5s Nudge / 18s Kill)', active: selectedStep >= 6, stepMin: 6 },
    { label: 'Non-Speech Token Interception', active: selectedStep >= 6, stepMin: 6 },
    { label: 'Tactile Barge-In & De-click Ramp', active: selectedStep >= 6, stepMin: 6 }
  ];

  return (
    <div className="bg-white/80 backdrop-blur-md border border-pastel-rose/80 rounded-3xl p-5 shadow-xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-pastel-border/60">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center font-bold">
            <Code2 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-pastel-text">Инспектор конфигурации шага {selectedStep}</h3>
            <p className="text-[10px] text-pastel-muted">Реальный JSON payload, отправляемый в Gemini Live v3</p>
          </div>
        </div>

        {/* Tab switch */}
        <div className="flex items-center gap-1 bg-pastel-bg p-1 rounded-xl border border-pastel-border/60">
          <button
            onClick={() => setActiveTab('payload')}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${
              activeTab === 'payload'
                ? 'bg-white text-violet-700 shadow-2xs'
                : 'text-pastel-muted hover:text-pastel-text'
            }`}
          >
            JSON Payload
          </button>
          <button
            onClick={() => setActiveTab('capabilities')}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${
              activeTab === 'capabilities'
                ? 'bg-white text-violet-700 shadow-2xs'
                : 'text-pastel-muted hover:text-pastel-text'
            }`}
          >
            Слои ({capabilities.filter((c) => c.active).length}/{capabilities.length})
          </button>
        </div>
      </div>

      {/* Content */}
      {activeTab === 'payload' ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] text-pastel-muted">
            <span className="font-mono text-[10px]">Setup Envelope & Grounding Frame</span>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-pastel-card hover:bg-white border border-pastel-border text-[10px] text-slate-700 hover:text-violet-700 transition cursor-pointer"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? 'Скопировано!' : 'Копировать'}</span>
            </button>
          </div>

          <pre className="p-3.5 rounded-2xl bg-slate-900 text-slate-100 font-mono text-[11px] leading-relaxed overflow-x-auto max-h-60 border border-slate-800 shadow-inner">
            {JSON.stringify(stepDef.setupPayload, null, 2)}
          </pre>

          <div className="p-2.5 rounded-xl bg-violet-50/70 border border-violet-200/60 text-[11px] text-slate-700 space-y-1">
            <div className="font-bold text-violet-800 flex items-center gap-1.5 text-[10px] uppercase tracking-wider">
              <Eye className="w-3 h-3" />
              <span>Ожидаемый результат проверки шага:</span>
            </div>
            <p className="text-slate-600 leading-normal">
              {stepDef.expectedBehavior}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
          {capabilities.map((c, i) => (
            <div
              key={i}
              className={`p-2 rounded-xl flex items-center justify-between text-[11px] border transition ${
                c.active
                  ? 'bg-emerald-50/50 border-emerald-200/70 text-emerald-900'
                  : 'bg-slate-50/50 border-slate-200/50 text-slate-400 opacity-60'
              }`}
            >
              <div className="flex items-center gap-2">
                {c.active ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                )}
                <span className="font-medium">{c.label}</span>
              </div>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/80 border border-current opacity-80">
                Шаг {c.stepMin}+
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
