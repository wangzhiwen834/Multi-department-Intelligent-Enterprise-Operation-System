import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { authRequired } from '../auth/auth.middleware.js';

export const shopRouter = Router();
shopRouter.use(authRequired);

// 列出所有门店(本期不区分内容可见性,所有人可见)。含地址 / 电话(海报预设用)。
shopRouter.get('/shops', async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT s.id, s.code, s.name, s.status, s.address, s.phone,
              b.code AS business_code, b.name AS business_name
       FROM shop s JOIN business b ON b.id=s.business_id ORDER BY s.id`,
    );
    res.json(rows);
  } catch (e) { next(e); }
});

const PatchBody = z.object({
  address: z.string().max(255),
  phone: z.string().max(50),
});

// PATCH /api/shops/:id -> 更新门店联系信息(地址 / 电话),用于海报预设。空串存为 NULL。
shopRouter.patch('/shops/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: '无效 id' });
    const b = PatchBody.parse(req.body);
    const address = b.address.trim() || null;
    const phone = b.phone.trim() || null;
    const { rows } = await query(
      `UPDATE shop SET address = $2, phone = $3 WHERE id = $1
       RETURNING id, code, name, status, address, phone`,
      [id, address, phone],
    );
    if (!rows.length) return res.status(404).json({ error: '门店不存在' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});
