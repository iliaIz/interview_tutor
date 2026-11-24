import React from 'react';
import { HrSessionMode, HrPersonaId } from '@interview-prep/shared';
import { GraduationCap, HeartHandshake, ShieldAlert, Search, Sparkles } from 'lucide-react';

interface HrModeSelectorProps {
  mode: HrSessionMode;
  personaId: HrPersonaId;
  activeVoice: string;
  onSelectMode: (mode: HrSessionMode) => void;
  onSelectPersona: (persona: HrPersonaId) => void;
}

const MODE_OPTIONS: Array<{ id: HrSessionMode; label: string; title: string }> = [
  {
    id: 'guided_zero_start',
    label: 'С нуля (Повтор)',
    title: 'Пошаговый разбор с нуля (8–15 слов): эхо-повтор, перефраз, угасание подсказок'
  },
  {
    id: 'tutor_rehearsal',
    label: 'Репетиция',
    title: 'Живая репетиция с коучем Ольгой (остановка на ошибках и подсказки голосом)'
  },
  {
    id: 'rapid_fire_micro_drill',
    label: 'Микро-дрилл',
    title: 'Экзаменационный прогон вопроса на время (60–80 сек + скоринг)'
  },
  {
    id: 'full_screening_simulation',
    label: 'Полный скрининг',
    title: 'Полноценное 7-фазное HR-интервью с итоговым вердиктом'
  }
];

export const HrModeSelector: React.FC<HrModeSelectorProps> = ({
  mode,
  personaId,
  activeVoice,
  onSelectMode,
  onSelectPersona
}) => {
  const isCoachMode = mode === 'tutor_rehearsal' || mode === 'guided_zero_start';

  const handleModeClick = (targetMode: HrSessionMode) => {
    onSelectMode(targetMode);
    if (targetMode === 'tutor_rehearsal' || targetMode === 'guided_zero_start') {
      onSelectPersona('mentor_coach');
    } else if (personaId === 'mentor_coach') {
      onSelectPersona('friendly_sourcer');
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap justify-end">
      <div className="flex p-1 bg-white border border-slate-200 rounded-xl text-xs">
        {MODE_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            onClick={() => handleModeClick(opt.id)}
            title={opt.title}
            className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1 ${
              mode === opt.id
                ? opt.id === 'guided_zero_start'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-pastel-accentRose text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {opt.id === 'guided_zero_start' && <Sparkles className="w-3 h-3" />}
            <span>{opt.label}</span>
          </button>
        ))}
      </div>

      {isCoachMode ? (
        <div
          className="flex items-center px-2 py-1 bg-purple-50 border border-purple-200 rounded-xl text-xs text-purple-700 font-semibold gap-1.5"
          title={`Ольга — Наставник по моторике ответов (${activeVoice})`}
        >
          <GraduationCap className="w-4 h-4 text-purple-600" />
          <span>Ольга (Коуч • {activeVoice})</span>
        </div>
      ) : (
        <div className="flex p-1 bg-white border border-slate-200 rounded-xl text-xs">
          <button
            onClick={() => onSelectPersona('friendly_sourcer')}
            className={`p-1.5 rounded-lg transition cursor-pointer ${
              personaId === 'friendly_sourcer' ? 'bg-pink-100 text-pink-700' : 'text-slate-400 hover:text-slate-600'
            }`}
            title="Елена — Дружелюбный сорсер"
          >
            <HeartHandshake className="w-4 h-4" />
          </button>
          <button
            onClick={() => onSelectPersona('bank_compliance_officer')}
            className={`p-1.5 rounded-lg transition cursor-pointer ${
              personaId === 'bank_compliance_officer' ? 'bg-amber-100 text-amber-800' : 'text-slate-400 hover:text-slate-600'
            }`}
            title="Виктория — Офицер комплаенса"
          >
            <ShieldAlert className="w-4 h-4" />
          </button>
          <button
            onClick={() => onSelectPersona('behavioral_conflict_hunter')}
            className={`p-1.5 rounded-lg transition cursor-pointer ${
              personaId === 'behavioral_conflict_hunter' ? 'bg-purple-100 text-purple-700' : 'text-slate-400 hover:text-slate-600'
            }`}
            title="Дарья — Охотник за конфликтами (STAR)"
          >
            <Search className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
