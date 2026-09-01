import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { KeyRound, Plus, X, Copy, Check, Shield, User, Trash2, RefreshCw, Sparkles, AlertCircle } from 'lucide-react';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';

export interface InviteItem {
  id: string;
  label: string;
  role: 'owner' | 'user';
  isActive: boolean;
  maxUses: number;
  useCount: number;
  createdAt: string;
  lastUsedAt?: string;
  userId: string;
  userName: string;
  userLastLoginAt?: string;
}

export const AdminInvitesModal: React.FC = () => {
  const { isAdminInvitesModalOpen, closeAdminInvitesModal, currentUser, showToast } = useAppStore();
  useBodyScrollLock(isAdminInvitesModalOpen);

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

  const fetchInvites = async () => {
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
  };

  useEffect(() => {
    if (isAdminInvitesModalOpen) {
      fetchInvites();
      setNewlyCreatedCode(null);
      setError(null);
    }
  }, [isAdminInvitesModalOpen]);

  if (!isAdminInvitesModalOpen || !currentUser || currentUser.role !== 'owner') {
    return null;
  }

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-slate-900/40 backdrop-blur-md overflow-y-auto modal-overscroll-contain font-sans">
      <div className="bg-white/95 rounded-3xl max-w-2xl w-full border border-pastel-rose/80 shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh] my-auto animate-in fade-in zoom-in-95 duration-200">
        
        {/* Soft Ambient Mesh Auras */}
        <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-gradient-to-br from-pastel-accentRose/20 to-transparent blur-2xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-gradient-to-tr from-pastel-accentViolet/20 to-transparent blur-2xl pointer-events-none" />

        {/* Header */}
        <div className="p-5 md:p-6 pb-4 border-b border-pastel-border/60 flex items-center justify-between bg-gradient-to-r from-pastel-bg/60 via-white to-pastel-rose/30 relative z-10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-gradient-to-tr from-pastel-accentRose to-pastel-accentViolet text-white rounded-2xl flex items-center justify-center shadow-sm shadow-pastel-accentRose/25">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-pastel-text text-base md:text-lg">
                  Генератор инвайт-кодов
                </h3>
                <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-amber-50 text-amber-700 border border-amber-200/80">
                  👑 Владелец
                </span>
              </div>
              <p className="text-[11px] text-pastel-muted font-medium mt-0.5">
                Управление закрытым доступом и распределение ролей в Студии
              </p>
            </div>
          </div>

          <button
            onClick={closeAdminInvitesModal}
            className="w-9 h-9 rounded-full bg-pastel-bg text-pastel-muted hover:text-pastel-text flex items-center justify-center hover:bg-pastel-rose/40 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 md:p-6 overflow-y-auto space-y-6 relative z-10">
          
          {/* Newly Created Code Card */}
          {newlyCreatedCode && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50 to-pastel-rose/30 border border-emerald-200/80 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3 animate-in fade-in slide-in-from-top-3">
              <div>
                <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-700 block">
                  🎉 Инвайт-код успешно создан:
                </span>
                <span className="font-mono text-base md:text-lg font-extrabold text-slate-900 tracking-wider">
                  {newlyCreatedCode}
                </span>
              </div>

              <button
                onClick={() => copyToClipboard(newlyCreatedCode)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition shadow-sm cursor-pointer shrink-0"
              >
                {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{isCopied ? 'Скопировано!' : 'Скопировать'}</span>
              </button>
            </div>
          )}

          {/* Create Form */}
          <form onSubmit={handleCreateInvite} className="p-5 rounded-2xl bg-pastel-bg/60 border border-pastel-border/80 space-y-4">
            <h4 className="text-xs font-bold text-pastel-text flex items-center gap-2">
              <Plus className="w-4 h-4 text-pastel-accentRose" />
              <span>Создать новый инвайт-код</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-pastel-muted">Имя / Описание:</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Например: Иван Иванов (Senior)"
                  className="w-full bg-white border border-pastel-border focus:border-pastel-accentRose/80 rounded-xl px-3 py-2 text-xs text-pastel-text placeholder-pastel-muted/50 focus:outline-none transition shadow-2xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-pastel-muted">Роль пользователя:</label>
                <select
                  value={role}
                  onChange={(e: any) => setRole(e.target.value)}
                  className="w-full bg-white border border-pastel-border focus:border-pastel-accentRose/80 rounded-xl px-3 py-2 text-xs text-pastel-text focus:outline-none transition shadow-2xs"
                >
                  <option value="user">🛡️ Пользователь (Полный доступ ко всей Студии)</option>
                  <option value="owner">👑 Владелец (Администратор с управлением инвайтами)</option>
                </select>
              </div>


              <div className="space-y-1">
                <label className="text-[11px] font-bold text-pastel-muted">Лимит использований:</label>
                <select
                  value={maxUses}
                  onChange={(e) => setMaxUses(Number(e.target.value))}
                  className="w-full bg-white border border-pastel-border focus:border-pastel-accentRose/80 rounded-xl px-3 py-2 text-xs text-pastel-text focus:outline-none transition shadow-2xs"
                >
                  <option value={0}>♾️ Безлимитный (многократный вход)</option>
                  <option value={1}>1️⃣ Одноразовый (для 1 кандидата)</option>
                  <option value={5}>5️⃣ До 5 использований</option>
                  <option value={10}>🔟 До 10 использований</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-pastel-muted">Кастомный код (опционально):</label>
                <input
                  type="text"
                  value={customCode}
                  onChange={(e) => setCustomCode(e.target.value)}
                  placeholder="Оставьте пустым для авто-генерации"
                  className="w-full bg-white border border-pastel-border focus:border-pastel-accentRose/80 rounded-xl px-3 py-2 text-xs text-pastel-text font-mono uppercase placeholder-pastel-muted/50 focus:outline-none transition shadow-2xs"
                />
              </div>
            </div>

            {error && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={isCreating || !name.trim()}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-pastel-accentRose via-pink-500 to-pastel-accentViolet hover:opacity-95 transition shadow-sm shadow-pastel-accentRose/20 cursor-pointer disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isCreating ? 'Генерация...' : 'Сгенерировать инвайт'}</span>
              </button>
            </div>
          </form>

          {/* Invites List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-pastel-text flex items-center gap-2">
                <span>Список всех инвайтов ({invites.length}):</span>
              </h4>
              <button
                onClick={fetchInvites}
                disabled={isLoading}
                className="p-1 rounded-lg text-pastel-muted hover:text-pastel-text hover:bg-pastel-rose/40 transition cursor-pointer"
                title="Обновить список"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="divide-y divide-pastel-border/60 border border-pastel-border/80 rounded-2xl overflow-hidden bg-white shadow-2xs">
              {invites.length === 0 ? (
                <div className="p-6 text-center text-xs text-pastel-muted">
                  Инвайтов пока нет.
                </div>
              ) : (
                invites.map((inv) => (
                  <div key={inv.id} className="p-3.5 flex items-center justify-between gap-3 hover:bg-pastel-bg/40 transition">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-pastel-text">{inv.label}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                          inv.role === 'owner' 
                            ? 'bg-amber-50 text-amber-700 border-amber-200' 
                            : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}>
                          {inv.role === 'owner' ? '👑 Владелец' : '🛡️ Пользователь'}
                        </span>

                        {!inv.isActive && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-100 text-slate-500 border border-slate-200">
                            Отозван
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-pastel-muted font-mono">
                        Создан: {new Date(inv.createdAt).toLocaleDateString('ru-RU')} • Использовано: {inv.useCount}/{inv.maxUses === 0 ? '∞' : inv.maxUses}
                        {inv.lastUsedAt && ` • Посл. вход: ${new Date(inv.lastUsedAt).toLocaleDateString('ru-RU')}`}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {inv.id !== 'invite_master' && !inv.id.startsWith('invite_master') && (
                        <button
                          onClick={() => handleRevokeInvite(inv.id, inv.label)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 transition cursor-pointer"
                          title="Удалить инвайт из базы данных"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Удалить</span>
                        </button>
                      )}

                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
