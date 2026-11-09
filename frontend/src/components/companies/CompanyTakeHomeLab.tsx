import React, { useState } from 'react';
import { 
  PackageCheck, AlertTriangle, ShieldCheck, CheckCircle2, 
  ExternalLink, Code2, Bot, ArrowLeft, RefreshCw 
} from 'lucide-react';
import { usePracticeTutorStore } from '../../store/usePracticeTutorStore';
import { normalizeCompanyContext, TakeHomePrCase } from '@interview-prep/shared';

interface CompanyTakeHomeLabProps {
  onBackToPipeline: () => void;
  companyName?: string;
  prCases?: TakeHomePrCase[];
}

export const CompanyTakeHomeLab: React.FC<CompanyTakeHomeLabProps> = ({
  onBackToPipeline,
  companyName = 'АО «Райффайзенбанк»',
  prCases = []
}) => {
  const [activeCaseIndex, setActiveCaseIndex] = useState(0);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState(false);

  if (!prCases || prCases.length === 0) {
    return (
      <div className="p-8 rounded-3xl bg-white border border-pastel-border/80 text-center space-y-3 font-sans">
        <PackageCheck className="w-8 h-8 text-pastel-muted mx-auto" />
        <h3 className="text-sm font-bold text-slate-800">Кейсы ревью тестовых заданий для данной компании формируются</h3>
        <button onClick={onBackToPipeline} className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold cursor-pointer">
          Вернуться к пайплайну
        </button>
      </div>
    );
  }

  const currentCase = prCases[activeCaseIndex] || prCases[0];
  const selectedOption = currentCase.options.find((o) => o.id === selectedOptionId);

  const handleSelectOption = (optId: string) => {
    setSelectedOptionId(optId);
    setIsAnswerSubmitted(true);
  };

  const handleNextCase = () => {
    setSelectedOptionId(null);
    setIsAnswerSubmitted(false);
    setActiveCaseIndex((prev) => (prev + 1) % prCases.length);
  };

  const handleOpenCopilot = () => {
    const polyContext = normalizeCompanyContext({
      profile: { id: 'company_take_home', name: companyName, tagline: 'Take-Home Project Lab', takeHomePrCases: prCases },
      activeStage: { id: 'stage-take-home', title: `Кейс ревью ${currentCase.prNumber}: ${currentCase.title}`, description: currentCase.flawCategory },
      activeCodeSnippet: currentCase.codeSnippet,
      activeTaskTitle: `Take-Home Lab: PR ${currentCase.prNumber}`
    });
    usePracticeTutorStore.getState().setActiveContext(polyContext);
    usePracticeTutorStore.getState().toggleOpen(true);
  };

  return (
    <div className="space-y-6 font-sans pb-20">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-3xl border border-pastel-border/80 shadow-xs">
        <div className="flex items-center gap-3">
          <button onClick={onBackToPipeline} className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer" title="Назад к воронке этапов">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200 flex items-center gap-1">
                <PackageCheck className="w-3.5 h-3.5 text-teal-700" /> Официальное тестовое задание банка
              </span>
              <a href="https://github.com/Raiffeisen-DGTL/cib-interns-test-task" target="_blank" rel="noreferrer" className="text-[11px] font-mono text-indigo-600 hover:underline flex items-center gap-1">
                Raiffeisen-DGTL/cib-interns-test-task <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <h2 className="text-base sm:text-lg font-black text-slate-900">
              Склад носков: Криминалистика {prCases.length} реальных Pull Request'ов
            </h2>
          </div>
        </div>

        <button onClick={handleOpenCopilot} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-950 font-bold text-xs transition cursor-pointer shadow-2xs self-start sm:self-auto">
          <Bot className="w-4 h-4 text-amber-700" />
          Обсудить с AI-Напарником
        </button>
      </div>

      {/* Case Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {prCases.map((pr, idx) => (
          <button
            key={pr.id}
            onClick={() => { setActiveCaseIndex(idx); setSelectedOptionId(null); setIsAnswerSubmitted(false); }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeCaseIndex === idx ? 'bg-slate-900 text-white shadow-xs' : 'bg-white text-slate-600 border border-pastel-border/60 hover:bg-slate-50'
            }`}
          >
            <span>{pr.prNumber}</span>
            <span className="text-[10px] opacity-75 font-normal">({pr.flawCategory.split(' ')[0]})</span>
          </button>
        ))}
      </div>

      {/* Main Review Arena */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Code Snippet */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-pastel-border/80 p-5 shadow-xs space-y-3 flex flex-col">
          <div className="flex items-center justify-between border-b border-pastel-border/60 pb-2">
            <div className="flex items-center gap-2">
              <Code2 className="w-4 h-4 text-slate-600" />
              <span className="text-xs font-bold text-slate-800 font-mono">
                PR {currentCase.prNumber} by {currentCase.author}: {currentCase.title}
              </span>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
              {currentCase.flawCategory}
            </span>
          </div>

          <pre className="p-4 rounded-2xl bg-slate-950 text-slate-100 text-xs font-mono overflow-x-auto leading-relaxed border border-slate-800">
            <code>{currentCase.codeSnippet}</code>
          </pre>

          {isAnswerSubmitted && selectedOption?.isCorrect && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-1.5">
              <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-700" />
                Каноническое Production-решение банка:
              </span>
              <pre className="p-2.5 rounded-xl bg-white border border-emerald-300 text-emerald-950 font-mono text-[11px] overflow-x-auto">
                <code>{currentCase.canonicalFixSql}</code>
              </pre>
            </div>
          )}
        </div>

        {/* Right: Inspection Questions & Verdict */}
        <div className="lg:col-span-5 bg-white rounded-3xl border border-pastel-border/80 p-5 shadow-xs space-y-4">
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Вердикт ревьюера (Senior Bar-Raiser)</span>
            <h3 className="text-sm font-bold text-slate-900">Почему этот Pull Request был отклонен техлидом?</h3>
          </div>

          <div className="space-y-2.5">
            {currentCase.options.map((opt) => {
              const isSelected = selectedOptionId === opt.id;
              let btnStyle = 'bg-slate-50 border-pastel-border/70 hover:bg-slate-100 text-slate-800';
              if (isAnswerSubmitted && isSelected) {
                btnStyle = opt.isCorrect ? 'bg-emerald-50 border-emerald-300 text-emerald-950' : 'bg-rose-50 border-rose-300 text-rose-950';
              }
              return (
                <button
                  key={opt.id}
                  onClick={() => handleSelectOption(opt.id)}
                  disabled={isAnswerSubmitted}
                  className={`w-full text-left p-3.5 rounded-2xl border text-xs leading-relaxed transition-all cursor-pointer ${btnStyle}`}
                >
                  <div className="flex items-start gap-2">
                    <span className="font-bold shrink-0">{isSelected ? '●' : '○'}</span>
                    <span>{opt.label}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {isAnswerSubmitted && selectedOption && (
            <div className={`p-3.5 rounded-2xl border text-xs leading-relaxed space-y-1 animate-in fade-in ${
              selectedOption.isCorrect ? 'bg-emerald-50/90 border-emerald-200 text-emerald-900' : 'bg-rose-50/90 border-rose-200 text-rose-900'
            }`}>
              <div className="font-bold flex items-center gap-1.5">
                {selectedOption.isCorrect ? (
                  <><CheckCircle2 className="w-4 h-4 text-emerald-600" /><span>Верно! Выявили первопричину отказа:</span></>
                ) : (
                  <><AlertTriangle className="w-4 h-4 text-rose-600" /><span>Поверхностный вывод (симптом, а не причина):</span></>
                )}
              </div>
              <p>{selectedOption.explanation}</p>
            </div>
          )}

          {isAnswerSubmitted && (
            <button
              onClick={handleNextCase}
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Следующий кейс
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
