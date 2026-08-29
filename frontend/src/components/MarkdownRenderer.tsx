import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CodeViewer } from './CodeViewer';

export interface MarkdownRendererProps {
  content: string;
  className?: string;
  compact?: boolean;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  className = '',
  compact = false,
}) => {
  if (!content) return null;

  return (
    <div className={`markdown-content leading-relaxed ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ inline, className: codeClass, children, ...props }: any) {
            const match = /language-(\w+)/.exec(codeClass || '');
            const language = match ? match[1] : 'java';
            const rawCode = String(children).replace(/\n$/, '');

            if (!inline) {
              const isDiff = language === 'diff' || language === 'patch';
              return (
                <div className="my-2.5">
                  <CodeViewer
                    code={rawCode}
                    language={isDiff ? 'java' : language}
                    isDiff={isDiff}
                    showLineNumbers={!compact}
                  />
                </div>
              );
            }

            return (
              <code
                className="px-1.5 py-0.5 mx-0.5 rounded-md bg-pastel-lavender/50 text-pastel-accentViolet font-mono text-[0.88em] font-semibold border border-pastel-accentViolet/25 shadow-2xs"
                {...props}
              >
                {children}
              </code>
            );
          },
          p({ children }) {
            return <p className={`my-1.5 ${compact ? 'text-xs' : 'text-sm'}`}>{children}</p>;
          },
          ul({ children }) {
            return (
              <ul className={`list-disc list-inside space-y-1 my-1.5 ${compact ? 'text-xs' : 'text-sm'}`}>
                {children}
              </ul>
            );
          },
          ol({ children }) {
            return (
              <ol className={`list-decimal list-inside space-y-1 my-1.5 ${compact ? 'text-xs' : 'text-sm'}`}>
                {children}
              </ol>
            );
          },
          li({ children }) {
            return <li className="leading-relaxed">{children}</li>;
          },
          h1({ children }) {
            return <h1 className="text-base font-bold text-pastel-text mt-3 mb-1.5">{children}</h1>;
          },
          h2({ children }) {
            return <h2 className="text-sm font-bold text-pastel-text mt-2.5 mb-1">{children}</h2>;
          },
          h3({ children }) {
            return <h3 className="text-xs font-bold text-pastel-accentViolet mt-2 mb-1">{children}</h3>;
          },
          blockquote({ children }) {
            return (
              <blockquote className="border-l-3 border-pastel-accentRose pl-3 my-2 text-pastel-muted italic text-xs bg-pastel-rose/20 py-1 rounded-r-xl">
                {children}
              </blockquote>
            );
          },
          table({ children }) {
            return (
              <div className="overflow-x-auto my-2 rounded-xl border border-pastel-border shadow-2xs">
                <table className="min-w-full text-xs text-left divide-y divide-pastel-border">
                  {children}
                </table>
              </div>
            );
          },
          th({ children }) {
            return <th className="px-3 py-2 bg-pastel-card font-bold text-pastel-text">{children}</th>;
          },
          td({ children }) {
            return <td className="px-3 py-1.5 border-t border-pastel-border/60">{children}</td>;
          },
          strong({ children }) {
            return <strong className="font-bold text-pastel-text">{children}</strong>;
          },
          a({ href, children }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-pastel-accentViolet underline hover:text-pastel-accentRose transition"
              >
                {children}
              </a>
            );
          }
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;
