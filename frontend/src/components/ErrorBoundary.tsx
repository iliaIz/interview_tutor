import React from 'react';
import { ShieldAlert, RotateCcw, BookOpen, ChevronDown, ChevronUp } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  isDetailExpanded: boolean;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Optional fallback UI to render instead of default recovery card */
  fallback?: React.ReactNode;
}

/**
 * GlobalErrorBoundary — catches any uncaught React render error in the subtree and renders
 * a luxury pastel recovery card instead of an empty white screen.
 *
 * Architecture compliance:
 *   - Soft luxury pastel aesthetic (#FFF0F5, lavender, rose, gentle mesh glow auras)
 *   - Full-height 100dvh viewport standard (prevents mobile keyboard jump)
 *   - Zero-Phantom-Fallback: never fabricates data, shows real error detail on demand
 */
export class GlobalErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      isDetailExpanded: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    this.setState({ errorInfo });
    console.error('[GlobalErrorBoundary] Uncaught render error:', error, errorInfo);
  }

  handleReload = (): void => {
    window.location.reload();
  };

  handleReturnHome = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null, isDetailExpanded: false });
    window.history.pushState(null, '', '/');
    window.location.reload();
  };

  toggleDetail = (): void => {
    this.setState((prev) => ({ isDetailExpanded: !prev.isDetailExpanded }));
  };

  render(): React.ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.props.fallback) {
      return this.props.fallback;
    }

    const { error, errorInfo, isDetailExpanded } = this.state;
    const stackTrace = errorInfo?.componentStack || error?.stack || 'Stack trace unavailable.';
    const errorMessage = error?.message || 'Неизвестная ошибка';
    const errorName = error?.name || 'Error';

    return (
      <div
        style={{ minHeight: '100dvh' }}
        className="flex items-center justify-center p-4 bg-gradient-to-br from-[#FFF0F5] via-[#F8F0FF] to-[#FFF4F0]"
      >
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 60% 50% at 30% 40%, rgba(255,182,193,0.18) 0%, transparent 70%), ' +
              'radial-gradient(ellipse 50% 60% at 70% 60%, rgba(196,181,253,0.15) 0%, transparent 70%)',
          }}
        />

        <div className="relative z-10 w-full max-w-md">
          <div className="bg-white/90 backdrop-blur-md rounded-3xl border border-rose-200/60 shadow-xl p-6 space-y-5">
            <div className="flex justify-center">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-md"
                style={{
                  background: 'linear-gradient(135deg, #FB7185 0%, #A78BFA 100%)',
                }}
              >
                <ShieldAlert className="w-8 h-8 text-white" />
              </div>
            </div>

            <div className="text-center space-y-1.5">
              <h1 className="text-lg font-black text-slate-800">
                Ошибка интерфейса
              </h1>
              <p className="text-sm text-slate-500 leading-relaxed">
                Произошла непредвиденная ошибка при отображении этого раздела.
                Ваш прогресс сохранён в базе данных.
              </p>
            </div>

            <div className="px-4 py-2.5 rounded-2xl bg-rose-50 border border-rose-200 text-center">
              <span className="text-[11px] font-bold text-rose-700 block mb-0.5">{errorName}</span>
              <p className="text-xs text-rose-900 font-medium leading-snug break-words">
                {errorMessage}
              </p>
            </div>

            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full py-3 rounded-2xl text-sm font-bold text-white shadow-sm transition hover:opacity-90 active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
                style={{
                  background: 'linear-gradient(135deg, #FB7185 0%, #A78BFA 100%)',
                }}
              >
                <RotateCcw className="w-4 h-4" />
                Перезагрузить страницу
              </button>

              <button
                type="button"
                onClick={this.handleReturnHome}
                className="w-full py-3 rounded-2xl text-sm font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-rose-50/60 hover:border-rose-200 transition active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                <BookOpen className="w-4 h-4 text-violet-500" />
                Вернуться к темам
              </button>
            </div>

            <div className="rounded-2xl border border-slate-200 overflow-hidden">
              <button
                type="button"
                onClick={this.toggleDetail}
                className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50 hover:bg-slate-100 transition text-xs font-semibold text-slate-600 cursor-pointer"
              >
                <span>🔍 Технические детали ошибки</span>
                {isDetailExpanded ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>

              {isDetailExpanded && (
                <div className="p-3 bg-slate-950 max-h-48 overflow-auto">
                  <pre className="text-[10px] text-emerald-400 font-mono whitespace-pre-wrap break-words leading-relaxed">
                    {stackTrace}
                  </pre>
                </div>
              )}
            </div>

            <p className="text-center text-[11px] text-slate-400 leading-snug">
              Если проблема повторяется — скопируйте технические детали выше
              и обратитесь к разработчику.
            </p>
          </div>
        </div>
      </div>
    );
  }
}
