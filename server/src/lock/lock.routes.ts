import { Router } from 'express';
import { authRequired } from '../auth/auth.middleware.js';
import { acquireLock, heartbeat, releaseLock, takeoverLock, getLockStatus } from './lock.service.js';

export const lockRouter = Router();
lockRouter.use(authRequired);

// 锁状态
lockRouter.get('/workbooks/:id/locks/:sheetKey', async (req, res, next) => {
  try {
    const st = await getLockStatus(Number(req.params.id), req.params.sheetKey);
    res.json(st ?? { held: false });
  } catch (e) { next(e); }
});

// 占锁
lockRouter.post('/workbooks/:id/locks/:sheetKey', async (req, res, next) => {
  try {
    const r = await acquireLock(Number(req.params.id), req.params.sheetKey, req.user!);
    res.status(r.acquired ? 201 : 409).json(r);
  } catch (e) { next(e); }
});

// 心跳续约
lockRouter.put('/workbooks/:id/locks/:sheetKey', async (req, res, next) => {
  try {
    const r = await heartbeat(Number(req.params.id), req.params.sheetKey, req.user!);
    res.status(r.renewed ? 200 : 409).json(r);
  } catch (e) { next(e); }
});

// 释放
lockRouter.delete('/workbooks/:id/locks/:sheetKey', async (req, res, next) => {
  try {
    const r = await releaseLock(Number(req.params.id), req.params.sheetKey, req.user!);
    res.json(r);
  } catch (e) { next(e); }
});

// 强制接管
lockRouter.post('/workbooks/:id/locks/:sheetKey/takeover', async (req, res, next) => {
  try {
    const r = await takeoverLock(Number(req.params.id), req.params.sheetKey, req.user!);
    res.status(r.acquired ? 201 : 409).json(r);
  } catch (e) { next(e); }
});
