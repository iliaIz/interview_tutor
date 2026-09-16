import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, MessageSquare, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
  onFallbackToText?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class PracticeVoiceErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('PracticeVoiceErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 rounded-2xl bg-gradient-to-b from-[#FFF0F5] via-white to-pastel-lavender/20 border border-pastel-accentRose/30 shadow-xs flex flex-col items-center text-center gap-3 animate-in fade-in duration-200">
          <div className="w-10 h-10 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-500 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-slate-800">
              Голосовой режим временно недоступен
            </h4>
            <p className="text-[11px] text-slate-500 max-w-xs leading-relaxed">
              {this.state.error?.message?.includes('PracticeVoiceProvider')
                ? 'Инициализация аудиоконтекста. Вы можете продолжить общение в текстовом режиме.'
                : 'Произошла ошибка при подключении к аудиоустройству или серверу Gemini Live.'}
            </p>
          </div>
          <div className="flex items-center gap-2 pt-1">
            {this.props.onFallbackToText && (
              <button
                type="button"
                onClick={this.props.onFallbackToText}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-pastel-accentRose text-white text-xs font-bold shadow-2xs hover:opacity-90 transition cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Текстовый чат</span>
              </button>
            )}
            <button
              type="button"
              onClick={this.handleReset}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              <span>Повторить</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
