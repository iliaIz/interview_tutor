import { Router } from 'express';
import { db } from '../services/db';

const router = Router();

// GET /api/profiles - list all profiles
router.get('/', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM interview_profiles ORDER BY is_preset DESC, created_at DESC').all() as any[];
    
    const formatted = rows.map((r) => ({
      id: r.id,
      name: r.name,
      badge: r.badge,
      description: r.description || '',
      isPreset: Boolean(r.is_preset),
      config: {
        strategy: r.strategy,
        voice: r.voice,
        maxProbes: r.max_probes,
        customPromptOverride: r.custom_prompt_override || undefined,
        customAnchors: r.custom_anchors ? JSON.parse(r.custom_anchors) : undefined
      }
    }));

    res.json(formatted);
  } catch (err) {
    console.error('Error fetching interview profiles:', err);
    res.status(500).json({ error: 'Failed to fetch interview profiles' });
  }
});

// POST /api/profiles - create or update a profile
router.post('/', (req, res) => {
  try {
    const { id, name, badge, description, config } = req.body;
    if (!name || !config) {
      return res.status(400).json({ error: 'Missing name or config in request' });
    }

    const profileId = id || `user_profile_${Date.now()}`;
    const badgeText = badge || (config.strategy === 'adaptive_probing' ? '🎯 Мой профиль' : '💡 Мой ментор');
    const desc = description || 'Пользовательский профиль';
    const anchorsJson = Array.isArray(config.customAnchors) ? JSON.stringify(config.customAnchors) : null;

    const stmt = db.prepare(`
      INSERT INTO interview_profiles (
        id, name, badge, description, is_preset, strategy, voice, max_probes,
        custom_prompt_override, custom_anchors, created_at, updated_at
      ) VALUES (
        @id, @name, @badge, @description, 0, @strategy, @voice, @max_probes,
        @custom_prompt_override, @custom_anchors, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        badge = excluded.badge,
        description = excluded.description,
        strategy = excluded.strategy,
        voice = excluded.voice,
        max_probes = excluded.max_probes,
        custom_prompt_override = excluded.custom_prompt_override,
        custom_anchors = excluded.custom_anchors,
        updated_at = CURRENT_TIMESTAMP
    `);

    stmt.run({
      id: profileId,
      name,
      badge: badgeText,
      description: desc,
      strategy: config.strategy || 'adaptive_probing',
      voice: config.voice || 'Kore',
      max_probes: config.maxProbes || 3,
      custom_prompt_override: config.customPromptOverride || null,
      custom_anchors: anchorsJson
    });

    res.json({
      id: profileId,
      name,
      badge: badgeText,
      description: desc,
      isPreset: false,
      config
    });
  } catch (err) {
    console.error('Error saving profile:', err);
    res.status(500).json({ error: 'Failed to save profile' });
  }
});

// DELETE /api/profiles/:id - delete a profile
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const stmt = db.prepare('DELETE FROM interview_profiles WHERE id = ? AND is_preset = 0');
    const result = stmt.run(id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Profile not found or cannot delete built-in preset' });
    }

    res.json({ success: true, deletedId: id });
  } catch (err) {
    console.error('Error deleting profile:', err);
    res.status(500).json({ error: 'Failed to delete profile' });
  }
});

export default router;
