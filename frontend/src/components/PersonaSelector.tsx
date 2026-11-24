import React from 'react';
import { 
  InterviewPersonaId, 
  TargetGrade, 
  FAANG_PERSONAS, 
  TARGET_GRADES 
} from '../types/personas';
import { GeminiVoiceName } from '../types/interviewConfig';
import { Award, Check, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface PersonaSelectorProps {
  selectedPersona: InterviewPersonaId;
  selectedGrade: TargetGrade;
  selectedVoice?: GeminiVoiceName;
  onSelectPersona: (persona: InterviewPersonaId, recommendedVoice?: GeminiVoiceName) => void;
  onSelectGrade: (grade: TargetGrade) => void;
}

export const PersonaSelector: React.FC<PersonaSelectorProps> = ({
  selectedPersona,
  selectedGrade,
  selectedVoice,
  onSelectPersona,
  onSelectGrade
}) => {
  const [isExpanded, setIsExpanded] = React.useState(false);

  const currentPersona = FAANG_PERSONAS[selectedPersona] || FAANG_PERSONAS.mentor;
  const currentGrade = TARGET_GRADES[selectedGrade] || TARGET_GRADES.L5_SENIOR;

  return (
    <div className="w-full max-w-lg mx-auto space-y-3">
      {/* Compact Header Pill Bar (Always visible) */}
      <div className="flex items-center justify-between p-2.5 rounded-2xl bg-white/90 border border-pastel-border/80 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div 
            className="w-8 h-8 rounded-xl flex items-center justify-center text-sm shadow-xs font-bold text-white shrink-0"
            style={{ backgroundColor: currentPersona.accentColor }}
          >
            {selectedPersona === 'amazon_bar_raiser' ? '📦' : selectedPersona === 'google_staff' ? '🔍' : selectedPersona === 'yandex_core' ? '🔴' : '🎓'}
          </div>
          <div className="text-left">
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-xs text-pastel-text">
                {currentPersona.name}
              </span>
              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                {currentGrade.badge}
              </span>
            </div>
            <p className="text-[10px] text-pastel-muted truncate max-w-[210px] sm:max-w-[280px]">
              {currentPersona.focusAreas.slice(0, 2).join(' • ')}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="px-2.5 py-1 rounded-xl text-[11px] font-bold text-pastel-accentViolet hover:bg-pastel-accentViolet/10 transition-all flex items-center gap-1 cursor-pointer"
        >
          <span>{isExpanded ? 'Свернуть' : 'Выбрать персону'}</span>
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Expanded Persona & Grade Selection Matrix */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="space-y-3.5 overflow-hidden"
          >
            {/* 1. Target Grade Pill Buttons */}
            <div className="space-y-1.5 text-left">
              <span className="text-[11px] font-bold text-pastel-muted flex items-center gap-1">
                <Award className="w-3.5 h-3.5 text-pastel-accentRose" />
                Целевой грейд для калибровки:
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {(Object.keys(TARGET_GRADES) as TargetGrade[]).map((gradeKey) => {
                  const grade = TARGET_GRADES[gradeKey];
                  const isSelected = selectedGrade === gradeKey;
                  return (
                    <button
                      key={gradeKey}
                      type="button"
                      onClick={() => onSelectGrade(gradeKey)}
                      className={`p-2 rounded-xl text-left border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-gradient-to-r from-pastel-accentViolet/15 to-pastel-accentRose/15 border-pastel-accentViolet text-pastel-accentViolet shadow-2xs font-extrabold'
                          : 'bg-white/80 hover:bg-slate-50 border-pastel-border text-slate-600 font-medium'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs">{grade.label}</span>
                        {isSelected && <Check className="w-3 h-3 text-pastel-accentViolet" />}
                      </div>
                      <span className="text-[9px] text-pastel-muted block">{grade.exp}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Persona Cards Grid */}
            <div className="space-y-1.5 text-left">
              <span className="text-[11px] font-bold text-pastel-muted flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Персона интервьюера BigTech:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(Object.keys(FAANG_PERSONAS) as InterviewPersonaId[]).map((pKey) => {
                  const p = FAANG_PERSONAS[pKey];
                  const isSelected = selectedPersona === pKey;
                  return (
                    <button
                      key={pKey}
                      type="button"
                      onClick={() => onSelectPersona(pKey, p.recommendedVoice)}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'bg-gradient-to-br from-white via-pastel-lavender/30 to-white shadow-sm ring-2 ring-pastel-accentViolet/50'
                          : 'bg-white/70 hover:bg-white border-pastel-border/70 hover:shadow-2xs'
                      }`}
                      style={{
                        borderColor: isSelected ? p.accentColor : undefined
                      }}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-base">
                              {pKey === 'amazon_bar_raiser' ? '📦' : pKey === 'google_staff' ? '🔍' : pKey === 'yandex_core' ? '🔴' : '🎓'}
                            </span>
                            <span className="font-extrabold text-xs text-pastel-text">
                              {p.name}
                            </span>
                          </div>
                          <span 
                            className="text-[9px] font-extrabold px-2 py-0.5 rounded-full text-white"
                            style={{ backgroundColor: p.accentColor }}
                          >
                            {p.badge}
                          </span>
                        </div>
                        <p className="text-[10px] text-pastel-muted leading-tight mb-2">
                          {p.evaluationStyle}
                        </p>
                      </div>

                      <div className="pt-1.5 border-t border-pastel-border/30 flex items-center justify-between text-[9px] text-pastel-sub">
                        <span className="italic truncate max-w-[170px]">{p.signatureQuote}</span>
                        <span className="font-semibold shrink-0 ml-1">Рек. тембр: {p.recommendedVoice}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
