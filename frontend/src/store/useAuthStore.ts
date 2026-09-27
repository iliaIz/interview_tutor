import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User {
  id: string;
  name: string;
  role: 'owner' | 'candidate' | 'user';
  created_at?: string;
}

export interface AuthState {
  currentUser: User | null;
  isAuthChecking: boolean;
  isProfileModalOpen: boolean;
  isAdminInvitesModalOpen: boolean;

  openProfileModal: () => void;
  closeProfileModal: () => void;
  openAdminInvitesModal: () => void;
  closeAdminInvitesModal: () => void;

  loginWithInviteCode: (inviteCode: string) => Promise<{ success: boolean; error?: string; user?: User }>;
  updateUserName: (newName: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  checkAuthSession: () => Promise<void>;
}

/**
 * Dedicated Auth Store with Zero-Flicker Session Persistence (SOTA Late 2026).
 * Persists currentUser in localStorage to prevent unauthenticated flashes on page reload.
 * Cognitive bounding limit: <= 350 lines.
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      currentUser: null,
      isAuthChecking: true,
      isProfileModalOpen: false,
      isAdminInvitesModalOpen: false,

      openProfileModal: () => set({ isProfileModalOpen: true }),
      closeProfileModal: () => set({ isProfileModalOpen: false }),
      openAdminInvitesModal: () => set({ isAdminInvitesModalOpen: true }),
      closeAdminInvitesModal: () => set({ isAdminInvitesModalOpen: false }),

      loginWithInviteCode: async (inviteCode: string) => {
        try {
          const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ inviteCode: inviteCode.trim().toUpperCase() })
          });
          const data = await res.json();
          if (res.ok && data.success) {
            set({ currentUser: data.user, isAuthChecking: false });
            return { success: true, user: data.user };
          } else {
            return { success: false, error: data.message || data.error || 'Неверный инвайт-код' };
          }
        } catch {
          return { success: false, error: 'Сетевая ошибка при проверке инвайт-кода' };
        }
      },

      updateUserName: async (newName: string) => {
        try {
          const res = await fetch('/api/auth/profile', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ name: newName.trim() })
          });
          const data = await res.json();
          if (res.ok && data.success) {
            set({ currentUser: data.user });
            return { success: true };
          } else {
            return { success: false, error: data.message || data.error || 'Ошибка обновления имени' };
          }
        } catch {
          return { success: false, error: 'Сетевая ошибка при обновлении профиля' };
        }
      },

      logout: async () => {
        try {
          await fetch('/api/auth/logout', {
            method: 'POST',
            credentials: 'include'
          });
        } catch {}
        set({ currentUser: null, isAuthChecking: false });
      },

      checkAuthSession: async () => {
        // If we already have a cached user, we don't block the UI with a full-page spinner
        const hasCachedUser = Boolean(get().currentUser);
        if (!hasCachedUser) {
          set({ isAuthChecking: true });
        }

        try {
          const res = await fetch('/api/auth/me', {
            credentials: 'include'
          });
          if (res.ok) {
            const data = await res.json();
            set({ currentUser: data.user, isAuthChecking: false });
          } else {
            set({ currentUser: null, isAuthChecking: false });
          }
        } catch {
          // In case of transient network error, preserve cached user so candidate is not kicked out
          set({ isAuthChecking: false });
        }
      }
    }),
    {
      name: 'interview-prep-auth-v1',
      partialize: (state) => ({
        currentUser: state.currentUser
      })
    }
  )
);
