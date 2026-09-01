import React, { useMemo, useState } from 'react';
import Prism from '../utils/prismSetup';
import { Highlight, type PrismTheme } from 'prism-react-renderer';
import { Copy, Check } from 'lucide-react';

// Import Prism language definitions for Java, Kotlin, SQL
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-kotlin';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-bash';

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
  ],
};

export type SupportedLanguage = 'java' | 'kotlin' | 'sql' | 'json' | 'bash' | 'markdown' | string;

export interface CodeViewerProps {
  code: string;
  language?: SupportedLanguage;
  isDiff?: boolean;
  showLineNumbers?: boolean;
  title?: string;
  className?: string;
  maxHeight?: string;
}

type DiffKind = 'added' | 'removed' | 'neutral';

interface LineMetadata {
  diffKind: DiffKind;
  cleanText: string;
}

const CodeViewerComponent: React.FC<CodeViewerProps> = ({
  code,
  language = 'java',
  isDiff = false,
  showLineNumbers = true,
  title,
  className = '',
  maxHeight,
}) => {
  const [copied, setCopied] = useState(false);

  // Normalize code and extract unified diff metadata
  const { normalizedCode, linesMeta } = useMemo(() => {
    const rawLines = (code || '').trimEnd().split('\n');

    if (!isDiff) {
      return {
        normalizedCode: rawLines.join('\n'),
        linesMeta: rawLines.map(
          (): LineMetadata => ({ diffKind: 'neutral', cleanText: '' })
        ),
      };
    }

    const metadata: LineMetadata[] = [];
    const sanitizedCodeLines: string[] = [];

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

      metadata.push({ diffKind, cleanText });
      sanitizedCodeLines.push(cleanText);
    }

    return {
      normalizedCode: sanitizedCodeLines.join('\n'),
      linesMeta: metadata,
    };
  }, [code, isDiff]);

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
      className={`relative overflow-hidden rounded-2xl border border-[#2A243E] bg-[#0B0C10] font-mono text-xs md:text-sm shadow-xl modal-overscroll-contain ${className}`}
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
          <span className="text-[10px] uppercase font-mono tracking-wider text-[#7E7796] bg-[#1E1A2E] px-2 py-0.5 rounded-md border border-[#2A243E]">
            {isDiff ? 'Unified Diff' : language}
          </span>
          <button
            onClick={handleCopy}
            title="Скопировать код"
            className="flex items-center gap-1.5 text-[11px] text-[#A59CBF] hover:text-white transition-colors bg-[#1E1A2E] hover:bg-[#2A243E] px-2.5 py-1 rounded-lg border border-[#2A243E]"
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
        language={language}
      >
        {({ className: highlightClass, style, tokens, getLineProps, getTokenProps }) => (
          <pre
            className={`${highlightClass} m-0 overflow-x-auto p-0 selection:bg-[#3D3558] modal-overscroll-contain ${maxHeight ? maxHeight : ''}`}
            style={{ ...style, backgroundColor: '#0B0C10' }}
          >
            <code className="block min-w-full py-3">
              <div className="w-max min-w-full">
                {tokens.map((lineTokens, lineIndex) => {
                  const meta = linesMeta[lineIndex] || { diffKind: 'neutral' };
                  const lineProps = getLineProps({ line: lineTokens, key: lineIndex });

                  let rowBgStyle = 'hover:bg-white/[0.03] transition-colors duration-75';
                  let indicatorChar = ' ';
                  let indicatorStyle = 'text-transparent';

                  if (isDiff) {
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
                  }

                  return (
                    <div
                      key={lineIndex}
                      {...lineProps}
                      className={`flex items-baseline w-full px-2 py-0.5 ${rowBgStyle}`}
                    >
                      {showLineNumbers && (
                        <span className="w-8 flex-shrink-0 select-none pr-3 text-right font-mono text-[11px] text-[#7E7796] tabular-nums">
                          {lineIndex + 1}
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
    prev.maxHeight === next.maxHeight
  );
});

export default CodeViewer;

