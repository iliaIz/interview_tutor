import React, { useMemo, useState } from 'react';
import Prism from '../utils/prismSetup';
import { Highlight, type PrismTheme } from 'prism-react-renderer';
import { Copy, Check, Search } from 'lucide-react';
import { useSelectionFocusStore } from '../store/useSelectionFocusStore';

// Import Prism language definitions for Java, Kotlin, SQL, JSON, Bash
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-kotlin';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-bash';

/**
 * Register Custom JVM Forensics & SRE Observability Log Grammar into Prism
 */
if (Prism && Prism.languages) {
  Prism.languages.log = {
    'thread-deadlock': {
      pattern: /Found \d+ Java-level deadlock|Deadlock detected|deadlock/i,
      alias: 'important'
    },
    'thread-state-runnable': {
      pattern: /java\.lang\.Thread\.State:\s*RUNNABLE/i,
      alias: 'attr-name'
    },
    'thread-state-blocked': {
      pattern: /java\.lang\.Thread\.State:\s*BLOCKED[^\n]*/i,
      alias: 'deleted'
    },
    'thread-state-waiting': {
      pattern: /java\.lang\.Thread\.State:\s*(TIMED_WAITING|WAITING)[^\n]*/i,
      alias: 'keyword'
    },
    'lock-address': {
      pattern: /<0x[0-9a-fA-F]+>|parking to wait for <0x[0-9a-fA-F]+>|waiting on <0x[0-9a-fA-F]+>|locked <0x[0-9a-fA-F]+>/i,
      alias: 'number'
    },
    'log-error': {
      pattern: /\b(FATAL|ERROR|SEVERE|CRITICAL|OutOfMemoryError|NullPointerException|Deadlock|TimeoutException|SQLException|HikariPool-\d+ - Connection is not available)\b/,
      alias: 'deleted'
    },
    'log-warn': {
      pattern: /\b(WARN|WARNING|Slow query|High GC pause|Pool exhausted)\b/,
      alias: 'annotation'
    },
    'log-info': {
      pattern: /\b(INFO|DEBUG|TRACE)\b/,
      alias: 'function'
    },
    'thread-name': {
      pattern: /"[^"\n]+"(?=\s+#\d+)/,
      alias: 'class-name'
    },
    'timestamp': {
      pattern: /\b\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?\b/,
      alias: 'comment'
    },
    'string': {
      pattern: /(["'])(?:\\(?:\r\n|[\s\S])|(?!\1)[^\\\r\n])*\1/,
      greedy: true
    },
    'number': /\b\d+(?:\.\d+)?(?:ms|s|MB|GB|KB|K|M|B)?\b/
  };

  Prism.languages.jstack = Prism.languages.log;
}

/**
 * Velvet Obsidian Luxury Dark Theme Token Mappings
 */
export const velvetObsidianTheme: PrismTheme = {
  plain: {
    color: '#E0E6ED',
    backgroundColor: '#0B0C10',
  },
  styles: [
    {
      types: ['comment', 'prolog', 'doctype', 'cdata'],
      style: {
        color: '#637777',
        fontStyle: 'italic',
      },
    },
    {
      types: ['annotation', 'decorator', 'attr-name'],
      style: {
        color: '#C792EA',
        fontWeight: '600',
      },
    },
    {
      types: ['keyword', 'tag', 'operator'],
      style: {
        color: '#7FDBCA',
      },
    },
    {
      types: ['class-name', 'type-annotation', 'builtin'],
      style: {
        color: '#82AAFF',
      },
    },
    {
      types: ['string', 'char'],
      style: {
        color: '#ECC48D',
      },
    },
    {
      types: ['function', 'function-variable'],
      style: {
        color: '#80CBC4',
      },
    },
    {
      types: ['number', 'boolean'],
      style: {
        color: '#FF5370',
      },
    },
    {
      types: ['punctuation'],
      style: {
        color: '#89DDFF',
      },
    },
    {
      types: ['deleted', 'important'],
      style: {
        color: '#FF6B6B',
        fontWeight: 'bold',
      },
    },
    {
      types: ['inserted'],
      style: {
        color: '#49D69E',
        fontWeight: 'bold',
      },
    },
  ],
};

export type SupportedLanguage = 'java' | 'kotlin' | 'sql' | 'json' | 'bash' | 'markdown' | 'log' | 'jstack' | string;

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
}

