import React, { useState, useEffect } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { java } from '@codemirror/lang-java';
import { oneDark } from '@codemirror/theme-one-dark';
import { 
  FileCode, AlertTriangle, CheckCircle2, RotateCcw, 
  Sparkles, ShieldCheck, ShieldAlert 
} from 'lucide-react';

interface SourceFile {
  path: string;
  content: string;
  is_editable?: boolean;
}

interface FadedBug {
  line_number: number;
  description: string;
  bug_pattern: string;
}

interface ForensicCodeEditorProps {
  files?: SourceFile[];
  fadedBug?: FadedBug;
  correctFixDiff?: string;
  astRuleInvariants?: string[];
  onCodeChange?: (content: string) => void;
  onRuntimeFixApplied?: (fixed: boolean) => void;
}

export const ForensicCodeEditor: React.FC<ForensicCodeEditorProps> = ({
  files = [],
  fadedBug,
  correctFixDiff,
  astRuleInvariants = [],
  onCodeChange,
  onRuntimeFixApplied
}) => {
  const defaultFile = files[0] || {
    path: 'src/main/java/Service.java',
    content: '// No runtime source files defined for this challenge'
  };

  const [activeFilePath, setActiveFilePath] = useState(defaultFile.path);
  const [code, setCode] = useState(defaultFile.content);
  const [isDiffExpanded, setIsDiffExpanded] = useState(false);

  const checkIsFixed = (currentCode: string): boolean => {
    if (!fadedBug) return false;
    // 1. Initial unmodified baseline code is NEVER considered fixed
    if (currentCode.trim() === defaultFile.content.trim()) {
      return false;
    }
    // 2. Unimplemented placeholders or bug markers disqualify the fix
    if (currentCode.includes('// BUG:') || currentCode.includes('// BUG 2:') || currentCode.includes('return null;')) {
      return false;
    }
    // 3. If bug_pattern exists in code as a literal string or symbol, ensure it was eliminated
    if (fadedBug.bug_pattern && currentCode.includes(fadedBug.bug_pattern)) {
      return false;
    }
    // 4. Candidate must have added substantive logic beyond the original template
    return currentCode.trim().length > 100;
  };

  const [isBugFixed, setIsBugFixed] = useState(() => checkIsFixed(defaultFile.content));

  useEffect(() => {
    const f = files.find(item => item.path === activeFilePath) || files[0];
    if (f) {
      setCode(f.content);
      const fixed = checkIsFixed(f.content);
      setIsBugFixed(fixed);
      onRuntimeFixApplied?.(fixed);
    }
  }, [files, activeFilePath]);

  const handleReset = () => {
    const f = files.find(item => item.path === activeFilePath) || files[0];
    if (f) {
      setCode(f.content);
      onCodeChange?.(f.content);
      const fixed = checkIsFixed(f.content);
      setIsBugFixed(fixed);
      onRuntimeFixApplied?.(fixed);
    }
  };

  const handleChange = (val: string) => {
    setCode(val);
    onCodeChange?.(val);
    const fixed = checkIsFixed(val);
    setIsBugFixed(fixed);
    onRuntimeFixApplied?.(fixed);
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100 rounded-2xl overflow-hidden border border-slate-800 shadow-xl">
      {/* 1. Header with file tabs */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-950/80 border-b border-slate-800">
        <div className="flex items-center gap-2 overflow-x-auto">
          {files.map((file) => (
            <button
              key={file.path}
              onClick={() => setActiveFilePath(file.path)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono transition ${
                activeFilePath === file.path
                  ? 'bg-purple-950/70 text-purple-300 border border-purple-500/40'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              {file.path.split('/').pop()}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleReset}
            className="flex items-center gap-1 px-2.5 py-1 text-xs text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            title="Сбросить к исходному коду"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Сбросить</span>
          </button>
        </div>
      </div>

      {/* 2. Faded Bug Banner if present */}
      {fadedBug && (
        <div className={`flex items-start justify-between gap-3 px-4 py-2.5 border-b text-xs transition-colors ${
          isBugFixed
            ? 'bg-emerald-950/40 border-emerald-600/30 text-emerald-200'
            : 'bg-amber-950/40 border-amber-600/30 text-amber-200'
        }`}>
          <div className="flex items-start gap-2">
            {isBugFixed ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            )}
            <div>
              <div className="font-semibold flex items-center gap-2">
                <span className={isBugFixed ? 'text-emerald-300' : 'text-amber-300'}>
                  {isBugFixed ? 'Дефект устранен' : `Дефект в строке ${fadedBug.line_number}`} [{fadedBug.bug_pattern}]:
                </span>
                {isBugFixed && (
                  <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-emerald-900/60 text-emerald-300 border border-emerald-700/50">
                    Студия 2: Пенальти снят
                  </span>
                )}
              </div>
              <div className={`text-[11px] mt-0.5 ${isBugFixed ? 'text-emerald-200/90' : 'text-amber-200/90'}`}>
                {isBugFixed
                  ? 'Код успешно модифицирован без антипаттерна. Архитектурный пенальти в симуляции деактивирован.'
                  : fadedBug.description}
              </div>
            </div>
          </div>
          {correctFixDiff && (
            <button
              onClick={() => setIsDiffExpanded(!isDiffExpanded)}
              className={`text-[11px] px-2 py-1 rounded border shrink-0 transition ${
                isBugFixed
                  ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border-emerald-500/30'
                  : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-500/30'
              }`}
            >
              {isDiffExpanded ? 'Скрыть подсказку' : 'Подсказка фикса'}
            </button>
          )}
        </div>
      )}

      {/* Diff hint collapsible panel */}
      {isDiffExpanded && correctFixDiff && (
        <div className="p-3 bg-slate-950 border-b border-slate-800 font-mono text-[11px] text-emerald-300 overflow-x-auto whitespace-pre">
          <div className="text-slate-400 font-sans text-xs mb-1 font-bold">Эталонный diff архитектурного фикса:</div>
          {correctFixDiff}
        </div>
      )}

      {/* 3. CodeMirror Editor */}
      <div className="flex-1 overflow-auto">
        <CodeMirror
          value={code}
          height="100%"
          theme={oneDark}
          extensions={[java()]}
          onChange={handleChange}
          basicSetup={{
            lineNumbers: true,
            highlightActiveLineGutter: true,
            highlightActiveLine: true,
            foldGutter: true
          }}
          className="text-xs font-mono h-full"
        />
      </div>

      {/* 4. Footer Invariants */}
      {astRuleInvariants.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 bg-slate-950/90 border-t border-slate-800 text-[11px] text-slate-400">
          <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
          <span>AST Invariant Rules:</span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {astRuleInvariants.map((rule) => (
              <span key={rule} className="px-2 py-0.5 rounded bg-purple-950/60 border border-purple-800/50 text-purple-300 font-mono text-[10px]">
                {rule}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
