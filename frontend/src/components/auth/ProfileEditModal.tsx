import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { User, X, Check, Edit3, Shield, Loader2 } from 'lucide-react';

interface ProfileEditModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProfileEditModal: React.FC<ProfileEditModalProps> = ({ isOpen, onClose }) => {
  const { currentUser, updateUserName } = useAppStore();
  const [name, setName] = useState(currentUser?.name || '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser) {
      setName(currentUser.name);
    }
  }, [currentUser, isOpen]);

  if (!isOpen || !currentUser) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isSaving) return;

    setIsSaving(true);
    setError(null);

    const res = await updateUserName(name.trim());
    setIsSaving(false);
    if (res.success) {
      onClose();
    } else {
      setError(res.error || 'Не удалось сохранить имя');
    }
  };

  const getRoleBadge = (role: string) => {
    if (role === 'owner') return { title: '👑 Владелец Платформы (Owner)', color: 'bg-amber-500/10 text-amber-400 border-amber-500/30' };
    if (role === 'mentor') return { title: '💡 Ментор / Интервьюер', color: 'bg-pastel-accentViolet/10 text-pastel-accentViolet border-pastel-accentViolet/30' };
    return { title: '🛡️ Кандидат (Candidate)', color: 'bg-blue-500/10 text-blue-400 border-blue-500/30' };
  };

  const roleInfo = getRoleBadge(currentUser.role);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md font-sans">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-pastel-accentRose via-pink-400 to-pastel-accentViolet flex items-center justify-center text-white font-bold shadow-sm shadow-pastel-accentRose/20">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Профиль пользователя</h2>
              <span className="text-[10px] text-slate-400 font-mono">ID: {currentUser.id}</span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Role Badge */}
        <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-950 border border-slate-800/80">
          <span className="text-xs text-slate-400 font-medium">Роль доступа:</span>
          <span className={`px-2.5 py-1 rounded-xl text-xs font-bold font-mono border ${roleInfo.color}`}>
            {roleInfo.title}
          </span>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
              <span>Отображаемое имя / Никнейм:</span>
              <span className="text-[10px] text-slate-500 font-mono">Видно ИИ-интервьюеру</span>
            </label>

            <div className="relative">
              <Edit3 className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
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
                className="w-full bg-slate-950 border border-slate-800 focus:border-pastel-accentRose/60 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none transition shadow-inner font-sans"
              />
            </div>

            {error && (
              <p className="text-xs text-rose-400 font-medium mt-1 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                <span>{error}</span>
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer"
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
