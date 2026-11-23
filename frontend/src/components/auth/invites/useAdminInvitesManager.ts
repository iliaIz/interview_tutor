import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { InviteItem } from './adminInvitesUtils';

export const useAdminInvitesManager = (isOpen: boolean) => {
  const { showToast } = useAppStore();
  const { currentUser } = useAuthStore();

  const [invites, setInvites] = useState<InviteItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [role, setRole] = useState<'user' | 'owner'>('user');
  const [maxUses, setMaxUses] = useState<number>(0);
  const [customCode, setCustomCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Newly Created Code Display
  const [newlyCreatedCode, setNewlyCreatedCode] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  const fetchInvites = useCallback(async () => {
    if (!currentUser || currentUser.role !== 'owner') return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/invites', {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setInvites(data);
      }
    } catch (e) {
      console.error('Failed to load invites:', e);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (isOpen) {
      fetchInvites();
      setNewlyCreatedCode(null);
      setError(null);
    }
  }, [isOpen, fetchInvites]);

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Укажите имя кандидата или название инвайта');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: name.trim(),
          role,
          maxUses,
          code: customCode.trim() || undefined
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setNewlyCreatedCode(data.invite.plainCode);
        setName('');
        setCustomCode('');
        fetchInvites();
        showToast({
          type: 'success',
          title: 'Инвайт создан',
          message: `Код ${data.invite.plainCode} успешно сгенерирован`
        });
      } else {
        setError(data.message || data.error || 'Ошибка при создании инвайта');
      }
    } catch (err) {
      setError('Сетевая ошибка при генерации инвайта');
    } finally {
      setIsCreating(false);
    }
  };

  const handleRevokeInvite = async (id: string, label: string) => {
    if (!confirm(`Удалить инвайт «${label}» из базы данных? Доступ по этому коду будет немедленно прекращен.`)) return;

    try {
      const res = await fetch(`/api/auth/invites/${id}/revoke`, {
        method: 'POST',
        credentials: 'include'
      });
      if (res.ok) {
        fetchInvites();
        showToast({
          type: 'info',
          title: 'Инвайт удалён',
          message: `Инвайт для «${label}» полностью удалён из базы данных`
        });
      }
    } catch (e) {
      console.error('Failed to revoke:', e);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
    showToast({
      type: 'success',
      title: 'Скопировано',
      message: 'Инвайт-код скопирован в буфер обмена'
    });
  };

  return {
    invites,
    isLoading,
    isCreating,
    error,
    newlyCreatedCode,
    isCopied,
    name,
    setName,
    role,
    setRole,
    maxUses,
    setMaxUses,
    customCode,
    setCustomCode,
    fetchInvites,
    handleCreateInvite,
    handleRevokeInvite,
    copyToClipboard
  };
};
