import React from 'react';
import { CompanyProfile } from '@interview-prep/shared';
import { CompanyBrandBanner } from '../CompanyBrandBanner';
import { Layers, BookOpen, Code2, FileText, Zap, Database, PackageCheck } from 'lucide-react';

export interface CompanyPrepStudioHeaderProps {
  profile: CompanyProfile;
  companyProfiles: CompanyProfile[];
  selectedCompanyProfileId: string;
  setSelectedCompanyProfileId: (id: string) => void;
  isAlfa: boolean;
  readinessIndex: number;
  activeCompanySubTab: string;
  setActiveCompanySubTab: (tab: any) => void;
  onOpenCopilot: () => void;
}

export const CompanyPrepStudioHeader: React.FC<CompanyPrepStudioHeaderProps> = ({
  profile,
  companyProfiles,
  selectedCompanyProfileId,
  setSelectedCompanyProfileId,
  isAlfa,
  readinessIndex,
  activeCompanySubTab,
  setActiveCompanySubTab,
  onOpenCopilot
}) => {
  return (
    <>
      <CompanyBrandBanner
        profile={profile}
        profiles={companyProfiles}
        selectedProfileId={selectedCompanyProfileId}
        onSelectProfileId={setSelectedCompanyProfileId}
        isAlfa={isAlfa}
        readinessIndex={readinessIndex}
        onOpenCopilot={onOpenCopilot}
      />

      <div className="flex items-center gap-2 border-b border-pastel-border/70 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveCompanySubTab('pipeline')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-colors flex items-center gap-2 shrink-0 ${
            activeCompanySubTab === 'pipeline' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Layers className="w-4 h-4" />
          Воронка отбора (Пайплайн)
        </button>

        {isAlfa && (
          <button
            onClick={() => setActiveCompanySubTab('theory')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-colors flex items-center gap-2 shrink-0 ${
              activeCompanySubTab === 'theory' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-600 hover:bg-rose-50 hover:text-rose-700'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            Теория & Скрининг (27)
          </button>
        )}

        {isAlfa && (
          <button
            onClick={() => setActiveCompanySubTab('challenges')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-colors flex items-center gap-2 shrink-0 ${
              activeCompanySubTab === 'challenges' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'text-slate-600 hover:bg-amber-50 hover:text-amber-800'
            }`}
          >
            <Code2 className="w-4 h-4" />
            Задачи & Code Review (11)
          </button>
        )}

        <button
          onClick={() => setActiveCompanySubTab('dossier')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-colors flex items-center gap-2 shrink-0 ${
            activeCompanySubTab === 'dossier' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FileText className="w-4 h-4" />
          Инженерное досье & Флаги
        </button>

        <button
          onClick={() => setActiveCompanySubTab('runbook')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-colors flex items-center gap-2 shrink-0 ${
            activeCompanySubTab === 'runbook' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Zap className="w-4 h-4" />
          Ранбук «Собеседование завтра»
        </button>

        <button
          onClick={() => setActiveCompanySubTab('sql_arena')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-colors flex items-center gap-2 shrink-0 ${
            activeCompanySubTab === 'sql_arena' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:bg-indigo-50 hover:text-indigo-700'
          }`}
        >
          <Database className="w-4 h-4" />
          PostgreSQL WASM Арена
        </button>

        {profile.takeHomePrCases && profile.takeHomePrCases.length > 0 && (
          <button
            onClick={() => setActiveCompanySubTab('take_home')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-colors flex items-center gap-2 shrink-0 ${
              activeCompanySubTab === 'take_home' ? 'bg-teal-700 text-white shadow-xs' : 'text-slate-600 hover:bg-teal-50 hover:text-teal-800'
            }`}
          >
            <PackageCheck className="w-4 h-4" />
            Тестовое задание ({profile.takeHomePrCases.length} PRs)
          </button>
        )}
      </div>
    </>
  );
};
