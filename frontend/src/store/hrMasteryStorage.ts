/**
 * hrMasteryStorage.ts
 * Pure client-side persistence helper for Spec 40 Guided Micro-Beats mastery tracking.
 * Bounded cognitive size: <= 60 lines (Rule 8 compliant).
 */

const STORAGE_KEY = 'hr_guided_mastery_v1';

export type HrMasteredBeatsMap = Record<string, string[]>;

export function loadMasteredBeatsMap(): HrMasteredBeatsMap {
  if (typeof window === 'undefined' || !window.localStorage) return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const clean: HrMasteredBeatsMap = {};
    for (const [qid, list] of Object.entries(parsed)) {
      if (Array.isArray(list)) {
        clean[qid] = list.filter((item): item is string => typeof item === 'string');
      }
    }
    return clean;
  } catch {
    return {};
  }
}

export function saveMasteredBeatsMap(map: HrMasteredBeatsMap): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Quota errors ignored silently
  }
}

export function mergeMasteredBeatsForQuestion(
  existingMap: HrMasteredBeatsMap,
  questionId: string,
  incomingIds: string[]
): HrMasteredBeatsMap {
  if (!questionId || !Array.isArray(incomingIds) || incomingIds.length === 0) {
    return existingMap;
  }
  const prev = existingMap[questionId] || [];
  const merged = Array.from(new Set([...prev, ...incomingIds]));
  if (merged.length === prev.length) return existingMap;
  const next = { ...existingMap, [questionId]: merged };
  saveMasteredBeatsMap(next);
  return next;
}
