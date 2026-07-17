import { Router } from 'express';
import { query } from '../db/pool.js';
import { authRequired } from '../auth/auth.middleware.js';

export const shopRouter = Router();
shopRouter.use(authRequired);

// 列出所有门店(本期不区分内容可见性,所有人可见)
shopRouter.get('/shops', async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT s.id, s.code, s.name, s.status, b.code AS business_code, b.name AS business_name
       FROM shop s JOIN business b ON b.id=s.business_id ORDER BY s.id`,
    );
    res.json(rows);
  } catch (e) { next(e); }
});
