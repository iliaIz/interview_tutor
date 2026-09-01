import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Sparkles, Shield, KeyRound, ArrowRight, Loader2, Lock, CheckCircle2 } from 'lucide-react';

export const AuthGateModal: React.FC = () => {
  const { loginWithInviteCode } = useAppStore();
  const [inviteCode, setInviteCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isShaking, setIsShaking] = useState(false);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inviteCode.trim() || isLoading) return;

    setIsLoading(true);
    setErrorMessage(null);

    const result = await loginWithInviteCode(inviteCode.trim());
    if (!result.success) {
      setErrorMessage(result.error || 'Неверный или неактивный инвайт-код доступа');
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 600);
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-2xl overflow-hidden font-sans">
      {/* Ambient Luxury Auras */}
      <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full bg-gradient-to-br from-pastel-accentRose/20 to-transparent blur-3xl pointer-events-none animate-aura-slow" />
      <div className="absolute -bottom-32 -right-32 w-[500px] h-[500px] rounded-full bg-gradient-to-tl from-pastel-accentViolet/20 via-pink-400/10 to-transparent blur-3xl pointer-events-none animate-aura-reverse" />

      {/* Main Glass Card */}
      <div 
        className={`relative w-full max-w-md bg-slate-900/90 border border-slate-800/80 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl transition-transform duration-300 ${
          isShaking ? 'animate-shake' : ''
        }`}
      >
        {/* Decorative Top Accent Line */}
        <div className="absolute top-0 left-8 right-8 h-1 bg-gradient-to-r from-pastel-accentRose via-pink-400 to-pastel-accentViolet rounded-full opacity-80" />

        {/* Brand Icon Header */}
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-pastel-accentRose via-pink-400 to-pastel-accentViolet flex items-center justify-center text-white font-bold shadow-lg shadow-pastel-accentRose/25 ring-4 ring-slate-800/50">
            <Shield className="w-7 h-7" />
          </div>

          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-pastel-rose/10 text-pastel-accentRose border border-pastel-accentRose/20 mb-2">
              <Lock className="w-3 h-3" />
              <span>Закрытый доступ SOTA 2026</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-100 tracking-tight">
              InterviewPrep AI Studio
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">
              Лаборатория подготовки к Senior/Staff собеседованиям по Java, Spring & System Design
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
              <span>Инвайт-код доступа:</span>
              <span className="text-[10px] font-mono text-slate-500">Master / VIP</span>
            </label>

            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                autoFocus
                placeholder="ВВЕДИТЕ-ИНВАЙТ-КОД"
                value={inviteCode}
                onChange={(e) => {
                  setInviteCode(e.target.value.toUpperCase());
                  if (errorMessage) setErrorMessage(null);
                }}
                disabled={isLoading}
                className="w-full bg-slate-950 border border-slate-800 focus:border-pastel-accentRose/60 rounded-2xl pl-10 pr-4 py-3 text-sm font-mono tracking-widest text-slate-100 placeholder-slate-600 uppercase focus:outline-none transition shadow-inner disabled:opacity-50"
              />
            </div>

            {errorMessage && (
              <p className="text-xs text-rose-400 font-medium mt-1.5 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                <span>{errorMessage}</span>
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={!inviteCode.trim() || isLoading}
            className="w-full py-3 px-4 rounded-2xl text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-pastel-accentRose via-pink-500 to-pastel-accentViolet hover:opacity-95 active:scale-[0.99] transition shadow-lg shadow-pastel-accentRose/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Проверка доступа...</span>
              </>
            ) : (
              <>
                <span>Войти в Студию</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Footer info */}
        <div className="mt-6 pt-4 border-t border-slate-800/80 text-center text-[11px] text-slate-500 font-mono flex items-center justify-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-pastel-accentRose" />
          <span>Персональные инвайты & Безопасные 30-дневные сессии</span>
        </div>
      </div>
    </div>
  );
};
