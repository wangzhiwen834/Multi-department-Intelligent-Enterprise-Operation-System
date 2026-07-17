import { Router } from 'express';
import { authRequired } from '../auth/auth.middleware.js';
import { syncWorkbook } from './sync.service.js';

export const syncRouter = Router();
syncRouter.use(authRequired);

syncRouter.post('/workbooks/:id/sync', async (req, res, next) => {
  try {
    const r = await syncWorkbook(Number(req.params.id), req.body, req.user!);
    if (!r.ok) return res.status(r.status).json({ error: r.error });
    res.json({ autoSums: r.autoSums, errors: r.errors });
  } catch (e) { next(e); }
});
