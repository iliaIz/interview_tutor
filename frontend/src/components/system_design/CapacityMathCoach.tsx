import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Calculator } from 'lucide-react';
import { PRESET_SCENARIOS } from './math/MathCoachPresets';
import { MathCoachCard } from './math/MathCoachCard';
import { MathCoachAiChat } from './math/MathCoachAiChat';
import { calculateCapacity, validateCandidateCapacity } from '../../utils/capacityMath';

interface CapacityMathCoachProps {
  onApplyCalculations?: (summary: string) => void;
  onCalculationChange?: (calcText: string) => void;
}

export const CapacityMathCoach: React.FC<CapacityMathCoachProps> = ({
  onApplyCalculations,
  onCalculationChange
}) => {
  const [activeScenarioId, setActiveScenarioId] = useState<string>(PRESET_SCENARIOS[0].id);
  const scenario = useMemo(() => {
    return PRESET_SCENARIOS.find((s) => s.id === activeScenarioId) || PRESET_SCENARIOS[0];
  }, [activeScenarioId]);

  // User input guesses for drill
  const [userPeakQps, setUserPeakQps] = useState<string>('');
  const [userStorageTb, setUserStorageTb] = useState<string>('');
  const [userHotRamGb, setUserHotRamGb] = useState<string>('');
  const [isEvaluated, setIsEvaluated] = useState(false);

  // AI Tutor & Voice Modal State
  const [isTutorOpen, setIsTutorOpen] = useState(true);
  const [isVoiceTutorOpen, setIsVoiceTutorOpen] = useState(false);
  const [voiceSessionId, setVoiceSessionId] = useState<string | null>(null);

  // Exact calculations based on centralized capacityMath utility
  const mathResults = useMemo(() => {
    return calculateCapacity({
      dau: scenario.dau,
      writesPerUser: scenario.writesPerUser,
      readsPerUser: scenario.readsPerUser,
      avgWriteBytes: scenario.avgWriteBytes,
      avgReadBytes: scenario.avgReadBytes,
      retentionYears: scenario.retentionYears,
      peakFactor: 3.0,
      replicationFactor: 0.2
    });
  }, [scenario]);

  // Validation evaluation (+-25% tolerance window)
  const validation = useMemo(() => {
    if (!isEvaluated) return null;
    return validateCandidateCapacity(
      { peakQps: userPeakQps, storageTb: userStorageTb, hotRamGb: userHotRamGb },
      mathResults
    );
  }, [isEvaluated, userPeakQps, userStorageTb, userHotRamGb, mathResults]);

  // Live Grounding of candidate inputs into active voice session
  const calcTimerRef = useRef<any>(null);
  useEffect(() => {
    if (!onCalculationChange) return;
    if (calcTimerRef.current) clearTimeout(calcTimerRef.current);

    calcTimerRef.current = setTimeout(() => {
      if (userPeakQps || userStorageTb || userHotRamGb) {
        const text = `📊 [ОБНОВЛЕНИЕ РАСЧЕТОВ КАНДИДАТА В CAPACITY MATH COACH]:
Сценарий: «${scenario.title}»
- Введенный Пиковый QPS: ${userPeakQps || 'не задан'}
- Введенное Хранилище: ${userStorageTb ? `${userStorageTb} TB` : 'не задано'}
- Введенный Кэш RAM: ${userHotRamGb ? `${userHotRamGb} GB` : 'не задан'}`;
        onCalculationChange(text);
      }
    }, 800);

    return () => {
      if (calcTimerRef.current) clearTimeout(calcTimerRef.current);
    };
  }, [userPeakQps, userStorageTb, userHotRamGb, scenario.title, onCalculationChange]);

  const handleReset = () => {
    setUserPeakQps('');
    setUserStorageTb('');
    setUserHotRamGb('');
    setIsEvaluated(false);
  };

  const mathVoicePrompt = useMemo(() => {
    return `=== КОНТЕКСТ СЕССИИ: ГОЛОСОВОЙ ТЬЮТОР CAPACITY MATH COACH (L1) ===
Ты — дружелюбный голосовой AI-тьютор по расчетам емкости и нагрузки на салфетке (Back-of-the-Envelope Estimation).
СЦЕНАРИЙ: «${scenario.title}»
Описание: ${scenario.description}

ВХОДНЫЕ ПАРАМЕТРЫ СИСТЕМЫ:
- DAU: ${scenario.dau.toLocaleString()}
- Записей на пользователя: ${scenario.writesPerUser}, Чтений: ${scenario.readsPerUser}
- Размер записи: ${scenario.avgWriteBytes}B, чтения: ${scenario.avgReadBytes}B, Retention: ${scenario.retentionYears} лет

ЭТАЛОННЫЕ РАСЧЕТЫ:
- Пиковый QPS: ~${mathResults.peakTotalQps.toLocaleString()} QPS (Запись: ${mathResults.peakWriteQps}, Чтение: ${mathResults.peakReadQps})
- Хранилище на ${scenario.retentionYears} лет: ~${mathResults.totalStorageTb.toFixed(1)} TB (суточный прирост: ${mathResults.dailyStorageGb.toFixed(1)} GB)
- Горячий кэш RAM (80/20): ~${mathResults.hotRamGb.toFixed(1)} GB
- Сетевая полоса: ~${mathResults.networkGbps.toFixed(2)} Gbps

ЧТО ВВЕЛ КАНДИДАТ:
- Пиковый QPS: ${userPeakQps || 'пока не ввел'}
- Хранилище: ${userStorageTb ? `${userStorageTb} TB` : 'пока не ввел'}
- Кэш RAM: ${userHotRamGb ? `${userHotRamGb} GB` : 'пока не ввел'}

ДИРЕКТИВА: Поздоровайся теплым голосом, спроси с какого расчета кандидат хочет начать. НЕ ставь оценок найма!`;
  }, [scenario, mathResults, userPeakQps, userStorageTb, userHotRamGb]);

  return (
    <div
      data-selection-zone="math"
      className="p-4 sm:p-6 bg-white/95 rounded-3xl border border-pastel-border/80 shadow-sm space-y-6 font-sans"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white shadow-sm shadow-violet-200">
          <Calculator className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
            Math Coach: Прикидки на салфетке (Back-of-the-Envelope)
          </h3>
          <p className="text-xs text-slate-500">
            Отработка математических расчетов QPS, дисков, RAM и сети за 60 секунд перед началом дизайна
          </p>
        </div>
      </div>

      <MathCoachCard
        scenario={scenario}
        activeScenarioId={activeScenarioId}
        onSelectScenario={(id) => {
          setActiveScenarioId(id);
          handleReset();
        }}
        userPeakQps={userPeakQps}
        setUserPeakQps={setUserPeakQps}
        userStorageTb={userStorageTb}
        setUserStorageTb={setUserStorageTb}
        userHotRamGb={userHotRamGb}
        setUserHotRamGb={setUserHotRamGb}
        isEvaluated={isEvaluated}
        onEvaluate={() => setIsEvaluated(true)}
        onReset={handleReset}
        mathResults={mathResults}
        validation={validation}
        onApplyCalculations={onApplyCalculations}
        isTutorOpen={isTutorOpen}
        onToggleTutor={() => setIsTutorOpen(!isTutorOpen)}
        onStartVoiceTutor={() => {
          setVoiceSessionId(`voice_math_${scenario.id}_${Date.now()}`);
          setIsVoiceTutorOpen(true);
        }}
      />

      {isTutorOpen && (
        <MathCoachAiChat
          scenario={scenario}
          mathResults={mathResults}
          userPeakQps={userPeakQps}
          userStorageTb={userStorageTb}
          userHotRamGb={userHotRamGb}
          isVoiceTutorOpen={isVoiceTutorOpen}
          setIsVoiceTutorOpen={setIsVoiceTutorOpen}
          voiceSessionId={voiceSessionId}
          setVoiceSessionId={setVoiceSessionId}
          mathVoicePrompt={mathVoicePrompt}
        />
      )}
    </div>
  );
};
