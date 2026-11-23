export type ScenarioRung = 'L3' | 'L4' | 'L5_L7';
export type LevelFilter = 'all' | ScenarioRung;

export function getScenarioRung(s: any): ScenarioRung {
  const targetLevel = s?.target_level || '';
  if (targetLevel === 'L3_JUNIOR') return 'L3';
  if (targetLevel === 'L4_MIDDLE') return 'L4';
  if (['L5_SENIOR', 'L6_STAFF', 'L7_PRINCIPAL'].includes(targetLevel)) return 'L5_L7';

  // Legacy mappings from SQLite system_design_challenges
  const lvl = s?.level || '';
  const diff = (s?.difficulty || '').toLowerCase();
  const id = (s?.canonical_id || s?.id || '').toLowerCase();

  if (lvl === 'L0' || diff === 'junior' || id.startsWith('hld-micro')) return 'L3';
  if (lvl === 'L2' || id.includes('faded')) return 'L4';
  if (lvl === 'L3' || diff === 'senior' || diff === 'lead' || id.startsWith('hld-scenario')) return 'L5_L7';

  return 'L5_L7';
}

export function getLevelBadge(s: any): { label: string; bg: string } {
  const rung = getScenarioRung(s);
  if (s?.target_level === 'L7_PRINCIPAL') {
    return { label: 'L7 Principal', bg: 'bg-rose-50 text-rose-800 border-rose-200' };
  }
  if (s?.target_level === 'L6_STAFF' || (s?.difficulty || '').toLowerCase() === 'lead') {
    return { label: 'L6 Staff', bg: 'bg-purple-50 text-purple-800 border-purple-200' };
  }
  if (rung === 'L3') {
    return { label: 'L3 Junior', bg: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
  }
  if (rung === 'L4') {
    return { label: 'L4 Middle', bg: 'bg-amber-50 text-amber-800 border-amber-200' };
  }
  return { label: 'L5 Senior', bg: 'bg-blue-50 text-blue-800 border-blue-200' };
}

export function getPedagogicalModeBadge(mode?: string): { label: string; bg: string } {
  switch (mode) {
    case 'WORKED_EXAMPLE':
      return { label: '🎯 Разбор (Studio 1+2)', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    case 'FADED_COMPLETION':
      return { label: '🔧 Починка (Studio 2)', bg: 'bg-amber-50 text-amber-700 border-amber-200' };
    case 'INDEPENDENT_DESIGN':
    default:
      return { label: '🏛️ Дизайн (Studio 2+3)', bg: 'bg-purple-50 text-purple-700 border-purple-200' };
  }
}
