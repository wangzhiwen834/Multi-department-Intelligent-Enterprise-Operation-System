import { Router } from 'express';
import { authRequired } from '../auth/auth.middleware.js';
import { syncWorkbook } from './sync.service.js';
import { isLockHolder } from '../lock/lock.service.js';

export const syncRouter = Router();
syncRouter.use(authRequired);

syncRouter.post('/workbooks/:id/sync', async (req, res, next) => {
  try {
    if (!await isLockHolder(Number(req.params.id), req.user!.id))
      return res.status(409).json({ error: '锁已丢失(被他人接管或过期),同步被拒绝,请重载工作簿' });
    const r = await syncWorkbook(Number(req.params.id), req.body, req.user!);
    if (!r.ok) return res.status(r.status).json({ error: r.error });
    res.json({ autoSums: r.autoSums, errors: r.errors });
  } catch (e) { next(e); }
});
