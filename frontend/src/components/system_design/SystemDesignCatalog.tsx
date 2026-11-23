import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { SystemDesignScenario } from '../../types/nextgen';
import { Layers, X } from 'lucide-react';
import { CapacityMathCoach } from './CapacityMathCoach';
import { VoiceModal } from '../VoiceModal';
import {
  ScenarioRung,
  LevelFilter,
  getScenarioRung,
  getLevelBadge
} from './utils/scenarioLevel';
import { useScenarioCatalogFilters } from './hooks/useScenarioCatalogFilters';
import { SystemDesignCatalogHeader } from './catalog/SystemDesignCatalogHeader';
import { SystemDesignScenarioCard } from './catalog/SystemDesignScenarioCard';
import { SystemDesignScenarioDetail } from './catalog/SystemDesignScenarioDetail';

export type { ScenarioRung, LevelFilter };
export { getScenarioRung, getLevelBadge };

export const SystemDesignCatalog: React.FC = () => {
  const { openSystemDesignById, openSystemDesignScenario } = useAppStore();
  const [scenarios, setScenarios] = useState<SystemDesignScenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMathCoachOpen, setIsMathCoachOpen] = useState(false);

  // Gemini Live Voice Brief State
  const [isVoiceBriefOpen, setIsVoiceBriefOpen] = useState(false);
  const [voiceBriefSessionId, setVoiceBriefSessionId] = useState<string | null>(null);
  const [voiceBriefScenario, setVoiceBriefScenario] = useState<SystemDesignScenario | null>(null);

  const handleLaunchScenario = useCallback(
    (scenario: SystemDesignScenario) => {
      const id = scenario.canonical_id || scenario.id;
      if (id) {
        void openSystemDesignById(id);
      } else {
        openSystemDesignScenario(scenario);
      }
    },
    [openSystemDesignById, openSystemDesignScenario]
  );

  const {
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
    selectedLevel,
    setSelectedLevel,
    selectedScenarioId,
    setSelectedScenarioId,
    categories,
    levelCounts,
    filteredScenarios,
    activeScenario,
    resetFilters
  } = useScenarioCatalogFilters(scenarios, handleLaunchScenario);

  const handleStartVoiceBrief = (scenario: SystemDesignScenario) => {
    setVoiceBriefScenario(scenario);
    setVoiceBriefSessionId(`voice_brief_${scenario.canonical_id || scenario.id}_${Date.now()}`);
    setIsVoiceBriefOpen(true);
  };

  const voiceBriefPrompt = useMemo(() => {
    if (!voiceBriefScenario) return '';
    const rps = voiceBriefScenario.studio_2_simulation?.traffic_profile?.lambda_mean_rps
      ? `${voiceBriefScenario.studio_2_simulation.traffic_profile.lambda_mean_rps.toLocaleString()} RPS`
      : voiceBriefScenario.trafficProfile?.estimatedPeakRPS || 'Высокая нагрузка';
    const p99 = voiceBriefScenario.studio_2_simulation?.slos?.p99_latency_max_ms
      ? `${voiceBriefScenario.studio_2_simulation.slos.p99_latency_max_ms} мс`
      : '50 мс';
    const sla = voiceBriefScenario.studio_2_simulation?.slos?.availability_target_nines || 99.99;

    return `=== КОНТЕКСТ СЕССИИ: ГОЛОСОВОЙ БРИФ ПО СЦЕНАРИЮ SYSTEM DESIGN ===
Ты — доброжелательный, опытный Staff-архитектор и наставник.
Кандидат находится в каталоге архитектурных задач и запросил вводный экспресс-разбор (бриф) перед проектированием.

СЦЕНАРИЙ: «${voiceBriefScenario.title}»
Подзаголовок: ${voiceBriefScenario.subtitle || ''}
Категория / Архетип: ${voiceBriefScenario.archetype || voiceBriefScenario.category || 'Distributed Systems'}
Целевой уровень: ${voiceBriefScenario.target_level || voiceBriefScenario.level || 'L5_SENIOR'}

ТРЕБОВАНИЯ И НАГРУЗКА:
- Пиковый RPS: ${rps}
- SLA доступности: ${sla}%
- Задержка p99: ≤ ${p99}
- Описание задачи: ${(voiceBriefScenario.problem_statement || voiceBriefScenario.contextMarkdown || '').slice(0, 500)}

ДИРЕКТИВЫ ДЛЯ ПЕРВОГО ОТВЕТА:
1. Поздоровайся голосом и тепло поприветствуй кандидата.
2. Кратко (за 2-3 предложения) выдели самую главную архитектурную сложность этого сценария «${voiceBriefScenario.title}» (например, консистентность при сбоях, узкие места базы данных или пиковый трафик).
3. Спроси, какую часть кандидат хочет кратко проговорить голосом перед запуском студии.
4. ИНВАРИАНТ: Никаких оценок и вердиктов найма! Режим чистого наставничества.`;
  }, [voiceBriefScenario]);

  // Load scenarios from SSOT canonical manifests
  useEffect(() => {
    fetch('/api/system-design/scenarios', { credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data)) {
          setScenarios(data);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load system design scenarios:', err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[500px] text-pastel-muted font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-pastel-accentRose border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-mono">Загрузка канонических манифестов System Design (SSOT)...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 sm:py-8 space-y-6 font-sans animate-fade-in pb-24">
      {/* 1. Header Banner */}
      <SystemDesignCatalogHeader
        totalScenarios={scenarios.length}
        selectedLevel={selectedLevel}
        onSelectLevel={setSelectedLevel}
        levelCounts={levelCounts}
        categories={categories}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onOpenMathCoach={() => setIsMathCoachOpen(true)}
      />

      {/* 2. Main Master-Detail Grid */}
      {filteredScenarios.length === 0 ? (
        <div className="bg-white/95 border border-pastel-border/80 rounded-3xl p-12 text-center shadow-xs space-y-3 animate-fade-in">
          <Layers className="w-10 h-10 text-pastel-muted mx-auto opacity-40" />
          <h3 className="text-base font-bold text-pastel-text">Сценарии не найдены</h3>
          <p className="text-xs text-pastel-muted max-w-sm mx-auto leading-relaxed">
            По запросу «<strong className="text-pastel-text">{searchQuery || selectedCategory}</strong>» ничего не найдено в каталоге архитектурных кейсов.
          </p>
          <div className="pt-2">
            <button
              onClick={resetFilters}
              className="px-4 py-2 rounded-xl bg-pastel-bg hover:bg-pastel-rose text-pastel-text hover:text-pastel-accentRoseText text-xs font-bold border border-pastel-border transition cursor-pointer"
            >
              Сбросить фильтры
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Column: Master Scenarios List */}
          <div className="lg:col-span-5 space-y-2.5 max-h-[780px] overflow-y-auto pr-1 no-scrollbar">
            {filteredScenarios.map((scenario) => {
              const id = scenario.canonical_id || scenario.id || '';
              return (
                <SystemDesignScenarioCard
                  key={id}
                  scenario={scenario}
                  isSelected={selectedScenarioId === id}
                  onSelect={(s) => setSelectedScenarioId(s.canonical_id || s.id || null)}
                />
              );
            })}
          </div>

          {/* Right Column: Blueprint Inspector */}
          {activeScenario && (
            <SystemDesignScenarioDetail
              scenario={activeScenario}
              onLaunchScenario={handleLaunchScenario}
              onStartVoiceBrief={handleStartVoiceBrief}
            />
          )}
        </div>
      )}

      {/* L1 Math Coach Modal Overlay */}
      {isMathCoachOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/40 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
          <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[90vh] overflow-y-auto">
            <div className="sticky top-4 right-4 z-10 flex justify-end pr-4 pt-2">
              <button
                type="button"
                onClick={() => setIsMathCoachOpen(false)}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition cursor-pointer shadow-sm"
                title="Закрыть (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-2 sm:p-4">
              <CapacityMathCoach />
            </div>
          </div>
        </div>
      )}

      {/* Live Voice Brief Modal */}
      {isVoiceBriefOpen && voiceBriefSessionId && voiceBriefScenario && (
        <VoiceModal
          key={voiceBriefSessionId}
          isOpen={isVoiceBriefOpen}
          onClose={() => {
            setIsVoiceBriefOpen(false);
            setVoiceBriefSessionId(null);
            setVoiceBriefScenario(null);
          }}
          topic={`System Design: ${voiceBriefScenario.title}`}
          currentQuestionText={voiceBriefScenario.problem_statement || voiceBriefScenario.title}
          referenceAnswer={voiceBriefScenario.contextMarkdown}
          initialSessionType="tutor"
          initialTutorMode="free_chat"
          customPromptOverride={voiceBriefPrompt}
        />
      )}
    </div>
  );
};
