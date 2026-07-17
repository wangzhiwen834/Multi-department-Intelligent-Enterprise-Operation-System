import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { authRequired } from '../auth/auth.middleware.js';

export const workbookRouter = Router();
workbookRouter.use(authRequired);

const CreateBody = z.object({ shopId: z.number().int(), period: z.string().regex(/^\d{4}-\d{2}$/) });

// 创建(或返回已存在)工作簿
workbookRouter.post('/workbooks', async (req, res, next) => {
  try {
    const { shopId, period } = CreateBody.parse(req.body);
    const shop = (await query<{ business_id: number }>('SELECT business_id FROM shop WHERE id=$1', [shopId])).rows[0];
    if (!shop) return res.status(404).json({ error: 'shop not found' });
    const tpl = (await query<{ version: number }>(
      'SELECT version FROM template WHERE business_id=$1 ORDER BY version DESC LIMIT 1', [shop.business_id],
    )).rows[0];
    if (!tpl) return res.status(400).json({ error: 'no template for business' });
    const ins = await query(
      `INSERT INTO workbook (shop_id, period, template_version) VALUES ($1,$2,$3)
       ON CONFLICT (shop_id, period) DO UPDATE SET updated_at=now()
       RETURNING id, shop_id, period, template_version, status, created_at`,
      [shopId, period, tpl.version],
    );
    res.status(201).json(ins.rows[0]);
  } catch (e) { next(e); }
});

workbookRouter.get('/workbooks', async (req, res, next) => {
  try {
    const { shopId, period } = req.query as { shopId?: string; period?: string };
    const { rows } = await query(
      'SELECT id, shop_id, period, template_version, status, created_at, updated_at FROM workbook WHERE shop_id=$1 AND period=$2',
      [shopId, period],
    );
    res.json(rows[0] ?? null);
  } catch (e) { next(e); }
});

// 存快照
workbookRouter.put('/workbooks/:id/snapshot', async (req, res, next) => {
  try {
    const { data } = req.body as { data: unknown };
    await query(
      `INSERT INTO workbook_snapshot (workbook_id, data, updated_at) VALUES ($1,$2,now())
       ON CONFLICT (workbook_id) DO UPDATE SET data=EXCLUDED.data, updated_at=now()`,
      [req.params.id, JSON.stringify(data)],
    );
    await query('UPDATE workbook SET updated_at=now() WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// 取快照
workbookRouter.get('/workbooks/:id/snapshot', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT data, updated_at FROM workbook_snapshot WHERE workbook_id=$1', [req.params.id]);
    res.json(rows[0] ?? null);
  } catch (e) { next(e); }
});
