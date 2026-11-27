/**
 * HintTiersDropdown.tsx
 * Progressive hint tiers dropdown — domain-aware, top-layer popover="auto"
 * so all 5 tiers render unclipped outside overflow-x-auto containers.
 */

import React, { useState, useRef, useEffect, useId } from 'react';
import { Lightbulb, ChevronDown } from 'lucide-react';
import type { TutorDomain } from './TutorDomain';

interface HintTier {
  label: string;
  sub: string;
}

const HINT_TIERS: Record<TutorDomain, HintTier[]> = {
  lld: [
    { label: 'Уровень 0: Контракты & Синтаксис', sub: 'Сигнатуры методов, Records и типы' },
    { label: 'Уровень 1: Архитектурные границы', sub: 'Паттерн Стратегия, SOLID & SRP' },
    { label: 'Уровень 2: Потокобезопасность', sub: 'Защита от race conditions и блокировки' },
    { label: 'Уровень 3: Инжекция Clock', sub: 'Детерминизм времени за 0 мс' },
    { label: 'Уровень 4: Изоморфный пример', sub: 'Архитектурный шаблон решения' }
  ],
  concurrency: [
    { label: 'Уровень 0: JMM & Happens-Before', sub: 'Модель памяти Java и видимость' },
    { label: 'Уровень 1: Loom & Carrier Pinning', sub: 'Virtual threads и пиннинг потоков' },
    { label: 'Уровень 2: CAS & AtomicXxx', sub: 'Неблокирующие атомарные операции' },
    { label: 'Уровень 3: StampedLock & ReadWrite', sub: 'Оптимистичные и пессимистичные блокировки' },
    { label: 'Уровень 4: Архитектура без блокировок', sub: 'Lock-free паттерны и алгоритмы' }
  ],
  refactoring: [
    { label: 'Уровень 0: Швы Фезерса', sub: 'Точки изоляции для зависимостей' },
    { label: 'Уровень 1: Characterization-тест', sub: 'Фиксация текущего поведения' },
    { label: 'Уровень 2: Выделение метода/класса', sub: 'Extract Method и Extract Class' },
    { label: 'Уровень 3: Замена условий полиморфизмом', sub: 'Паттерн Strategy вместо if/else' },
    { label: 'Уровень 4: Контрольный прогон', sub: 'Сравнение старого и нового кода' }
  ],
  java21: [
    { label: 'Уровень 0: Records & Деструктуризация', sub: 'Синтаксис record и компоненты' },
    { label: 'Уровень 1: Sealed & Permits', sub: 'Запечатанные иерархии классов' },
    { label: 'Уровень 2: Pattern Matching switch', sub: 'switch с instanceof-паттернами' },
    { label: 'Уровень 3: Guarded Patterns', sub: 'Условия when в pattern matching' },
    { label: 'Уровень 4: Изоморфный рефактор', sub: 'Полный рефактор на Java 21' }
  ],
  transactions: [
    { label: 'Уровень 0: Уровни изоляции', sub: 'READ_COMMITTED, REPEATABLE_READ и SERIALIZABLE' },
    { label: 'Уровень 1: Распространение @Transactional', sub: 'REQUIRED, REQUIRES_NEW, NESTED' },
    { label: 'Уровень 2: Self-Invocation прокси', sub: 'Почему @Transactional не работает внутри класса' },
    { label: 'Уровень 3: Пессимистические блокировки', sub: 'FOR UPDATE и SELECT FOR SHARE' },
    { label: 'Уровень 4: Outbox Pattern', sub: 'Транзакционный Outbox и dual-write' }
  ],
  testing: [
    { label: 'Уровень 0: Синтаксис', sub: 'Импорты, типы и компиляция' },
    { label: 'Уровень 1: Достижимость', sub: 'Какую ветку кода нужно вызвать' },
    { label: 'Уровень 2: Заражение (Infection)', sub: 'Какое состояние портит мутант' },
    { label: 'Уровень 3: Контрпример', sub: 'Граничный входной параметр' },
    { label: 'Уровень 4: Изоморфный пример', sub: 'Паттерн теста из другой сферы' }
  ]
};

const DROPDOWN_LABELS: Record<TutorDomain, string> = {
  lld: 'Подсказка (LLD)',
  concurrency: 'Подсказка (Concurrency)',
  refactoring: 'Подсказка (Refactoring)',
  java21: 'Подсказка (Java 21)',
  transactions: 'Подсказка (ACID)',
  testing: 'Подсказка (RIPR)'
};

interface Props {
  domain: TutorDomain;
  onSelectTier: (tier: number) => void;
}

export const HintTiersDropdown: React.FC<Props> = ({ domain, onSelectTier }) => {
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const popoverId = useId();
  const tiers = HINT_TIERS[domain];

  const syncPosition = () => {
    const btn = triggerRef.current;
    if (!btn || typeof window === 'undefined') return;
    const rect = btn.getBoundingClientRect();
    const width = 264;
    const clampedLeft = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    const maxTop = Math.max(8, window.innerHeight - 280);
    const top = Math.min(rect.bottom + 6, maxTop);
    setCoords({ top, left: clampedLeft });
  };

  useEffect(() => {
    const pop = popoverRef.current;
    if (!pop) return;
    const handleToggle = (e: Event) => {
      const nextOpen = (e as unknown as { newState?: string }).newState === 'open';
      setIsOpen(nextOpen);
      if (nextOpen) syncPosition();
    };
    pop.addEventListener('toggle', handleToggle);
    return () => pop.removeEventListener('toggle', handleToggle);
  }, []);

  const handleToggleClick = () => {
    syncPosition();
    const pop = popoverRef.current as (HTMLDivElement & { togglePopover?: () => void }) | null;
    if (pop && typeof pop.togglePopover === 'function') {
      pop.togglePopover();
    } else {
      setIsOpen((o) => !o);
    }
  };

  const handleSelect = (index: number) => {
    const pop = popoverRef.current as (HTMLDivElement & { hidePopover?: () => void }) | null;
    if (pop && typeof pop.hidePopover === 'function') {
      pop.hidePopover();
    }
    setIsOpen(false);
    onSelectTier(index);
  };

  return (
    <div className="shrink-0">
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggleClick}
        aria-expanded={isOpen}
        aria-controls={popoverId}
        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-300 text-[11px] font-bold transition shrink-0 cursor-pointer"
      >
        <Lightbulb className="w-3 h-3 text-amber-700" />
        <span>{DROPDOWN_LABELS[domain]}</span>
        <ChevronDown className="w-3 h-3 opacity-70" />
      </button>

      <div
        ref={popoverRef}
        id={popoverId}
        popover="auto"
        style={{
          position: 'fixed',
          top: `${coords.top}px`,
          left: `${coords.left}px`,
          margin: 0,
          insetBlockEnd: 'auto',
          insetInlineEnd: 'auto'
        }}
        className={`w-[264px] bg-white rounded-2xl shadow-2xl border border-pastel-border p-1.5 z-50 flex-col gap-0.5 ${
          isOpen ? 'flex' : 'hidden open:flex'
        }`}
      >
        {tiers.map((tier, i) => (
          <button
            key={i}
            type="button"
            onClick={() => handleSelect(i)}
            className="text-left px-2.5 py-2 rounded-xl text-xs hover:bg-pastel-bg transition cursor-pointer"
          >
            <div className="font-bold text-pastel-text">{tier.label}</div>
            <div className="text-[10px] text-pastel-muted">{tier.sub}</div>
          </button>
        ))}
      </div>
    </div>
  );
};