type DiffKind = 'added' | 'removed' | 'neutral';

interface LineMetadata {
  diffKind: DiffKind;
  cleanText: string;
  isMatch?: boolean;
}

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
}) => {
  const [copied, setCopied] = useState(false);
  const { activeFocus, setFocus, clearFocus } = useSelectionFocusStore();
  const rawCodeLines = useMemo(() => (code || '').trimEnd().split('\n'), [code]);

  // SOTA 2026 Deictic Grounding: Check if line is within active user focus
  const isLineInFocus = (lineNum: number) => {
    if (!activeFocus || activeFocus.zone !== 'code') return false;
    if (activeFocus.revisionIndex !== undefined && revisionIndex !== undefined && activeFocus.revisionIndex !== revisionIndex) {
      return false;
    }
    const start = activeFocus.startLine ?? 0;
    const end = activeFocus.endLine ?? 0;
    return lineNum >= start && lineNum <= end;
  };

  const handleGutterClick = (lineNum: number, e: React.MouseEvent) => {
    e.stopPropagation();
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

    const selectedLinesText = rawCodeLines.slice(start - 1, end).join('\n');

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

  // Normalize code and extract unified diff & search match metadata
  const { normalizedCode, linesMeta, totalMatches } = useMemo(() => {
    const rawLines = (code || '').trimEnd().split('\n');
    const cleanSearch = searchQuery.trim().toLowerCase();

    if (!isDiff) {
      let matchesCount = 0;
      const metadata: LineMetadata[] = rawLines.map((line) => {
        const isMatch = cleanSearch.length > 0 && line.toLowerCase().includes(cleanSearch);
        if (isMatch) matchesCount++;
        return { diffKind: 'neutral', cleanText: line, isMatch };
      });

      return {
        normalizedCode: rawLines.join('\n'),
        linesMeta: metadata,
        totalMatches: matchesCount,
      };
    }

    const metadata: LineMetadata[] = [];
    const sanitizedCodeLines: string[] = [];
    let matchesCount = 0;

    for (const rawLine of rawLines) {
      let diffKind: DiffKind = 'neutral';
      let cleanText = rawLine;

      if (rawLine.startsWith('+')) {
        diffKind = 'added';
        cleanText = ' ' + rawLine.slice(1);
      } else if (rawLine.startsWith('-')) {
        diffKind = 'removed';
        cleanText = ' ' + rawLine.slice(1);
      }

      const isMatch = cleanSearch.length > 0 && cleanText.toLowerCase().includes(cleanSearch);
      if (isMatch) matchesCount++;

      metadata.push({ diffKind, cleanText, isMatch });
      sanitizedCodeLines.push(cleanText);
    }

    return {
      normalizedCode: sanitizedCodeLines.join('\n'),
      linesMeta: metadata,
      totalMatches: matchesCount,
    };
  }, [code, isDiff, searchQuery]);

  const handleCopy = () => {
    // Copy clean code without diff signs if in diff mode
    const textToCopy = isDiff
      ? linesMeta.map(l => l.cleanText.trimStart()).join('\n')
      : code;

    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      data-selection-zone="code"
      data-revision-index={revisionIndex}
      className={`relative overflow-hidden rounded-2xl border border-[#2A243E] bg-[#0B0C10] font-mono text-[11.5px] sm:text-xs md:text-sm shadow-xl ${className}`}
      style={{ contain: 'content' }}
    >
      {/* Header bar with macOS window dots and copy button */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#141220] border-b border-[#2A243E] select-none">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-rose-500/80 shadow-sm" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80 shadow-sm" />
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 shadow-sm" />
          </div>
          {title && (
            <span className="text-[11px] font-sans font-medium text-[#B3A9D4] tracking-wide ml-2">
              {title}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {searchQuery && totalMatches > 0 && (
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
              <Search className="w-3 h-3" />
              <span>{totalMatches} совп.</span>
            </span>
          )}
          <span className="text-[10px] uppercase font-mono tracking-wider text-[#7E7796] bg-[#1E1A2E] px-2 py-0.5 rounded-md border border-[#2A243E]">
            {isDiff ? 'Unified Diff' : language}
          </span>
          <button
            onClick={handleCopy}
            title="Скопировать код"
            className="flex items-center gap-1.5 text-[11px] text-[#A59CBF] hover:text-white transition-colors bg-[#1E1A2E] hover:bg-[#2A243E] px-2.5 py-1 rounded-lg border border-[#2A243E] cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Скопировано</span>
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

      {/* Code body */}
      <Highlight
        prism={Prism}
        theme={velvetObsidianTheme}
        code={normalizedCode}
        language={language === 'jstack' || language === 'log' ? 'log' : language}
      >
        {({ className: highlightClass, style, tokens, getLineProps, getTokenProps }) => (
          <pre
            className={`${highlightClass} m-0 overflow-x-auto p-0 selection:bg-[#3D3558] scroll-touch-x ${maxHeight ? maxHeight : ''}`}
            style={{ ...style, backgroundColor: '#0B0C10' }}
          >
            <code className="block min-w-full py-3">
              <div className="w-max min-w-full">
                {tokens.map((lineTokens, lineIndex) => {
                  const meta = linesMeta[lineIndex] || { diffKind: 'neutral', isMatch: false };
                  const lineProps = getLineProps({ line: lineTokens, key: lineIndex });
                  const lineNum = lineIndex + 1;
                  const inFocus = isLineInFocus(lineNum);

                  let rowBgStyle = 'hover:bg-white/[0.03] transition-colors duration-75';
                  let indicatorChar = ' ';
                  let indicatorStyle = 'text-transparent';

                  if (inFocus) {
                    rowBgStyle = 'bg-pastel-accentViolet/25 border-l-2 border-pastel-accentViolet ring-1 ring-pastel-accentViolet/40';
                  } else if (isDiff) {
                    if (meta.diffKind === 'added') {
                      rowBgStyle = 'bg-emerald-500/10 border-l-2 border-emerald-500';
                      indicatorChar = '+';
                      indicatorStyle = 'text-emerald-400 font-bold';
                    } else if (meta.diffKind === 'removed') {
                      rowBgStyle = 'bg-rose-500/15 border-l-2 border-rose-500';
                      indicatorChar = '-';
                      indicatorStyle = 'text-rose-400 font-bold';
                    } else {
                      rowBgStyle = 'border-l-2 border-transparent';
                    }
                  } else if (meta.isMatch) {
                    rowBgStyle = 'bg-amber-500/20 border-l-2 border-amber-400 ring-1 ring-amber-400/30';
                  }

                  return (
                    <div
                      key={lineIndex}
                      {...lineProps}
                      data-line-number={lineNum}
                      className={`flex items-baseline w-full px-2 py-0.5 ${rowBgStyle}`}
                    >
                      {showLineNumbers && (
                        <span
                          onClick={(e) => handleGutterClick(lineNum, e)}
                          title="Нажмите, чтобы указать ИИ на эту строку"
                          data-line-number={lineNum}
                          className={`w-7 sm:w-9 flex-shrink-0 select-none pr-1.5 sm:pr-3 text-right font-mono text-[10px] sm:text-[11px] tabular-nums cursor-pointer transition-colors duration-150 ${
                            inFocus ? 'text-pastel-accentViolet font-bold' : 'text-[#7E7796] hover:text-pastel-accentViolet'
                          }`}
                        >
                          {lineNum}
                        </span>
                      )}

                      {isDiff && (
                        <span
                          className={`w-4 flex-shrink-0 select-none text-center font-mono text-xs ${indicatorStyle}`}
                          aria-hidden="true"
                        >
                          {indicatorChar}
                        </span>
                      )}

                      <span className="flex-1 whitespace-pre font-mono pl-1 leading-relaxed text-[#E0E6ED]">
                        {lineTokens.map((token, tokenKey) => (
                          <span key={tokenKey} {...getTokenProps({ token, key: tokenKey })} />
                        ))}
                      </span>
                    </div>
                  );
                })}
              </div>
            </code>
          </pre>
        )}
      </Highlight>
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
    prev.revisionId === next.revisionId
  );
});

export default CodeViewer;
