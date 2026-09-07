export type InterviewPersonaId = 'mentor' | 'amazon_bar_raiser' | 'google_staff' | 'yandex_core';
export type TargetGrade = 'L4_MIDDLE' | 'L5_SENIOR' | 'L6_STAFF';

export interface PersonaPromptContext {
  persona: InterviewPersonaId;
  targetGrade: TargetGrade;
  topic: string;
}

export interface PersonaDirectives {
  personaTitle: string;
  roleDirective: string;
  gradeExpectationDirective: string;
  evaluationRubricDirective: string;
}
