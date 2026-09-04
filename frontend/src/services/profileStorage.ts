import { InterviewProfile, InterviewConfig } from '../types/interviewConfig';

export const BUILT_IN_PROFILES: InterviewProfile[] = [
  // 1. Адаптивное зондирование — Стандарт
  {
    id: 'preset_faang_senior',
    name: 'FAANG Senior Interviewer',
    badge: '🛡️ Адаптивное',
    description: 'Строгая и объективная оценка без подсказок, глубокая проверка понимания «под капотом» и краевых случаев.',
    isPreset: true,
    config: {
      strategy: 'adaptive_probing',
      voice: 'Aoede',
      maxProbes: 3,
      deepDive: true,
      liveCoaching: false
    }
  },
  // 2. Адаптивное зондирование — Экспресс
  {
    id: 'preset_express_screening',
    name: 'Быстрый скрининг (Recruiter Tech)',
    badge: '⚡ Экспресс',
    description: 'Быстрая проверка базовых определений и ключевых концепций в динамичном темпе (1 уточнение).',
    isPreset: true,
    config: {
      strategy: 'adaptive_probing',
      voice: 'Puck',
      maxProbes: 1,
      deepDive: false,
      liveCoaching: false
    }
  },
  // 3. Адаптивное зондирование — Стресс-тест
  {
    id: 'preset_deep_dive_lead',
    name: 'Глубокий стресс-тест (Tech Lead)',
    badge: '🔬 Hardcore',
    description: 'Максимальная глубина (до 5 раундов): проверка всех 10 якорей темы, отказоустойчивости и многопоточности.',
    isPreset: true,
    config: {
      strategy: 'adaptive_probing',
      voice: 'Fenrir',
      maxProbes: 5,
      deepDive: true,
      liveCoaching: false
    }
  },
  // 4. Сократический тьюторинг — Поддерживающий
  {
    id: 'preset_soft_mentor',
    name: 'Мягкий наставник (Поддерживающий)',
    badge: '🌸 Сократ',
    description: 'Теплая атмосфера: похвала за верные мысли, мягкие подсказки и живые аналогии при застревании.',
    isPreset: true,
    config: {
      strategy: 'socratic_tutoring',
      voice: 'Kore',
      maxProbes: 3,
      deepDive: false,
      liveCoaching: true
    }
  },
  // 5. Сократический тьюторинг — Академический
  {
    id: 'preset_academic_tutor',
    name: 'Академический тьютор (Разбор темы)',
    badge: '🎓 Обучение',
    description: 'Пошаговый разбор фундаментальных принципов: наводящие логические цепочки от простого к сложному.',
    isPreset: true,
    config: {
      strategy: 'socratic_tutoring',
      voice: 'Charon',
      maxProbes: 4,
      deepDive: true,
      liveCoaching: true
    }
  }
];

const STORAGE_KEY = 'interview_prep_profiles_v1';
const ACTIVE_CONFIG_KEY = 'interview_prep_active_config_v1';

export function getCachedProfiles(): InterviewProfile[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return BUILT_IN_PROFILES;
    const userProfiles: InterviewProfile[] = JSON.parse(raw);
    return userProfiles.length > 0 ? userProfiles : BUILT_IN_PROFILES;
  } catch {
    return BUILT_IN_PROFILES;
  }
}

export async function fetchProfiles(): Promise<InterviewProfile[]> {
  try {
    const res = await fetch('/api/profiles');
    if (res.ok) {
      const data: InterviewProfile[] = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        return data;
      }
    }
  } catch (err) {
    console.warn('Could not fetch profiles from backend DB, using cached:', err);
  }
  return getCachedProfiles();
}

export async function saveUserProfile(name: string, description: string, config: InterviewConfig): Promise<InterviewProfile> {
  const newProfile: InterviewProfile = {
    id: `user_profile_${Date.now()}`,
    name: name.trim() || 'Пользовательский профиль',
    badge: config.strategy === 'adaptive_probing' ? '🎯 Мой профиль' : '💡 Мой ментор',
    description: description.trim() || 'Индивидуальная конфигурация интервьюера',
    isPreset: false,
    config
  };

  // 1. Optimistically update local cache
  try {
    const cached = getCachedProfiles();
    const updated = [newProfile, ...cached.filter((p) => p.id !== newProfile.id)];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Error saving local cache:', err);
  }

  // 2. Persist to Backend SQLite DB
  try {
    const res = await fetch('/api/profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newProfile)
    });
    if (res.ok) {
      const saved: InterviewProfile = await res.json();
      return saved;
    }
  } catch (err) {
    console.error('Error persisting profile to SQLite DB:', err);
  }

  return newProfile;
}

export async function deleteUserProfile(profileId: string): Promise<void> {
  // 1. Update local cache
  try {
    const cached = getCachedProfiles();
    const updated = cached.filter((p) => p.id !== profileId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Error updating local cache on delete:', err);
  }

  // 2. Delete from Backend SQLite DB
  try {
    await fetch(`/api/profiles/${encodeURIComponent(profileId)}`, {
      method: 'DELETE'
    });
  } catch (err) {
    console.error('Error deleting profile from SQLite DB:', err);
  }
}

export function getActiveConfig(): InterviewConfig {
  const userGender = (localStorage.getItem('interview_user_gender') as any) || 'female';
  const turnMode = (localStorage.getItem('interview_turn_mode') as any) || 'manual';
  const liveModel = (localStorage.getItem('interview_live_model') as any) || 'gemini-live-v3';
  const alwaysShowPreflight = localStorage.getItem('interview_always_show_preflight') === 'true';

  try {
    const raw = localStorage.getItem(ACTIVE_CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...parsed,
        userGender: parsed.userGender || userGender,
        turnMode: parsed.turnMode || turnMode,
        liveModel: parsed.liveModel || liveModel,
        alwaysShowPreflight: typeof parsed.alwaysShowPreflight === 'boolean' ? parsed.alwaysShowPreflight : alwaysShowPreflight
      };
    }
  } catch {}
  return {
    ...BUILT_IN_PROFILES[0].config,
    userGender,
    turnMode,
    liveModel,
    alwaysShowPreflight
  };
}

export function saveActiveConfig(config: InterviewConfig): void {
  try {
    if (config.userGender) {
      localStorage.setItem('interview_user_gender', config.userGender);
    }
    if (config.turnMode) {
      localStorage.setItem('interview_turn_mode', config.turnMode);
    }
    if (config.liveModel) {
      localStorage.setItem('interview_live_model', config.liveModel);
    }
    if (typeof config.alwaysShowPreflight === 'boolean') {
      localStorage.setItem('interview_always_show_preflight', String(config.alwaysShowPreflight));
    }
    localStorage.setItem(ACTIVE_CONFIG_KEY, JSON.stringify(config));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('interview_config_updated', { detail: config }));
    }
  } catch (err) {
    console.error('Error saving active config:', err);
  }
}
