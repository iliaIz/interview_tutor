import React, { useEffect, useRef, useState, useId } from 'react';
import { Loader2, AlertCircle, Sparkles, Layers } from 'lucide-react';

interface MermaidPreviewProps {
  code: string;
  className?: string;
}

let mermaidInstance: any = null;

export const MermaidPreview: React.FC<MermaidPreviewProps> = ({ code, className = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgContent, setSvgContent] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const uniqueId = useId().replace(/[:]/g, '_');

  useEffect(() => {
    let isMounted = true;
    let timerId: any = null;

    const renderDiagram = async () => {
      if (!code.trim()) {
        if (isMounted) {
          setSvgContent('');
          setErrorMsg(null);
          setIsLoading(false);
        }
        return;
      }

      setIsLoading(true);

      try {
        // Dynamic import of mermaid to preserve initial light bundle size
        if (!mermaidInstance) {
          const mermaidModule = await import('mermaid');
          mermaidInstance = mermaidModule.default;
          mermaidInstance.initialize({
            startOnLoad: false,
            securityLevel: 'loose',
            theme: 'base',
            themeVariables: {
              darkMode: false,
              fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif',
              fontSize: '13px',
              primaryColor: '#F5EEF8',
              primaryBorderColor: '#D7BDE2',
              primaryTextColor: '#2D1B4E',
              lineColor: '#9B59B6',
              secondaryColor: '#E8F8F5',
              secondaryBorderColor: '#A3E4D7',
              secondaryTextColor: '#165B4C',
              tertiaryColor: '#FEF9E7',
              tertiaryBorderColor: '#F9E79F',
              tertiaryTextColor: '#7D6608',
              clusterBkg: '#FAF8F5',
              clusterBorder: '#E8E2D9',
              nodeBorder: '#D7BDE2'
            }
          });
        }

        const renderId = `mermaid_svg_${uniqueId}_${Date.now()}`;
        const { svg } = await mermaidInstance.render(renderId, code);

        if (isMounted) {
          setSvgContent(svg);
          setErrorMsg(null);
          setIsLoading(false);
        }
      } catch (err: any) {
        if (isMounted) {
          // Graceful error handling for incomplete syntax while typing
          const msg = err?.message || 'Синтаксическая ошибка в диаграмме';
          setErrorMsg(msg.length > 80 ? 'Синтаксис схемы: проверьте имена узлов или стрелки (например: A -->|gRPC| B)' : msg);
          setIsLoading(false);
        }
      }
    };

    // Debounce rendering by 250ms for buttery smooth typing
    timerId = setTimeout(() => {
      void renderDiagram();
    }, 250);

    return () => {
      isMounted = false;
      if (timerId) clearTimeout(timerId);
    };
  }, [code, uniqueId]);

  return (
    <div className={`flex flex-col h-full bg-white/95 border border-pastel-border/80 rounded-2xl shadow-2xs overflow-hidden relative ${className}`}>
      {/* Header Bar */}
      <div className="px-4 py-2.5 bg-gradient-to-r from-pastel-bg/60 via-white to-pastel-rose/20 border-b border-pastel-border/60 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-pastel-accentViolet animate-pulse" />
          <span className="text-xs font-bold text-pastel-text font-mono flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-pastel-accentViolet" />
            <span>Живой Архитектурный Холст (Mermaid Live SVG)</span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isLoading && (
            <span className="text-[10px] text-pastel-muted flex items-center gap-1 font-mono">
              <Loader2 className="w-3 h-3 animate-spin text-pastel-accentRose" />
              <span>Отрисовка...</span>
            </span>
          )}
          {errorMsg && (
            <span className="text-[10px] text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md font-mono flex items-center gap-1 max-w-[260px] truncate" title={errorMsg}>
              <AlertCircle className="w-3 h-3 shrink-0" />
              <span className="truncate">{errorMsg}</span>
            </span>
          )}
          {!isLoading && !errorMsg && svgContent && (
            <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md font-mono flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-emerald-600" />
              <span>Схема валидна</span>
            </span>
          )}
        </div>
      </div>

      {/* Canvas SVG Area */}
      <div
        ref={containerRef}
        className="flex-1 p-4 overflow-auto flex items-center justify-center bg-gradient-to-br from-[#FCFBF9] to-white relative"
      >
        {svgContent ? (
          <div
            className="w-full h-full flex items-center justify-center select-none [&>svg]:max-w-full [&>svg]:max-h-full [&>svg]:h-auto transition-all duration-300"
            dangerouslySetInnerHTML={{ __html: svgContent }}
          />
        ) : (
          <div className="text-center text-pastel-muted p-8 space-y-2">
            <Layers className="w-8 h-8 mx-auto text-pastel-border" />
            <p className="text-xs font-mono">Введите граф Mermaid (слева) для отображения топологии</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MermaidPreview;
