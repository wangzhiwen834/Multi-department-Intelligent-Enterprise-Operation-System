import type { Request, Response, NextFunction } from 'express';
import { logOperation } from './audit.log.js';

// 在路由上挂载:响应结束后按状态码记 success/failed
export const auditLog = (action: string) => (req: Request, res: Response, next: NextFunction) => {
  res.on('finish', () => {
    const ok = res.statusCode >= 200 && res.statusCode < 400;
    void logOperation({
      userId: req.user?.id ?? null,
      userName: req.user?.username ?? null,
      ip: req.ip ?? '',
      action,
      target: req.params.id ?? req.path,
      result: ok ? 'success' : 'failed',
    });
  });
  next();
};
