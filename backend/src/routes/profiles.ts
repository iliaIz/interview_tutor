import { Router } from 'express';
import { db } from '../services/db';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { safeJsonParse } from '../utils/safeJson';

const router = Router();

// GET /api/profiles - list all profiles
router.get('/', asyncHandler(async (_req, res) => {
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
      customAnchors: r.custom_anchors ? safeJsonParse(r.custom_anchors, undefined) : undefined
    }
  }));

  res.json(formatted);
}));

// POST /api/profiles - create or update a profile
router.post('/', asyncHandler(async (req, res) => {
  const { id, name, badge, description, config } = req.body;
  if (!name || !config) {
    throw new AppError('Missing name or config in request', 400);
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
}));

// DELETE /api/profiles/:id - delete a profile
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const stmt = db.prepare('DELETE FROM interview_profiles WHERE id = ? AND is_preset = 0');
  const result = stmt.run(id);

  if (result.changes === 0) {
    throw new AppError('Profile not found or cannot delete built-in preset', 404);
  }

  res.json({ success: true, deletedId: id });
}));

export default router;
