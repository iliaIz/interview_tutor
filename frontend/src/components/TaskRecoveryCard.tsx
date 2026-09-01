import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  RotateCcw,
  BookOpen,
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Server
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface TaskRecoveryCardProps {
  reason?: string;
  userMessage?: string;
  retryAfterSeconds?: number;
  availableBankCount?: number;
  technicalDetails?: string;
  onRetry: () => void;
  onSwitchToBank: () => void;
  isRetrying?: boolean;
}

export const TaskRecoveryCard: React.FC<TaskRecoveryCardProps> = ({
  reason = 'proxy_unreachable',
  userMessage = 'ИИ-модель перегружена или шлюз временно обновляет соединение. Мы автоматически восстанавливаем связь.',
  retryAfterSeconds = 5,
  availableBankCount = 70,
  technicalDetails,
  onRetry,
  onSwitchToBank,
  isRetrying = false,
}) => {
  const [countdown, setCountdown] = useState<number>(retryAfterSeconds);
  const [isAutoRetryPaused, setIsAutoRetryPaused] = useState<boolean>(false);
  const [isHealthOpen, setIsHealthOpen] = useState<boolean>(false);
  const [healthStatus, setHealthStatus] = useState<any>(null);
  const [isCheckingHealth, setIsCheckingHealth] = useState<boolean>(false);

  // Countdown timer for automatic retry
  useEffect(() => {
    if (isAutoRetryPaused || isRetrying) return;

    if (countdown <= 0) {
      onRetry();
      setCountdown(retryAfterSeconds);
      return;
    }

    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [countdown, isAutoRetryPaused, isRetrying, onRetry, retryAfterSeconds]);

  // Handler for /api/health check
  const handleCheckHealth = async () => {
    setIsCheckingHealth(true);
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      setHealthStatus(data);
    } catch (err: any) {
      setHealthStatus({ status: 'unreachable', error: err.message });
    } finally {
      setIsCheckingHealth(false);
      setIsHealthOpen(true);
    }
  };

  const getReasonBadge = () => {
    switch (reason) {
      case 'rate_limit_exceeded':
        return { text: '⚡ Лимит запросов (Rate Limit 429)', color: 'bg-amber-100 text-amber-950 border-amber-300' };
      case 'proxy_unreachable':
        return { text: '🔌 Шлюз LiteLLM перезапускается', color: 'bg-purple-100 text-purple-950 border-purple-300' };
      case 'upstream_timeout':
        return { text: '🕒 Сетевой таймаут модели', color: 'bg-rose-100 text-rose-950 border-rose-300' };
      default:
        return { text: '🔄 Временная недоступность ИИ', color: 'bg-pink-100 text-pink-950 border-pink-300' };
    }
  };

  const badge = getReasonBadge();

  return (
    <div className="w-full rounded-3xl border border-pink-200/90 bg-gradient-to-br from-[#FFF5F8] via-[#FAF5FF] to-white p-5 md:p-7 shadow-sm space-y-5 text-[#2D1B4E] font-sans">
      {/* Header with Reason Badge */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-100/90 border border-amber-300 flex items-center justify-center text-amber-700 shadow-2xs">
            <AlertTriangle className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 className="text-base md:text-lg font-bold text-[#4A1E6D] leading-tight">
              ИИ-генерация временно недоступна
            </h3>
            <p className="text-xs text-[#7E699B] font-medium">
              Автоматическое переподключение и альтернативные пути решения
            </p>
          </div>
        </div>

        <span className={`px-3 py-1 rounded-xl text-xs font-bold border shadow-2xs ${badge.color}`}>
          {badge.text}
        </span>
      </div>

      {/* Human-friendly message banner */}
      <div className="p-4 rounded-2xl bg-white/90 border border-pink-200/80 shadow-2xs space-y-2">
        <p className="text-xs md:text-sm text-[#3B2556] leading-relaxed font-normal">
          {userMessage}
        </p>

        {technicalDetails && (
          <p className="text-[11px] font-mono text-[#7E699B] bg-purple-50/60 p-2 rounded-lg border border-purple-100 overflow-x-auto">
            Диагностика: {technicalDetails}
          </p>
        )}
      </div>

      {/* Live Auto-Retry Countdown Progress Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-bold text-[#4A1E6D]">
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-pink-600 animate-spin" />
            <span>
              {isRetrying
                ? 'Отправка повторного запроса к ИИ-шлюзу...'
                : isAutoRetryPaused
                ? 'Авто-повтор на паузе'
                : `Автоматическая повторная попытка через ${countdown} сек...`}
            </span>
          </span>

          <button
            onClick={() => setIsAutoRetryPaused(!isAutoRetryPaused)}
            className="text-[11px] font-semibold text-pink-600 hover:underline cursor-pointer"
          >
            {isAutoRetryPaused ? 'Возобновить авто-повтор' : 'Поставить на паузу'}
          </button>
        </div>

        <div className="w-full h-2 rounded-full bg-pink-100 overflow-hidden shadow-inner">
          <motion.div
            className="h-full bg-gradient-to-r from-pink-500 via-purple-500 to-[#4A1E6D] rounded-full"
            initial={{ width: '100%' }}
            animate={{ width: isRetrying ? '100%' : `${(countdown / retryAfterSeconds) * 100}%` }}
            transition={{ duration: 1, ease: 'linear' }}
          />
        </div>
      </div>

      {/* 3 Action Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
        {/* Action 1: Retry Now */}
        <button
          onClick={onRetry}
          disabled={isRetrying}
          className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-[#4A1E6D] to-[#3B1754] text-white font-bold text-xs md:text-sm flex items-center justify-center gap-2 shadow-xs hover:opacity-95 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
        >
          <RotateCcw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
          <span>{isRetrying ? 'Повтор...' : 'Повторить сейчас'}</span>
        </button>

        {/* Action 2: Switch to 70 Verified Bank Katas */}
        <button
          onClick={onSwitchToBank}
          className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50 to-white hover:from-emerald-100 hover:to-teal-50 text-emerald-950 border border-emerald-300 font-bold text-xs md:text-sm flex items-center justify-center gap-2 shadow-2xs active:scale-[0.98] transition-all cursor-pointer"
        >
          <BookOpen className="w-4 h-4 text-emerald-700 shrink-0" />
          <span>Банк {availableBankCount} задач</span>
        </button>

        {/* Action 3: Check /api/health */}
        <button
          onClick={handleCheckHealth}
          disabled={isCheckingHealth}
          className="w-full py-3 px-4 rounded-2xl bg-white hover:bg-pink-50/80 text-[#4A1E6D] border border-pink-200/80 font-bold text-xs md:text-sm flex items-center justify-center gap-2 shadow-2xs active:scale-[0.98] transition-all cursor-pointer"
        >
          <Activity className={`w-4 h-4 text-purple-600 ${isCheckingHealth ? 'animate-spin' : ''}`} />
          <span>Диагностика шлюза</span>
        </button>
      </div>

      {/* Collapsible Health Diagnostic Drawer */}
      <AnimatePresence>
        {isHealthOpen && healthStatus && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="p-4 rounded-2xl bg-white border border-purple-200 shadow-2xs space-y-3 text-xs overflow-hidden"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-[#4A1E6D]">
                <Server className="w-3.5 h-3.5 text-purple-700" />
                <span>Отчёт о состоянии LiteLLM Gateway (/api/health)</span>
              </div>
              <button
                onClick={() => setIsHealthOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-xs font-semibold cursor-pointer"
              >
                Закрыть
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              <div className="p-2.5 rounded-xl bg-purple-50/70 border border-purple-100">
                <span className="text-[10px] text-[#7E699B] font-bold block">Статус:</span>
                <span className="font-bold text-[#4A1E6D]">{healthStatus.status || 'Checking...'}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-purple-50/70 border border-purple-100">
                <span className="text-[10px] text-[#7E699B] font-bold block">ИИ готов:</span>
                <span className="font-bold flex items-center gap-1">
                  {healthStatus.isAiReady ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <XCircle className="w-3.5 h-3.5 text-rose-600" />}
                  <span>{healthStatus.isAiReady ? 'Да' : 'Нет'}</span>
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-purple-50/70 border border-purple-100">
                <span className="text-[10px] text-[#7E699B] font-bold block">Задержка:</span>
                <span className="font-bold text-[#4A1E6D]">{healthStatus.latencyMs ? `${healthStatus.latencyMs}мс` : 'N/A'}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-purple-50/70 border border-purple-100">
                <span className="text-[10px] text-[#7E699B] font-bold block">Модели:</span>
                <span className="font-bold text-[#4A1E6D]">{healthStatus.modelsRegistered ? 'Все 4 активны' : 'Проверка'}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TaskRecoveryCard;
