/**
 * TutorQuickActionChips.tsx
 * Domain-specific quick action chips bar for the PracticeTutorDrawer.
 * Single Responsibility: render compass trigger + 2 domain quick-send chips.
 */

import React from 'react';
import { Sparkles, Clock, Compass, Bug } from 'lucide-react';
import type { TutorDomain } from './TutorDomain';

interface ChipDef {
  label: string;
  message: string;
  icon: React.ReactNode;
}

const CHIPS: Record<TutorDomain, ChipDef[]> = {
  testing: [
    {
      label: 'Мутанты',
      message: 'Объясни, почему выжили мутанты в моем тесте и как их поймать?',
      icon: <Sparkles className="w-3 h-3 text-slate-500" />,
    },
    {
      label: 'RIPR',
      message: 'Какой паттерн теста использовать по модели RIPR?',
      icon: <Sparkles className="w-3 h-3 text-slate-500" />,
    },
  ],
  lld: [
    {
      label: 'Virtual Clock',
      message:
        'Как правильно применить инжекцию java.time.Clock в текущий класс для детерминированного 0мс тестирования?',
      icon: <Clock className="w-3 h-3 text-indigo-500" />,
    },
    {
      label: 'Concurrency',
      message: 'Как обеспечить потокобезопасность и защититься от дедлоков в этом сценарии?',
      icon: <Sparkles className="w-3 h-3 text-purple-500" />,
    },
  ],
  transactions: [
    {
      label: 'Propagation',
      message: 'Объясни механику распространения транзакций (@Transactional propagation) в этом сценарии.',
      icon: <Sparkles className="w-3 h-3 text-violet-500" />,
    },
    {
      label: 'Self-Invocation',
      message: 'Где здесь может произойти Self-Invocation и как это исправить?',
      icon: <Sparkles className="w-3 h-3 text-violet-500" />,
    },
  ],
  concurrency: [
    {
      label: 'Loom Pinning',
      message: 'Есть ли здесь риск пиннинга carrier-потока Loom из-за synchronized?',
      icon: <Sparkles className="w-3 h-3 text-orange-500" />,
    },
    {
      label: 'CAS / StampedLock',
      message: 'Как здесь применить StampedLock или CAS вместо synchronized?',
      icon: <Sparkles className="w-3 h-3 text-orange-500" />,
    },
  ],
  refactoring: [
    {
      label: 'Seam (Фезерс)',
      message: 'Где здесь можно создать шов (Seam) по Фезерсу для изоляции зависимости?',
      icon: <Sparkles className="w-3 h-3 text-green-600" />,
    },
    {
      label: 'Char. Test',
      message: 'Как написать Characterization-тест для фиксации текущего поведения?',
      icon: <Sparkles className="w-3 h-3 text-green-600" />,
    },
  ],
  java21: [
    {
      label: 'Pattern Match',
      message: 'Покажи как переписать этот if-instanceof на Pattern Matching switch.',
      icon: <Sparkles className="w-3 h-3 text-sky-500" />,
    },
    {
      label: 'Sealed',
      message: 'Как правильно объявить sealed иерархию для этого домена?',
      icon: <Sparkles className="w-3 h-3 text-sky-500" />,
    },
  ],
};

const BUG_HUNT_CHIPS: ChipDef[] = [
  {
    label: 'В чем подвох?',
    message: 'В чем заключается скрытый дефект или подвох в этом коде? Намекни без прямого спойлера решения.',
    icon: <Bug className="w-3 h-3 text-rose-500" />
  },
  {
    label: 'Намек на дефект',
    message: 'На какой метод или строчку в коде стоит обратить самое пристальное внимание?',
    icon: <Sparkles className="w-3 h-3 text-amber-500" />
  },
  {
    label: 'Тест бага',
    message: 'Как лучше всего написать воспроизводящий юнит-тест на этот баг?',
    icon: <Sparkles className="w-3 h-3 text-sky-500" />
  },
  {
    label: 'Покажи на доске',
    message: 'Покажи на интерактивной доске (через функцию update_whiteboard) архитектурную схему или исправленный фрагмент кода с пояснением.',
    icon: <Sparkles className="w-3 h-3 text-purple-500" />
  }
];

interface Props {
  domain: TutorDomain;
  isBugHunt?: boolean;
  onSendMessage: (text: string) => void;
  onOpenCompass: () => void;
}

export const TutorQuickActionChips: React.FC<Props> = ({ domain, isBugHunt, onSendMessage, onOpenCompass }) => {
  const chips = isBugHunt ? BUG_HUNT_CHIPS : CHIPS[domain];

  return (
    <>
      {/* Compass trigger — only when not in Bug Hunt */}
      {!isBugHunt && (
        <button
          onClick={onOpenCompass}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-pastel-rose text-pastel-accentRoseText hover:bg-pastel-accentRose hover:text-white border border-pastel-accentRose/30 text-[11px] font-bold transition shrink-0 cursor-pointer"
        >
          <Compass className="w-3 h-3" />
          <span>Компас (Ctrl+/)</span>
        </button>
      )}

      {/* Domain-specific chips */}
      {chips.map((chip) => (
        <button
          key={chip.label}
          onClick={() => onSendMessage(chip.message)}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition shrink-0 cursor-pointer"
        >
          {chip.icon}
          <span>{chip.label}</span>
        </button>
      ))}
    </>
  );
};
