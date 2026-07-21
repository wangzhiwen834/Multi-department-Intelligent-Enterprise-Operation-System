import { Router } from 'express';
import { z } from 'zod';
import { authRequired } from '../auth/auth.middleware.js';
import { requireRole } from '../rbac/rbac.middleware.js';
import { auditLog } from '../audit/audit.middleware.js';
import { query } from '../db/pool.js';
import { getAiSettings, refreshModels } from './settings.service.js';

export const settingsRouter = Router();
settingsRouter.use(authRequired);

const ModelBody = z.object({ model_id: z.string().min(1), label: z.string().min(1), kind: z.enum(['chat', 'image', 'other']) });

// 读:所有登录用户可读(供前端显示当前模型分配)
settingsRouter.get('/settings/ai', async (req, res, next) => {
  try { res.json(await getAiSettings()); } catch (e) { next(e); }
});

// 写:chairman 专属
settingsRouter.post('/settings/ai/models', requireRole('chairman'), auditLog('settings.ai.model.add'), async (req, res, next) => {
  try {
    const { model_id, label, kind } = ModelBody.parse(req.body);
    await query(
      `INSERT INTO ai_model (model_id, label, kind) VALUES ($1,$2,$3)
       ON CONFLICT (model_id) DO UPDATE SET label=EXCLUDED.label, kind=EXCLUDED.kind`,
      [model_id, label, kind],
    );
    res.status(201).json({ ok: true });
  } catch (e) { next(e); }
});

settingsRouter.delete('/settings/ai/models/:id', requireRole('chairman'), auditLog('settings.ai.model.del'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const m = (await query<{ model_id: string }>('SELECT model_id FROM ai_model WHERE id=$1', [id])).rows[0];
    if (!m) return res.status(404).json({ error: '模型不存在' });
    const ref = (await query('SELECT 1 FROM ai_feature_config WHERE model_id=$1', [m.model_id])).rows[0];
    if (ref) return res.status(409).json({ error: '模型已被功能引用,先解除分配' });
    await query('DELETE FROM ai_model WHERE id=$1', [id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

settingsRouter.put('/settings/ai/features/:feature', requireRole('chairman'), auditLog('settings.ai.feature.assign'), async (req, res, next) => {
  try {
    const feature = z.enum(['chat', 'poster', 'extraction']).parse(req.params.feature);
    const { model_id } = z.object({ model_id: z.string().min(1) }).parse(req.body);
    const m = (await query('SELECT 1 FROM ai_model WHERE model_id=$1', [model_id])).rows[0];
    if (!m) return res.status(404).json({ error: '模型不存在' });
    await query(
      `INSERT INTO ai_feature_config (feature, model_id, updated_at) VALUES ($1,$2,now())
       ON CONFLICT (feature) DO UPDATE SET model_id=EXCLUDED.model_id, updated_at=now()`,
      [feature, model_id],
    );
    res.json({ ok: true });
  } catch (e) { next(e); }
});

settingsRouter.post('/settings/ai/models/refresh', requireRole('chairman'), auditLog('settings.ai.model.refresh'), async (req, res, next) => {
  try {
    const r = await refreshModels();
    res.json({ ok: true, ...r });
  } catch (e: any) {
    res.status(502).json({ ok: false, error: e.message });
  }
});
