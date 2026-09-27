import React from 'react';
import { Sparkles, Target, Cpu } from 'lucide-react';

interface AcademyHeaderProps {
  coursesCount: number;
  selectedCategory: 'career' | 'domain';
  onSelectCategory: (cat: 'career' | 'domain') => void;
  careerCount: number;
  domainCount: number;
}

export const AcademyHeader: React.FC<AcademyHeaderProps> = ({
  coursesCount,
  selectedCategory,
  onSelectCategory,
  careerCount,
  domainCount
}) => {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-pastel-border/60">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-pastel-accentRose to-pastel-accentViolet text-white flex items-center justify-center shadow-xs">
            <Sparkles className="w-4 h-4" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-pastel-text tracking-tight">
            Академия Мастерства
          </h1>
          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-pastel-rose text-pastel-accentRose border border-pastel-accentRose/20">
            {coursesCount || 6} Программ 2026
          </span>
        </div>
        <p className="text-xs sm:text-sm text-pastel-muted font-medium">
          Сквозная траектория подготовки к Bar-Raiser интервью на грейды Senior & Staff в BigTech
        </p>
      </div>

      {/* Category Switcher: Career vs Domain */}
      <div className="flex items-center bg-white/80 p-1.5 rounded-2xl border border-pastel-border shadow-2xs self-start md:self-auto">
        <button
          onClick={() => onSelectCategory('career')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
            selectedCategory === 'career'
              ? 'bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet text-white shadow-xs'
              : 'text-pastel-muted hover:text-pastel-text hover:bg-pastel-bg'
          }`}
        >
          <Target className="w-3.5 h-3.5" />
          <span>Карьерные Спринты ({careerCount})</span>
        </button>
        <button
          onClick={() => onSelectCategory('domain')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
            selectedCategory === 'domain'
              ? 'bg-gradient-to-r from-pastel-accentRose to-pastel-accentViolet text-white shadow-xs'
              : 'text-pastel-muted hover:text-pastel-text hover:bg-pastel-bg'
          }`}
        >
          <Cpu className="w-3.5 h-3.5" />
          <span>Доменные Треки ({domainCount})</span>
        </button>
      </div>
    </div>
  );
};
