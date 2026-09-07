import { db } from '../connection';

export function seedDefaultProfiles() {
  try {
    const countRow = db.prepare('SELECT COUNT(*) as count FROM interview_profiles').get() as { count: number };
    if (countRow && countRow.count > 0) return;

    const defaultPresets = [
      {
        id: 'preset_faang_senior',
        name: 'FAANG Senior Interviewer',
        badge: '🛡️ Адаптивное',
        description: 'Строгая и объективная оценка без подсказок, глубокая проверка понимания «под капотом» и краевых случаев.',
        is_preset: 1,
        strategy: 'adaptive_probing',
        voice: 'Aoede',
        max_probes: 3,
        custom_prompt_override: null,
        custom_anchors: null
      },
      {
        id: 'preset_express_screening',
        name: 'Быстрый скрининг (Recruiter Tech)',
        badge: '⚡ Экспресс',
        description: 'Быстрая проверка базовых определений и ключевых концепций в динамичном темпе (1 уточнение).',
        is_preset: 1,
        strategy: 'adaptive_probing',
        voice: 'Puck',
        max_probes: 1,
        custom_prompt_override: null,
        custom_anchors: null
      },
      {
        id: 'preset_deep_dive_lead',
        name: 'Глубокий стресс-тест (Tech Lead)',
        badge: '🔬 Hardcore',
        description: 'Максимальная глубина (до 5 раундов): проверка всех 10 якорей темы, отказоустойчивости и многопоточности.',
        is_preset: 1,
        strategy: 'adaptive_probing',
        voice: 'Fenrir',
        max_probes: 5,
        custom_prompt_override: null,
        custom_anchors: null
      },
      {
        id: 'preset_soft_mentor',
        name: 'Мягкий наставник (Поддерживающий)',
        badge: '🌸 Сократ',
        description: 'Теплая атмосфера: похвала за верные мысли, мягкие подсказки и живые аналогии при застревании.',
        is_preset: 1,
        strategy: 'socratic_tutoring',
        voice: 'Kore',
        max_probes: 3,
        custom_prompt_override: null,
        custom_anchors: null
      },
      {
        id: 'preset_academic_tutor',
        name: 'Академический тьютор (Разбор темы)',
        badge: '🎓 Обучение',
        description: 'Пошаговый разбор фундаментальных принципов: наводящие логические цепочки от простого к сложному.',
        is_preset: 1,
        strategy: 'socratic_tutoring',
        voice: 'Charon',
        max_probes: 4,
        custom_prompt_override: null,
        custom_anchors: null
      }
    ];

    const insert = db.prepare(`
      INSERT INTO interview_profiles (
        id, name, badge, description, is_preset, strategy, voice, max_probes,
        custom_prompt_override, custom_anchors, created_at, updated_at
      ) VALUES (
        @id, @name, @badge, @description, @is_preset, @strategy, @voice, @max_probes,
        @custom_prompt_override, @custom_anchors, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `);

    for (const preset of defaultPresets) {
      insert.run(preset);
    }
    console.log('✅ Seeded default interview profiles into SQLite DB');
  } catch (err) {
    console.error('Error seeding default profiles:', err);
  }
}
