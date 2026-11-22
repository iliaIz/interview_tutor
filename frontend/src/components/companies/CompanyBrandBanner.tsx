import React from 'react';
import { CompanyProfile } from '@interview-prep/shared';
import { Building2, MapPin, Bot } from 'lucide-react';

interface CompanyBrandBannerProps {
  profile: CompanyProfile;
  profiles: CompanyProfile[];
  selectedProfileId: string;
  onSelectProfileId: (id: string) => void;
  isAlfa: boolean;
  readinessIndex: number;
  onOpenCopilot: () => void;
}

export const CompanyBrandBanner: React.FC<CompanyBrandBannerProps> = ({
  profile,
  profiles,
  selectedProfileId,
  onSelectProfileId,
  isAlfa,
  readinessIndex,
  onOpenCopilot
}) => {
  return (
    <div
      className={`border rounded-3xl p-5 sm:p-6 shadow-sm relative overflow-hidden ${
        isAlfa
          ? 'bg-gradient-to-r from-rose-500/15 via-rose-100/10 to-white border-rose-300/60'
          : 'bg-gradient-to-r from-amber-400/20 via-amber-200/10 to-white border-amber-300/60'
      }`}
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            {profiles.length > 1 && (
              <div className="flex items-center gap-1 bg-white/90 p-0.5 rounded-xl border border-slate-200/80 shadow-xs mr-1">
                {profiles.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => onSelectProfileId(p.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                      selectedProfileId === p.id
                        ? p.id === 'alfa_digital'
                          ? 'bg-rose-600 text-white shadow-xs'
                          : 'bg-amber-400 text-amber-950 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>{p.logoBadge || '🏦'}</span>
                    <span>{p.id === 'alfa_digital' ? 'Альфа-Банк' : 'Райффайзен'}</span>
                  </button>
                ))}
              </div>
            )}
            <span
              className={`px-3 py-1 rounded-full text-xs font-black shadow-xs flex items-center gap-1.5 ${
                isAlfa ? 'bg-rose-600 text-white' : 'bg-amber-400 text-amber-950'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              {profile.name}
            </span>
            <span className="text-xs text-slate-600 font-mono flex items-center gap-1">
              <MapPin className="w-3 h-3 text-pastel-muted" /> {isAlfa ? 'Alfa Digital Hub' : 'Raiffeisen DGTL Hub'}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight">
            {isAlfa ? 'Целевая Подготовка: Senior Java & HighLoad FinTech' : 'Целевая Подготовка: Product Engineer (Java/Kotlin)'}
          </h1>
          <p className="text-xs text-slate-700 max-w-2xl leading-relaxed">{profile.tagline}</p>
        </div>

        {/* Quick Stats Pill & AI Copilot Action */}
        <div className="flex flex-wrap items-center gap-3 self-start md:self-auto">
          <button
            onClick={onOpenCopilot}
            className={`px-3.5 py-2.5 rounded-2xl font-extrabold text-xs shadow-xs flex items-center gap-2 transition-all cursor-pointer border ${
              isAlfa
                ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-700/30'
                : 'bg-amber-400 hover:bg-amber-500 text-slate-950 border-amber-500/30'
            }`}
            title={`Открыть диалог с AI-Напарником (${profile.name})`}
          >
            <Bot className="w-4 h-4" />
            <span>AI-Напарник (Bar-Raiser)</span>
          </button>

          <div
            className={`flex items-center gap-3 bg-white/90 p-3 rounded-2xl border shadow-xs font-mono text-xs ${
              isAlfa ? 'border-rose-300/40' : 'border-amber-300/40'
            }`}
          >
            <div>
              <span className="block text-slate-500 text-[10px] uppercase font-bold">Степень готовности</span>
              <span className="font-extrabold text-base text-slate-900">{readinessIndex}% CRI</span>
            </div>
            <div className="h-8 w-px bg-slate-200" />
            <div>
              <span className="block text-slate-500 text-[10px] uppercase font-bold">Этапов</span>
              <span className={`font-extrabold text-base ${isAlfa ? 'text-rose-700' : 'text-amber-700'}`}>
                {profile.stages.length} раунда
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
