import React, { useState } from 'react';
import { CompanyCulture, CompanyProfile } from '@interview-prep/shared';
import {
  ShieldAlert,
  CheckCircle2,
  TrendingUp,
  Cpu,
  Award,
  Sparkles,
  ClipboardCheck,
  Compass,
  Calculator
} from 'lucide-react';
import { CompanyCompetenciesRadar } from './dossier/CompanyCompetenciesRadar';
import { CompanySpecReviewChecklist } from './dossier/CompanySpecReviewChecklist';
import { CompanyStarScenarios } from './dossier/CompanyStarScenarios';
import { CompanyTalentQGuide } from './dossier/CompanyTalentQGuide';

interface CompanyDossierTabProps {
  culture: CompanyCulture;
  companyName: string;
  profile?: CompanyProfile;
}

type DossierSection = 'culture' | 'competencies' | 'spec_review' | 'star_cases' | 'talent_q';

export const CompanyDossierTab: React.FC<CompanyDossierTabProps> = ({ culture, companyName, profile }) => {
  const [activeSection, setActiveSection] = useState<DossierSection>('culture');

  return (
    <div className="space-y-6 font-sans">
      {/* Dossier Section Navigation Pills */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-2xl bg-slate-100/80 border border-slate-200/80">
        {(
          [
            { id: 'culture', label: 'Парадигма & Флаги', icon: Cpu, visible: true },
            { id: 'competencies', label: `${profile?.competencies?.length || 9} Компетенций PE`, icon: Compass, visible: Boolean(profile?.competencies && profile.competencies.length > 0) },
            { id: 'spec_review', label: `${profile?.specReviewChecklist?.length || 8}-Point Spec Review`, icon: ClipboardCheck, visible: Boolean(profile?.specReviewChecklist && profile.specReviewChecklist.length > 0) },
            { id: 'star_cases', label: `STAR Сценарии (${profile?.starScenarios?.length || 4})`, icon: Sparkles, visible: Boolean(profile?.starScenarios && profile.starScenarios.length > 0) },
            { id: 'talent_q', label: `Тест Talent Q (${profile?.talentQGuide?.deadlineHours || 72}ч)`, icon: Calculator, visible: Boolean(profile?.talentQGuide) }
          ] as const
        )
          .filter((sec) => sec.visible)
          .map((sec) => {
            const Icon = sec.icon;
            const isActive = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                onClick={() => setActiveSection(sec.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                  isActive
                    ? 'bg-amber-400 text-slate-950 shadow-xs'
                    : 'text-slate-700 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{sec.label}</span>
              </button>
            );
          })}
      </div>

      {/* 1. Paradigm & Red/Green Flags Section */}
      {activeSection === 'culture' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Paradigm Banner */}
          <div className="p-5 rounded-3xl bg-gradient-to-r from-amber-500/10 via-amber-400/5 to-transparent border border-amber-300/40 relative overflow-hidden">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-400/20 text-amber-900 border border-amber-300/60 flex items-center justify-center shrink-0 shadow-sm">
                <Cpu className="w-6 h-6 text-amber-700" />
              </div>
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold font-mono tracking-wider uppercase text-amber-800">
                  Культурная трансформация & Парадигма найма
                </span>
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900">
                  {culture.engineeringParadigm}
                </h3>
                <p className="text-xs text-slate-700 leading-relaxed max-w-3xl">
                  В {companyName} отказались от разделения на системных аналитиков, классических разработчиков и ручных QA.
                  Оценивается готовность кандидата отвечать за фичу от бизнес-идеи и метрик до написания TDD-тестов,
                  деплоя и ночных дежурств.
                </p>
              </div>
            </div>
          </div>

          {/* Metrics Focus */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider font-mono flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-indigo-600" />
              Ключевые продуктовые метрики (Метрики, о которых спросят):
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {culture.metricsFocus.map((metric, i) => (
                <div
                  key={i}
                  className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex items-center gap-3"
                >
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200/80 flex items-center justify-center shrink-0 font-bold text-xs">
                    {i + 1}
                  </div>
                  <span className="text-xs font-bold text-slate-800 leading-snug">{metric}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Red Flags vs Green Flags Matrix */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Red Flags (Instant Rejection) */}
            <div className="p-4 rounded-3xl bg-rose-50/70 border border-rose-200/80 shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-rose-900">
                <ShieldAlert className="w-5 h-5 text-rose-600" />
                <h4 className="text-sm font-extrabold tracking-tight">
                  Красные Флаги (Мгновенный отказ / No Hire)
                </h4>
              </div>
              <p className="text-xs text-rose-800/90 leading-relaxed">
                Паттерны и ответы, гарантированно приводящие к отклонению кандидатуры комитетом найма:
              </p>
              <ul className="space-y-2">
                {culture.redFlags.map((flag, idx) => (
                  <li
                    key={idx}
                    className="p-2.5 rounded-xl bg-white/90 border border-rose-200/60 text-xs text-slate-800 flex items-start gap-2 shadow-xs"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0 mt-1.5" />
                    <span className="leading-relaxed">{flag}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Green Flags (Senior / Bar-Raiser) */}
            <div className="p-4 rounded-3xl bg-emerald-50/70 border border-emerald-200/80 shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-emerald-900">
                <Award className="w-5 h-5 text-emerald-600" />
                <h4 className="text-sm font-extrabold tracking-tight">
                  Зеленые Флаги (Маркеры сеньорности / Strong Hire)
                </h4>
              </div>
              <p className="text-xs text-emerald-800/90 leading-relaxed">
                Архитектурные привычки и решения, выделяющие кандидата в топ-5% претендентов:
              </p>
              <ul className="space-y-2">
                {culture.greenFlags.map((flag, idx) => (
                  <li
                    key={idx}
                    className="p-2.5 rounded-xl bg-white/90 border border-emerald-200/60 text-xs text-slate-800 flex items-start gap-2 shadow-xs"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span className="leading-relaxed font-medium">{flag}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* 2. Competencies Radar */}
      {activeSection === 'competencies' && (
        <div className="animate-in fade-in duration-150">
          <CompanyCompetenciesRadar
            competencies={profile?.competencies}
            companyName={companyName}
          />
        </div>
      )}

      {/* 3. Spec Review Checklist */}
      {activeSection === 'spec_review' && (
        <div className="animate-in fade-in duration-150">
          <CompanySpecReviewChecklist items={profile?.specReviewChecklist} />
        </div>
      )}

      {/* 4. STAR Scenarios */}
      {activeSection === 'star_cases' && (
        <div className="animate-in fade-in duration-150">
          <CompanyStarScenarios scenarios={profile?.starScenarios} />
        </div>
      )}

      {/* 5. Talent Q Guide */}
      {activeSection === 'talent_q' && (
        <div className="animate-in fade-in duration-150">
          <CompanyTalentQGuide guide={profile?.talentQGuide} />
        </div>
      )}
    </div>
  );
};
