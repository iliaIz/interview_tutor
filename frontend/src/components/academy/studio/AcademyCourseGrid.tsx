import React from 'react';
import { AcademyCourse } from '../../../types/nextgen';
import { Clock, ArrowRight } from 'lucide-react';

interface AcademyCourseGridProps {
  courses: AcademyCourse[];
  activeCourseId: string | null;
  onSelectCourse: (id: string) => void;
}

export const AcademyCourseGrid: React.FC<AcademyCourseGridProps> = ({
  courses,
  activeCourseId,
  onSelectCourse
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {courses.map((course) => {
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

              <div
                className={`px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1 ${
                  isSelected
                    ? 'bg-pastel-accentRose text-white'
                    : 'bg-pastel-bg text-pastel-text hover:bg-pastel-rose hover:text-pastel-accentRose'
                }`}
              >
                <span>{isSelected ? 'Активен' : 'Выбрать'}</span>
                <ArrowRight className="w-3 h-3" />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
