/**
 * HintTiersDropdown.tsx
 * Progressive hint tiers dropdown — domain-aware, self-contained open/close state.
 * Single Responsibility: render hint tier menu per domain and emit selected tier index.
 */

import React, { useState } from 'react';
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
    { label: 'Уровень 4: Изоморфный пример', sub: 'Архитектурный шаблон решения' },
  ],
  concurrency: [
    { label: 'Уровень 0: JMM & Happens-Before', sub: 'Модель памяти Java и видимость' },
    { label: 'Уровень 1: Loom & Carrier Pinning', sub: 'Virtual threads и пиннинг потоков' },
    { label: 'Уровень 2: CAS & AtomicXxx', sub: 'Неблокирующие атомарные операции' },
    { label: 'Уровень 3: StampedLock & ReadWrite', sub: 'Оптимистичные и пессимистичные блокировки' },
    { label: 'Уровень 4: Архитектура без блокировок', sub: 'Lock-free паттерны и алгоритмы' },
  ],
  refactoring: [
    { label: 'Уровень 0: Швы Фезерса', sub: 'Точки изоляции для зависимостей' },
    { label: 'Уровень 1: Characterization-тест', sub: 'Фиксация текущего поведения' },
    { label: 'Уровень 2: Выделение метода/класса', sub: 'Extract Method и Extract Class' },
    { label: 'Уровень 3: Замена условий полиморфизмом', sub: 'Паттерн Strategy вместо if/else' },
    { label: 'Уровень 4: Контрольный прогон', sub: 'Сравнение старого и нового кода' },
  ],
  java21: [
    { label: 'Уровень 0: Records & Деструктуризация', sub: 'Синтаксис record и компоненты' },
    { label: 'Уровень 1: Sealed & Permits', sub: 'Запечатанные иерархии классов' },
    { label: 'Уровень 2: Pattern Matching switch', sub: 'switch с instanceof-паттернами' },
    { label: 'Уровень 3: Guarded Patterns', sub: 'Условия when в pattern matching' },
    { label: 'Уровень 4: Изоморфный рефактор', sub: 'Полный рефактор на Java 21' },
  ],
  transactions: [
    { label: 'Уровень 0: Уровни изоляции', sub: 'READ_COMMITTED, REPEATABLE_READ и SERIALIZABLE' },
    { label: 'Уровень 1: Распространение @Transactional', sub: 'REQUIRED, REQUIRES_NEW, NESTED' },
    { label: 'Уровень 2: Self-Invocation прокси', sub: 'Почему @Transactional не работает внутри класса' },
    { label: 'Уровень 3: Пессимистические блокировки', sub: 'FOR UPDATE и SELECT FOR SHARE' },
    { label: 'Уровень 4: Outbox Pattern', sub: 'Транзакционный Outbox и dual-write' },
  ],
  testing: [
    { label: 'Уровень 0: Синтаксис', sub: 'Импорты, типы и компиляция' },
    { label: 'Уровень 1: Достижимость', sub: 'Какую ветку кода нужно вызвать' },
    { label: 'Уровень 2: Заражение (Infection)', sub: 'Какое состояние портит мутант' },
    { label: 'Уровень 3: Контрпример', sub: 'Граничный входной параметр' },
    { label: 'Уровень 4: Изоморфный пример', sub: 'Паттерн теста из другой сферы' },
  ],
};

const DROPDOWN_LABELS: Record<TutorDomain, string> = {
  lld: 'Подсказка (LLD)',
  concurrency: 'Подсказка (Concurrency)',
  refactoring: 'Подсказка (Refactoring)',
  java21: 'Подсказка (Java 21)',
  transactions: 'Подсказка (ACID)',
  testing: 'Подсказка (RIPR)',
};

interface Props {
  domain: TutorDomain;
  onSelectTier: (tier: number) => void;
}

export const HintTiersDropdown: React.FC<Props> = ({ domain, onSelectTier }) => {
  const [open, setOpen] = useState(false);
  const tiers = HINT_TIERS[domain];

  const handleSelect = (index: number) => {
    setOpen(false);
    onSelectTier(index);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 text-[11px] font-bold transition shrink-0 cursor-pointer"
      >
        <Lightbulb className="w-3 h-3 text-amber-600" />
        <span>{DROPDOWN_LABELS[domain]}</span>
        <ChevronDown className="w-3 h-3 opacity-60" />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 w-60 bg-white rounded-xl shadow-xl border border-slate-200 p-1 z-50 flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-150">
          {tiers.map((tier, i) => (
            <button
              key={i}
              onClick={() => handleSelect(i)}
              className="text-left px-2.5 py-1.5 rounded-lg text-xs hover:bg-slate-50 transition cursor-pointer"
            >
              <div className="font-bold text-slate-800">{tier.label}</div>
              <div className="text-[10px] text-slate-400">{tier.sub}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
