import { Router } from 'express';
import { z } from 'zod';
import { authRequired } from '../auth/auth.middleware.js';
import { auditLog } from '../audit/audit.middleware.js';
import { isLockHolder } from '../lock/lock.service.js';
import { query } from '../db/pool.js';
import { extractWorkbook } from './extraction.service.js';

export const extractRouter = Router();
extractRouter.use(authRequired);

const Body = z.object({ source: z.enum(['save', 'manual']) });

// AI 抽取:source=manual 需 manager+;source=save 需持锁(保存流程保证)。scheduled 走进程内,不经此路由。
extractRouter.post('/workbooks/:id/extract', auditLog('ai.extract'), async (req, res, next) => {
  try {
    const { source } = Body.parse(req.body);
    const id = Number(req.params.id);
    if (source === 'manual' && req.user!.role !== 'manager' && req.user!.role !== 'chairman')
      return res.status(403).json({ error: '需要经理或以上权限' });
    if (source === 'save' && !await isLockHolder(id, req.user!.id))
      return res.status(409).json({ error: '锁已丢失,请重载工作簿' });
    const r = await extractWorkbook(id, { source, userId: req.user!.id });
    if (!r.ok) {
      if (r.code === 'not_configured') return res.status(503).json(r);
      if (r.code === 'not_found') return res.status(404).json(r);
      return res.status(502).json(r);
    }
    res.json(r);
  } catch (e) { next(e); }
});

// 上次抽取时间(工作簿粒度)。供前端显示"上次 AI 抽取"。
extractRouter.get('/workbooks/:id/extract/status', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const r = await query<{ last_extracted_at: string | null }>(
      'SELECT last_extracted_at FROM workbook WHERE id=$1', [id]);
    if (!r.rows.length) return res.status(404).json({ error: '工作簿不存在' });
    res.json({ lastExtractedAt: r.rows[0].last_extracted_at });
  } catch (e) { next(e); }
});
