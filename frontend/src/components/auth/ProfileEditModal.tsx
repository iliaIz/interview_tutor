import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { User, X, Check, Edit3, Shield, Loader2, KeyRound, Sparkles, GitCommit, ExternalLink } from 'lucide-react';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';

export const ProfileEditModal: React.FC = () => {
  const { isProfileModalOpen, closeProfileModal, currentUser, updateUserName, openAdminInvitesModal, systemHealth } = useAppStore();
  useBodyScrollLock(isProfileModalOpen);

  const [name, setName] = useState(currentUser?.name || '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser) {
      setName(currentUser.name);
    }
  }, [currentUser, isProfileModalOpen]);

  if (!isProfileModalOpen || !currentUser) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isSaving) return;

    setIsSaving(true);
    setError(null);

    const res = await updateUserName(name.trim());
    setIsSaving(false);
    if (res.success) {
      closeProfileModal();
    } else {
      setError(res.error || 'Не удалось сохранить имя');
    }
  };

  const getRoleBadge = (role: string) => {
    if (role === 'owner') return { title: '👑 Владелец (Owner)', color: 'bg-amber-50 text-amber-700 border-amber-200' };
    return { title: '🛡️ Пользователь (User)', color: 'bg-blue-50 text-blue-700 border-blue-200' };
  };


  const roleInfo = getRoleBadge(currentUser.role);

  const clientCommitSha = (import.meta.env.VITE_GIT_COMMIT_SHA as string) || '';
  const shortClientSha = clientCommitSha ? clientCommitSha.slice(0, 7) : 'dev';
  const backendCommitSha = systemHealth?.commitSha || 'unknown';
  const isSynced = !clientCommitSha || backendCommitSha === 'dev' || backendCommitSha === 'unknown' || shortClientSha === backendCommitSha;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-4 bg-slate-900/40 backdrop-blur-md overflow-y-auto modal-overscroll-contain font-sans">
      <div className="relative w-full max-w-md bg-white/95 border border-pastel-rose/80 rounded-3xl p-6 shadow-2xl space-y-5 my-auto animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
        
        {/* Soft Ambient Mesh Auras */}
        <div className="absolute -top-16 -right-16 w-36 h-36 rounded-full bg-gradient-to-br from-pastel-accentRose/20 to-transparent blur-2xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-36 h-36 rounded-full bg-gradient-to-tr from-pastel-accentViolet/20 to-transparent blur-2xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-pastel-accentRose via-pink-400 to-pastel-accentViolet flex items-center justify-center text-white font-bold shadow-sm shadow-pastel-accentRose/20">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-pastel-text">Профиль пользователя</h2>
              <span className="text-[10px] text-pastel-muted font-mono">ID: {currentUser.id}</span>
            </div>
          </div>

          <button
            onClick={closeProfileModal}
            className="p-1.5 rounded-xl text-pastel-muted hover:text-pastel-text hover:bg-pastel-rose/40 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Role & Privileges Badge */}
        <div className="flex items-center justify-between p-3.5 rounded-2xl bg-pastel-bg/80 border border-pastel-border/80 relative z-10">
          <span className="text-xs text-pastel-muted font-medium">Роль доступа:</span>
          <span className={`px-2.5 py-1 rounded-xl text-xs font-bold font-mono border shadow-2xs ${roleInfo.color}`}>
            {roleInfo.title}
          </span>
        </div>

        {/* Owner Quick Action: Manage Invites */}
        {currentUser.role === 'owner' && (
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-50/70 via-pastel-rose/40 to-purple-50/70 border border-amber-200/60 relative z-10 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-amber-600" />
              <div className="text-[11px] font-bold text-slate-800">Инвайт-коды</div>
            </div>
            <button
              onClick={() => {
                closeProfileModal();
                openAdminInvitesModal();
              }}
              className="px-3 py-1.5 rounded-xl text-xs font-bold text-amber-900 bg-amber-200/70 hover:bg-amber-300/80 transition cursor-pointer shadow-2xs"
            >
              Управление инвайтами →
            </button>
          </div>
        )}

        {/* SOTA 2026 Owner Build Revision & Cloud Sync */}
        {currentUser.role === 'owner' && (
          <div className="p-3.5 rounded-2xl bg-pastel-bg/80 border border-pastel-border/90 relative z-10 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-pastel-muted font-medium">
                <GitCommit className="w-3.5 h-3.5 text-pastel-accentRose" />
                <span>Ревизия сборки:</span>
              </div>
              <div className="flex items-center gap-1.5">
                <a
                  href={clientCommitSha ? `https://github.com/iliaIz/interview_tutor/commit/${clientCommitSha}` : 'https://github.com/iliaIz/interview_tutor'}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Открыть коммит на GitHub"
                  className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white border border-pastel-border text-slate-800 font-mono text-[11px] font-bold hover:bg-pastel-rose/30 hover:border-pastel-accentRose/50 transition cursor-pointer group shadow-2xs"
                >
                  <span>{shortClientSha}</span>
                  <ExternalLink className="w-3 h-3 text-pastel-muted group-hover:text-pastel-accentRose" />
                </a>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-pastel-border/60">
              <span className="text-pastel-muted">Серверный API:</span>
              <span className="flex items-center gap-1.5 font-mono">
                {isSynced ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-emerald-700 font-medium">Синхронизирован ({backendCommitSha})</span>
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    <span className="text-amber-700 font-medium" title="Кэш браузера отличается от сервера. Нажмите Ctrl+F5">
                      Кэш: {shortClientSha} ≠ Сервер: {backendCommitSha}
                    </span>
                  </>
                )}
              </span>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSave} className="space-y-4 relative z-10">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-pastel-text flex items-center justify-between">
              <span>Отображаемое имя / Никнейм:</span>
              <span className="text-[10px] text-pastel-muted font-normal">Видно ИИ-интервьюеру</span>
            </label>

            <div className="relative">
              <Edit3 className="w-4 h-4 text-pastel-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                autoFocus
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (error) setError(null);
                }}
                maxLength={60}
                placeholder="Ваше имя (например, Илья, Senior Java)..."
                className="w-full bg-pastel-bg border border-pastel-border focus:border-pastel-accentRose rounded-2xl pl-10 pr-4 py-2.5 text-xs text-pastel-text placeholder-pastel-muted/60 focus:outline-none transition shadow-2xs font-sans"
              />
            </div>

            {error && (
              <p className="text-xs text-rose-600 font-medium mt-1 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                <span>{error}</span>
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={closeProfileModal}
              className="px-4 py-2 rounded-xl text-xs font-bold text-pastel-muted hover:text-pastel-text hover:bg-pastel-rose/40 transition cursor-pointer"
            >
              Отмена
            </button>

            <button
              type="submit"
              disabled={!name.trim() || isSaving || name.trim() === currentUser.name}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-pastel-accentRose via-pink-500 to-pastel-accentViolet hover:opacity-95 transition shadow-sm shadow-pastel-accentRose/20 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Сохранение...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Сохранить имя</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
