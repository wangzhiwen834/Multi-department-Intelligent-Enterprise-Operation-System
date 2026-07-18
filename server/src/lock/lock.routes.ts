import { Router } from 'express';
import { authRequired } from '../auth/auth.middleware.js';
import { acquireLock, heartbeat, releaseLock, requestTakeover, yieldLock, getLockStatus } from './lock.service.js';

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

// 请求接管(两阶段:登记请求,原持有者保存后让出)
lockRouter.post('/workbooks/:id/locks/:sheetKey/takeover', async (req, res, next) => {
  try {
    const r = await requestTakeover(Number(req.params.id), req.params.sheetKey, req.user!);
    res.status(r.acquired ? 201 : 200).json(r);
  } catch (e) { next(e); }
});

// 让出(持有者保存后让给接管请求者)
lockRouter.post('/workbooks/:id/locks/:sheetKey/yield', async (req, res, next) => {
  try {
    const r = await yieldLock(Number(req.params.id), req.params.sheetKey, req.user!);
    res.status(r.yielded ? 200 : 409).json(r);
  } catch (e) { next(e); }
});
