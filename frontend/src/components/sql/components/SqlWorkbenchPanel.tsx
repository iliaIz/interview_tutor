import React from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { sql } from '@codemirror/lang-sql';
import { luxuryPastelTheme } from '../../practice/editorTheme';
import { Database, Bot, RotateCcw, Play } from 'lucide-react';

export interface SqlWorkbenchPanelProps {
  editorSql: string;
  setEditorSql: (val: string) => void;
  isExecuting: boolean;
  onRunQuery: () => void;
  onReset: () => void;
  onOpenCopilot: () => void;
}

export const SqlWorkbenchPanel: React.FC<SqlWorkbenchPanelProps> = ({
  editorSql,
  setEditorSql,
  isExecuting,
  onRunQuery,
  onReset,
  onOpenCopilot
}) => {
  return (
    <div className="bg-white border border-pastel-border/80 rounded-2xl overflow-hidden shadow-sm flex flex-col">
      <div className="flex items-center justify-between px-3.5 py-2 bg-slate-50 border-b border-pastel-border/60">
        <span className="text-xs font-bold text-slate-700 font-mono flex items-center gap-1.5">
          <Database className="w-3.5 h-3.5 text-indigo-600" />
          Редактор SQL-запроса
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenCopilot}
            className="px-2.5 py-1 text-[11px] font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300/80 rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
            title="Открыть AI-Напарника с контекстом текущей SQL-задачи"
          >
            <Bot className="w-3.5 h-3.5 text-amber-700" />
            <span>AI-Напарник</span>
          </button>
          <button
            onClick={onReset}
            className="px-2 py-1 text-[11px] font-medium text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-200/60 transition-colors flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" /> Сброс
          </button>
          <button
            onClick={onRunQuery}
            disabled={isExecuting}
            className="px-3.5 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl transition-all shadow-sm flex items-center gap-1.5 active:scale-95"
          >
            {isExecuting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                <span>Выполнение...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Выполнить (Ctrl+Enter)</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div className="min-h-[180px] max-h-[260px] overflow-auto">
        <CodeMirror
          value={editorSql}
          height="100%"
          extensions={[sql()]}
          theme={luxuryPastelTheme}
          onChange={(val) => setEditorSql(val)}
          className="text-xs font-mono"
        />
      </div>
    </div>
  );
};
