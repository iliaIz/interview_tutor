import React, { useState } from 'react';
import { MutantResult } from '../../types/practice';
import {
  Bug,
  Sparkles,
  Copy,
  Check,
  Code2,
  FileCode,
  ShieldAlert,
  ChevronRight
} from 'lucide-react';

interface MutantDiffInspectorProps {
  mutant: MutantResult;
  onAskTutor: (mutant: MutantResult) => void;
}

export const MutantDiffInspector: React.FC<MutantDiffInspectorProps> = ({
  mutant,
  onAskTutor
}) => {
  const [copied, setCopied] = useState(false);
  const isKilled = mutant.status === 'KILLED';
  const isStillborn = mutant.status === 'STILLBORN';

  // Format mutator name into human-readable label
  const operatorLabel = mutant.mutatorType || mutant.name || 'Bytecode Mutator';
  const mutatedSnippet = mutant.mutatedContent || '// Байтодовая мутация оператора на строке ' + mutant.line;

  const handleCopySnippet = (snippet: string) => {
    navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sampleAssertJ = `// Добавьте в ваш тестовый класс:
@Test
void testDefectResistance_Line${mutant.line}() {
    // Arrange: подготовьте граничные входные данные
    
    // Act & Assert:
    assertThat(result).isNotNull();
}`;

  return (
    <div className="flex flex-col gap-2.5 p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs">
      {/* 1. Header with Mutator Type and Line */}
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${
            isKilled
              ? 'bg-emerald-500/10 text-emerald-400'
              : isStillborn
              ? 'bg-amber-500/10 text-amber-400'
              : 'bg-rose-500/10 text-rose-400'
          }`}>
            <Bug className="w-4 h-4" />
          </div>
          <div>
            <div className="font-semibold text-slate-200">{operatorLabel}</div>
            <div className="text-[10px] text-slate-400 font-mono">
              {mutant.file} : строка {mutant.line}
            </div>
          </div>
        </div>

        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
          isKilled
            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
            : isStillborn
            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
            : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
        }`}>
          {mutant.status}
        </span>
      </div>

      {/* 2. Interactive Bytecode Mutation Diff View */}
      <div className="rounded-lg overflow-hidden border border-slate-800 bg-slate-950 font-mono text-[11px]">
        <div className="bg-slate-900/80 px-3 py-1 text-[10px] text-slate-400 border-b border-slate-800 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Code2 className="w-3.5 h-3.5 text-slate-400" />
            Инъецированная мутация (Mutant Bytecode Diff)
          </span>
          <span className="text-slate-500">строка {mutant.line}</span>
        </div>
        <div className="p-2 space-y-1">
          <div className="flex items-start gap-2 text-rose-400/90 bg-rose-950/20 px-2 py-1 rounded">
            <span className="select-none font-bold text-rose-500">+</span>
            <span className="break-all">{mutatedSnippet}</span>
          </div>
        </div>
      </div>

      {/* 3. Root Cause Analysis / Defect Explanation */}
      {isStillborn && (
        <div className="p-2.5 rounded-lg bg-amber-950/30 border border-amber-900/40 text-[11px] text-amber-200">
          <div className="flex items-center gap-1.5 font-bold text-amber-300 mb-1">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
            <span>Ошибка компиляции мутанта (Stillborn Mutant)</span>
          </div>
          <p className="leading-relaxed text-slate-300">
            {mutant.failureReason ||
              'Инъецированная мутация привела к синтаксической ошибке компиляции в Java-компиляторе. Мутант исключен из зачета мутационного покрытия.'}
          </p>
        </div>
      )}

      {!isKilled && !isStillborn && (
        <div className="p-2.5 rounded-lg bg-rose-950/30 border border-rose-900/40 text-[11px] text-rose-200">
          <div className="flex items-center gap-1.5 font-bold text-rose-300 mb-1">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            <span>Почему тест-сьют пропустил этот дефект?</span>
          </div>
          <p className="leading-relaxed text-slate-300">
            {mutant.remediationHint ||
              'Ни один из существующих тестовых методов не проверяет точное пограничное поведение на этой строке. Ваши тесты проходят даже тогда, когда логика сломана.'}
          </p>
        </div>
      )}

      {/* 4. Killed By / Execution Details */}
      {isKilled && mutant.killedBy && (
        <div className="p-2 rounded-lg bg-emerald-950/20 border border-emerald-900/30 text-[11px] text-emerald-300 flex items-center gap-2">
          <span>Убит тестовым методом:</span>
          <span className="font-mono font-bold text-emerald-200">
            {mutant.killedBy.endsWith(')') ? mutant.killedBy : `${mutant.killedBy}()`}
          </span>
        </div>
      )}

      {/* 5. Action Triggers */}
      <div className="flex items-center gap-2 pt-1 flex-wrap">
        {!isKilled && !isStillborn && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAskTutor(mutant);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-pastel-rose text-pastel-accentRoseText text-xs font-bold border border-pastel-accentRose/30 hover:bg-pastel-accentRose hover:text-white transition cursor-pointer shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Спросить AI-Напарника: как убить мутанта?</span>
          </button>
        )}

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleCopySnippet(sampleAssertJ);
          }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition cursor-pointer"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'Скопировано!' : 'Шаблон AssertJ'}</span>
        </button>
      </div>
    </div>
  );
};
