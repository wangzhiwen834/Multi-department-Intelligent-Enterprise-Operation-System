import { Router } from 'express';
import { query } from '../db/pool.js';
import { authRequired } from '../auth/auth.middleware.js';

export const templateRouter = Router();
templateRouter.use(authRequired);

templateRouter.get('/templates', async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT t.id, b.code AS business_code, b.name AS business_name, t.version, t.created_at
       FROM template t JOIN business b ON b.id=t.business_id
       ORDER BY b.code, t.version DESC`,
    );
    res.json(rows);
  } catch (e) { next(e); }
});

templateRouter.get('/templates/:businessCode', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT t.id, b.code AS business_code, t.version, t.definition
       FROM template t JOIN business b ON b.id=t.business_id
       WHERE b.code=$1 ORDER BY t.version DESC LIMIT 1`,
      [req.params.businessCode],
    );
    if (!rows.length) return res.status(404).json({ error: 'template not found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});
