import { StateCreator } from 'zustand';
import { AppState, AuthSlice } from '../types';

export const createAuthSlice: StateCreator<AppState, [], [], AuthSlice> = (set, get) => ({
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
        body: JSON.stringify({ inviteCode })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        set({ currentUser: data.user });
        get().showToast({
          type: 'success',
          title: 'Добро пожаловать в Студию!',
          message: `Доступ активирован: ${data.user.name}`
        });
        return { success: true };
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
        body: JSON.stringify({ name: newName })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        set({ currentUser: data.user });
        get().showToast({
          type: 'success',
          title: 'Профиль обновлен',
          message: `Ваше имя изменено на: ${data.user.name}`
        });
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
    set({ currentUser: null });
    get().showToast({
      type: 'info',
      title: 'Сессия завершена',
      message: 'Вы успешно вышли из студии'
    });
  },

  checkAuthSession: async () => {
    set({ isAuthChecking: true });
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
      set({ currentUser: null, isAuthChecking: false });
    }
  }
});
