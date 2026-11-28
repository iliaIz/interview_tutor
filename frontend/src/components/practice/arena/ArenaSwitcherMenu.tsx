import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Layers } from 'lucide-react';
import { StudioTab, useAppStore } from '../../../store/useAppStore';

export const ARENA_SWITCH_TARGETS: Array<{ id: StudioTab; label: string }> = [
  { id: 'academy', label: 'Академия' },
  { id: 'theory', label: 'База знаний' },
  { id: 'companies', label: 'Компании' },
  { id: 'system_design', label: 'System Design' },
  { id: 'practice', label: 'Практика (Каталог)' },
  { id: 'incidents', label: 'Баг-Хант' },
  { id: 'triage', label: 'Триаж Аварий' },
  { id: 'hr_screening', label: 'HR-Скрининг' }
];

interface ArenaSwitcherMenuProps {
  onBeforeNavigate?: (target: StudioTab) => boolean | void;
}

export const ArenaSwitcherMenu: React.FC<ArenaSwitcherMenuProps> = ({ onBeforeNavigate }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const setStudioTab = useAppStore((s) => s.setStudioTab);
  const currentStudioTab = useAppStore((s) => s.currentStudioTab);

  useEffect(() => {
    if (!isOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    window.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen]);

  return (
    <div className="relative hidden sm:block shrink-0" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className="flex items-center gap-1 px-2 py-1 rounded-xl text-xs font-semibold text-pastel-muted hover:text-pastel-text hover:bg-pastel-bg border border-pastel-border/80 transition cursor-pointer"
        title="Переключить студию или арену"
      >
        <Layers className="w-3.5 h-3.5 text-pastel-accentViolet" />
        <span>Арены</span>
        <ChevronDown className="w-3 h-3" />
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute left-0 top-full mt-1.5 w-52 bg-white border border-pastel-border rounded-2xl shadow-xl p-1.5 z-50"
        >
          {ARENA_SWITCH_TARGETS.map((target) => (
            <button
              key={target.id}
              type="button"
              role="menuitem"
              onClick={() => {
                const handled = onBeforeNavigate ? onBeforeNavigate(target.id) : false;
                if (!handled) {
                  setStudioTab(target.id);
                }
                setIsOpen(false);
              }}
              className={`w-full text-left px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                currentStudioTab === target.id
                  ? 'bg-pastel-rose text-pastel-accentRoseText font-bold'
                  : 'text-pastel-text hover:bg-pastel-bg'
              }`}
            >
              {target.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
