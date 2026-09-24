import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useAuthStore } from '../../store/useAuthStore';
import { KeyRound, User, Edit2, LogOut } from 'lucide-react';

/**
 * UserProfileMenu component for StudioHeader (SOTA Late 2026).
 * Cognitive bounding limit: <= 350 lines.
 */
export const UserProfileMenu: React.FC = () => {
  const { systemHealth } = useAppStore();
  const { currentUser, logout, openProfileModal, openAdminInvitesModal } = useAuthStore();

  if (!currentUser) return null;

  const shortSha = (import.meta.env.VITE_GIT_COMMIT_SHA as string)?.slice(0, 7) || systemHealth?.commitSha || 'dev';

  return (
    <div className="flex items-center gap-1 pl-1 sm:pl-2 border-l border-pastel-border/80">
      {currentUser.role === 'owner' && (
        <button
          onClick={openAdminInvitesModal}
          title="Генератор инвайт-кодов (Владелец)"
          className="flex items-center gap-1 text-xs font-bold p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100/80 text-amber-800 border border-amber-200/80 shadow-2xs transition cursor-pointer"
        >
          <KeyRound className="w-3.5 h-3.5 text-amber-600" />
          <span className="hidden xl:inline text-[11px]">Инвайты</span>
        </button>
      )}

      <button
        onClick={openProfileModal}
        title={
          currentUser.role === 'owner'
            ? `Профиль: ${currentUser.name} (Владелец) • Сборка: ${shortSha}`
            : `Настройки профиля: ${currentUser.name} (${currentUser.role})`
        }
        className="flex items-center gap-1 sm:gap-1.5 text-xs font-bold p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-pastel-card hover:bg-pastel-rose/50 text-pastel-text border border-pastel-border hover:border-pastel-accentRose/50 shadow-2xs transition cursor-pointer group shrink-0"
      >
        <User className="w-3.5 h-3.5 text-pastel-accentRose" />
        <span className="max-w-[90px] truncate hidden sm:inline text-[11px]">{currentUser.name}</span>
        <Edit2 className="w-3 h-3 text-pastel-muted group-hover:text-pastel-accentRose transition hidden sm:inline" />
      </button>

      <button
        onClick={() => {
          localStorage.removeItem('interview_prep_user_cached');
          void logout();
        }}
        title="Выйти из студии"
        className="p-1.5 rounded-xl text-pastel-muted hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer shrink-0"
      >
        <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
      </button>
    </div>
  );
};
