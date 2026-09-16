import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw, Home, Trash2, ChevronDown, ChevronUp } from 'lucide-react';

export interface StudioErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackDescription?: string;
  onReset?: () => void;
}

interface StudioErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

/**
 * SOTA 2026 Resilient Studio Error Boundary
 * Catches unhandled React render errors, eliminates White Screens of Death (WSOD),
 * and presents actionable recovery controls adhering to Soft Luxury Pastel aesthetics.
 */
export class StudioErrorBoundary extends Component<StudioErrorBoundaryProps, StudioErrorBoundaryState> {
  constructor(props: StudioErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false
    };
  }

  static getDerivedStateFromError(error: Error): Partial<StudioErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('🛡️ [StudioErrorBoundary] Caught unhandled render exception:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleRetry = () => {
    if (this.props.onReset) {
      try {
        this.props.onReset();
      } catch (err) {
        console.error('Error during error boundary reset handler:', err);
      }
    }
    this.setState({ hasError: false, error: null, errorInfo: null, showDetails: false });
  };

  handlePurgeCacheAndReload = () => {
    try {
      localStorage.removeItem('interview-prep-storage-v2');
      sessionStorage.clear();
    } catch (err) {
      console.warn('Unable to clean local storage:', err);
    }
    window.location.reload();
  };

  handleGoHome = () => {
    try {
      window.location.href = '/';
    } catch {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      const {
        fallbackTitle = 'Интерфейс временно восстанавливает состояние',
        fallbackDescription = 'Произошла непредвиденная ошибка в компоненте. Ваши сохраненные данные и прогресс защищены.'
      } = this.props;

      return (
        <div className="min-h-[360px] w-full flex items-center justify-center p-4 sm:p-8 animate-fade-in font-sans">
          <div className="max-w-md w-full bg-white/95 backdrop-blur-md rounded-3xl border border-pastel-border/80 shadow-sm p-6 sm:p-7 text-center relative overflow-hidden">
            {/* Ambient Aura Background */}
            <div className="absolute top-0 right-0 w-48 h-48 bg-pastel-accentRose/15 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-pastel-accentViolet/15 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 space-y-4">
              {/* Icon */}
              <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-50 border border-rose-200/80 flex items-center justify-center text-rose-500 shadow-2xs">
                <AlertTriangle className="w-7 h-7" />
              </div>

              {/* Headings */}
              <div className="space-y-1.5">
                <h3 className="text-base sm:text-lg font-bold text-pastel-text tracking-tight">
                  {fallbackTitle}
                </h3>
                <p className="text-xs sm:text-sm text-pastel-muted leading-relaxed">
                  {fallbackDescription}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2.5">
                <button
                  type="button"
                  onClick={this.handleRetry}
                  className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet text-white text-xs font-bold shadow-2xs hover:opacity-95 transition cursor-pointer active:scale-95"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Повторить</span>
                </button>

                <button
                  type="button"
                  onClick={this.handleGoHome}
                  className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-pastel-bg hover:bg-white border border-pastel-border text-pastel-text text-xs font-semibold shadow-2xs transition cursor-pointer active:scale-95"
                >
                  <Home className="w-4 h-4 text-pastel-muted" />
                  <span>На главную</span>
                </button>
              </div>

              {/* Cache purge & Technical diagnostics */}
              <div className="pt-3 border-t border-pastel-border/60 flex flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={this.handlePurgeCacheAndReload}
                  className="text-[11px] text-pastel-muted hover:text-rose-600 transition flex items-center gap-1.5 cursor-pointer"
                  title="Очистить временные данные воркспейса в браузере и перезапустить страницу"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Сбросить локальный кэш сессии</span>
                </button>

                {this.state.error && (
                  <div className="w-full text-left pt-1">
                    <button
                      type="button"
                      onClick={() => this.setState((prev) => ({ showDetails: !prev.showDetails }))}
                      className="text-[10px] font-mono text-pastel-muted hover:text-pastel-text transition flex items-center justify-between w-full p-1.5 rounded-lg bg-pastel-bg/50 border border-pastel-border/50"
                    >
                      <span className="truncate max-w-[280px]">
                        {this.state.error.message || 'Технические детали ошибки'}
                      </span>
                      {this.state.showDetails ? (
                        <ChevronUp className="w-3 h-3 shrink-0 ml-1" />
                      ) : (
                        <ChevronDown className="w-3 h-3 shrink-0 ml-1" />
                      )}
                    </button>

                    {this.state.showDetails && (
                      <div className="mt-2 p-3 rounded-xl bg-slate-900 text-slate-300 font-mono text-[10px] overflow-x-auto max-h-40 leading-relaxed border border-slate-800">
                        <p className="font-bold text-rose-400 mb-1">
                          {this.state.error.name}: {this.state.error.message}
                        </p>
                        {this.state.error.stack && (
                          <pre className="whitespace-pre-wrap text-[9px] text-slate-400">
                            {this.state.error.stack}
                          </pre>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
