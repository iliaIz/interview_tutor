import React from 'react';
import { AcademyCourse } from '../../types/nextgen';
import { Sparkles, Target, Cpu, Clock, ArrowRight } from 'lucide-react';

interface AcademyCourseCatalogProps {
  courses: AcademyCourse[];
  filteredCourses: AcademyCourse[];
  selectedCategory: 'career' | 'domain';
  onSelectCategory: (cat: 'career' | 'domain') => void;
  careerCount: number;
  domainCount: number;
  activeCourseId: string | null;
  onSelectCourse: (courseId: string) => void;
}

export const AcademyCourseCatalog: React.FC<AcademyCourseCatalogProps> = ({
  courses,
  filteredCourses,
  selectedCategory,
  onSelectCategory,
  careerCount,
  domainCount,
  activeCourseId,
  onSelectCourse
}) => {
  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
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
              {courses.length || 6} Программ 2026
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

      {/* 2. Course Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCourses.map((course) => {
          const isSelected = activeCourseId === course.id;
          const userProg = course.userProgress || { percentage: 0, completedCount: 0 };

          return (
            <div
              key={course.id}
              onClick={() => onSelectCourse(course.id)}
              className={`p-5 rounded-3xl border transition-all duration-300 cursor-pointer relative overflow-hidden flex flex-col justify-between gap-4 ${
                isSelected
                  ? 'bg-white shadow-lg border-pastel-accentRose/50 ring-2 ring-pastel-accentRose/20'
                  : 'bg-white/70 hover:bg-white border-pastel-border hover:border-pastel-accentRose/30 shadow-2xs hover:shadow-sm'
              }`}
            >
              {/* Card Header */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-pastel-bg text-pastel-accentRose border border-pastel-border font-mono">
                    {course.badge}
                  </span>
                  <span className="text-[11px] font-bold text-pastel-muted flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {course.estimatedDuration}
                  </span>
                </div>
                <h3 className="font-bold text-sm sm:text-base text-pastel-text leading-snug">
                  {course.title}
                </h3>
                <p className="text-xs text-pastel-muted line-clamp-2 leading-relaxed">
                  {course.description}
                </p>
              </div>

              {/* Progress Footer */}
              <div className="pt-3 border-t border-pastel-border/50 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-pastel-rose/40 flex items-center justify-center font-bold text-xs text-pastel-accentRose">
                    {userProg.percentage}%
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-pastel-text">
                      {userProg.completedCount || (userProg as any).completedSteps?.length || 0} из {course.totalSteps} шагов
                    </p>
                    <p className="text-[10px] text-pastel-muted">{course.milestonesCount} майлстоунов</p>
                  </div>
                </div>

                <div className={`px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1 ${
                  isSelected 
                    ? 'bg-pastel-accentRose text-white' 
                    : 'bg-pastel-bg text-pastel-text hover:bg-pastel-rose hover:text-pastel-accentRose'
                }`}>
                  <span>{isSelected ? 'Активен' : 'Выбрать'}</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
