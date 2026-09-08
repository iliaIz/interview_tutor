import React, { useMemo, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { java } from '@codemirror/lang-java';
import { RangeSetBuilder, Extension } from '@codemirror/state';
import { EditorView, Decoration, DecorationSet } from '@codemirror/view';
import { Copy, Check, Search } from 'lucide-react';
import { useSelectionFocusStore } from '../store/useSelectionFocusStore';
import { luxuryPastelTheme } from '../theme/codeMirrorTheme';

export type SupportedLanguage = 'java' | 'kotlin' | 'sql' | 'json' | 'bash' | 'log' | 'jstack' | string;

export interface CodeViewerProps {
  code: string;
  language?: SupportedLanguage;
  isDiff?: boolean;
  showLineNumbers?: boolean;
  title?: string;
  className?: string;
  maxHeight?: string;
  searchQuery?: string;
  revisionIndex?: number;
  revisionTitle?: string;
  revisionId?: string;
  hideHeader?: boolean;
  embedded?: boolean;
}

/**
 * Backward compatibility alias for legacy imports
 */
export const velvetObsidianTheme = luxuryPastelTheme;

const CodeViewerComponent: React.FC<CodeViewerProps> = ({
  code,
  language = 'java',
  isDiff = false,
  showLineNumbers = true,
  title,
  className = '',
  maxHeight,
  searchQuery = '',
  revisionIndex,
  revisionTitle,
  revisionId,
  hideHeader = false,
  embedded = false,
}) => {
  const [copied, setCopied] = useState(false);
  const { activeFocus, setFocus, clearFocus } = useSelectionFocusStore();

  // Determine if a line number is currently in active user focus
  const isLineInFocus = (lineNum: number) => {
    if (!activeFocus || activeFocus.zone !== 'code') return false;
    if (
      activeFocus.revisionIndex !== undefined &&
      revisionIndex !== undefined &&
      activeFocus.revisionIndex !== revisionIndex
    ) {
      return false;
    }
    const start = activeFocus.startLine ?? 0;
    const end = activeFocus.endLine ?? 0;
    return lineNum >= start && lineNum <= end;
  };

  // Active focus range memo for fast decoration lookup
  const activeFocusRange = useMemo(() => {
    if (!activeFocus || activeFocus.zone !== 'code') return null;
    if (
      activeFocus.revisionIndex !== undefined &&
      revisionIndex !== undefined &&
      activeFocus.revisionIndex !== revisionIndex
    ) {
      return null;
    }
    if (!activeFocus.startLine || !activeFocus.endLine) return null;
    return { startLine: activeFocus.startLine, endLine: activeFocus.endLine };
  }, [activeFocus, revisionIndex]);

  // Handle clicking line numbers in the gutter for Deictic Grounding
  const handleGutterClick = (lineNum: number, e: MouseEvent) => {
    if (isLineInFocus(lineNum) && activeFocus?.startLine === activeFocus?.endLine) {
      clearFocus();
      return;
    }

    let start = lineNum;
    let end = lineNum;

    if (e.shiftKey && activeFocus && activeFocus.zone === 'code' && activeFocus.startLine) {
      start = Math.min(activeFocus.startLine, lineNum);
      end = Math.max(activeFocus.startLine, lineNum);
    }

    const rawLines = (code || '').trimEnd().split('\n');
    const selectedLinesText = rawLines.slice(start - 1, end).join('\n');

    setFocus({
      zone: 'code',
      text: selectedLinesText,
      startLine: start,
      endLine: end,
      revisionIndex,
      revisionTitle: title || revisionTitle || (revisionIndex ? `v${revisionIndex}` : undefined),
      revisionId,
      language,
      timestamp: Date.now()
    });
  };

  // Search match count
  const totalMatches = useMemo(() => {
    if (!searchQuery.trim() || !code) return 0;
    const query = searchQuery.toLowerCase();
    return code.split('\n').filter(line => line.toLowerCase().includes(query)).length;
  }, [code, searchQuery]);

  // Copy clean code without diff signs
  const handleCopy = () => {
    const textToCopy = isDiff
      ? (code || '')
          .split('\n')
          .map((l) => (l.startsWith('+') || l.startsWith('-') ? l.slice(1) : l))
          .join('\n')
      : code;

    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // CodeMirror Extensions: Language, Diff / Focus Line Decorator, Gutter Click Handler
  const extensions = useMemo(() => {
    const exts: Extension[] = [java()];

    // Line decoration extension for Diff and Active Focus highlighting
    const lineDecorationExt = EditorView.decorations.of((view: EditorView): DecorationSet => {
      const builder = new RangeSetBuilder<Decoration>();
      for (const { from, to } of view.visibleRanges) {
        for (let pos = from; pos <= to; ) {
          const line = view.state.doc.lineAt(pos);
          let cls = '';

          if (
            activeFocusRange &&
            line.number >= activeFocusRange.startLine &&
            line.number <= activeFocusRange.endLine
          ) {
            cls = 'cm-focus-line';
          } else if (isDiff) {
            const text = line.text;
            if (text.startsWith('+')) {
              cls = 'cm-diff-added';
            } else if (text.startsWith('-')) {
              cls = 'cm-diff-removed';
            }
          }

          if (cls) {
            builder.add(line.from, line.from, Decoration.line({ class: cls }));
          }
          pos = line.to + 1;
        }
      }
      return builder.finish();
    });
    exts.push(lineDecorationExt);

    // Gutter click listener for Deictic Grounding
    const gutterClickExt = EditorView.domEventHandlers({
      click(event: MouseEvent) {
        const target = event.target as HTMLElement | null;
        if (!target) return false;
        const gutterEl = target.closest('.cm-gutterElement') as HTMLElement | null;
        if (gutterEl && !gutterEl.classList.contains('cm-foldGutter')) {
          const text = gutterEl.textContent?.trim() || '';
          const lineNum = parseInt(text, 10);
          if (!isNaN(lineNum) && lineNum > 0) {
            event.preventDefault();
            event.stopPropagation();
            handleGutterClick(lineNum, event);
            return true;
          }
        }
        return false;
      }
    });
    exts.push(gutterClickExt);

    return exts;
  }, [isDiff, activeFocusRange, code, language, revisionIndex, revisionTitle, revisionId, title]);

  return (
    <div
      data-selection-zone="code"
      data-revision-index={revisionIndex}
      className={
        embedded
          ? `relative overflow-hidden font-mono text-xs codeviewer-codemirror w-full h-full flex flex-col ${className}`
          : `relative overflow-hidden rounded-2xl border border-[#1e2638] bg-[#121622] font-mono text-xs shadow-xl modal-overscroll-contain codeviewer-codemirror ${className}`
      }
    >
      {/* Header bar with macOS window dots and copy button (hidden when embedded or hideHeader) */}
      {!hideHeader && !embedded && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#171c2c] border-b border-[#1e2638] select-none">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex gap-1.5 shrink-0">
              <div className="w-2.5 h-2.5 rounded-full bg-rose-500/80 shadow-xs" />
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80 shadow-xs" />
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 shadow-xs" />
            </div>
            {title && (
              <span className="text-[11px] font-sans font-medium text-slate-300 tracking-wide ml-2 truncate">
                {title}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {searchQuery && totalMatches > 0 && (
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                <Search className="w-3 h-3" />
                <span>{totalMatches} совп.</span>
              </span>
            )}
            <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-700/60">
              {isDiff ? 'Unified Diff' : language}
            </span>
            <button
              onClick={handleCopy}
              title="Скопировать код"
              className="flex items-center gap-1.5 text-[11px] text-slate-300 hover:text-white transition-colors bg-slate-800/80 hover:bg-slate-700/80 px-2.5 py-1 rounded-lg border border-slate-700/60 cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400 font-semibold">Скопировано</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Копировать</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* CodeMirror 6 Viewport */}
      <div className={`overflow-hidden ${embedded ? 'flex-1 h-full w-full' : maxHeight ? `${maxHeight} overflow-y-auto` : ''}`}>
        <CodeMirror
          value={code || ''}
          height={embedded ? '100%' : undefined}
          className={embedded ? 'h-full w-full custom-codemirror-container' : undefined}
          theme={luxuryPastelTheme}
          extensions={extensions}
          readOnly={true}
          editable={false}
          basicSetup={{
            lineNumbers: showLineNumbers,
            highlightActiveLineGutter: false,
            highlightSpecialChars: true,
            history: false,
            foldGutter: false,
            drawSelection: true,
            dropCursor: false,
            allowMultipleSelections: false,
            indentOnInput: false,
            syntaxHighlighting: true,
            bracketMatching: true,
            closeBrackets: false,
            autocompletion: false,
            rectangularSelection: false,
            crosshairCursor: false,
            highlightActiveLine: false,
            highlightSelectionMatches: true
          }}
        />
      </div>
    </div>
  );
};

export const CodeViewer = React.memo(CodeViewerComponent, (prev, next) => {
  return (
    prev.code === next.code &&
    prev.language === next.language &&
    prev.isDiff === next.isDiff &&
    prev.showLineNumbers === next.showLineNumbers &&
    prev.title === next.title &&
    prev.className === next.className &&
    prev.maxHeight === next.maxHeight &&
    prev.searchQuery === next.searchQuery &&
    prev.revisionIndex === next.revisionIndex &&
    prev.revisionTitle === next.revisionTitle &&
    prev.revisionId === next.revisionId &&
    prev.hideHeader === next.hideHeader &&
    prev.embedded === next.embedded
  );
});

export default CodeViewer;
