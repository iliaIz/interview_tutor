import React, { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useAuthStore } from '../../store/useAuthStore';
import { KeyRound, User, Edit2, LogOut, Sparkles, ChevronDown } from 'lucide-react';

/**
 * UserProfileMenu component for StudioHeader (SOTA Late 2026).
 * Consolidates account settings, owner tools (VAD Lab, Invites), and logout
 * into one compact menu trigger so the primary header never starves navigation.
 */
export const UserProfileMenu: React.FC = () => {
  const { systemHealth, currentStudioTab, setStudioTab } = useAppStore();
  const { currentUser, logout, openProfileModal, openAdminInvitesModal } = useAuthStore();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isMenuOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMenuOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    window.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('keydown', handleEsc);
    };
  }, [isMenuOpen]);

  if (!currentUser) return null;

  const shortSha = (import.meta.env.VITE_GIT_COMMIT_SHA as string)?.slice(0, 7) || systemHealth?.commitSha || 'dev';

  return (
    <div className="relative pl-1 sm:pl-2 border-l border-pastel-border/80 shrink-0" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsMenuOpen((v) => !v)}
        aria-expanded={isMenuOpen}
        aria-haspopup="menu"
        aria-label={`Меню пользователя: ${currentUser.name}`}
        title={
          currentUser.role === 'owner'
            ? `${currentUser.name} (Владелец) • Сборка: ${shortSha}`
            : `Профиль: ${currentUser.name}`
        }
        className={`flex items-center gap-1.5 text-xs font-bold p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border shadow-2xs transition cursor-pointer ${
          isMenuOpen || currentStudioTab === 'live_debug'
            ? 'bg-pastel-rose text-pastel-accentRoseText border-pastel-accentRose/50'
            : 'bg-pastel-card hover:bg-pastel-rose/50 text-pastel-text border-pastel-border hover:border-pastel-accentRose/50'
        }`}
      >
        <User className="w-3.5 h-3.5 text-pastel-accentRoseText shrink-0" />
        <span className="max-w-[96px] truncate hidden md:inline text-[11px]">{currentUser.name}</span>
        <ChevronDown className={`w-3 h-3 text-pastel-muted transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} />
      </button>

      {isMenuOpen && (
        <div
          role="menu"
          aria-label="Аккаунт и инструменты"
          className="absolute right-0 top-full mt-2 w-60 bg-white border border-pastel-border rounded-2xl shadow-2xl p-1.5 z-50 space-y-1"
        >
          <div className="px-3 py-2 border-b border-pastel-border/60">
            <div className="text-xs font-bold text-pastel-text truncate">{currentUser.name}</div>
            <div className="text-[10px] text-pastel-muted font-mono">
              {currentUser.role === 'owner' ? 'Владелец' : currentUser.role} • {shortSha}
            </div>
          </div>

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setIsMenuOpen(false);
              openProfileModal();
            }}
            className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-pastel-text hover:bg-pastel-bg transition cursor-pointer"
          >
            <Edit2 className="w-3.5 h-3.5 text-pastel-accentRoseText shrink-0" />
            <span>Настройки профиля</span>
          </button>

          {currentUser.role === 'owner' && (
            <>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setIsMenuOpen(false);
                  setStudioTab('live_debug');
                }}
                className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  currentStudioTab === 'live_debug'
                    ? 'bg-violet-50 text-violet-900 font-bold'
                    : 'text-pastel-text hover:bg-pastel-bg'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-violet-600 shrink-0" />
                <span>VAD Lab (диагностика)</span>
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setIsMenuOpen(false);
                  openAdminInvitesModal();
                }}
                className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-pastel-text hover:bg-pastel-bg transition cursor-pointer"
              >
                <KeyRound className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>Инвайт-коды</span>
              </button>
            </>
          )}

          <div className="pt-1 border-t border-pastel-border/60">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setIsMenuOpen(false);
                localStorage.removeItem('interview_prep_user_cached');
                void logout();
              }}
              className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-rose-700 hover:bg-rose-50 transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              <span>Выйти из студии</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
